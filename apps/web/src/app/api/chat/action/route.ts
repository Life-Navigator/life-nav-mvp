import 'server-only';
import { NextResponse } from 'next/server';
import { CORE_API, token } from '@/app/api/life/_helper';

/**
 * Advisor Action Loop proxy. Two ops, both server-authenticated:
 *  - {op:'detect', message}              → core-api detects one of the 5 life-change actions (NO write)
 *  - {op:'apply', action, fields}        → APPROVED write (the user clicked Approve in the action card)
 * Writes happen only in core-api via IngestionService — this route just forwards the bearer token.
 */
export async function POST(req: Request) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const op = body.op === 'apply' ? 'apply' : 'detect';

  const path = op === 'apply' ? '/v1/life/advisor/action/apply' : '/v1/life/advisor/action/detect';
  const payload =
    op === 'apply'
      ? {
          action: body.action,
          fields: body.fields ?? {},
          conversation_id: body.conversation_id ?? '',
        }
      : { message: body.message ?? '' };

  const r = await fetch(`${CORE_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
