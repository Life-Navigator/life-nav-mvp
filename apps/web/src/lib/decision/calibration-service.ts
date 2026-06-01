/**
 * CalibrationService
 *
 * Measures how well the system's stated confidences match observed
 * outcomes. Three quantities, all in [0, 1] unless noted:
 *
 *   * Brier Score          — mean squared error between predicted
 *                            probability and realized 0/1 outcome.
 *                            0 perfect, 1 worst.
 *
 *   * Calibration Error    — mean |bucket_mean_pred − bucket_mean_actual|
 *                            across non-empty bins (Expected Calibration
 *                            Error / ECE).
 *
 *   * Confidence-Accuracy  — mean(predicted) − mean(actual).
 *     Gap                    Positive => overconfident; negative => underconfident.
 *
 * The calibration *curve* is the per-bin tabulation that drives the
 * adjustment we apply to the AdvisorReasoningService confidence in
 * `confidence_calibrated`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AdvisorAccuracy,
  CalibrationBin,
  CalibrationCurve,
  PredictionCalibration,
  RecommendationAccuracy,
} from '@/types/decision-intelligence';

// ---------------------------------------------------------------------------
// Pure math
// ---------------------------------------------------------------------------

const DEFAULT_BIN_COUNT = 10;

export interface PredictionPair {
  predicted: number; // [0,1]
  actual: number; // [0,1] — accept 0/1 OR a continuous outcome quality
}

export function brierScore(predictions: PredictionPair[]): number {
  if (predictions.length === 0) return 0;
  const sq = predictions.reduce((a, p) => {
    const pp = clamp01(p.predicted);
    const aa = clamp01(p.actual);
    const d = pp - aa;
    return a + d * d;
  }, 0);
  return sq / predictions.length;
}

export function bucketLabel(bin: number, binCount: number): string {
  const lo = bin / binCount;
  const hi = (bin + 1) / binCount;
  return `${lo.toFixed(1)}-${hi.toFixed(1)}`;
}

export function computeCalibrationCurve(
  predictions: PredictionPair[],
  binCount: number = DEFAULT_BIN_COUNT
): CalibrationCurve {
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < binCount; i += 1) {
    const range_lo = i / binCount;
    const range_hi = (i + 1) / binCount;
    bins.push({
      bucket: bucketLabel(i, binCount),
      range_lo,
      range_hi,
      n: 0,
      mean_predicted: 0,
      mean_actual: 0,
      gap: 0,
    });
  }

  for (const p of predictions) {
    const pp = clamp01(p.predicted);
    // Map predicted into a bin index, with the high edge belonging to
    // the last bin so 1.0 isn't out of range.
    let idx = Math.floor(pp * binCount);
    if (idx >= binCount) idx = binCount - 1;
    const b = bins[idx];
    b.n += 1;
    b.mean_predicted += pp;
    b.mean_actual += clamp01(p.actual);
  }

  for (const b of bins) {
    if (b.n > 0) {
      b.mean_predicted /= b.n;
      b.mean_actual /= b.n;
      b.gap = b.mean_predicted - b.mean_actual;
    }
  }

  // Expected Calibration Error: weighted average of |gap| by bin size.
  const nTotal = predictions.length;
  const ece = nTotal === 0 ? 0 : bins.reduce((a, b) => a + (b.n / nTotal) * Math.abs(b.gap), 0);

  const meanPred = mean(predictions.map((p) => clamp01(p.predicted)));
  const meanAct = mean(predictions.map((p) => clamp01(p.actual)));

  return {
    brier_score: brierScore(predictions),
    calibration_error: ece,
    confidence_accuracy_gap: (meanPred ?? 0) - (meanAct ?? 0),
    bins,
    n: nTotal,
  };
}

/**
 * Use the per-bin (mean_predicted → mean_actual) mapping to project
 * an advisor's *current* stated confidence into a calibrated value.
 *
 * If the relevant bin has fewer than `min_support` observations, fall
 * back to the user's overall confidence-accuracy gap (or the input
 * unchanged if there is no data at all).
 */
