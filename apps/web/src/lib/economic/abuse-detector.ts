/**
 * AbuseDetector — Sprint O.0.2 Phase 9.
 *
 * Reads recent activity from `economic.usage_events` +
 * `ingestion.files` + `analytics.user_events` and scores common
 * abuse patterns. The scorer is pure: it accepts a `Signal` snapshot
 * and returns a verdict.
 *
 * Signals are gathered by `gatherSignals()` from production DB; the
 * scorer is unit-tested with deterministic snapshots.
 */

import type { AbuseAction, AbuseKind, AbuseSeverity } from './types';

export interface AbuseSignal {
  /** Number of chat messages emitted in the last hour. */
  chat_messages_1h: number;
  /** Number of file uploads in the last 1h / 24h. */
  uploads_1h: number;
  uploads_24h: number;
  /** Cumulative cost in micro-USD over last 1h. */
  cost_1h_micros: number;
  /** Cumulative cost in micro-USD over last 24h. */
  cost_24h_micros: number;
  /** Distinct request_ids in last hour — high count + low diversity = automation. */
  distinct_requests_1h: number;
  /** Retries: same request_id seen multiple times in last 5 minutes. */
  retries_5m: number;
  /** Tokens consumed in last hour (sum of token-dimension units). */
  tokens_1h: number;
  /** Whether the user fingerprint looks like a bot UA / headless. */
  bot_score: number; // 0..1
}

export interface AbuseFinding {
  kind: AbuseKind;
  severity: AbuseSeverity;
  action: AbuseAction;
  reason: string;
  evidence: Partial<AbuseSignal>;
}

/** Internal-beta thresholds. */
export const ABUSE_THRESHOLDS = Object.freeze({
  prompt_flooding: {
    messages_1h: 60,
    severity: 'HIGH' as AbuseSeverity,
    action: 'THROTTLE' as AbuseAction,
  },
  upload_flooding: {
    uploads_1h: 20,
    severity: 'HIGH' as AbuseSeverity,
    action: 'THROTTLE' as AbuseAction,
  },
  cost_farming: {
    cost_1h_micros: 1_000_000,
    severity: 'HIGH' as AbuseSeverity,
    action: 'BLOCK' as AbuseAction,
  }, // $1/hr
  automation: {
    distinct_requests_1h: 100,
    bot_score: 0.8,
    severity: 'MODERATE' as AbuseSeverity,
    action: 'REVIEW' as AbuseAction,
  },
  retry_abuse: {
    retries_5m: 10,
    severity: 'MODERATE' as AbuseSeverity,
    action: 'WARN' as AbuseAction,
  },
  token_burn: {
    tokens_1h: 500_000,
    severity: 'HIGH' as AbuseSeverity,
    action: 'THROTTLE' as AbuseAction,
  },
  api_abuse: {
    cost_24h_micros: 10_000_000,
    severity: 'CRITICAL' as AbuseSeverity,
    action: 'BLOCK' as AbuseAction,
  }, // $10/day
});

/**
 * Pure scoring. Returns every finding that fires. Callers pick the
 * worst action and persist all findings to security audit.
 */
