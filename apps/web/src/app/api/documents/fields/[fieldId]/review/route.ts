import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// POST /api/documents/fields/[fieldId]/review — human review of one extracted field: confirm / edit /
// reject. Drives the trust precedence the advisor honors (user_confirmed/user_edited > extracted >
// inferred). Proxies to core-api (user JWT, tenant-scoped).
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { fieldId } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/documents/fields/${encodeURIComponent(fieldId)}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: body.action, new_value: body.new_value ?? '' }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
