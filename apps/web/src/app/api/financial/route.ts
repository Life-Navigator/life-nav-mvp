/**
 * GET /api/financial?timeframe=week|month|year
 *
 * Aggregator for the Finance dashboard landing page
 * (apps/web/src/app/dashboard/finance/page.tsx). Returns ONE payload shaped
 * for the dashboard's existing state model:
 *
 *   {
 *     accounts: [...]                    // from finance.financial_accounts
 *     transactions: {
 *       dailySpending: [{date, amount}]  // spend (debit) per day
 *       categorySpending: [{name, value}]// spend (debit) per category
 *       recentTransactions: [...]        // newest first, 50 cap
 *     },
 *     investments: { ... }               // currently empty until investment
 *                                        //   tables are wired (Sprint TBD)
 *     cryptoAssets: []                   // empty for the same reason
 *   }
 *
 * Reads PERSISTED finance.financial_accounts + finance.transactions (the same
 * source the persona-aware recommendation engine reads). No live Plaid call —
 * the worker / persona-activation already populated these tables.
 *
 * The Finance landing page was calling this URL since the brand rebuild but
 * the route file was missing, which is why the dashboard showed empty arrays
 * for every authenticated user. Fix surfaced 2026-06-06.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

type Timeframe = 'week' | 'month' | 'year';

function rangeFor(timeframe: Timeframe): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const startMs =
    timeframe === 'week' ? 7 * 86400_000 : timeframe === 'year' ? 365 * 86400_000 : 30 * 86400_000;
  const start = new Date(now.getTime() - startMs).toISOString().split('T')[0];
  return { start, end };
}

/** Map account_type to the three buckets the Finance landing renders. */
function bucketFor(t: string | null | undefined): 'banking' | 'investment' | 'credit' {
  const s = (t ?? '').toLowerCase();
  if (s.includes('invest') || s.includes('retire') || s.includes('brokerage')) return 'investment';
  if (s.includes('credit') || s.includes('loan')) return 'credit';
  return 'banking';
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Thin proxy to the Core API (orchestration tier) ───────────────────────
  // When CORE_API_URL is set, forward the user's Supabase JWT to the Core API
  // and return its response directly — NO business logic here, and only the
  // user's own JWT travels (never the service-role or Gemini keys). Off by
  // default, so behavior is unchanged until the Core API is deployed AND the
  // finance page consumes the DomainViewModel shape. See FINANCE_PROXY_NOTES.md.
  const coreApiUrl = process.env.CORE_API_URL;
  if (coreApiUrl) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const upstream = await fetch(`${coreApiUrl.replace(/\/$/, '')}/v1/finance/summary`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
      });
    } catch {
      return NextResponse.json({ error: 'finance_service_unavailable' }, { status: 502 });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const sp = request.nextUrl.searchParams;
  const timeframe = (sp.get('timeframe') as Timeframe) || 'month';
  const { start, end } = rangeFor(timeframe);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // ---- 1. Accounts -------------------------------------------------------
    const accountsRes = await sb
      .schema('finance')
      .from('financial_accounts')
      .select(
        'id, account_name, account_type, institution_name, current_balance, currency, plaid_account_id, is_active'
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('current_balance', { ascending: false });

    if (accountsRes.error) throw accountsRes.error;

    const accountsRaw = accountsRes.data ?? [];
    const accounts = accountsRaw.map((a: Record<string, unknown>) => ({
      id: String(a.id ?? ''),
      name: String(a.account_name ?? 'Account'),
      type: bucketFor(a.account_type as string | null),
      balance: Number(a.current_balance ?? 0),
      institution: String(a.institution_name ?? ''),
    }));

    // ---- 2. Transactions ---------------------------------------------------
    const txRes = await sb
      .schema('finance')
      .from('transactions')
      .select(
        'id, account_id, amount, currency, transaction_date, description, merchant, category, transaction_type'
      )
      .eq('user_id', user.id)
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .limit(1000);

    if (txRes.error) throw txRes.error;
    const txRaw = (txRes.data ?? []) as Array<Record<string, unknown>>;

    // Daily spend: sum of debit transactions per day.
    const dailyMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    for (const t of txRaw) {
      const direction = String(t.transaction_type ?? '').toLowerCase();
      const isDebit = direction === 'debit' || direction === 'expense';
      if (!isDebit) continue;
      const amt = Math.abs(Number(t.amount ?? 0));
      const day = String(t.transaction_date ?? '').slice(0, 10);
      if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + amt);
      const cat = String(t.category ?? 'Uncategorized') || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + amt);
    }
    const dailySpending = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const categorySpending = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const recentTransactions = txRaw.slice(0, 50).map((t) => ({
      id: String(t.id ?? ''),
      account_id: String(t.account_id ?? ''),
      amount: Number(t.amount ?? 0),
      currency: String(t.currency ?? 'USD'),
      date: String(t.transaction_date ?? '').slice(0, 10),
      description: String(t.description ?? ''),
      merchant: String(t.merchant ?? ''),
      category: String(t.category ?? ''),
      type: String(t.transaction_type ?? ''),
    }));

    // ---- 3. Investments + Crypto (placeholders) ---------------------------
    // The investment tables aren't yet in finance.* on the linked Supabase
    // project (deferred — see SUPABASE_MIGRATION_RECONCILIATION_REPORT.md
    // and the broken chain that originally carried them). The shape stays
    // stable so the landing page renders empty without crashing.
    const investments = {
      portfolioPerformance: [] as Array<{ date: string; value: number }>,
      assetAllocation: [] as Array<{ name: string; value: number }>,
      holdings: [] as Array<Record<string, unknown>>,
      totalValue: 0,
      dayChange: 0,
      dayChangePercent: 0,
    };
    const cryptoAssets: Array<Record<string, unknown>> = [];

    return NextResponse.json({
      timeframe,
      range: { start, end },
      accounts,
      transactions: {
        dailySpending,
        categorySpending,
        recentTransactions,
      },
      investments,
      cryptoAssets,
    });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
