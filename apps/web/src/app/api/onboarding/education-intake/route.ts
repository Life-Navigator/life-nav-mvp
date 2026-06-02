import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const IntakeSchema = z
  .object({
    highest_completed_degree: z.string().trim().max(64).optional().nullable(),
    current_program: z.string().trim().max(256).optional().nullable(),
    current_institution: z.string().trim().max(256).optional().nullable(),
    expected_completion_date: z.string().date().optional().nullable(),
    tuition_budget_total: z.number().finite().min(0).optional().nullable(),
    tuition_budget_annual: z.number().finite().min(0).optional().nullable(),
    willing_to_take_loans: z.boolean().optional().nullable(),
    expected_roi_preference: z
      .enum(['fast_payback', 'balanced', 'long_term_value'])
      .optional()
      .nullable(),
    credential_urgency: z
      .enum(['none', 'within_year', 'within_2_years', 'within_5_years'])
      .optional()
      .nullable(),
    time_available_for_study_hours_per_week: z.number().finite().min(0).optional().nullable(),
    has_gi_bill: z.boolean().optional().nullable(),
    gi_bill_remaining_months: z.number().finite().min(0).optional().nullable(),
    has_va_benefits: z.boolean().optional().nullable(),
    employer_tuition_reimbursement_annual: z.number().finite().min(0).optional().nullable(),
    scholarships_summary: z.string().trim().max(4000).optional().nullable(),
    desired_schools: z.array(z.string().trim().min(1).max(128)).max(20).optional(),
    financing_options: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  })
  .strict();

const CredentialSchema = z.object({
  credential_kind: z.enum(['certification', 'license', 'badge', 'target_credential']),
  name: z.string().trim().min(1).max(256),
  issuer: z.string().trim().max(256).optional().nullable(),
  issued_at: z.string().date().optional().nullable(),
  expires_at: z.string().date().optional().nullable(),
  status: z.enum(['active', 'expired', 'in_progress', 'target', 'lapsed']).optional(),
  url: z.string().trim().max(1024).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const BodySchema = z.object({
  intake: IntakeSchema.optional(),
  credentials: z.array(CredentialSchema).max(50).optional(),
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

  if (parsed.data.intake && Object.keys(parsed.data.intake).length > 0) {
    const { error } = await (supabase as any)
      .from('education_intake')
      .upsert({ user_id: user.id, source, ...parsed.data.intake }, { onConflict: 'user_id' });
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
  }

  if (parsed.data.credentials && parsed.data.credentials.length > 0) {
    const rows = parsed.data.credentials.map((c) => ({ user_id: user.id, source, ...c }));
    const { error } = await (supabase as any).from('education_credentials').insert(rows);
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
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

  const [{ data: intake }, { data: credentials }] = await Promise.all([
    (supabase as any).from('education_intake').select('*').eq('user_id', user.id).maybeSingle(),
    (supabase as any)
      .from('education_credentials')
      .select('id, credential_kind, name, issuer, status, issued_at, expires_at, url, notes')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false, nullsFirst: false }),
  ]);

  return NextResponse.json({ intake: intake ?? null, credentials: credentials ?? [] });
}
