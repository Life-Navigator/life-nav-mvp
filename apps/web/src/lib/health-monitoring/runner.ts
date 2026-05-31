/**
 * Shared loader + persister used by the manual-entry and wearable-event
 * API routes. Reads the user's recent metrics + rule config, runs the
 * deterministic engine, and inserts surviving alerts into
 * health_meta.health_alert_events.
 *
 * `is_health_enabled()` may return FALSE today; in that case owner-context
 * reads/writes will fail RLS and we return a soft `feature_locked` shape
 * so the API surface stays clean.
 */

import { evaluate } from './alert-engine';
import {
  DEFAULT_THRESHOLDS,
  type AlertCandidate,
  type AlertRuleKey,
  type AlertSeverity,
  type BodyMeasurementPoint,
  type DailyWellbeingPoint,
  type EngineInputs,
  type LabResultPoint,
  type VitalsPoint,
} from '@/types/health-monitoring';

const ALL_RULES: AlertRuleKey[] = [
  'rhr_up_sleep_down',
  'bp_trend_worsening',
  'weight_sudden_drop',
  'recovery_score_collapse',
  'concerning_combo',
  'lab_out_of_range',
];

export interface RunnerOutcome {
  ok: boolean;
  feature_locked?: boolean;
  alerts_persisted: number;
  alerts: AlertCandidate[];
  error?: string;
}

/**
 * Run the engine for `user_id` using the authenticated `supabase` client.
 * The window we look back is 60 days — enough for every default rule.
 */
/** `supabase` is the authenticated server client; typed as `any` because the
 *  Database type narrow on createServerSupabaseClient doesn't expose the
 *  multi-schema overloads we need (.schema('health_meta')). */
export async function runForUser(
  supabase: unknown,
  userId: string,
  now: Date = new Date()
): Promise<RunnerOutcome> {
  const sb: any = supabase;
  const sinceIso = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  // Pull all inputs in parallel.
  const [
    { data: wellbeing, error: wbErr },
    { data: vitals, error: vErr },
    { data: body, error: bErr },
    { data: labs, error: lErr },
    { data: prefs, error: pErr },
    { data: ruleRows, error: rErr },
    { data: lastFired, error: lfErr },
  ] = await Promise.all([
    sb
      .schema('health_meta')
      .from('daily_wellbeing')
      .select(
        'observed_on, sleep_hours, sleep_quality, energy_score, recovery_score, soreness_score, stress_score, mood_score, focus_score, libido_score'
      )
      .eq('user_id', userId)
      .gte('observed_on', sinceDate)
      .order('observed_on', { ascending: true }),
    sb
      .schema('health_meta')
      .from('vitals_log')
      .select(
        'observed_at, resting_heart_rate_bpm, heart_rate_variability_ms, systolic_bp_mmhg, diastolic_bp_mmhg, glucose_mg_dl, spo2_percent'
      )
      .eq('user_id', userId)
      .gte('observed_at', sinceIso)
      .order('observed_at', { ascending: true }),
    sb
      .schema('health_meta')
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .eq('user_id', userId)
      .gte('measured_at', sinceIso)
      .order('measured_at', { ascending: true }),
    sb
      .schema('health_meta')
      .from('lab_results')
      .select('analyte, value, unit, flagged, created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .schema('health_meta')
      .from('health_monitoring_preferences')
      .select('alerts_enabled, min_severity_to_notify')
      .eq('user_id', userId)
      .maybeSingle(),
    sb
      .schema('health_meta')
      .from('health_alert_rules')
      .select('id, rule_key, is_active, thresholds, cooldown_minutes, severity')
      .eq('user_id', userId),
    sb
      .schema('health_meta')
      .from('health_alert_events')
      .select('rule_key, observed_at')
      .eq('user_id', userId)
      .gte('observed_at', sinceIso)
      .order('observed_at', { ascending: false })
      .limit(200),
  ]);

  const anyErr = wbErr || vErr || bErr || lErr || pErr || rErr || lfErr;
  if (anyErr) {
    const msg = anyErr.message || String(anyErr);
    // RLS-blocked under the health feature gate manifests as a permission
    // error or empty data with no row visibility. We collapse to a clean
    // feature_locked outcome so the API surface is uniform.
    if (/permission|policy|not allowed|locked/i.test(msg)) {
      return { ok: true, feature_locked: true, alerts_persisted: 0, alerts: [] };
    }
    return { ok: false, alerts_persisted: 0, alerts: [], error: msg };
  }

  // If alerts are turned off entirely, evaluate nothing.
  if (prefs && prefs.alerts_enabled === false) {
    return { ok: true, alerts_persisted: 0, alerts: [] };
  }

  // Build the per-rule config. If the user has no row for a rule, default
  // it to active with the engine defaults.
  const lastFiredByKey = new Map<string, string>();
  for (const e of lastFired ?? []) {
    if (!lastFiredByKey.has(e.rule_key)) lastFiredByKey.set(e.rule_key, e.observed_at);
  }
  const byRuleKey = new Map<string, any>();
  for (const r of ruleRows ?? []) byRuleKey.set(r.rule_key, r);

  const rules = ALL_RULES.map((rk) => {
    const row = byRuleKey.get(rk);
    return {
      rule_key: rk,
      is_active: row?.is_active ?? true,
      thresholds: (row?.thresholds ?? {}) as Record<string, unknown>,
      cooldown_minutes: row?.cooldown_minutes ?? 720,
      severity_override: row?.severity as AlertSeverity | undefined,
      last_fired_at: lastFiredByKey.get(rk) ?? null,
    };
  });

  const inputs: EngineInputs = {
    now,
    wellbeing: (wellbeing ?? []) as DailyWellbeingPoint[],
    vitals: (vitals ?? []) as VitalsPoint[],
    body_measurements: (body ?? []) as BodyMeasurementPoint[],
    lab_results: ((labs ?? []) as Array<any>).map((l) => ({
      analyte: l.analyte,
      value: Number(l.value),
      unit: l.unit,
      flagged: l.flagged,
      observed_at: l.created_at,
    })) as LabResultPoint[],
    rules,
    user_severity_floor: (prefs?.min_severity_to_notify as AlertSeverity) ?? 'info',
  };

  const result = evaluate(inputs);
  if (result.alerts.length === 0) {
    return { ok: true, alerts_persisted: 0, alerts: [] };
  }

  // Persist surviving alerts. We link rule_id when we have one.
  const ruleIdByKey = new Map<string, string>();
  for (const r of ruleRows ?? []) ruleIdByKey.set(r.rule_key, r.id);

  const rows = result.alerts.map((a) => ({
    user_id: userId,
    rule_id: ruleIdByKey.get(a.rule_key) ?? null,
    rule_key: a.rule_key,
    severity: a.severity,
    observed_at: now.toISOString(),
    headline: a.headline,
    body: a.body,
    recommended_next_step: a.recommended_next_step,
    trigger_metrics: a.trigger_metrics,
    source: 'engine',
  }));

  const { error: insErr } = await sb.schema('health_meta').from('health_alert_events').insert(rows);
  if (insErr) {
    if (/permission|policy|not allowed|locked/i.test(insErr.message)) {
      return { ok: true, feature_locked: true, alerts_persisted: 0, alerts: result.alerts };
    }
    return { ok: false, alerts_persisted: 0, alerts: result.alerts, error: insErr.message };
  }

  return { ok: true, alerts_persisted: rows.length, alerts: result.alerts };
}

/**
 * Exported for tests so we don't have to import the engine indirectly.
 */
export const RUNNER_DEFAULTS = DEFAULT_THRESHOLDS;
