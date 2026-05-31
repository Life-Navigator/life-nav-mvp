/**
 * @jest-environment node
 *
 * Deterministic tests for the alert engine. Each rule is exercised in
 * isolation with stub data so the test is not coupled to Supabase.
 */

import { evaluate } from '../alert-engine';
import type {
  AlertRuleKey,
  BodyMeasurementPoint,
  DailyWellbeingPoint,
  EngineInputs,
  LabResultPoint,
  VitalsPoint,
} from '@/types/health-monitoring';

const ALL_RULES: AlertRuleKey[] = [
  'rhr_up_sleep_down',
  'bp_trend_worsening',
  'weight_sudden_drop',
  'recovery_score_collapse',
  'concerning_combo',
  'lab_out_of_range',
];

const NOW = new Date('2026-06-01T12:00:00Z');

function daysAgo(d: number, anchor: Date = NOW): Date {
  return new Date(anchor.getTime() - d * 24 * 60 * 60 * 1000);
}
function dateAgo(d: number): string {
  return daysAgo(d).toISOString().slice(0, 10);
}
function isoAgo(d: number): string {
  return daysAgo(d).toISOString();
}

function defaultRules(only?: AlertRuleKey): EngineInputs['rules'] {
  return ALL_RULES.map((rk) => ({
    rule_key: rk,
    is_active: only ? rk === only : true,
    cooldown_minutes: 720,
    thresholds: {},
    last_fired_at: null,
  }));
}

function emptyInputs(): EngineInputs {
  return {
    now: NOW,
    wellbeing: [],
    vitals: [],
    body_measurements: [],
    lab_results: [],
    rules: defaultRules(),
    user_severity_floor: 'info',
  };
}

describe('rhr_up_sleep_down', () => {
  it('fires when RHR is up and sleep is down vs baseline', () => {
    const vitals: VitalsPoint[] = [];
    // Baseline window (8-28 days ago): RHR ~55
    for (let i = 8; i <= 28; i++) {
      vitals.push({
        observed_at: isoAgo(i),
        resting_heart_rate_bpm: 55,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: null,
        diastolic_bp_mmhg: null,
        glucose_mg_dl: null,
        spo2_percent: null,
      });
    }
    // Recent 7 days: RHR ~65 (+10)
    for (let i = 0; i < 7; i++) {
      vitals.push({
        observed_at: isoAgo(i),
        resting_heart_rate_bpm: 65,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: null,
        diastolic_bp_mmhg: null,
        glucose_mg_dl: null,
        spo2_percent: null,
      });
    }
    const wellbeing: DailyWellbeingPoint[] = [];
    for (let i = 8; i <= 28; i++) {
      wellbeing.push({
        observed_on: dateAgo(i),
        sleep_hours: 7.5,
        sleep_quality: null,
        energy_score: null,
        recovery_score: null,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      });
    }
    for (let i = 0; i < 7; i++) {
      wellbeing.push({
        observed_on: dateAgo(i),
        sleep_hours: 6.0,
        sleep_quality: null,
        energy_score: null,
        recovery_score: null,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      });
    }
    const inputs: EngineInputs = {
      ...emptyInputs(),
      vitals,
      wellbeing,
      rules: defaultRules('rhr_up_sleep_down'),
    };
    const result = evaluate(inputs);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].rule_key).toBe('rhr_up_sleep_down');
    expect(result.alerts[0].trigger_metrics.rhr_delta_bpm).toBeCloseTo(10, 1);
  });

  it('does NOT fire when only RHR rises but sleep is steady', () => {
    const vitals: VitalsPoint[] = [];
    for (let i = 8; i <= 28; i++) {
      vitals.push({
        observed_at: isoAgo(i),
        resting_heart_rate_bpm: 55,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: null,
        diastolic_bp_mmhg: null,
        glucose_mg_dl: null,
        spo2_percent: null,
      });
    }
    for (let i = 0; i < 7; i++) {
      vitals.push({
        observed_at: isoAgo(i),
        resting_heart_rate_bpm: 65,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: null,
        diastolic_bp_mmhg: null,
        glucose_mg_dl: null,
        spo2_percent: null,
      });
    }
    const wellbeing: DailyWellbeingPoint[] = [];
    for (let i = 0; i <= 28; i++) {
      wellbeing.push({
        observed_on: dateAgo(i),
        sleep_hours: 7.5,
        sleep_quality: null,
        energy_score: null,
        recovery_score: null,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      });
    }
    const result = evaluate({
      ...emptyInputs(),
      vitals,
      wellbeing,
      rules: defaultRules('rhr_up_sleep_down'),
    });
    expect(result.alerts).toHaveLength(0);
  });
});

describe('bp_trend_worsening', () => {
  it('fires when 50%+ of recent readings are elevated', () => {
    const vitals: VitalsPoint[] = [
      {
        observed_at: isoAgo(1),
        resting_heart_rate_bpm: null,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: 145,
        diastolic_bp_mmhg: 92,
        glucose_mg_dl: null,
        spo2_percent: null,
      },
      {
        observed_at: isoAgo(3),
        resting_heart_rate_bpm: null,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: 138,
        diastolic_bp_mmhg: 88,
        glucose_mg_dl: null,
        spo2_percent: null,
      },
      {
        observed_at: isoAgo(5),
        resting_heart_rate_bpm: null,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: 150,
        diastolic_bp_mmhg: 95,
        glucose_mg_dl: null,
        spo2_percent: null,
      },
      {
        observed_at: isoAgo(7),
        resting_heart_rate_bpm: null,
        heart_rate_variability_ms: null,
        systolic_bp_mmhg: 142,
        diastolic_bp_mmhg: 90,
        glucose_mg_dl: null,
        spo2_percent: null,
      },
    ];
    const result = evaluate({
      ...emptyInputs(),
      vitals,
      rules: defaultRules('bp_trend_worsening'),
    });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].rule_key).toBe('bp_trend_worsening');
  });
});

