import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../../_helper';

// Web proxy for the LLM-led ADVISOR turn (mode="advisor"), distinct from onboarding's discovery turn.
// The dashboard Advisor and the floating chat both call THIS route once onboarding is complete, so the
// user talks to their ongoing advisor — grounded fact packet + validator/citation gate — never the
// onboarding/discovery interview. Discovery mode stays behind /api/life/discovery-chat (onboarding only).
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/life/advisor/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
