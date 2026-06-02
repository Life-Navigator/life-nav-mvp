/**
 * Estate & Legacy intake.
 *
 *   PUT  { profile?: {...}, beneficiaries?: [...] }   upsert
 *   GET                                                read snapshot
 *
 * All values are stored as planning context. The route never returns or
 * stores legal advice — it just persists what the user told the
 * estate-advisor persona.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const ProfileSchema = z
  .object({
    has_will: z.boolean().optional().nullable(),
    will_last_updated: z.string().date().optional().nullable(),
    has_living_trust: z.boolean().optional().nullable(),
    trust_type: z.string().trim().max(64).optional().nullable(),
    trust_last_updated: z.string().date().optional().nullable(),
    has_financial_poa: z.boolean().optional().nullable(),
    financial_poa_holder: z.string().trim().max(256).optional().nullable(),
    has_healthcare_poa: z.boolean().optional().nullable(),
    healthcare_poa_holder: z.string().trim().max(256).optional().nullable(),
    has_healthcare_directive: z.boolean().optional().nullable(),
    has_living_will: z.boolean().optional().nullable(),
    has_hipaa_release: z.boolean().optional().nullable(),
    has_minor_children: z.boolean().optional().nullable(),
    guardian_designated: z.boolean().optional().nullable(),
    guardian_name: z.string().trim().max(256).optional().nullable(),
    guardian_relationship: z.string().trim().max(64).optional().nullable(),
    alternate_guardian_name: z.string().trim().max(256).optional().nullable(),
    charitable_intent: z.string().trim().max(4000).optional().nullable(),
    legacy_goals: z.string().trim().max(4000).optional().nullable(),
    owns_business: z.boolean().optional().nullable(),
    has_business_continuity_plan: z.boolean().optional().nullable(),
    business_continuity_notes: z.string().trim().max(4000).optional().nullable(),
    digital_asset_inventory_status: z.enum(['none', 'partial', 'complete']).optional().nullable(),
    digital_asset_access_method: z.string().trim().max(256).optional().nullable(),
    open_concerns: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();

const BeneficiarySchema = z.object({
  family_member_id: z.string().uuid().optional().nullable(),
  beneficiary_name: z.string().trim().min(1).max(256),
  relationship: z.string().trim().max(64).optional().nullable(),
  asset_class: z
    .enum(['will_residual', 'retirement_account', 'life_insurance', 'trust', 'specific_bequest'])
    .optional()
    .nullable(),
  asset_reference: z.string().trim().max(256).optional().nullable(),
  allocation_percent: z.number().min(0).max(100).optional().nullable(),
  is_contingent: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const BodySchema = z.object({
  profile: ProfileSchema.optional(),
  beneficiaries: z.array(BeneficiarySchema).max(30).optional(),
  replace_beneficiaries: z.boolean().optional().default(false),
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
      .from('estate_planning_profile')
      .upsert({ user_id: user.id, source, ...parsed.data.profile }, { onConflict: 'user_id' });
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
  }

  if (parsed.data.beneficiaries) {
    if (parsed.data.replace_beneficiaries) {
      const { error: delErr } = await (supabase as any)
        .from('estate_beneficiaries')
        .delete()
        .eq('user_id', user.id)
        .eq('source', source);
      if (delErr) return safeApiError({ code: 'validation_failed', internal: delErr });
    }
    if (parsed.data.beneficiaries.length > 0) {
      const rows = parsed.data.beneficiaries.map((b) => ({
        user_id: user.id,
        source,
        ...b,
      }));
      const { error } = await (supabase as any).from('estate_beneficiaries').insert(rows);
      if (error) return safeApiError({ code: 'validation_failed', internal: error });
    }
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

  const [{ data: profile }, { data: beneficiaries }] = await Promise.all([
    (supabase as any)
      .from('estate_planning_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    (supabase as any)
      .from('estate_beneficiaries')
      .select('*')
      .eq('user_id', user.id)
      .order('asset_class', { ascending: true }),
  ]);

  return NextResponse.json({ profile: profile ?? null, beneficiaries: beneficiaries ?? [] });
}