describe('weight_sudden_drop', () => {
  it('fires on a 3kg drop vs baseline window', () => {
    const body: BodyMeasurementPoint[] = [
      { measured_at: isoAgo(40), weight_kg: 90 },
      { measured_at: isoAgo(35), weight_kg: 90.5 },
      { measured_at: isoAgo(30), weight_kg: 90 },
      { measured_at: isoAgo(10), weight_kg: 87 },
      { measured_at: isoAgo(5), weight_kg: 86.5 },
      { measured_at: isoAgo(2), weight_kg: 87 },
    ];
    const result = evaluate({
      ...emptyInputs(),
      body_measurements: body,
      rules: defaultRules('weight_sudden_drop'),
    });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].trigger_metrics.drop_kg).toBeGreaterThanOrEqual(2.5);
  });
});

describe('recovery_score_collapse', () => {
  it('fires on three consecutive low recovery days', () => {
    const wb: DailyWellbeingPoint[] = [
      {
        observed_on: dateAgo(0),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 3,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
      {
        observed_on: dateAgo(1),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 2,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
      {
        observed_on: dateAgo(2),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 4,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
    ];
    const result = evaluate({
      ...emptyInputs(),
      wellbeing: wb,
      rules: defaultRules('recovery_score_collapse'),
    });
    expect(result.alerts).toHaveLength(1);
  });

  it('does not fire on mixed days', () => {
    const wb: DailyWellbeingPoint[] = [
      {
        observed_on: dateAgo(0),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 3,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
      {
        observed_on: dateAgo(1),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 8,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
      {
        observed_on: dateAgo(2),
        sleep_hours: 6,
        sleep_quality: null,
        energy_score: null,
        recovery_score: 4,
        soreness_score: null,
        stress_score: null,
        mood_score: null,
        focus_score: null,
        libido_score: null,
      },
    ];
    const result = evaluate({
      ...emptyInputs(),
      wellbeing: wb,
      rules: defaultRules('recovery_score_collapse'),
    });
    expect(result.alerts).toHaveLength(0);
  });
});

describe('lab_out_of_range', () => {
  it('fires on a critical-flagged lab', () => {
    const labs: LabResultPoint[] = [
      {
        analyte: 'potassium',
        value: 6.8,
        unit: 'mmol/L',
        flagged: 'critical',
        observed_at: isoAgo(2),
      },
    ];
    const result = evaluate({
      ...emptyInputs(),
      lab_results: labs,
      rules: defaultRules('lab_out_of_range'),
    });
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].severity).toBe('urgent');
  });

  it('does not fire on a normal-flagged lab', () => {
    const labs: LabResultPoint[] = [
      { analyte: 'ldl', value: 90, unit: 'mg/dL', flagged: 'normal', observed_at: isoAgo(2) },
    ];
    const result = evaluate({
      ...emptyInputs(),
      lab_results: labs,
      rules: defaultRules('lab_out_of_range'),
    });
    expect(result.alerts).toHaveLength(0);
  });
});

describe('gating', () => {
  it('honors the user severity floor', () => {
    const labs: LabResultPoint[] = [
      { analyte: 'glucose', value: 200, unit: 'mg/dL', flagged: 'high', observed_at: isoAgo(2) },
    ];
    // 'high' flagged → 'watch' severity by default; setting floor to 'warn' should suppress.
    const result = evaluate({
      ...emptyInputs(),
      lab_results: labs,
      rules: defaultRules('lab_out_of_range'),
      user_severity_floor: 'warn',
    });
    expect(result.alerts).toHaveLength(0);
  });

  it('honors the cooldown window per rule', () => {
    const labs: LabResultPoint[] = [
      { analyte: 'ldl', value: 200, unit: 'mg/dL', flagged: 'high', observed_at: isoAgo(2) },
    ];
    const rules = defaultRules('lab_out_of_range');
    rules[ALL_RULES.indexOf('lab_out_of_range')].last_fired_at = isoAgo(0);
    rules[ALL_RULES.indexOf('lab_out_of_range')].cooldown_minutes = 1440; // 24h
    const result = evaluate({
      ...emptyInputs(),
      lab_results: labs,
      rules,
    });
    expect(result.alerts).toHaveLength(0);
  });

  it('skips inactive rules', () => {
    const labs: LabResultPoint[] = [
      { analyte: 'ldl', value: 200, unit: 'mg/dL', flagged: 'high', observed_at: isoAgo(2) },
    ];
    const rules = defaultRules();
    for (const r of rules) r.is_active = false;
    const result = evaluate({
      ...emptyInputs(),
      lab_results: labs,
      rules,
    });
    expect(result.alerts).toHaveLength(0);
  });
});

describe('determinism', () => {
  it('the same input produces the same alerts every run', () => {
    const labs: LabResultPoint[] = [
      {
        analyte: 'potassium',
        value: 6.8,
        unit: 'mmol/L',
        flagged: 'critical',
        observed_at: isoAgo(2),
      },
    ];
    const inputs: EngineInputs = {
      ...emptyInputs(),
      lab_results: labs,
      rules: defaultRules('lab_out_of_range'),
    };
    const r1 = evaluate(inputs);
    const r2 = evaluate(inputs);
    expect(r1).toEqual(r2);
  });
});
