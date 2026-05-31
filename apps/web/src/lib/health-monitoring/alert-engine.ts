/**
 * Deterministic alert engine for the wearable / manual health
 * monitoring system. Pure functions — no I/O. The API layer is
 * responsible for loading data, calling `evaluate`, and persisting
 * the surviving alerts to health_meta.health_alert_events.
 *
 * Every alert produced here MUST go through the copy bank in
 * lib/health-monitoring/copy.ts which is jest-tested to contain no
 * diagnostic language.
 */

import {
  DEFAULT_THRESHOLDS,
  type AlertCandidate,
  type AlertRuleKey,
  type AlertSeverity,
  type BodyMeasurementPoint,
  type DailyWellbeingPoint,
  type EngineInputs,
  type EvaluationResult,
  type LabResultPoint,
  type RuleThresholds,
  type VitalsPoint,
} from '@/types/health-monitoring';
import { copyFor } from './copy';

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  watch: 1,
  warn: 2,
  urgent: 3,
};

function withinDays(at: string | Date, now: Date, days: number): boolean {
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime();
  return now.getTime() - t <= days * 24 * 60 * 60 * 1000;
}

function avgDefined(values: Array<number | null | undefined>): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function mergeThresholds<K extends keyof RuleThresholds>(
  rule: K,
  override?: Record<string, unknown>
): Required<RuleThresholds>[K] {
  return { ...DEFAULT_THRESHOLDS[rule], ...(override ?? {}) } as Required<RuleThresholds>[K];
}

// --- individual rules ---------------------------------------------------

function evalRhrUpSleepDown(
  vitals: VitalsPoint[],
  wellbeing: DailyWellbeingPoint[],
  now: Date,
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('rhr_up_sleep_down', override);

  const recentRhr = vitals
    .filter((v) => withinDays(v.observed_at, now, t.window_days))
    .map((v) => v.resting_heart_rate_bpm)
    .filter((v): v is number => typeof v === 'number');
  const baselineRhr = vitals
    .filter(
      (v) =>
        !withinDays(v.observed_at, now, t.window_days) &&
        withinDays(v.observed_at, now, t.window_days * 4)
    )
    .map((v) => v.resting_heart_rate_bpm)
    .filter((v): v is number => typeof v === 'number');
  if (recentRhr.length < 3 || baselineRhr.length < 3) return null;

  const rhrDelta = avgDefined(recentRhr)! - avgDefined(baselineRhr)!;
  if (rhrDelta < t.rhr_rise_bpm) return null;

  const recentSleep = wellbeing
    .filter((w) => withinDays(w.observed_on, now, t.window_days))
    .map((w) => w.sleep_hours);
  const baselineSleep = wellbeing
    .filter(
      (w) =>
        !withinDays(w.observed_on, now, t.window_days) &&
        withinDays(w.observed_on, now, t.window_days * 4)
    )
    .map((w) => w.sleep_hours);
  const sleepRecent = avgDefined(recentSleep);
  const sleepBaseline = avgDefined(baselineSleep);
  if (sleepRecent == null || sleepBaseline == null) return null;
  if (sleepBaseline - sleepRecent < t.sleep_drop_hours) return null;

  const severity: AlertSeverity = rhrDelta >= t.rhr_rise_bpm * 1.5 ? 'warn' : 'watch';
  const c = copyFor('rhr_up_sleep_down', severity);
  return {
    rule_key: 'rhr_up_sleep_down',
    severity,
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      rhr_recent_avg: round(avgDefined(recentRhr)!),
      rhr_baseline_avg: round(avgDefined(baselineRhr)!),
      rhr_delta_bpm: round(rhrDelta),
      sleep_recent_avg: round(sleepRecent),
      sleep_baseline_avg: round(sleepBaseline),
      window_days: t.window_days,
    },
  };
}

