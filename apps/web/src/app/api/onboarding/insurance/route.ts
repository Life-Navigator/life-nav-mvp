import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLAN_TYPES = [
  'medical',
  'dental',
  'vision',
  'pharmacy',
  'mental_health',
  'long_term_disability',
  'short_term_disability',
  'life',
  'accident',
  'critical_illness',
  'auto',
  'home',
  'renters',
  'umbrella',
  'pet',
  'other',
] as const;

const PlanSchema = z.object({
  plan_type: z.enum(PLAN_TYPES),
  carrier: z.string().trim().max(128).optional().nullable(),
  plan_name: z.string().trim().max(256).optional().nullable(),
  plan_id_external: z.string().trim().max(128).optional().nullable(),
  // member_id / group_number arrive plaintext from the client; server encrypts.
  member_id: z.string().trim().max(128).optional().nullable(),
  group_number: z.string().trim().max(128).optional().nullable(),
  effective_date: z.string().date().optional().nullable(),
  termination_date: z.string().date().optional().nullable(),
  is_primary: z.boolean().optional(),
  source_of_coverage: z
    .enum(['employer', 'marketplace', 'medicare', 'medicaid', 'va', 'private'])
    .optional()
    .nullable(),
  monthly_premium: z.number().finite().nonnegative().optional().nullable(),
  annual_deductible: z.number().finite().nonnegative().optional().nullable(),
  deductible_met_ytd: z.number().finite().nonnegative().optional().nullable(),
  out_of_pocket_max: z.number().finite().nonnegative().optional().nullable(),
  out_of_pocket_met_ytd: z.number().finite().nonnegative().optional().nullable(),
  copay_primary_care: z.number().finite().nonnegative().optional().nullable(),
  copay_specialist: z.number().finite().nonnegative().optional().nullable(),
  copay_er: z.number().finite().nonnegative().optional().nullable(),
  copay_urgent_care: z.number().finite().nonnegative().optional().nullable(),
  coinsurance_percent: z.number().min(0).max(100).optional().nullable(),
  hsa_eligible: z.boolean().optional().nullable(),
  fsa_eligible: z.boolean().optional().nullable(),
  hra_eligible: z.boolean().optional().nullable(),
  network_type: z.string().trim().max(32).optional().nullable(),
  network_restrictions: z.string().trim().max(2000).optional().nullable(),
  wellness_benefits_summary: z.string().trim().max(4000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = z
    .object({
      plans: z.array(PlanSchema).max(20),
      source: z.string().trim().min(1).max(64).optional(),
    })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (parsed.data.plans.length === 0) return NextResponse.json({ success: true, created: 0 });

  // Encrypt member_id / group_number via core.encrypt_text() if either is
  // present. We pass the encryption key from the app runtime config so the
  // function works in both local dev and prod.
  const source = parsed.data.source ?? 'onboarding';
  const insertedIds: string[] = [];

  for (const plan of parsed.data.plans) {
    const { member_id, group_number, ...rest } = plan;
    let member_id_encrypted: string | null = null;
    let group_number_encrypted: string | null = null;

    if (member_id) {
      const { data, error } = await (supabase as any)
        .schema('core')
        .rpc('encrypt_with_app_key', { plaintext: member_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (data) member_id_encrypted = data as string;
    }
    if (group_number) {
      const { data, error } = await (supabase as any)
        .schema('core')
        .rpc('encrypt_with_app_key', { plaintext: group_number });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (data) group_number_encrypted = data as string;
    }

    const { data: ins, error: insErr } = await (supabase as any)
      .from('insurance_plans')
      .insert({
        user_id: user.id,
        source,
        is_active: true,
        member_id_encrypted,
        group_number_encrypted,
        ...rest,
      })
      .select('id')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    if (ins?.id) insertedIds.push(ins.id);
  }

  return NextResponse.json({ success: true, created: insertedIds.length, ids: insertedIds });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any)
    .from('insurance_plans')
    // Deliberately excludes member_id_encrypted / group_number_encrypted
    .select(
      'id, plan_type, carrier, plan_name, effective_date, termination_date, is_primary, is_active, source_of_coverage, monthly_premium, annual_deductible, deductible_met_ytd, out_of_pocket_max, out_of_pocket_met_ytd, copay_primary_care, copay_specialist, copay_er, copay_urgent_care, coinsurance_percent, hsa_eligible, fsa_eligible, hra_eligible, network_type, created_at'
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('plan_type', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ plans: data ?? [] });
}
