import { NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

// Real investment data: surfaces /v1/finance/investments (now backed by investment/brokerage accounts
// in finance.financial_accounts when investment_holdings is empty). Honest empty when none.
export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/finance/investments`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