function evalBpTrend(
  vitals: VitalsPoint[],
  now: Date,
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('bp_trend_worsening', override);

  const readings = vitals.filter(
    (v) =>
      v.systolic_bp_mmhg != null &&
      v.diastolic_bp_mmhg != null &&
      withinDays(v.observed_at, now, t.window_days)
  );
  if (readings.length < t.min_readings) return null;

  const elevated = readings.filter(
    (v) =>
      (v.systolic_bp_mmhg ?? 0) >= t.systolic_threshold ||
      (v.diastolic_bp_mmhg ?? 0) >= t.diastolic_threshold
  );
  const ratio = elevated.length / readings.length;
  if (ratio < 0.5) return null;

  const severity: AlertSeverity = ratio >= 0.8 ? 'warn' : 'watch';
  const c = copyFor('bp_trend_worsening', severity);
  return {
    rule_key: 'bp_trend_worsening',
    severity,
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      readings_count: readings.length,
      elevated_count: elevated.length,
      systolic_threshold: t.systolic_threshold,
      diastolic_threshold: t.diastolic_threshold,
      avg_systolic: round(avgDefined(readings.map((v) => v.systolic_bp_mmhg))!),
      avg_diastolic: round(avgDefined(readings.map((v) => v.diastolic_bp_mmhg))!),
    },
  };
}

function evalWeightDrop(
  body: BodyMeasurementPoint[],
  now: Date,
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('weight_sudden_drop', override);

  const window = body.filter((b) => withinDays(b.measured_at, now, t.window_days));
  const baseline = body.filter(
    (b) =>
      !withinDays(b.measured_at, now, t.window_days) &&
      withinDays(b.measured_at, now, t.window_days * 3)
  );
  if (window.length === 0 || baseline.length === 0) return null;

  const recentWeight = avgDefined(window.map((b) => b.weight_kg));
  const baseWeight = avgDefined(baseline.map((b) => b.weight_kg));
  if (recentWeight == null || baseWeight == null) return null;
  const drop = baseWeight - recentWeight;
  if (drop < t.drop_kg) return null;

  const severity: AlertSeverity = drop >= t.drop_kg * 1.6 ? 'warn' : 'watch';
  const c = copyFor('weight_sudden_drop', severity);
  return {
    rule_key: 'weight_sudden_drop',
    severity,
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      recent_avg_kg: round(recentWeight),
      baseline_avg_kg: round(baseWeight),
      drop_kg: round(drop),
      window_days: t.window_days,
    },
  };
}

function evalRecoveryCollapse(
  wellbeing: DailyWellbeingPoint[],
  now: Date,
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('recovery_score_collapse', override);

  // Consider the last N consecutive days available.
  const sorted = [...wellbeing]
    .filter((w) => w.recovery_score != null)
    .sort((a, b) => (a.observed_on < b.observed_on ? 1 : -1))
    .slice(0, t.consecutive_days);
  if (sorted.length < t.consecutive_days) return null;
  const allLow = sorted.every((w) => (w.recovery_score ?? 10) <= t.threshold);
  if (!allLow) return null;

  const c = copyFor('recovery_score_collapse', 'watch');
  return {
    rule_key: 'recovery_score_collapse',
    severity: 'watch',
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      consecutive_days: t.consecutive_days,
      threshold: t.threshold,
      observed: sorted.map((w) => ({ on: w.observed_on, recovery: w.recovery_score })),
    },
  };
}

function evalConcerningCombo(
  wellbeing: DailyWellbeingPoint[],
  vitals: VitalsPoint[],
  now: Date,
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('concerning_combo', override);

  const wb = wellbeing.filter((w) => withinDays(w.observed_on, now, t.window_days));
  const vi = vitals.filter((v) => withinDays(v.observed_at, now, t.window_days));
  if (wb.length === 0) return null;

  const avgEnergy = avgDefined(wb.map((w) => w.energy_score));
  const avgRecovery = avgDefined(wb.map((w) => w.recovery_score));
  const avgSleep = avgDefined(wb.map((w) => w.sleep_hours));
  const avgStress = avgDefined(wb.map((w) => w.stress_score));
  const avgHrv = avgDefined(vi.map((v) => v.heart_rate_variability_ms));
  const avgRhr = avgDefined(vi.map((v) => v.resting_heart_rate_bpm));

  // Need at least the wellbeing signals.
  if (avgEnergy == null || avgRecovery == null) return null;

  const fatigueComposite =
    ((avgEnergy != null ? avgEnergy : 5) +
      (avgRecovery != null ? avgRecovery : 5) +
      (avgSleep != null ? Math.min(avgSleep, 10) : 5) +
      (avgStress != null ? 10 - avgStress : 5)) /
    4;

  if (fatigueComposite > t.fatigue_threshold) return null;

  // Optional vitals support: if available, look for HRV down or RHR up.
  const vitalsSupport = (avgHrv != null && avgHrv < 40) || (avgRhr != null && avgRhr > 68);

  // Without vitals, fire on wellbeing alone only if composite is meaningfully low.
  if (!vitalsSupport && fatigueComposite > t.fatigue_threshold - 1) return null;

  const c = copyFor('concerning_combo', 'watch');
  return {
    rule_key: 'concerning_combo',
    severity: 'watch',
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      avg_energy: avgEnergy != null ? round(avgEnergy) : null,
      avg_recovery: avgRecovery != null ? round(avgRecovery) : null,
      avg_sleep: avgSleep != null ? round(avgSleep) : null,
      avg_stress: avgStress != null ? round(avgStress) : null,
      avg_hrv: avgHrv != null ? round(avgHrv) : null,
      avg_rhr: avgRhr != null ? round(avgRhr) : null,
      fatigue_composite: round(fatigueComposite),
    },
  };
}

