/**
 * GET /api/investments/analytics
 *
 * Honest, production-safe investment analytics. Position-level holdings are NOT
 * implemented yet (no Plaid Investments holdings sync), so this endpoint NEVER
 * fabricates holdings/allocation/performance. It returns the canonical,
 * user-scoped ACCOUNT-LEVEL investment balance plus an explicit limited-data
 * status, so the page can render real numbers + an honest missing-holdings state.
 *
 * TODO(Plaid Investments): when position-level holdings are persisted (e.g. via
 * Plaid /investments/holdings → finance schema), populate `holdings`, `allocation`,
 * and `performance` from that canonical source. Do not synthesize them here.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Canonical, user-scoped investment accounts (RLS-protected; explicit user_id
  // filter for defense-in-depth). Same source the dashboard/finance summary uses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('financial_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('account_type', 'investment');
    rows = data || [];
  } catch {
    rows = [];
  }

  const accounts = rows.map((a) => ({
    id: a.id,
    name: a.account_name || a.name || 'Investment account',
    subtype: a.account_subtype || a.subtype || 'investment',
    balance: Number(a.current_balance ?? a.balance ?? 0),
  }));
  const accountCount = accounts.length;
  const summed = accounts.reduce((n, a) => n + (a.balance || 0), 0);

  // Authoritative total + lineage from the ONE canonical finance summary (same
  // value the dashboard and finance overview show). Falls back to the summed
  // account balances if the canonical summary is unavailable.
  let totalInvestmentBalance = summed;
  let lastUpdated: string | null = null;
  try {
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (session?.access_token) {
      const r = await fetch(`${CORE_API}/v1/finance/canonical-summary`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (r.ok) {
        const cs = await r.json().catch(() => null);
        if (cs && typeof cs.investment_balance === 'number') {
          totalInvestmentBalance = cs.investment_balance;
        }
        if (cs?.last_updated) lastUpdated = cs.last_updated;
      }
    }
  } catch {
    /* keep the summed fallback */
  }

  const hasInvestments = accountCount > 0 || totalInvestmentBalance > 0;

  return NextResponse.json({
    status: hasInvestments ? 'limited_data' : 'no_investment_accounts',
    totalInvestmentBalance,
    accountCount,
    accounts,
    // No fabricated position-level data — see TODO above.
    holdings: [],
    allocation: null,
    performance: null,
    message: hasInvestments
      ? 'Position-level holdings are not available yet. Showing account-level investment balances from connected accounts.'
      : 'No investment accounts found. Connect a brokerage or add an investment account to see your balances here.',
    dataSource: 'connected_accounts',
    lastUpdated: lastUpdated ?? new Date().toISOString(),
  });
}
