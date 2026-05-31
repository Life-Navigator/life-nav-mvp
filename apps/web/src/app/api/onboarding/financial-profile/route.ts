import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ProfileSchema = z
  .object({
    annual_income: z.number().finite().optional().nullable(),
    income_stability: z
      .enum(['very_stable', 'stable', 'variable', 'unstable'])
      .optional()
      .nullable(),
    employment_type: z
      .enum([
        'w2_full_time',
        'w2_part_time',
        'self_employed',
        '1099_contractor',
        'business_owner',
        'unemployed',
        'retired',
        'student',
        'other',
      ])
      .optional()
      .nullable(),
    household_size: z.number().int().min(1).optional().nullable(),
    spouse_annual_income: z.number().finite().optional().nullable(),
    household_annual_income: z.number().finite().optional().nullable(),
    monthly_expenses: z.number().finite().optional().nullable(),
    monthly_discretionary_income: z.number().finite().optional().nullable(),
    emergency_fund_amount: z.number().finite().optional().nullable(),
    emergency_fund_months: z.number().finite().optional().nullable(),
    credit_score_range: z
      .enum(['below_580', '580_669', '670_739', '740_799', '800_plus', 'unknown'])
      .optional()
      .nullable(),
    credit_card_utilization: z.number().min(0).max(100).optional().nullable(),
    hsa_eligible: z.boolean().optional().nullable(),
    hsa_current_balance: z.number().finite().optional().nullable(),
    fsa_eligible: z.boolean().optional().nullable(),
    fsa_election_amount: z.number().finite().optional().nullable(),
    employer_match_percent: z.number().finite().optional().nullable(),
    employer_match_limit_percent: z.number().finite().optional().nullable(),
    has_pension: z.boolean().optional().nullable(),
    pension_type: z.string().trim().max(64).optional().nullable(),
    monthly_insurance_premiums: z.number().finite().optional().nullable(),
    estimated_marginal_tax_bracket: z.number().min(0).max(1).optional().nullable(),
    estimated_effective_tax_rate: z.number().min(0).max(1).optional().nullable(),
    current_bank: z.string().trim().max(128).optional().nullable(),
    current_brokerage: z.string().trim().max(128).optional().nullable(),
    preferred_financial_institution: z.string().trim().max(128).optional().nullable(),
  })
  .strict();

const PreferenceSchema = z
  .object({
    liquidity_preference: z
      .enum(['very_low', 'low', 'moderate', 'high', 'very_high'])
      .optional()
      .nullable(),
    liquidity_target_months: z.number().finite().optional().nullable(),
    debt_pay_weight: z.number().min(0).max(1).optional().nullable(),
    invest_weight: z.number().min(0).max(1).optional().nullable(),
    save_weight: z.number().min(0).max(1).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

const BodySchema = z.object({
  profile: ProfileSchema.optional(),
  preferences: PreferenceSchema.optional(),
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
  let profileUpdated = false;
  let prefsUpdated = false;

  if (parsed.data.profile && Object.keys(parsed.data.profile).length > 0) {
    const row = { user_id: user.id, source, ...parsed.data.profile };
    const { error } = await (supabase as any)
      .schema('finance')
      .from('user_financial_profile')
      .upsert(row, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    profileUpdated = true;
  }

  if (parsed.data.preferences && Object.keys(parsed.data.preferences).length > 0) {
    const row = { user_id: user.id, source, ...parsed.data.preferences };
    const { error } = await (supabase as any)
      .schema('finance')
      .from('financing_preferences')
      .upsert(row, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    prefsUpdated = true;
  }

  return NextResponse.json({ success: true, profileUpdated, prefsUpdated });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    (supabase as any)
      .schema('finance')
      .from('user_financial_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    (supabase as any)
      .schema('finance')
      .from('financing_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({ profile: profile ?? null, preferences: prefs ?? null });
}
