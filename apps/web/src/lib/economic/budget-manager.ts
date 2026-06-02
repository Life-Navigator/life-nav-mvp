/**
 * BudgetManager — Sprint O.0.2 Phase 2 + 3.
 *
 * Pre-call decisions:
 *   evaluate({ user_id, estimated_micros }) → { allowed, reason, advice }
 *
 * Post-call writes go through `recordUsage`; the BudgetManager only
 * READS state to make the call/no-call decision.
 */

import { BETA_USER_BUDGET_DEFAULTS, type BudgetStatus, type PlatformStatus } from './types';

export interface EvaluateInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user_id: string;
  estimated_micros: number;
  tenant_id?: string | null;
}

export type EvaluationVerdict = 'ALLOW' | 'WARN' | 'THROTTLE' | 'BLOCK' | 'HARD_STOP';

export interface EvaluationResult {
  verdict: EvaluationVerdict;
  reason?: string;
  user_status: BudgetStatus;
  platform_status: PlatformStatus;
  /** Operator-visible diagnostics — % of each cap projected after this call. */
  projected_pct: {
    user_daily: number;
    user_weekly: number;
    user_monthly: number;
    platform_monthly: number;
  };
}

export async function evaluate(inputs: EvaluateInputs): Promise<EvaluationResult> {
  const sb = inputs.supabase;
  const cost = Math.max(0, Math.round(inputs.estimated_micros));

  const userBudget = await ensureUserBudget(sb, inputs.user_id, inputs.tenant_id ?? null);
  const platform = await readPlatformBudget(sb);

  const projected_user_daily = userBudget.current_daily_micros + cost;
  const projected_user_weekly = userBudget.current_weekly_micros + cost;
  const projected_user_monthly = userBudget.current_monthly_micros + cost;
  const projected_platform = platform.current_monthly_micros + cost;

  const projected_pct = {
    user_daily: pct(projected_user_daily, userBudget.daily_budget_micros),
    user_weekly: pct(projected_user_weekly, userBudget.weekly_budget_micros),
    user_monthly: pct(projected_user_monthly, userBudget.monthly_budget_micros),
    platform_monthly: pct(projected_platform, platform.monthly_cap_micros),
  };

  // ---- Hardest gate first: platform HARD_STOP -----------------------------
  if (projected_pct.platform_monthly >= 100 && !platform.operator_override) {
    return {
      verdict: 'HARD_STOP',
      reason: 'platform_monthly_cap_reached',
      user_status: userBudget.status,
      platform_status: 'HARD_STOP',
      projected_pct,
    };
  }
  // Platform EMERGENCY (≥95%) — only urgent features should pass.
  if (projected_pct.platform_monthly >= 95 && !platform.operator_override) {
    return {
      verdict: 'BLOCK',
      reason: 'platform_emergency_mode',
      user_status: userBudget.status,
      platform_status: 'EMERGENCY',
      projected_pct,
    };
  }

  // ---- Per-user gates -----------------------------------------------------
  const max_user_pct = Math.max(
    projected_pct.user_daily,
    projected_pct.user_weekly,
    projected_pct.user_monthly
  );
  if (max_user_pct >= 100 && !userBudget.operator_override) {
    return {
      verdict: 'BLOCK',
      reason: 'user_budget_exhausted',
      user_status: 'BLOCKED',
      platform_status: platform.status,
      projected_pct,
    };
  }
  if (max_user_pct >= 90 && !userBudget.operator_override) {
    return {
      verdict: 'THROTTLE',
      reason: 'user_budget_near_exhausted',
      user_status: 'THROTTLED',
      platform_status: platform.status,
      projected_pct,
    };
  }
  if (max_user_pct >= 75 || projected_pct.platform_monthly >= 90) {
    return {
      verdict: 'WARN',
      reason: 'budget_warning',
      user_status: 'WARNING',
      platform_status: platform.status,
      projected_pct,
    };
  }

  return {
    verdict: 'ALLOW',
    user_status: 'ACTIVE',
    platform_status: platform.status,
    projected_pct,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((num / denom) * 10_000) / 100; // 2 decimal places
}

interface UserBudgetRow {
  user_id: string;
  daily_budget_micros: number;
  weekly_budget_micros: number;
  monthly_budget_micros: number;
  current_daily_micros: number;
  current_weekly_micros: number;
  current_monthly_micros: number;
  status: BudgetStatus;
  operator_override: boolean;
}

async function ensureUserBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  user_id: string,
  tenant_id: string | null
): Promise<UserBudgetRow> {
  try {
    const r = await sb
      .from('economic_user_budgets')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();
    if (r.data) return r.data as UserBudgetRow;
  } catch {
    /* fall through */
  }
  // Lazy-create with internal-beta defaults.
  try {
    await sb.from('economic_user_budgets').insert({
      user_id,
      tenant_id,
      daily_budget_micros: BETA_USER_BUDGET_DEFAULTS.daily_micros,
      weekly_budget_micros: BETA_USER_BUDGET_DEFAULTS.weekly_micros,
      monthly_budget_micros: BETA_USER_BUDGET_DEFAULTS.monthly_micros,
    });
  } catch {
    /* ignore — concurrent insert */
  }
  return {
    user_id,
    daily_budget_micros: BETA_USER_BUDGET_DEFAULTS.daily_micros,
    weekly_budget_micros: BETA_USER_BUDGET_DEFAULTS.weekly_micros,
    monthly_budget_micros: BETA_USER_BUDGET_DEFAULTS.monthly_micros,
    current_daily_micros: 0,
    current_weekly_micros: 0,
    current_monthly_micros: 0,
    status: 'ACTIVE',
    operator_override: false,
  };
}

interface PlatformBudgetRow {
  monthly_cap_micros: number;
  current_monthly_micros: number;
  status: PlatformStatus;
  operator_override: boolean;
}

async function readPlatformBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any
): Promise<PlatformBudgetRow> {
  try {
    const r = await sb
      .from('economic_platform_budget')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();
    if (r.data) return r.data as PlatformBudgetRow;
  } catch {
    /* fall through */
  }
  return {
    monthly_cap_micros: 500_000_000,
    current_monthly_micros: 0,
    status: 'NORMAL',
    operator_override: false,
  };
}

export const __test = { ensureUserBudget, readPlatformBudget, pct };
