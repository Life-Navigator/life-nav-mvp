import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../../_helper';

// Web proxy for categorized advisor-response reporting (audit finding R-3 / B-22).
//
// This route forwards ONLY the three fields the report contract allows. It is a deliberate
// allowlist, not a passthrough: the advisor chat proxy forwards the whole body because every field
// there is an input the user is entitled to supply, but a report record's identity, tenant, model,
// prompt version, deployment version, routing, policy and evidence metadata are all resolved
// server-side. Forwarding a wider body would let a crafted request smuggle forged metadata into a
// record whose entire purpose is investigating what actually happened.
//
// The core API re-validates everything and resolves ownership from the bearer token, so this
// allowlist is defence in depth rather than the security boundary itself.
export const dynamic = 'force-dynamic';

const ALLOWED_CATEGORIES = new Set([
  'wrong_or_unsupported',
  'inappropriate_or_harmful',
  'incorrect_or_irrelevant_citation',
  'outdated_information',
  'misunderstood_my_situation',
  'privacy_concern',
  'other',
]);

export async function POST(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const incoming = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const turn_id = typeof incoming.turn_id === 'string' ? incoming.turn_id : '';
  const category = typeof incoming.category === 'string' ? incoming.category : '';
  if (!turn_id || !ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ detail: 'Invalid report' }, { status: 400 });
  }

  // Rebuilt field-by-field. Anything else the caller sent is dropped here and never reaches the API.
  const body: Record<string, string> = { turn_id, category };
  if (typeof incoming.explanation === 'string' && incoming.explanation.trim()) {
    body.explanation = incoming.explanation.trim().slice(0, 4000);
  }

  const r = await fetch(`${CORE_API}/v1/analytics/advisor/response-report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
