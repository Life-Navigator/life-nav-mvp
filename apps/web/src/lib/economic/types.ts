/**
 * Economic-governance shared types.
 *
 * All monetary values are integer micro-USD (1 USD = 1,000,000 micros).
 * Money never flows through `number` math without this normalization.
 */

export type BudgetStatus = 'ACTIVE' | 'WARNING' | 'THROTTLED' | 'BLOCKED';
export type PlatformStatus =
  | 'NORMAL'
  | 'INFORMATIONAL'
  | 'ALERT'
  | 'HIGH_ALERT'
  | 'EMERGENCY'
  | 'HARD_STOP';
export type RateScope =
  | 'chat'
  | 'upload'
  | 'simulation'
  | 'arcana'
  | 'enterprise_api'
  | 'governance_review';
export type CostDimension =
  | 'text_input'
  | 'text_output'
  | 'embedding'
  | 'vision_image'
  | 'speech_minute'
  | 'video_minute'
  | 'storage_gb_month'
  | 'tool_call'
  | 'other';
export type BreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';
export type AbuseKind =
  | 'prompt_flooding'
  | 'upload_flooding'
  | 'cost_farming'
  | 'automation'
  | 'retry_abuse'
  | 'token_burn'
  | 'api_abuse';
export type AbuseAction = 'WARN' | 'THROTTLE' | 'BLOCK' | 'REVIEW';
export type AbuseSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

/** A bound budget envelope for one (user, tenant). */
export interface UserBudget {
  user_id: string;
  tenant_id?: string | null;
  daily_budget_micros: number;
  weekly_budget_micros: number;
  monthly_budget_micros: number;
  current_daily_micros: number;
  current_weekly_micros: number;
  current_monthly_micros: number;
  status: BudgetStatus;
  operator_override: boolean;
}

export interface PlatformBudget {
  monthly_cap_micros: number;
  current_monthly_micros: number;
  status: PlatformStatus;
  last_threshold_notified: number;
  operator_override: boolean;
}

export interface RateBucket {
  scope: RateScope;
  user_id?: string | null;
  tenant_id?: string | null;
  capacity: number;
  refill_per_minute: number;
  tokens_remaining: number;
  daily_capacity?: number | null;
  daily_used: number;
  daily_window_start: string;
  last_refill_at: string;
}

/** Constants used by helpers + tests. */
export const MICROS_PER_USD = 1_000_000;

/**
 * Internal-beta default caps (per user).
 *
 * Raised from $1/$5/$20 after the cost-estimator alias fix: at the corrected
 * ~$0.00035/turn for gemini-2.5-flash, $4/day = ~11,400 chat turns/day of
 * headroom so a heavy beta session never hits a premature 429, while the
 * per-user weekly/monthly ceilings and the $500 platform cap (unchanged)
 * remain as runaway backstops. The original 1:5:20 daily:weekly:monthly
 * ratio is preserved so the daily cap stays the meaningful per-session limit.
 */
export const BETA_USER_BUDGET_DEFAULTS = Object.freeze({
  daily_micros: 4 * MICROS_PER_USD, // $4
  weekly_micros: 20 * MICROS_PER_USD, // $20
  monthly_micros: 80 * MICROS_PER_USD, // $80
});

/** Internal-beta default platform cap. */
export const BETA_PLATFORM_BUDGET_DEFAULT = Object.freeze({
  monthly_cap_micros: 500 * MICROS_PER_USD, // $500
});

/** Threshold percentages (informational / alert / high / emergency / hard-stop). */
export const PLATFORM_THRESHOLDS = Object.freeze([
  { pct: 50, status: 'INFORMATIONAL' as PlatformStatus },
  { pct: 75, status: 'ALERT' as PlatformStatus },
  { pct: 90, status: 'HIGH_ALERT' as PlatformStatus },
  { pct: 95, status: 'EMERGENCY' as PlatformStatus },
  { pct: 100, status: 'HARD_STOP' as PlatformStatus },
]);

/** Default rate-limit policy for internal beta. */
export const BETA_RATE_LIMITS: Record<
  RateScope,
  {
    capacity: number;
    refill_per_minute: number;
    daily_capacity?: number;
    enabled_by_default: boolean;
  }
> = Object.freeze({
  chat: { capacity: 30, refill_per_minute: 1, daily_capacity: 100, enabled_by_default: true },
  upload: { capacity: 5, refill_per_minute: 1, daily_capacity: 20, enabled_by_default: true },
  simulation: { capacity: 5, refill_per_minute: 1, daily_capacity: 20, enabled_by_default: true },
  arcana: { capacity: 5, refill_per_minute: 1, daily_capacity: 20, enabled_by_default: true },
  governance_review: { capacity: 60, refill_per_minute: 2, enabled_by_default: true },
  enterprise_api: {
    capacity: 50,
    refill_per_minute: 5,
    daily_capacity: 500,
    enabled_by_default: false,
  },
});
