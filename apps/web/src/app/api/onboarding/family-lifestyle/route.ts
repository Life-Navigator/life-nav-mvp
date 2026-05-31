import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ProfileSchema = z
  .object({
    has_elder_care_responsibilities: z.boolean().optional().nullable(),
    elder_care_notes: z.string().trim().max(2000).optional().nullable(),
    caregiving_hours_per_week: z.number().finite().min(0).optional().nullable(),
    family_financial_obligations_monthly: z.number().finite().min(0).optional().nullable(),
    willing_to_relocate: z
      .enum(['no', 'regional', 'national', 'international'])
      .optional()
      .nullable(),
    must_stay_near_family: z.boolean().optional().nullable(),
    travel_frequency_target: z
      .enum(['rarely', 'occasional', 'frequent', 'extensive'])
      .optional()
      .nullable(),
    travel_budget_annual: z.number().finite().min(0).optional().nullable(),
    lifestyle_goals: z.string().trim().max(4000).optional().nullable(),
    household_priorities: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  })
  .strict();

const ProfileFieldsSchema = z
  .object({
    marital_status: z
      .enum([
        'single',
        'partnered',
        'married',
        'separated',
        'divorced',
        'widowed',
        'prefer_not_to_say',
      ])
      .optional()
      .nullable(),
    dependents_count: z.number().int().min(0).max(50).optional().nullable(),
  })
  .strict();

const BodySchema = z.object({
  profile: ProfileSchema.optional(),
  profile_fields: ProfileFieldsSchema.optional(),
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

  if (parsed.data.profile && Object.keys(parsed.data.profile).length > 0) {
    const { error } = await (supabase as any)
      .from('family_lifestyle_profile')
      .upsert({ user_id: user.id, source, ...parsed.data.profile }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (parsed.data.profile_fields && Object.keys(parsed.data.profile_fields).length > 0) {
    const { error } = await (supabase as any)
      .from('profiles')
      .update(parsed.data.profile_fields)
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: lifestyle }, { data: profile }] = await Promise.all([
    (supabase as any)
      .from('family_lifestyle_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    (supabase as any)
      .from('profiles')
      .select('marital_status, dependents_count')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({ profile: lifestyle ?? null, profile_fields: profile ?? null });
}
