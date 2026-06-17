/**
 * GET  /api/investments/holdings — the user's position-level holdings (finance.investment_holdings),
 *                                  RLS-scoped (explicit user_id for defense-in-depth).
 * POST /api/investments/holdings — manually add a holding.
 *
 * The Investments page "Add Holding" form posts here. Friendly form fields (ticker, shares,
 * costBasis, currentPrice, accountName, ...) are mapped to the REAL finance.investment_holdings
 * columns by financeService.mapEntry('investment', ...) and whitelisted, then written under the
 * USER session (RLS: auth.uid() = user_id). No fake rows; no service-role for user writes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createFinanceEntry, listFinanceEntries } from '@/lib/services/financeService';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const holdings = await listFinanceEntries(supabase, user.id, 'investment');
    return NextResponse.json({ holdings });
  } catch (err) {
    return safeApiError({
      code: 'internal_error',
      internal: err,
      context: { route: '/api/investments/holdings', table: 'finance.investment_holdings' },
    });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    // Require a symbol (ticker) and a positive share count — anything else is invalid.
    const symbol = body?.symbol ?? body?.ticker;
    const shares = body?.shares ?? body?.quantity;
    if (!symbol || shares == null || shares === '' || Number(shares) <= 0) {
      return safeApiError({
        code: 'validation_failed',
        publicMessage: 'A ticker symbol and a positive number of shares are required.',
        context: { route: '/api/investments/holdings', field: 'ticker|shares' },
      });
    }
    const holding = await createFinanceEntry(supabase, user.id, 'investment', body || {});
    return NextResponse.json({ holding }, { status: 201 });
  } catch (err) {
    return safeApiError({
      code: 'db_persistence_error',
      internal: err,
      context: { route: '/api/investments/holdings', table: 'finance.investment_holdings' },
    });
  }
}