export function calibrateConfidence(
  predicted: number,
  curve: CalibrationCurve | undefined,
  options: { min_support?: number } = {}
): number {
  const minSupport = options.min_support ?? 5;
  const p = clamp01(predicted);
  if (!curve || curve.n === 0) return p;
  // Find matching bin.
  const bin = curve.bins.find(
    (b) => p >= b.range_lo && (p < b.range_hi || (p === 1 && b.range_hi === 1))
  );
  if (bin && bin.n >= minSupport && bin.mean_actual > 0) {
    return clamp01(bin.mean_actual);
  }
  // Fallback: subtract the global overconfidence gap, clamped to [0,1].
  return clamp01(p - curve.confidence_accuracy_gap);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface RecordCalibrationInput {
  user_id: string;
  predicted_at: string;
  predicted_confidence: number;
  predicted_value?: number;
  actual_correct?: boolean;
  actual_value?: number;
  source_run_id?: string;
  source_action_id?: string;
  source_decision_id?: string;
  source_outcome_id?: string;
}

export async function recordCalibration(
  supabase: SupabaseClient,
  input: RecordCalibrationInput
): Promise<PredictionCalibration> {
  const conf = clamp01(input.predicted_confidence);
  const bucket = bucketLabel(
    Math.min(DEFAULT_BIN_COUNT - 1, Math.floor(conf * DEFAULT_BIN_COUNT)),
    DEFAULT_BIN_COUNT
  );
  const row = {
    user_id: input.user_id,
    predicted_at: input.predicted_at,
    predicted_confidence: conf,
    predicted_value: input.predicted_value ?? null,
    actual_correct: input.actual_correct ?? null,
    actual_value: input.actual_value ?? null,
    bucket,
    source_run_id: input.source_run_id ?? null,
    source_action_id: input.source_action_id ?? null,
    source_decision_id: input.source_decision_id ?? null,
    source_outcome_id: input.source_outcome_id ?? null,
    validated_at:
      input.actual_correct != null || input.actual_value != null ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from('prediction_calibration')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as PredictionCalibration;
}

export interface SnapshotAdvisorAccuracyInput {
  user_id: string;
  advisor_run_id: string;
  rows: RecommendationAccuracy[];
}

export async function snapshotAdvisorAccuracy(
  supabase: SupabaseClient,
  input: SnapshotAdvisorAccuracyInput
): Promise<AdvisorAccuracy> {
  const completed = input.rows.filter((r) => r.observed_outcome_quality != null);
  const pairs: PredictionPair[] = completed.map((r) => ({
    predicted: clamp01(r.predicted_confidence ?? r.predicted_strength ?? 0),
    actual: clamp01(r.observed_outcome_quality ?? 0),
  }));
  const curve = computeCalibrationCurve(pairs);

  const meanPred = mean(input.rows.map((r) => r.predicted_confidence ?? null));
  const meanObs = mean(input.rows.map((r) => r.observed_outcome_quality ?? null));

  const row = {
    user_id: input.user_id,
    advisor_run_id: input.advisor_run_id,
    computed_at: new Date().toISOString(),
    total_actions: input.rows.length,
    completed_actions: completed.length,
    abandoned_actions: 0,
    rejected_actions: 0,
    mean_predicted_confidence: meanPred,
    mean_observed_outcome_quality: meanObs,
    brier_score: curve.brier_score,
    calibration_error: curve.calibration_error,
    confidence_accuracy_gap: curve.confidence_accuracy_gap,
  };
  const { data, error } = await supabase
    .from('advisor_accuracy')
    .upsert(row, { onConflict: 'user_id,advisor_run_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as AdvisorAccuracy;
}

export async function loadCalibrationHistory(
  supabase: SupabaseClient,
  userId: string,
  options: { since?: string } = {}
): Promise<PredictionCalibration[]> {
  let qb = supabase.from('prediction_calibration').select('*').eq('user_id', userId);
  if (options.since) qb = qb.gte('predicted_at', options.since);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as PredictionCalibration[];
}

/**
 * Build a CalibrationCurve from the user's historical predictions
 * (validated entries only). Used by AdvisorReasoningService to compute
 * `confidence_calibrated` for new recommendations.
 */
export function buildCurveFromHistory(
  history: PredictionCalibration[],
  binCount = DEFAULT_BIN_COUNT
): CalibrationCurve {
  const pairs: PredictionPair[] = history
    .filter((h) => h.validated_at != null)
    .map((h) => ({
      predicted: clamp01(h.predicted_confidence),
      actual: h.actual_correct == null ? clamp01(h.actual_value ?? 0) : h.actual_correct ? 1 : 0,
    }));
  return computeCalibrationCurve(pairs, binCount);
}

// ---------------------------------------------------------------------------
// Helpers + exports for tests
// ---------------------------------------------------------------------------

function clamp01(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function mean(arr: Array<number | null | undefined>): number | null {
  const f = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

export const __test = {
  brierScore,
  computeCalibrationCurve,
  calibrateConfidence,
  buildCurveFromHistory,
  bucketLabel,
};
