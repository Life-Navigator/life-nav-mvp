import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

/**
 * Unified pilot-instrument feedback proxy → core-api POST /v1/feedback (analytics.pilot_feedback).
 * This is the CANONICAL pilot-measurement path (admin rollup at /v1/admin/pilot-analytics reads it).
 * Accepts any instrument: { kind, metrics:{narrative_accuracy,trust,...}, insight_detected, surprised,
 * thumbs, nps, comment, context }. user_id is stamped server-side from the JWT — never the body.
 * Tokens/PII never returned to the client; only an {ok} ack.
 */
export async function POST(request: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const r = await fetch(`${CORE_API}/v1/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({ ok: false }));
    return NextResponse.json(data, { status: r.status });
  } catch {
    // Never fail the user's feedback action — accept optimistically.
    return NextResponse.json({ ok: true, stored: false }, { status: 200 });
  }
}
