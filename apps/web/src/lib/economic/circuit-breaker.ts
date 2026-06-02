/**
 * CircuitBreaker — Sprint O.0.2 Phase 10.
 *
 * Per-feature breaker with three states:
 *
 *   CLOSED     — calls pass through; failures increment counter.
 *   OPEN       — calls are degraded / queued / disabled / shutdown.
 *   HALF_OPEN  — after `retry_at`, the next call is allowed through;
 *                success closes the breaker, failure re-opens.
 *
 * Triggers:
 *
 *   recordFailure(feature, reason)          → increments counter; opens on threshold.
 *   forceOpen(feature, reason, action)      → opens immediately (used by AbuseDetector + BudgetManager).
 *   evaluate(feature)                        → returns the current verdict.
 *
 * Storage: `economic.circuit_breakers`.
 */

import type { BreakerState } from './types';

export type BreakerVerdict = 'PASS' | 'DEGRADE' | 'QUEUE' | 'DISABLED' | 'SHUTDOWN';

export interface BreakerRow {
  feature: string;
  state: BreakerState;
  trigger_reason: string | null;
  failure_count: number;
  failure_threshold: number;
  opened_at: string | null;
  retry_at: string | null;
  open_action: string;
  operator_override: boolean;
}

/** Default action while OPEN, per feature. */
const DEFAULT_OPEN_ACTION: Record<string, BreakerVerdict> = {
  'provider.gemini': 'DEGRADE',
  'provider.openai': 'DEGRADE',
  'provider.anthropic': 'DEGRADE',
  'upload.vision': 'DISABLED',
  'upload.speech': 'DISABLED',
  'upload.video': 'DISABLED',
  chat: 'QUEUE',
  enterprise_api: 'DISABLED',
  governance_review: 'PASS', // never break governance
};

/** Default retry window after opening (ms). */
const DEFAULT_RETRY_MS = 60_000;

export interface EvaluateInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  feature: string;
}

export async function evaluate(
  inputs: EvaluateInputs
): Promise<{ verdict: BreakerVerdict; state: BreakerState; reason?: string }> {
  const row = await read(inputs.supabase, inputs.feature);
  if (!row || row.state === 'CLOSED') return { verdict: 'PASS', state: 'CLOSED' };
  if (row.state === 'HALF_OPEN')
    return { verdict: 'PASS', state: 'HALF_OPEN', reason: row.trigger_reason ?? undefined };
  // OPEN — but check if it's time to try recovery.
  if (row.retry_at && new Date(row.retry_at).getTime() <= Date.now()) {
    await transition(inputs.supabase, inputs.feature, 'HALF_OPEN', row.trigger_reason ?? null);
    return { verdict: 'PASS', state: 'HALF_OPEN' };
  }
  const verdict =
    DEFAULT_OPEN_ACTION[inputs.feature] ?? (row.open_action as BreakerVerdict) ?? 'DEGRADE';
  return { verdict, state: 'OPEN', reason: row.trigger_reason ?? undefined };
}

export interface RecordOutcomeInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  feature: string;
  outcome: 'success' | 'failure';
  failure_threshold?: number;
  retry_ms?: number;
  reason?: string;
}

export async function recordOutcome(inputs: RecordOutcomeInputs): Promise<void> {
  const row = await read(inputs.supabase, inputs.feature, true);
  if (!row) return;
  if (inputs.outcome === 'success') {
    if (row.state === 'HALF_OPEN') {
      await transition(inputs.supabase, inputs.feature, 'CLOSED', null, { failure_count: 0 });
    } else if (row.state === 'CLOSED' && row.failure_count > 0) {
      await transition(inputs.supabase, inputs.feature, 'CLOSED', null, { failure_count: 0 });
    }
    return;
  }
  // failure
  const new_count = row.failure_count + 1;
  const threshold = inputs.failure_threshold ?? row.failure_threshold;
  if (new_count >= threshold) {
    const retry_at = new Date(Date.now() + (inputs.retry_ms ?? DEFAULT_RETRY_MS)).toISOString();
    await transition(
      inputs.supabase,
      inputs.feature,
      'OPEN',
      inputs.reason ?? row.trigger_reason ?? 'failure_threshold_reached',
      {
        failure_count: new_count,
        opened_at: new Date().toISOString(),
        retry_at,
      }
    );
  } else {
    await transition(inputs.supabase, inputs.feature, row.state, row.trigger_reason ?? null, {
      failure_count: new_count,
    });
  }
}

export async function forceOpen(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  feature: string,
  reason: string,
  open_action: BreakerVerdict = 'DEGRADE',
  retry_ms = DEFAULT_RETRY_MS
): Promise<void> {
  const retry_at = new Date(Date.now() + retry_ms).toISOString();
  await ensure(supabase, feature);
  await transition(supabase, feature, 'OPEN', reason, {
    opened_at: new Date().toISOString(),
    retry_at,
    open_action,
  });
}

export async function reset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  feature: string
): Promise<void> {
  await transition(supabase, feature, 'CLOSED', null, {
    failure_count: 0,
    opened_at: null,
    retry_at: null,
  });
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function read(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  feature: string,
  create_if_missing = false
): Promise<BreakerRow | null> {
  try {
    const r = await sb
      .from('economic_circuit_breakers')
      .select('*')
      .eq('feature', feature)
      .maybeSingle();
    if (r.data) return r.data as BreakerRow;
    if (create_if_missing) {
      await ensure(sb, feature);
      const r2 = await sb
        .from('economic_circuit_breakers')
        .select('*')
        .eq('feature', feature)
        .maybeSingle();
      return (r2.data as BreakerRow) ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function ensure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  feature: string
): Promise<void> {
  try {
    await sb.from('economic_circuit_breakers').insert({
      feature,
      state: 'CLOSED',
      open_action: DEFAULT_OPEN_ACTION[feature] ?? 'degrade',
    });
  } catch {
    /* concurrent insert ignored */
  }
}

async function transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  feature: string,
  state: BreakerState,
  reason: string | null,
  extra: Record<string, unknown> = {}
): Promise<void> {
  try {
    await sb
      .from('economic_circuit_breakers')
      .update({
        state,
        trigger_reason: reason,
        updated_at: new Date().toISOString(),
        ...extra,
      })
      .eq('feature', feature);
  } catch {
    /* ignore */
  }
}

export const __test = { DEFAULT_OPEN_ACTION, DEFAULT_RETRY_MS };
