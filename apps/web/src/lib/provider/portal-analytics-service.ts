/**
 * Portal Analytics Service (Sprint J, Phase 6).
 *
 * Extends the Sprint I `computeProviderAnalytics` with derived
 * effectiveness metrics: client retention, readiness improvement,
 * probability improvement, goal completion, single composite
 * effectiveness score in [0,1].
 *
 * Pure-logic; same input → same output.
 */

import { computeProviderAnalytics } from './analytics-service';
import type { ProviderOutcome, ProviderRecommendation } from '@/types/provider';
import type { ProviderEffectivenessAggregate } from '@/types/provider-portal';

export interface PortalAnalyticsInputs {
  provider_id: string;
  period: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  recommendations: ProviderRecommendation[];
  outcomes: ProviderOutcome[];
  /** Per-client readiness deltas computed by the loader. */
  readiness_deltas?: Array<{ patient_user_id: string; delta: number }>;
  /** Per-client probability deltas computed by the loader. */
  probability_deltas?: Array<{ patient_user_id: string; delta: number }>;
  /** Per-client retention bit (1 = still active, 0 = churned in period). */
  retention?: Array<{ patient_user_id: string; retained: 0 | 1 }>;
  /** Per-client goal-completion bit (1 = completed during period). */
  goal_completions?: Array<{ patient_user_id: string; completed: 0 | 1 }>;
}

function meanOrNull(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));
}

function rate(num: number, den: number): number | null {
  if (den === 0) return null;
  return Number((num / den).toFixed(4));
}

function composeEffectiveness(parts: Array<number | null>): number | null {
  const valid = parts.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(4));
}

export function buildEffectiveness(inputs: PortalAnalyticsInputs): ProviderEffectivenessAggregate {
  const base = computeProviderAnalytics({
    provider_id: inputs.provider_id,
    period: inputs.period,
    period_start: inputs.period_start,
    recommendations: inputs.recommendations,
    outcomes: inputs.outcomes,
  });

  const readiness_improvement_mean = inputs.readiness_deltas
    ? meanOrNull(inputs.readiness_deltas.map((r) => r.delta))
    : null;
  const probability_improvement_mean = inputs.probability_deltas
    ? meanOrNull(inputs.probability_deltas.map((r) => r.delta))
    : null;

  const client_retention_rate = inputs.retention
    ? rate(inputs.retention.filter((r) => r.retained === 1).length, inputs.retention.length)
    : null;
  const goal_completion_rate = inputs.goal_completions
    ? rate(
        inputs.goal_completions.filter((g) => g.completed === 1).length,
        inputs.goal_completions.length
      )
    : null;

  const acceptance_rate = base.recommendations_issued
    ? Number((base.recommendations_completed / base.recommendations_issued).toFixed(4))
    : 0;
  const completion_rate = base.success_rate ?? 0;

  const effectiveness_score = composeEffectiveness([
    base.mean_outcome_quality ?? null,
    completion_rate,
    readiness_improvement_mean,
    probability_improvement_mean,
    client_retention_rate,
    goal_completion_rate,
  ]);

  return {
    provider_id: inputs.provider_id,
    period: inputs.period,
    period_start: inputs.period_start,
    active_clients: base.active_patient_count,
    acceptance_rate,
    completion_rate,
    mean_outcome_quality: base.mean_outcome_quality ?? null,
    client_retention_rate,
    readiness_improvement_mean,
    probability_improvement_mean,
    goal_completion_rate,
    effectiveness_score,
  };
}

export const __test = { buildEffectiveness, composeEffectiveness };
