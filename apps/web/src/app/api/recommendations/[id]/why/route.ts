/**
 * GET /api/recommendations/[id]/why
 *
 * The `[id]` is a `recommendation_audit_trail.id`. Returns the
 * structured WhyChain built deterministically from the audit row's
 * `output_summary`. No LLM in the answer path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { buildWhyChain, type WhyChainTarget } from '@/lib/decision/why-chain-builder';
import { loadAuditRow } from '@/lib/decision/trust-route-helpers';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: auditId } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await loadAuditRow(supabase as never, user.id, auditId);
  if (!row) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

  const value = row.output_summary as any;
  const target = {
    kind: row.target_kind,
    value,
    target_id: row.target_id ?? undefined,
  } as WhyChainTarget;
  const chain = buildWhyChain(target, { user_id: user.id, computed_at: new Date().toISOString() });

  // Persist (idempotent — unique key includes computed_at)
  try {
    const sb = supabase as any;
    await sb.from('why_chains').insert({
      user_id: user.id,
      audit_id: row.id,
      target_kind: row.target_kind,
      target_id: row.target_id,
      nodes: chain.nodes,
      edges: chain.edges,
      max_depth: chain.max_depth,
      computed_at: chain.computed_at,
    });
  } catch {
    /* best effort */
  }

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: { kind: 'recommendation', text: subjectTextFromPayload(chain) },
    emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({ chain, governance: { verdict: g.decision.verdict } });
}