export function scoreAbuse(signal: AbuseSignal): AbuseFinding[] {
  const findings: AbuseFinding[] = [];

  if (signal.chat_messages_1h >= ABUSE_THRESHOLDS.prompt_flooding.messages_1h) {
    findings.push({
      kind: 'prompt_flooding',
      severity: ABUSE_THRESHOLDS.prompt_flooding.severity,
      action: ABUSE_THRESHOLDS.prompt_flooding.action,
      reason: `Chat messages (${signal.chat_messages_1h}) exceeded threshold (${ABUSE_THRESHOLDS.prompt_flooding.messages_1h}/hr).`,
      evidence: { chat_messages_1h: signal.chat_messages_1h },
    });
  }
  if (signal.uploads_1h >= ABUSE_THRESHOLDS.upload_flooding.uploads_1h) {
    findings.push({
      kind: 'upload_flooding',
      severity: ABUSE_THRESHOLDS.upload_flooding.severity,
      action: ABUSE_THRESHOLDS.upload_flooding.action,
      reason: `Uploads (${signal.uploads_1h}) exceeded threshold (${ABUSE_THRESHOLDS.upload_flooding.uploads_1h}/hr).`,
      evidence: { uploads_1h: signal.uploads_1h },
    });
  }
  if (signal.cost_1h_micros >= ABUSE_THRESHOLDS.cost_farming.cost_1h_micros) {
    findings.push({
      kind: 'cost_farming',
      severity: ABUSE_THRESHOLDS.cost_farming.severity,
      action: ABUSE_THRESHOLDS.cost_farming.action,
      reason: `Hourly cost ($${(signal.cost_1h_micros / 1_000_000).toFixed(2)}) exceeded threshold.`,
      evidence: { cost_1h_micros: signal.cost_1h_micros },
    });
  }
  if (
    signal.distinct_requests_1h >= ABUSE_THRESHOLDS.automation.distinct_requests_1h ||
    signal.bot_score >= ABUSE_THRESHOLDS.automation.bot_score
  ) {
    findings.push({
      kind: 'automation',
      severity: ABUSE_THRESHOLDS.automation.severity,
      action: ABUSE_THRESHOLDS.automation.action,
      reason: `Automation signals: distinct=${signal.distinct_requests_1h}, bot=${signal.bot_score.toFixed(2)}.`,
      evidence: { distinct_requests_1h: signal.distinct_requests_1h, bot_score: signal.bot_score },
    });
  }
  if (signal.retries_5m >= ABUSE_THRESHOLDS.retry_abuse.retries_5m) {
    findings.push({
      kind: 'retry_abuse',
      severity: ABUSE_THRESHOLDS.retry_abuse.severity,
      action: ABUSE_THRESHOLDS.retry_abuse.action,
      reason: `Retries (${signal.retries_5m}) exceeded threshold in 5 minutes.`,
      evidence: { retries_5m: signal.retries_5m },
    });
  }
  if (signal.tokens_1h >= ABUSE_THRESHOLDS.token_burn.tokens_1h) {
    findings.push({
      kind: 'token_burn',
      severity: ABUSE_THRESHOLDS.token_burn.severity,
      action: ABUSE_THRESHOLDS.token_burn.action,
      reason: `Tokens consumed (${signal.tokens_1h}) exceeded threshold in 1h.`,
      evidence: { tokens_1h: signal.tokens_1h },
    });
  }
  if (signal.cost_24h_micros >= ABUSE_THRESHOLDS.api_abuse.cost_24h_micros) {
    findings.push({
      kind: 'api_abuse',
      severity: ABUSE_THRESHOLDS.api_abuse.severity,
      action: ABUSE_THRESHOLDS.api_abuse.action,
      reason: `Daily cost ($${(signal.cost_24h_micros / 1_000_000).toFixed(2)}) exceeded threshold.`,
      evidence: { cost_24h_micros: signal.cost_24h_micros },
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Signal gathering (production)
// ---------------------------------------------------------------------------

export async function gatherSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  user_id: string
): Promise<AbuseSignal> {
  const since_1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const since_24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since_5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const sig: AbuseSignal = {
    chat_messages_1h: 0,
    uploads_1h: 0,
    uploads_24h: 0,
    cost_1h_micros: 0,
    cost_24h_micros: 0,
    distinct_requests_1h: 0,
    retries_5m: 0,
    tokens_1h: 0,
    bot_score: 0,
  };

  try {
    const r = await supabase
      .from('analytics_user_events')
      .select('event_type')
      .eq('user_id', user_id)
      .gte('occurred_at', since_1h);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sig.chat_messages_1h = (r.data as Array<{ event_type: string }>).filter(
        (x) => x.event_type === 'recommendation_generated'
      ).length;
    }
  } catch {
    /* ignore */
  }
  try {
    const r1 = await supabase
      .from('ingestion_files')
      .select('id')
      .eq('user_id', user_id)
      .gte('created_at', since_1h);
    if (Array.isArray(r1.data)) sig.uploads_1h = r1.data.length;
    const r2 = await supabase
      .from('ingestion_files')
      .select('id')
      .eq('user_id', user_id)
      .gte('created_at', since_24h);
    if (Array.isArray(r2.data)) sig.uploads_24h = r2.data.length;
  } catch {
    /* ignore */
  }
  try {
    const r1 = await supabase
      .from('economic_usage_events')
      .select('cost_usd_micros, units, cost_dimension, request_id')
      .eq('user_id', user_id)
      .gte('created_at', since_1h);
    if (Array.isArray(r1.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = r1.data as Array<{
        cost_usd_micros: number;
        units: number;
        cost_dimension: string;
        request_id: string | null;
      }>;
      sig.cost_1h_micros = rows.reduce((s, x) => s + (x.cost_usd_micros ?? 0), 0);
      sig.tokens_1h = rows
        .filter((x) => x.cost_dimension === 'text_input' || x.cost_dimension === 'text_output')
        .reduce((s, x) => s + (x.units ?? 0), 0);
      sig.distinct_requests_1h = new Set(rows.map((x) => x.request_id).filter(Boolean)).size;
    }
    const r2 = await supabase
      .from('economic_usage_events')
      .select('cost_usd_micros')
      .eq('user_id', user_id)
      .gte('created_at', since_24h);
    if (Array.isArray(r2.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sig.cost_24h_micros = (r2.data as Array<{ cost_usd_micros: number }>).reduce(
        (s, x) => s + (x.cost_usd_micros ?? 0),
        0
      );
    }
    const r3 = await supabase
      .from('economic_usage_events')
      .select('request_id')
      .eq('user_id', user_id)
      .gte('created_at', since_5m);
    if (Array.isArray(r3.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (r3.data as Array<{ request_id: string | null }>)
        .map((x) => x.request_id)
        .filter(Boolean);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id as string, (counts.get(id as string) ?? 0) + 1);
      sig.retries_5m = Math.max(0, ...Array.from(counts.values()).map((n) => n - 1));
    }
  } catch {
    /* ignore */
  }
  return sig;
}

export async function persistAbuseFindings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  user_id: string,
  findings: AbuseFinding[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (findings.length === 0) return;
  try {
    await supabase.from('economic_abuse_events').insert(
      findings.map((f) => ({
        user_id,
        kind: f.kind,
        action_taken: f.action,
        severity: f.severity,
        signal: f.evidence,
        feature: metadata.feature ?? null,
        metadata,
      }))
    );
  } catch {
    /* best-effort */
  }
}
