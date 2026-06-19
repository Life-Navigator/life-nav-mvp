/**
 * GET /api/investments/analytics
 *
 * Honest, production-safe investment analytics. Position-level holdings come from
 * the canonical finance.investment_holdings table (manual entry, the /add page,
 * document extraction, and persona seeding all write here). This endpoint NEVER
 * fabricates market data it doesn't have (day change, P/E, 52-week range stay 0).
 * When no holdings exist it falls back to account-level investment balances and an
 * explicit limited-data status so the page renders real numbers or an honest
 * missing-holdings state.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listFinanceEntries } from '@/lib/services/financeService';

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

  // Position-level holdings from the canonical finance.investment_holdings table.
  // Map the REAL columns (quantity/cost_basis/current_price/current_value) to the
  // page's holding shape. Market-data fields we don't track stay 0 (no fabrication).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let holdings: any[] = [];
  try {
    const rows = await listFinanceEntries(sb, user.id, 'investment');
    holdings = (rows || []).map((h: Record<string, unknown>) => {
      const shares = Number(h.quantity ?? 0);
      const currentPrice = h.current_price != null ? Number(h.current_price) : 0;
      const costBasisPerShare = h.cost_basis != null ? Number(h.cost_basis) : 0;
      const marketValue = h.current_value != null ? Number(h.current_value) : shares * currentPrice;
      const costTotal = costBasisPerShare * shares;
      return {
        ticker: h.symbol,
        symbol: h.symbol,
        name: (h.name as string) ?? (h.symbol as string),
        shares,
        costBasis: costBasisPerShare, // page multiplies by shares
        currentPrice,
        marketValue,
        unrealizedGain: marketValue - costTotal,
        unrealizedGainPercent: costTotal > 0 ? (marketValue - costTotal) / costTotal : 0,
        sector: (h.sector as string) ?? 'Other',
        assetClass: (h.asset_class as string) ?? null,
        // Market data we do not track — never fabricated.
        dividendYield: 0,
        dayChange: 0,
        dayChangePercent: 0,
        peRatio: 0,
        fiftyTwoWeekHigh: 0,
        fiftyTwoWeekLow: 0,
      };
    });
  } catch {
    holdings = [];
  }

  const status = holdings.length
    ? 'has_holdings'
    : hasInvestments
      ? 'limited_data'
      : 'no_investment_accounts';

  return NextResponse.json({
    status,
    totalInvestmentBalance,
    accountCount,
    accounts,
    holdings,
    allocation: null,
    performance: null,
    message: holdings.length
      ? 'Showing your position-level holdings.'
      : hasInvestments
        ? 'Position-level holdings are not available yet. Showing account-level investment balances from connected accounts.'
        : 'No investment accounts found. Connect a brokerage or add an investment account to see your balances here.',
    dataSource: holdings.length ? 'investment_holdings' : 'connected_accounts',
    lastUpdated: lastUpdated ?? new Date().toISOString(),
  });
}
