/**
 * GET  /api/tax/profile?year= — the user's tax profile + latest persisted estimate.
 * POST /api/tax/profile       — create/update the profile for a year.
 *
 * Reads finance.tax_profiles (RLS, migration 031). The computed estimate is stored
 * in tax_profiles.metadata.estimate by /api/tax/calculate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { dbToPageFilingStatus, pageToDbFilingStatus } from '@/lib/finance/tax';

export const dynamic = 'force-dynamic';

const CURRENT_YEAR = 2026;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    taxYear: r.tax_year,
    filingStatus: dbToPageFilingStatus(r.filing_status),
    state: r.state ?? undefined,
    dependents: r.dependents ?? 0,
    isBlind: false,
    isOver65: false,
    spouseIsBlind: false,
    spouseIsOver65: false,
    status: (r.metadata?.status as string) || 'in_progress',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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
  const { data } = await sb
    .schema('finance')
    .from('tax_profiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('tax_year', year)
    .maybeSingle();

  if (!data) return NextResponse.json({ profile: null, latestEstimate: null });
  return NextResponse.json({
    profile: mapProfile(data),
    latestEstimate: data.metadata?.estimate ?? null,
  });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .schema('finance')
    .from('tax_profiles')
    .upsert(
      {
        user_id: user.id,
        tax_year: year,
        filing_status: pageToDbFilingStatus(body.filingStatus),
        dependents: Number(body.dependents) || 0,
        state: body.state || null,
      },
      { onConflict: 'user_id,tax_year' }
    )
    .select('*')
    .single();
  if (error)
    return safeApiError({
      code: 'db_persistence_error',
      internal: error,
      context: { route: '/api/tax/profile', table: 'finance.tax_profiles' },
    });

  return NextResponse.json({ profile: mapProfile(data) });
}
