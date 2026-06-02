/**
 * UsageMeter — Sprint O.0.2 Phase 4.
 *
 * Single ledger writer. Every chargeable action MUST go through
 * `recordUsage`. The meter:
 *
 *   1. Writes a row to `economic.usage_events`.
 *   2. Increments the user's `economic.user_budgets.current_*` windows.
 *   3. Increments `economic.platform_budget.current_monthly_micros`.
 *   4. Returns the post-write status (whether the user is now in
 *      WARNING / THROTTLED / BLOCKED).
 *
 * The meter is best-effort on the audit row but STRICT on the budget
 * counters — the counters drive future throttle/block decisions.
 */

import type { BudgetStatus, CostDimension, PlatformStatus } from './types';
import { PLATFORM_THRESHOLDS } from './types';

export interface RecordUsageInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user_id: string;
  tenant_id?: string | null;
  feature: string;
  provider?: string;
  model?: string;
  cost_dimension: CostDimension;
  units: number;
  unit_label?: string;
  cost_usd_micros: number;
  request_id?: string;
  governance_audit_id?: string;
  job_id?: string;
  estimated_micros?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordUsageResult {
  ok: boolean;
  usage_event_id?: string;
  /** Per-user status after this write. */
  user_status: BudgetStatus;
  /** Platform status after this write. */
  platform_status: PlatformStatus;
}

export async function recordUsage(inputs: RecordUsageInputs): Promise<RecordUsageResult> {
  const sb = inputs.supabase;
  const now = new Date().toISOString();
  const estimation_error =
    inputs.estimated_micros && inputs.estimated_micros > 0
      ? Math.round(
          ((inputs.cost_usd_micros - inputs.estimated_micros) / inputs.estimated_micros) * 10_000
        ) / 10_000
      : null;

  // 1. Append the ledger row.
  let usage_event_id: string | undefined;
  try {
    const ins = await sb
      .from('economic_usage_events')
      .insert({
        user_id: inputs.user_id,
        tenant_id: inputs.tenant_id ?? null,
        feature: inputs.feature,
        provider: inputs.provider ?? null,
        model: inputs.model ?? null,
        cost_dimension: inputs.cost_dimension,
        units: inputs.units,
        unit_label: inputs.unit_label ?? null,
        cost_usd_micros: Math.max(0, Math.round(inputs.cost_usd_micros)),
        request_id: inputs.request_id ?? null,
        governance_audit_id: inputs.governance_audit_id ?? null,
        job_id: inputs.job_id ?? null,
        estimated_micros: inputs.estimated_micros ?? null,
        estimation_error,
        metadata: inputs.metadata ?? {},
        created_at: now,
      })
      .select('id')
      .single();
    usage_event_id = ins?.data?.id;
  } catch {
    /* meter is best-effort on the audit; budgets still update */
  }

  // 2. Increment the user budget windows + read post-state.
  const userStatus = await incrementUserBudget(sb, inputs.user_id, inputs.cost_usd_micros);

  // 3. Increment the platform budget + read post-state.
  const platformStatus = await incrementPlatformBudget(sb, inputs.cost_usd_micros);

  return {
    ok: true,
    usage_event_id,
    user_status: userStatus,
    platform_status: platformStatus,
  };
}

// ---------------------------------------------------------------------------
// User-budget increment
// ---------------------------------------------------------------------------

