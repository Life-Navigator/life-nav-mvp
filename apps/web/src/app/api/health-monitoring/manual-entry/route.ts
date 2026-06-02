import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runForUser } from '@/lib/health-monitoring/runner';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const DailyWellbeingSchema = z.object({
  observed_on: z.string().date(),
  sleep_hours: z.number().finite().min(0).max(24).optional().nullable(),
  sleep_quality: z.number().int().min(0).max(10).optional().nullable(),
  wakeups: z.number().int().min(0).max(50).optional().nullable(),
  energy_score: z.number().int().min(0).max(10).optional().nullable(),
  recovery_score: z.number().int().min(0).max(10).optional().nullable(),
  soreness_score: z.number().int().min(0).max(10).optional().nullable(),
  stress_score: z.number().int().min(0).max(10).optional().nullable(),
  mood_score: z.number().int().min(0).max(10).optional().nullable(),
  focus_score: z.number().int().min(0).max(10).optional().nullable(),
  libido_score: z.number().int().min(0).max(10).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const VitalsSchema = z.object({
  observed_at: z.string().datetime().optional(),
  resting_heart_rate_bpm: z.number().finite().min(20).max(220).optional().nullable(),
  heart_rate_variability_ms: z.number().finite().min(0).max(300).optional().nullable(),
  systolic_bp_mmhg: z.number().finite().min(40).max(260).optional().nullable(),
  diastolic_bp_mmhg: z.number().finite().min(20).max(200).optional().nullable(),
  glucose_mg_dl: z.number().finite().min(20).max(800).optional().nullable(),
  spo2_percent: z.number().finite().min(50).max(100).optional().nullable(),
  body_temp_c: z.number().finite().min(30).max(45).optional().nullable(),
});

const BodyMeasurementSchema = z.object({
  measured_at: z.string().datetime().optional(),
  weight_kg: z.number().finite().min(0).max(500).optional().nullable(),
  body_fat_percent: z.number().finite().min(0).max(100).optional().nullable(),
  waist_cm: z.number().finite().min(0).max(300).optional().nullable(),
});

const LabResultSchema = z.object({
  panel_id: z.string().uuid().optional().nullable(),
  analyte: z.string().trim().min(1).max(128),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(32),
  reference_range_low: z.number().finite().optional().nullable(),
  reference_range_high: z.number().finite().optional().nullable(),
  flagged: z.enum(['low', 'high', 'critical', 'normal']).optional().nullable(),
});

const BodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily_wellbeing'), data: DailyWellbeingSchema }),
  z.object({ kind: z.literal('vitals'), data: VitalsSchema }),
  z.object({ kind: z.literal('body_measurement'), data: BodyMeasurementSchema }),
  z.object({ kind: z.literal('lab_result'), data: LabResultSchema }),
]);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const sb: any = supabase;
  const insertRow = { user_id: user.id, source: 'manual', ...parsed.data.data };

  const table: Record<typeof parsed.data.kind, string> = {
    daily_wellbeing: 'daily_wellbeing',
    vitals: 'vitals_log',
    body_measurement: 'body_measurements',
    lab_result: 'lab_results',
  };
  const conflict: Partial<Record<typeof parsed.data.kind, string>> = {
    daily_wellbeing: 'user_id,observed_on',
  };

  let q = sb.schema('health_meta').from(table[parsed.data.kind]);
  const writeRes = conflict[parsed.data.kind]
    ? await q.upsert(insertRow, { onConflict: conflict[parsed.data.kind] })
    : await q.insert(insertRow);

  if (writeRes.error) {
    if (/permission|policy|not allowed|locked/i.test(writeRes.error.message)) {
      return NextResponse.json(
        {
          success: false,
          feature_locked: true,
          message:
            'Health monitoring is currently locked. Your entry was validated and will persist when the health feature is enabled.',
        },
        { status: 200 }
      );
    }
    return safeApiError({ code: 'validation_failed', internal: writeRes.error });
  }

  const runnerOutcome = await runForUser(supabase, user.id);
  return NextResponse.json({
    success: true,
    kind: parsed.data.kind,
    runner: runnerOutcome,
  });
}
