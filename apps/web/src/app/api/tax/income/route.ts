/**
 * GET  /api/tax/income?year= — income items derived from REAL finance data.
 * POST /api/tax/income       — add a manual income item (stored in tax_profiles.metadata).
 *
 * Derived income (transactions + salary) is combined with any manually-entered
 * items the user saved. See lib/services/taxService for the honest derivation rules.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { deriveIncomeItems } from '@/lib/services/taxService';

export const dynamic = 'force-dynamic';
const CURRENT_YEAR = 2026;

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const year = Number(new URL(req.url).searchParams.get('year')) || CURRENT_YEAR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const derived = await deriveIncomeItems(sb, user.id, year);

  // Merge manual items saved in the tax profile metadata.
  let manual: unknown[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('tax_profiles')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('tax_year', year)
      .maybeSingle();
    manual = (data?.metadata?.incomes as unknown[]) || [];
  } catch {
    manual = [];
  }

  return NextResponse.json({ incomes: [...derived, ...manual] });
}

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const year = Number(body.taxYear) || CURRENT_YEAR;

  const item = {
    id: `manual:${year}:${body.category || 'other'}:${Math.round(Number(body.amount) || 0)}`,
    taxProfileId: '',
    category: body.category || 'other',
    source: body.source || 'Manual entry',
    amount: Number(body.amount) || 0,
    frequency: body.frequency || 'annual',
    taxWithheld: Number(body.taxWithheld) || 0,
    is1099: !!body.is1099,
    isW2: !!body.isW2,
    expenses: Number(body.expenses) || 0,
    qbiEligible: !!body.qbiEligible,
    isQualified: !!body.isQualified,
    documentIds: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // Load-merge-write the manual income list in metadata (no dedicated table needed).
  const { data: existing } = await sb
    .schema('finance')
    .from('tax_profiles')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('tax_year', year)
    .maybeSingle();
  const metadata = existing?.metadata || {};
  metadata.incomes = [...((metadata.incomes as unknown[]) || []), item];

  const { error } = await sb
    .schema('finance')
    .from('tax_profiles')
    .upsert(
      {
        user_id: user.id,
        tax_year: year,
        filing_status: existing?.filing_status || 'single',
        metadata,
      },
      { onConflict: 'user_id,tax_year' }
    );
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/tax/income', table: 'finance.tax_profiles' },
    });

  return NextResponse.json({ income: item });
}
