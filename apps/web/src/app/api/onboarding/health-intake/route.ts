/**
 * Health intake — combines training profile, body measurements, daily
 * wellbeing snapshot, injuries, mobility limitations, and nutrition
 * profile in one request.
 *
 * NOTE: Tables under health_meta are gated by public.is_health_enabled().
 * When the flag is false (default), owner inserts will fail RLS and this
 * route will return the underlying RLS error verbatim. That is correct —
 * the schema exists today so onboarding code can call this endpoint, and
 * the data will start flowing the moment the gate flips on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TrainingProfileSchema = z
  .object({
    activity_level: z
      .enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'])
      .optional()
      .nullable(),
    years_training: z.number().int().min(0).max(120).optional().nullable(),
    training_history: z.string().trim().max(4000).optional().nullable(),
    preferred_modalities: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    disliked_modalities: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    sessions_per_week_target: z.number().int().min(0).max(14).optional().nullable(),
    session_duration_minutes_target: z.number().int().min(0).max(600).optional().nullable(),
    walking_tolerance_minutes: z.number().int().min(0).max(600).optional().nullable(),
    running_tolerance_minutes: z.number().int().min(0).max(600).optional().nullable(),
    swimming_access: z.boolean().optional().nullable(),
    gym_access: z.boolean().optional().nullable(),
    available_equipment: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();

const BodyMeasurementsSchema = z
  .object({
    measured_at: z.string().datetime().optional(),
    height_cm: z.number().finite().min(0).max(300).optional().nullable(),
    weight_kg: z.number().finite().min(0).max(500).optional().nullable(),
    target_weight_kg: z.number().finite().min(0).max(500).optional().nullable(),
    body_fat_percent: z.number().finite().min(0).max(100).optional().nullable(),
    muscle_mass_kg: z.number().finite().min(0).max(200).optional().nullable(),
    waist_cm: z.number().finite().min(0).max(300).optional().nullable(),
    neck_cm: z.number().finite().min(0).max(100).optional().nullable(),
    chest_cm: z.number().finite().min(0).max(300).optional().nullable(),
    shoulders_cm: z.number().finite().min(0).max(300).optional().nullable(),
    left_arm_cm: z.number().finite().min(0).max(100).optional().nullable(),
    right_arm_cm: z.number().finite().min(0).max(100).optional().nullable(),
    hips_cm: z.number().finite().min(0).max(300).optional().nullable(),
    left_thigh_cm: z.number().finite().min(0).max(200).optional().nullable(),
    right_thigh_cm: z.number().finite().min(0).max(200).optional().nullable(),
  })
  .strict();

const DailyWellbeingSchema = z
  .object({
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
  })
  .strict();

const InjurySchema = z.object({
  body_region: z.enum([
    'shoulder',
    'elbow',
    'wrist',
    'neck',
    'upper_back',
    'lower_back',
    'hip',
    'knee',
    'ankle',
    'foot',
    'core',
    'chest',
    'other',
  ]),
  side: z.enum(['left', 'right', 'bilateral', 'na']).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  severity: z.enum(['mild', 'moderate', 'severe', 'chronic']).optional().nullable(),
  pain_score: z.number().int().min(0).max(10).optional().nullable(),
  status: z.enum(['active', 'managed', 'resolved']).optional(),
  onset_date: z.string().date().optional().nullable(),
  affects_modalities: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
});

const NutritionProfileSchema = z
  .object({
    diet_type: z.string().trim().max(64).optional().nullable(),
    daily_calorie_target: z.number().finite().min(0).max(20000).optional().nullable(),
    protein_target_g: z.number().finite().min(0).max(1000).optional().nullable(),
    carb_target_g: z.number().finite().min(0).max(2000).optional().nullable(),
    fat_target_g: z.number().finite().min(0).max(1000).optional().nullable(),
    fiber_target_g: z.number().finite().min(0).max(500).optional().nullable(),
    water_target_ml: z.number().finite().min(0).max(20000).optional().nullable(),
    alcohol_drinks_per_week_target: z.number().finite().min(0).max(200).optional().nullable(),
    caffeine_mg_per_day_target: z.number().finite().min(0).max(5000).optional().nullable(),
    food_allergies: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    preferences: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();

const BodySchema = z.object({
  training_profile: TrainingProfileSchema.optional(),
  body_measurements: BodyMeasurementsSchema.optional(),
  daily_wellbeing: DailyWellbeingSchema.optional(),
  injuries: z.array(InjurySchema).max(30).optional(),
  nutrition_profile: NutritionProfileSchema.optional(),
  source: z.string().trim().min(1).max(64).optional(),
});

export async function PUT(request: NextRequest) {
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

  const source = parsed.data.source ?? 'onboarding';
  const results: Record<string, { ok: boolean; error?: string }> = {};

  if (parsed.data.training_profile && Object.keys(parsed.data.training_profile).length > 0) {
    const { error } = await (supabase as any)
      .schema('health_meta')
      .from('training_profile')
      .upsert(
        { user_id: user.id, source, ...parsed.data.training_profile },
        { onConflict: 'user_id' }
      );
    results.training_profile = { ok: !error, error: error?.message };
  }

  if (parsed.data.body_measurements && Object.keys(parsed.data.body_measurements).length > 0) {
    const { error } = await (supabase as any)
      .schema('health_meta')
      .from('body_measurements')
      .insert({ user_id: user.id, source, ...parsed.data.body_measurements });
    results.body_measurements = { ok: !error, error: error?.message };
  }

  if (parsed.data.daily_wellbeing) {
    const { error } = await (supabase as any)
      .schema('health_meta')
      .from('daily_wellbeing')
      .upsert(
        { user_id: user.id, source, ...parsed.data.daily_wellbeing },
        { onConflict: 'user_id,observed_on' }
      );
    results.daily_wellbeing = { ok: !error, error: error?.message };
  }

  if (parsed.data.injuries && parsed.data.injuries.length > 0) {
    const rows = parsed.data.injuries.map((i) => ({ user_id: user.id, source, ...i }));
    const { error } = await (supabase as any).schema('health_meta').from('injuries').insert(rows);
    results.injuries = { ok: !error, error: error?.message };
  }

  if (parsed.data.nutrition_profile && Object.keys(parsed.data.nutrition_profile).length > 0) {
    const { error } = await (supabase as any)
      .schema('health_meta')
      .from('nutrition_profile')
      .upsert(
        { user_id: user.id, source, ...parsed.data.nutrition_profile },
        { onConflict: 'user_id' }
      );
    results.nutrition_profile = { ok: !error, error: error?.message };
  }

  const allOk = Object.values(results).every((r) => r.ok);
  return NextResponse.json({ success: allOk, sections: results });
}