async function incrementUserBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  user_id: string,
  cost_micros: number
): Promise<BudgetStatus> {
  try {
    // Read current row.
    const r = await sb
      .from('economic_user_budgets')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();
    if (r.error || !r.data) {
      // No budget configured — treat as ACTIVE; the BudgetManager
      // creates the row lazily.
      return 'ACTIVE';
    }
    const row = r.data;
    const next = applyWindows(row, cost_micros);
    const status = nextUserStatus(next);
    await sb
      .from('economic_user_budgets')
      .update({
        current_daily_micros: next.current_daily_micros,
        current_weekly_micros: next.current_weekly_micros,
        current_monthly_micros: next.current_monthly_micros,
        daily_window_start: next.daily_window_start,
        weekly_window_start: next.weekly_window_start,
        monthly_window_start: next.monthly_window_start,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);
    return status;
  } catch {
    return 'ACTIVE';
  }
}

interface BudgetRow {
  daily_budget_micros: number;
  weekly_budget_micros: number;
  monthly_budget_micros: number;
  current_daily_micros: number;
  current_weekly_micros: number;
  current_monthly_micros: number;
  daily_window_start: string;
  weekly_window_start: string;
  monthly_window_start: string;
  operator_override: boolean;
}

/**
 * Roll the daily/weekly/monthly windows when they're stale, then
 * add `cost_micros` to the relevant counters.
 */
export function applyWindows(row: BudgetRow, cost_micros: number): BudgetRow {
  const today = todayUtc();
  const week_start = weekStartUtc();
  const month_start = monthStartUtc();
  const next = { ...row };
  if (next.daily_window_start !== today) {
    next.daily_window_start = today;
    next.current_daily_micros = 0;
  }
  if (next.weekly_window_start !== week_start) {
    next.weekly_window_start = week_start;
    next.current_weekly_micros = 0;
  }
  if (next.monthly_window_start !== month_start) {
    next.monthly_window_start = month_start;
    next.current_monthly_micros = 0;
  }
  next.current_daily_micros += Math.max(0, Math.round(cost_micros));
  next.current_weekly_micros += Math.max(0, Math.round(cost_micros));
  next.current_monthly_micros += Math.max(0, Math.round(cost_micros));
  return next;
}

/**
 * Per-user status transitions:
 *   ≥ 100% of any window → BLOCKED
 *   ≥ 90%  → THROTTLED
 *   ≥ 75%  → WARNING
 *   else   → ACTIVE
 * Operator override skips THROTTLED and BLOCKED (stays WARNING).
 */
export function nextUserStatus(row: BudgetRow): BudgetStatus {
  const fractions = [
    row.daily_budget_micros > 0 ? row.current_daily_micros / row.daily_budget_micros : 0,
    row.weekly_budget_micros > 0 ? row.current_weekly_micros / row.weekly_budget_micros : 0,
    row.monthly_budget_micros > 0 ? row.current_monthly_micros / row.monthly_budget_micros : 0,
  ];
  const max = Math.max(...fractions, 0);
  if (max >= 1) return row.operator_override ? 'WARNING' : 'BLOCKED';
  if (max >= 0.9) return row.operator_override ? 'WARNING' : 'THROTTLED';
  if (max >= 0.75) return 'WARNING';
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Platform-budget increment
// ---------------------------------------------------------------------------

async function incrementPlatformBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  cost_micros: number
): Promise<PlatformStatus> {
  try {
    const r = await sb
      .from('economic_platform_budget')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();
    if (r.error || !r.data) return 'NORMAL';
    const row = r.data;
    const current_month = monthStartUtc();
    let next_monthly = row.current_monthly_micros;
    let next_window = row.monthly_window_start;
    if (next_window !== current_month) {
      next_window = current_month;
      next_monthly = 0;
    }
    next_monthly += Math.max(0, Math.round(cost_micros));
    const status = nextPlatformStatus(row.monthly_cap_micros, next_monthly, row.operator_override);

    await sb
      .from('economic_platform_budget')
      .update({
        current_monthly_micros: next_monthly,
        monthly_window_start: next_window,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'singleton');
    return status;
  } catch {
    return 'NORMAL';
  }
}

export function nextPlatformStatus(
  cap_micros: number,
  current_micros: number,
  operator_override: boolean
): PlatformStatus {
  if (cap_micros <= 0) return 'NORMAL';
  const pct = (current_micros / cap_micros) * 100;
  if (pct >= 100) return operator_override ? 'EMERGENCY' : 'HARD_STOP';
  // Highest threshold whose pct boundary we've crossed.
  let best: PlatformStatus = 'NORMAL';
  for (const t of PLATFORM_THRESHOLDS) {
    if (pct >= t.pct) best = t.status;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC; deterministic for tests via dependency injection if needed)
// ---------------------------------------------------------------------------

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
function weekStartUtc(): string {
  // ISO week starts Monday.
  const d = new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}
function monthStartUtc(): string {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

export const __test = {
  applyWindows,
  nextUserStatus,
  nextPlatformStatus,
  todayUtc,
  weekStartUtc,
  monthStartUtc,
};
