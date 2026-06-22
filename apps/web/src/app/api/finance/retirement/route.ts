import { NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

// Real retirement data: surfaces /v1/finance/retirement (now backed by retirement/401k/IRA accounts in
// finance.financial_accounts when retirement_plans is empty). Honest empty when none.
export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/finance/retirement`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