function evalLabOutOfRange(
  labs: LabResultPoint[],
  override: Record<string, unknown> | undefined
): AlertCandidate | null {
  const t = mergeThresholds('lab_out_of_range', override);
  const flagged = labs.filter(
    (l) => l.flagged && t.include_severities.includes(l.flagged as 'low' | 'high' | 'critical')
  );
  if (flagged.length === 0) return null;
  const hasCritical = flagged.some((l) => l.flagged === 'critical');
  const severity: AlertSeverity = hasCritical ? 'urgent' : 'watch';
  const c = copyFor('lab_out_of_range', severity);
  return {
    rule_key: 'lab_out_of_range',
    severity,
    headline: c.headline,
    body: c.body,
    recommended_next_step: c.recommended_next_step,
    trigger_metrics: {
      flagged_count: flagged.length,
      analytes: flagged.map((l) => ({ analyte: l.analyte, flagged: l.flagged })),
    },
  };
}

// --- orchestrator -------------------------------------------------------

/**
 * Evaluate every active rule against the inputs and apply gating:
 *
 *   1. severity floor from user preferences
 *   2. cooldown — rule's last_fired_at + cooldown_minutes
 *
 * Returns only the alerts the caller should persist.
 */
export function evaluate(inputs: EngineInputs): EvaluationResult {
  const candidates: AlertCandidate[] = [];

  for (const rule of inputs.rules) {
    if (!rule.is_active) continue;

    let result: AlertCandidate | null = null;
    switch (rule.rule_key) {
      case 'rhr_up_sleep_down':
        result = evalRhrUpSleepDown(inputs.vitals, inputs.wellbeing, inputs.now, rule.thresholds);
        break;
      case 'bp_trend_worsening':
        result = evalBpTrend(inputs.vitals, inputs.now, rule.thresholds);
        break;
      case 'weight_sudden_drop':
        result = evalWeightDrop(inputs.body_measurements, inputs.now, rule.thresholds);
        break;
      case 'recovery_score_collapse':
        result = evalRecoveryCollapse(inputs.wellbeing, inputs.now, rule.thresholds);
        break;
      case 'concerning_combo':
        result = evalConcerningCombo(inputs.wellbeing, inputs.vitals, inputs.now, rule.thresholds);
        break;
      case 'lab_out_of_range':
        result = evalLabOutOfRange(inputs.lab_results, rule.thresholds);
        break;
    }
    if (!result) continue;

    // Severity floor
    const userFloor = SEVERITY_RANK[inputs.user_severity_floor];
    if (SEVERITY_RANK[result.severity] < userFloor) continue;

    // Cooldown — rule's last_fired_at + cooldown_minutes
    if (rule.last_fired_at) {
      const lastMs = new Date(rule.last_fired_at).getTime();
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      if (inputs.now.getTime() - lastMs < cooldownMs) continue;
    }

    // Allow optional severity override from the user.
    if (rule.severity_override) result.severity = rule.severity_override;

    candidates.push(result);
  }

  return {
    alerts: candidates,
    evaluated_at: inputs.now.toISOString(),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
