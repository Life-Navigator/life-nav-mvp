/**
 * Shared types for the wearable monitoring + non-diagnostic alert engine.
 * Mirrors the columns in migration 073.
 */

export type AlertSeverity = 'info' | 'watch' | 'warn' | 'urgent';

export type AlertRuleKey =
  | 'rhr_up_sleep_down'
  | 'bp_trend_worsening'
  | 'weight_sudden_drop'
  | 'recovery_score_collapse'
  | 'concerning_combo'
  | 'lab_out_of_range';

/** Built-in default thresholds per rule. User-customizable via the
 *  `health_alert_rules.thresholds JSONB` column. */
export interface RuleThresholds {
  rhr_up_sleep_down?: {
    rhr_rise_bpm: number; // bpm increase from baseline
    sleep_drop_hours: number;
    window_days: number;
  };
  bp_trend_worsening?: {
    systolic_threshold: number;
    diastolic_threshold: number;
    window_days: number;
    min_readings: number;
  };
  weight_sudden_drop?: {
    drop_kg: number; // unintentional drop over the window
    window_days: number;
  };
  recovery_score_collapse?: {
    threshold: number; // 0..10
    consecutive_days: number;
  };
  concerning_combo?: {
    fatigue_threshold: number; // mood/energy/recovery composite
    window_days: number;
  };
  lab_out_of_range?: {
    include_severities: Array<'low' | 'high' | 'critical'>;
  };
}

export const DEFAULT_THRESHOLDS: Required<RuleThresholds> = {
  rhr_up_sleep_down: { rhr_rise_bpm: 7, sleep_drop_hours: 1, window_days: 7 },
  bp_trend_worsening: {
    systolic_threshold: 140,
    diastolic_threshold: 90,
    window_days: 14,
    min_readings: 3,
  },
  weight_sudden_drop: { drop_kg: 2.5, window_days: 14 },
  recovery_score_collapse: { threshold: 4, consecutive_days: 3 },
  concerning_combo: { fatigue_threshold: 4, window_days: 5 },
  lab_out_of_range: { include_severities: ['high', 'critical'] },
};

/** A point-in-time wellbeing observation row. */
export interface DailyWellbeingPoint {
  observed_on: string; // YYYY-MM-DD
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy_score: number | null;
  recovery_score: number | null;
  soreness_score: number | null;
  stress_score: number | null;
  mood_score: number | null;
  focus_score: number | null;
  libido_score: number | null;
}

export interface VitalsPoint {
  observed_at: string; // ISO timestamp
  resting_heart_rate_bpm: number | null;
  heart_rate_variability_ms: number | null;
  systolic_bp_mmhg: number | null;
  diastolic_bp_mmhg: number | null;
  glucose_mg_dl: number | null;
  spo2_percent: number | null;
}

export interface BodyMeasurementPoint {
  measured_at: string; // ISO timestamp
  weight_kg: number | null;
}

export interface LabResultPoint {
  analyte: string;
  value: number;
  unit: string;
  flagged: 'low' | 'high' | 'critical' | 'normal' | null;
  observed_at: string; // panel.drawn_at
}

/** Snapshot the engine reads to evaluate. The API route gathers this
 *  for the user before invoking the engine. */
export interface EngineInputs {
  now: Date;
  wellbeing: DailyWellbeingPoint[]; // chronological asc
  vitals: VitalsPoint[]; // chronological asc
  body_measurements: BodyMeasurementPoint[];
  lab_results: LabResultPoint[];
  rules: Array<{
    rule_key: AlertRuleKey;
    is_active: boolean;
    severity_override?: AlertSeverity;
    thresholds?: Record<string, unknown>;
    cooldown_minutes: number;
    last_fired_at?: string | null;
  }>;
  user_severity_floor: AlertSeverity;
}

/** Output of a single rule evaluation. */
export interface AlertCandidate {
  rule_key: AlertRuleKey;
  severity: AlertSeverity;
  headline: string;
  body: string;
  recommended_next_step: string;
  trigger_metrics: Record<string, unknown>;
}

/** Final engine output — candidates that survived cooldown + severity
 *  threshold gating. */
export interface EvaluationResult {
  alerts: AlertCandidate[];
  evaluated_at: string;
}

// API payloads ------------------------------------------------------------

export type ManualEntryKind = 'daily_wellbeing' | 'vitals' | 'body_measurement' | 'lab_result';

export interface ManualEntryPayload {
  kind: ManualEntryKind;
  observed_at?: string;
  data: Record<string, unknown>;
}

export interface WearableEventPayload {
  provider:
    | 'apple_health'
    | 'google_health_connect'
    | 'oura'
    | 'whoop'
    | 'garmin'
    | 'fitbit'
    | 'other';
  metric_type: string;
  value: number;
  unit: string;
  secondary_value?: number | null;
  recorded_at: string;
  metadata?: Record<string, unknown>;
}

export interface MonitoringPreferences {
  alerts_enabled: boolean;
  email_alerts_enabled: boolean;
  push_alerts_enabled: boolean;
  sms_alerts_enabled: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  min_severity_to_notify: AlertSeverity;
  share_alerts_with_physician: boolean;
  physician_email: string | null;
}
