import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    current_income: z.number().finite().min(0).optional().nullable(),
    income_trajectory: z
      .enum(['declining', 'stable', 'growing', 'rapidly_growing'])
      .optional()
      .nullable(),
    promotion_target: z.string().trim().max(256).optional().nullable(),
    target_income: z.number().finite().min(0).optional().nullable(),
    time_for_upskilling_hours_per_week: z.number().finite().min(0).max(168).optional().nullable(),
    job_change_willingness: z
      .enum(['not_open', 'passive', 'active', 'actively_searching'])
      .optional()
      .nullable(),
    entrepreneurial_interest: z
      .enum(['none', 'curious', 'side_hustle', 'committed', 'currently_running'])
      .optional()
      .nullable(),
    networking_capacity: z
      .enum(['very_low', 'low', 'moderate', 'high', 'very_high'])
      .optional()
      .nullable(),
    relocation_willingness: z
      .enum(['not_willing', 'regional_only', 'national', 'international'])
      .optional()
      .nullable(),
    skill_gaps: z.array(z.string().trim().min(1).max(128)).max(30).optional(),
  })
  .strict();

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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ success: true, noop: true });
  }

  // career_profiles has UNIQUE(user_id). Upsert ensures row exists.
  const { error } = await (supabase as any)
    .from('career_profiles')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('career_profiles')
    .select(
      'current_income, income_trajectory, promotion_target, target_income, time_for_upskilling_hours_per_week, job_change_willingness, entrepreneurial_interest, networking_capacity, relocation_willingness, skill_gaps'
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ extended: data ?? null });
}
