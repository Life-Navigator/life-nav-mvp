/**
 * ProviderAnalyticsService — pure aggregator over a provider's own
 * data. Never crosses provider boundaries.
 *
 * Inputs to `computeProviderAnalytics`:
 *   * recommendations issued by THIS provider
 *   * outcomes attributed to those recommendations
 *
 * Output: a `ProviderAnalytics` row ready to UPSERT into
 * `providers.provider_analytics`.
 */

import type { ProviderOutcome, ProviderRecommendation, ProviderAnalytics } from '@/types/provider';
import { computeRecommendationLifecycleStats } from './recommendation-service';

export interface ComputeAnalyticsInputs {
  provider_id: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  period_start: string; // YYYY-MM-DD
  recommendations: ProviderRecommendation[];
  outcomes: ProviderOutcome[];
}

export type AnalyticsRow = Omit<
  ProviderAnalytics,
  'id' | 'created_at' | 'updated_at' | 'metadata' | 'computed_at'
> & { metadata: Record<string, unknown>; computed_at: string };

export function computeProviderAnalytics(inputs: ComputeAnalyticsInputs): AnalyticsRow {
  const lifecycle = computeRecommendationLifecycleStats(inputs.recommendations);
  const activePatients = new Set(inputs.recommendations.map((r) => r.patient_user_id)).size;

  const meanQuality = meanOrNull(inputs.outcomes.map((o) => o.outcome_quality ?? null));
  const meanSatisfaction = meanOrNull(inputs.outcomes.map((o) => o.user_satisfaction ?? null));

  return {
    provider_id: inputs.provider_id,
    period: inputs.period,
    period_start: inputs.period_start,
    active_patient_count: activePatients,
    recommendations_issued: lifecycle.issued,
    recommendations_accepted: lifecycle.accepted,
    recommendations_completed: lifecycle.completed,
    recommendations_rejected: lifecycle.rejected,
    recommendations_abandoned: lifecycle.abandoned,
    success_rate: lifecycle.completion_rate,
    completion_rate: lifecycle.completion_rate,
    mean_outcome_quality: meanQuality,
    mean_user_satisfaction: meanSatisfaction,
    computed_at: new Date().toISOString(),
    metadata: {},
  };
}

function meanOrNull(arr: Array<number | null | undefined>): number | null {
  const f = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

export const __test = { computeProviderAnalytics, meanOrNull };
