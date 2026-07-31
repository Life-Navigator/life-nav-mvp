/**
 * GET/PATCH /api/admin/response-reports/[id] — proxy for one report's evidence and review updates.
 *
 * PATCH forwards an ALLOWLIST of six mutable fields. Evidence, reporter, tenant, turn and category
 * are absent by construction, so no request shape can reach them even before the API refuses.
 * There is deliberately no DELETE handler.
 */
import { NextRequest, NextResponse } from 'next/server';

import { CORE_API, token } from '../../../life/_helper';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const upstream = await fetch(`${CORE_API}/v1/analytics/admin/response-reports/${id}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Report unavailable' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const incoming = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Allowlist, rebuilt field-by-field. A spread would let a crafted request carry evidence columns.
  const body: Record<string, unknown> = {};
  for (const key of ['assigned_to', 'severity', 'review_status', 'note', 'duplicate_of'] as const) {
    if (typeof incoming[key] === 'string' && incoming[key]) body[key] = incoming[key];
  }
  if (incoming.escalate === true) body.escalate = true;

  try {
    const upstream = await fetch(`${CORE_API}/v1/analytics/admin/response-reports/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 502 });
  }
}
