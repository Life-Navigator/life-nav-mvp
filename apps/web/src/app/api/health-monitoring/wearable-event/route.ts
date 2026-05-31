/**
 * Wearable webhook normalizer.
 *
 * Accepts a single metric event from Apple Health / Google Health Connect /
 * Oura / Whoop / Garmin / Fitbit, writes it to `health_meta.wearable_metrics`
 * (the table created in 038), and for known metric types ALSO mirrors it to
 * the canonical table the alert engine reads:
 *
 *   resting_heart_rate / heart_rate_variability / blood_pressure / glucose
 *   / spo2 / body_temp                 -> health_meta.vitals_log
 *   weight                              -> health_meta.body_measurements
 *   sleep                               -> health_meta.daily_wellbeing
 *
 * The engine then runs over the user's recent window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runForUser } from '@/lib/health-monitoring/runner';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  provider: z.enum([
    'apple_health',
    'google_health_connect',
    'oura',
    'whoop',
    'garmin',
    'fitbit',
    'other',
  ]),
  metric_type: z.string().trim().min(1).max(64),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(32),
  secondary_value: z.number().finite().optional().nullable(),
  recorded_at: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const ev = parsed.data;
  const sb: any = supabase;

  // 1. raw store
  const raw = await sb
    .schema('health_meta')
    .from('wearable_metrics')
    .insert({
      user_id: user.id,
      metric_type: ev.metric_type,
      value: ev.value,
      unit: ev.unit,
      secondary_value: ev.secondary_value ?? null,
      source: ev.provider,
      recorded_at: ev.recorded_at,
      metadata: ev.metadata ?? {},
    });
  if (raw.error && !/permission|policy|locked/i.test(raw.error.message)) {
    return NextResponse.json({ error: raw.error.message }, { status: 400 });
  }
  const featureLocked = !!raw.error;

  // 2. normalize into the canonical table for the engine
  const mt = ev.metric_type.toLowerCase();
  let mirrored = false;
  if (
    mt === 'resting_heart_rate' ||
    mt === 'rhr' ||
    mt === 'heart_rate_variability' ||
    mt === 'hrv' ||
    mt === 'blood_pressure' ||
    mt === 'bp' ||
    mt === 'glucose' ||
    mt === 'spo2' ||
    mt === 'body_temp' ||
    mt === 'temperature'
  ) {
    const row: Record<string, unknown> = {
      user_id: user.id,
      source: ev.provider,
      observed_at: ev.recorded_at,
      metadata: ev.metadata ?? {},
    };
    if (mt === 'resting_heart_rate' || mt === 'rhr') row.resting_heart_rate_bpm = ev.value;
    if (mt === 'heart_rate_variability' || mt === 'hrv') row.heart_rate_variability_ms = ev.value;
    if (mt === 'blood_pressure' || mt === 'bp') {
      row.systolic_bp_mmhg = ev.value;
      if (ev.secondary_value != null) row.diastolic_bp_mmhg = ev.secondary_value;
    }
    if (mt === 'glucose') row.glucose_mg_dl = ev.value;
    if (mt === 'spo2') row.spo2_percent = ev.value;
    if (mt === 'body_temp' || mt === 'temperature') row.body_temp_c = ev.value;
    await sb.schema('health_meta').from('vitals_log').insert(row);
    mirrored = true;
  } else if (mt === 'weight') {
    await sb
      .schema('health_meta')
      .from('body_measurements')
      .insert({
        user_id: user.id,
        source: ev.provider,
        measured_at: ev.recorded_at,
        weight_kg: ev.value,
        metadata: ev.metadata ?? {},
      });
    mirrored = true;
  } else if (mt === 'sleep' || mt === 'sleep_duration') {
    const observed_on = ev.recorded_at.slice(0, 10);
    await sb
      .schema('health_meta')
      .from('daily_wellbeing')
      .upsert(
        {
          user_id: user.id,
          source: ev.provider,
          observed_on,
          sleep_hours: ev.value,
          metadata: ev.metadata ?? {},
        },
        { onConflict: 'user_id,observed_on' }
      );
    mirrored = true;
  }

  if (featureLocked) {
    return NextResponse.json({ success: true, feature_locked: true, mirrored });
  }

  const runnerOutcome = await runForUser(supabase, user.id);
  return NextResponse.json({ success: true, mirrored, runner: runnerOutcome });
}
