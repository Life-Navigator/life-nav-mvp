/**
 * Type Definitions
 * =============================================================================
 * Types for risk-engine API (aligned with Pydantic schemas)
 */

import { z } from 'zod';

// ===========================================================================
// Enums
// ===========================================================================

export enum GoalType {
  RETIREMENT = 'retirement',
  HOME_PURCHASE = 'home_purchase',
  EDUCATION = 'education',
  EMERGENCY_FUND = 'emergency_fund',
  VACATION = 'vacation',
  DEBT_PAYOFF = 'debt_payoff',
  MAJOR_PURCHASE = 'major_purchase',
  BUSINESS = 'business',
}

export enum MarketRegime {
  BULL_LOW_VOL = 'bull_low_vol',
  BULL_HIGH_VOL = 'bull_high_vol',
  BEAR_LOW_VOL = 'bear_low_vol',
  BEAR_HIGH_VOL = 'bear_high_vol',
  SIDEWAYS = 'sideways',
}

export enum ComputeMode {
  FAST = 'fast', // 1k sims, 5s cache
  BALANCED = 'balanced', // 5k sims, 30s cache
  FULL = 'full', // 25k sims, 300s cache
  DETERMINISTIC = 'deterministic', // Seeded
}

export enum RecommendationCategory {
  SAVE_MORE = 'save_more',
  REDUCE_GOAL = 'reduce_goal',
  DELAY_GOAL = 'delay_goal',
  REDUCE_RISK = 'reduce_risk',
  INCREASE_RISK = 'increase_risk',
  REDUCE_SPENDING = 'reduce_spending',
}

// ===========================================================================
// Request Types
// ===========================================================================

export interface Goal {
  id: string;
  type: GoalType;
  target_value: number;
  target_date: string; // ISO date
  priority: number; // 1-10
  current_allocated: number;
  name?: string;
}

export interface RiskComputeRequest {
  goal_context: {
    goals: Goal[];
  };
  mode: ComputeMode;
  overrides?: {
    force_recompute?: boolean;
    skip_cache?: boolean;
  };
  call_context?: {
    api_version?: string;
    client_type?: string;
    feature_flags?: Record<string, boolean>;
  };
}

// ===========================================================================
// Response Types
// ===========================================================================

export interface OverallRisk {
  win_probability: number; // 0-1
  loss_probability: number;
  partial_success_probability: number;
  confidence_interval_95: [number, number];
}

export interface GoalResult {
  goal_id: string;
  success_probability: number; // 0-1
  expected_shortfall: number;
  expected_delay_months: number;
  value_at_risk_5pct: number;
  primary_driver: string;
  driver_impact_pct: number;
}

export interface Driver {
  name: string;
  category: 'market' | 'household' | 'goal' | 'portfolio';
  impact_on_success_pct: number; // -1 to 1
  confidence: number; // 0-1
}

export interface RecommendedAction {
  action: string;
  category: RecommendationCategory;
  expected_improvement_pct: number;
  tradeoff: string;
  confidence: number;
}

export interface TimeSeriesPoint {
  timestamp: number; // Unix timestamp
  year: number;
  month?: number;
  value: number;
  label?: string;
}

export interface PercentileBand {
  timestamp: number;
  year: number;
  month?: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface TimeSeries {
  name: string;
  unit: string; // "$", "%", etc.
  data: TimeSeriesPoint[];
  percentile_bands?: PercentileBand[];
  chart_type: 'line' | 'area' | 'bar';
  color?: string;
}

export interface RiskResponse {
  meta: {
    computed_at: string;
    cache_hit: boolean;
    compute_time_ms: number;
  };
  overall: OverallRisk;
  per_goal: GoalResult[];
  series_payload: {
    portfolio_value_series: TimeSeries;
    goal_progress_series: TimeSeries[];
    cashflow_series?: TimeSeries;
  };
  drivers: Driver[];
  recommended_actions: RecommendedAction[];
}

// ===========================================================================
// Stream Types
// ===========================================================================

export enum StreamEventType {
  SNAPSHOT = 'snapshot',
  DELTA = 'delta',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  COMPLETE = 'complete',
}

export enum ReasonCode {
  MARKET_REGIME_CHANGED = 'market_regime_changed',
  PORTFOLIO_CHANGED = 'portfolio_changed',
  SPENDING_CHANGED = 'spending_changed',
  RISK_PROFILE_UPDATED = 'risk_profile_updated',
  GOAL_UPDATED = 'goal_updated',
  SIMULATION_PROGRESS = 'simulation_progress',
  COMPUTATION_COMPLETE = 'computation_complete',
}

export interface WinLossDelta {
  goal_id: string;
  previous_success_probability: number;
  new_success_probability: number;
  delta_pct: number;
}

export interface StreamDelta {
  win_loss_deltas: WinLossDelta[];
  updated_series?: Record<string, any>;
  reason_codes: ReasonCode[];
  material_change: boolean;
  change_magnitude: number;
}

export interface StreamEvent {
  event_type: StreamEventType;
  sequence: number;
  timestamp: string;
  snapshot?: RiskResponse;
  delta?: StreamDelta;
  progress_pct?: number;
  error_message?: string;
}

// ===========================================================================
// Zod Schemas (for runtime validation)
// ===========================================================================

export const GoalSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(GoalType),
  target_value: z.number().positive(),
  target_date: z.string(),
  priority: z.number().int().min(1).max(10),
  current_allocated: z.number().nonnegative(),
  name: z.string().optional(),
});

export const RiskComputeRequestSchema = z.object({
  goal_context: z.object({
    goals: z.array(GoalSchema).min(1).max(20),
  }),
  mode: z.nativeEnum(ComputeMode),
  overrides: z
    .object({
      force_recompute: z.boolean().optional(),
      skip_cache: z.boolean().optional(),
    })
    .optional(),
  call_context: z
    .object({
      api_version: z.string().optional(),
      client_type: z.string().optional(),
      feature_flags: z.record(z.boolean()).optional(),
    })
    .optional(),
});

export const RiskResponseSchema = z.object({
  meta: z.object({
    computed_at: z.string(),
    cache_hit: z.boolean(),
    compute_time_ms: z.number(),
  }),
  overall: z.object({
    win_probability: z.number().min(0).max(1),
    loss_probability: z.number().min(0).max(1),
    partial_success_probability: z.number().min(0).max(1),
    confidence_interval_95: z.tuple([z.number(), z.number()]),
  }),
  per_goal: z.array(
    z.object({
      goal_id: z.string(),
      success_probability: z.number().min(0).max(1),
      expected_shortfall: z.number(),
      expected_delay_months: z.number().int().nonnegative(),
      value_at_risk_5pct: z.number(),
      primary_driver: z.string(),
      driver_impact_pct: z.number(),
    })
  ),
  series_payload: z.object({
    portfolio_value_series: z.any(),
    goal_progress_series: z.array(z.any()),
    cashflow_series: z.any().optional(),
  }),
  drivers: z.array(z.any()),
  recommended_actions: z.array(z.any()),
});
