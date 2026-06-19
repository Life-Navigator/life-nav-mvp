/**
 * POST /api/tax/calculate { taxYear } — compute the federal planning estimate from
 * the user's real income + filing status and persist it to tax_profiles.metadata.estimate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { deriveIncomeItems } from '@/lib/services/taxService';
import { computeEstimate, dbToPageFilingStatus } from '@/lib/finance/tax';

export const dynamic = 'force-dynamic';
const CURRENT_YEAR = 2026;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const year = Number(body.taxYear) || CURRENT_YEAR;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb
    .schema('finance')
    .from('tax_profiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('tax_year', year)
    .maybeSingle();

  const filingStatus = dbToPageFilingStatus(profile?.filing_status);
  const derived = await deriveIncomeItems(sb, user.id, year);
  const manual = (profile?.metadata?.incomes as { amount?: number; taxWithheld?: number }[]) || [];
  const estimate = computeEstimate([...derived, ...manual], filingStatus);

  // Persist the estimate into metadata + the summary columns.
  const metadata = { ...(profile?.metadata || {}), estimate };
  const { error } = await sb
    .schema('finance')
    .from('tax_profiles')
    .upsert(
      {
        user_id: user.id,
        tax_year: year,
        filing_status: profile?.filing_status || 'single',
        estimated_income: estimate.grossIncome,
        estimated_tax_liability: estimate.totalTaxLiability,
        effective_tax_rate: estimate.effectiveRate,
        metadata,
      },
      { onConflict: 'user_id,tax_year' }
    );
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/tax/calculate', table: 'finance.tax_profiles' },
    });

  return NextResponse.json({ estimate });
}
