/**
 * Progress Monitoring Service (Sprint J, Phase 5).
 *
 * Assembles biometric trends, lab trends, compliance scores, and the
 * probability trend for a single client. Pure projection.
 *
 * The loader fetches the raw rows AFTER passing them through the
 * Sprint I scope barrier:
 *   - allowed_domains must include the metric's domain
 *   - max_sensitivity must allow Health-class data
 *   - engagement.status must be 'active'
 *
 * This service trusts those filters and only does shape-building.
 */

import type { BiometricObservation, LabResult } from '@/types/arcana';
import type {
  BiometricTrend,
  ClientWorkspaceGoalProgress,
  ComplianceSummary,
  LabTrend,
  ProbabilityTrend,
  ProgressMonitoringView,
} from '@/types/provider-portal';
import type { ProviderDomain } from '@/types/provider';

// ---------------------------------------------------------------------------
// Biometric trend builder
// ---------------------------------------------------------------------------

/** Group observations by metric_kind and project a trend per group. */
export function buildBiometricTrends(obs: BiometricObservation[]): BiometricTrend[] {
  const byKind = new Map<string, BiometricObservation[]>();
  for (const o of obs) {
    if (!byKind.has(o.metric_kind)) byKind.set(o.metric_kind, []);
    byKind.get(o.metric_kind)!.push(o);
  }
  const out: BiometricTrend[] = [];
  for (const [kind, rows] of byKind.entries()) {
    rows.sort((a, b) => (a.collected_at < b.collected_at ? -1 : 1));
    const points = rows.map((r) => ({
      collected_at: r.collected_at,
      value: r.value,
      unit: r.unit ?? null,
      source: r.source ?? null,
    }));
    const last = points[points.length - 1];
    const prior = points.length >= 2 ? points[points.length - 2] : undefined;
    out.push({
      metric_kind: kind as BiometricTrend['metric_kind'],
      points,
      most_recent: last?.value ?? null,
      prior: prior?.value ?? null,
      delta: prior && last ? Number((last.value - prior.value).toFixed(4)) : null,
    });
  }
  // Deterministic order by metric_kind.
  out.sort((a, b) => a.metric_kind.localeCompare(b.metric_kind));
  return out;
}

// ---------------------------------------------------------------------------
// Lab trend builder
// ---------------------------------------------------------------------------

export function buildLabTrends(rows: LabResult[]): LabTrend[] {
  const byKind = new Map<string, LabResult[]>();
  for (const r of rows) {
    if (!byKind.has(r.lab_kind)) byKind.set(r.lab_kind, []);
    byKind.get(r.lab_kind)!.push(r);
  }
  const out: LabTrend[] = [];
  for (const [kind, list] of byKind.entries()) {
    list.sort((a, b) => (a.collection_date < b.collection_date ? -1 : 1));
    out.push({
      lab_kind: kind as LabTrend['lab_kind'],
      points: list.map((r) => ({
        collection_date: r.collection_date,
        result_value: r.result_value ?? null,
        unit: r.unit ?? null,
        flag: r.flag ?? null,
      })),
    });
  }
  out.sort((a, b) => a.lab_kind.localeCompare(b.lab_kind));
  return out;
}

// ---------------------------------------------------------------------------
// Compliance — input from goal_progress / adherence signals
// ---------------------------------------------------------------------------

export interface AdherenceInputs {
  training_adherence?: number | null;
  nutrition_adherence?: number | null;
  recovery_adherence?: number | null;
  appointment_adherence?: number | null;
}

export function buildCompliance(inputs: AdherenceInputs): ComplianceSummary {
  return {
    training_adherence: inputs.training_adherence ?? null,
    nutrition_adherence: inputs.nutrition_adherence ?? null,
    recovery_adherence: inputs.recovery_adherence ?? null,
    appointment_adherence: inputs.appointment_adherence ?? null,
  };
}

// ---------------------------------------------------------------------------
// Probability trend
// ---------------------------------------------------------------------------

export function buildProbabilityTrend(
  current?: number | null,
  prior?: number | null
): ProbabilityTrend {
  if (current == null && prior == null) return { current: null, prior: null, delta: null };
  const delta =
    typeof current === 'number' && typeof prior === 'number'
      ? Number((current - prior).toFixed(4))
      : null;
  return { current: current ?? null, prior: prior ?? null, delta };
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

export interface ProgressMonitoringInputs {
  engagement_id: string;
  patient_user_id: string;
  scope_domains: ProviderDomain[];
  observations: BiometricObservation[];
  labs: LabResult[];
  adherence: AdherenceInputs;
  probability_current?: number | null;
  probability_prior?: number | null;
  goals_summary: ClientWorkspaceGoalProgress[];
  now: string;
}

export function assembleProgressMonitoring(
  inputs: ProgressMonitoringInputs
): ProgressMonitoringView {
  return {
    engagement_id: inputs.engagement_id,
    patient_user_id: inputs.patient_user_id,
    scope_domains: inputs.scope_domains,
    biometrics: buildBiometricTrends(inputs.observations),
    labs: buildLabTrends(inputs.labs),
    compliance: buildCompliance(inputs.adherence),
    probability: buildProbabilityTrend(inputs.probability_current, inputs.probability_prior),
    goals_summary: inputs.goals_summary,
    generated_at: inputs.now,
  };
}

export const __test = {
  buildBiometricTrends,
  buildLabTrends,
  buildCompliance,
  buildProbabilityTrend,
  assembleProgressMonitoring,
};
