/**
 * GET /api/recommendations/[id]/evidence
 *
 * Returns the EvidenceGraph for the target identified by the audit
 * row. Persists evidence_links rows so the GraphRAG sync triggers
 * fire and downstream search can find them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import {
  buildEvidenceGraph,
  persistEvidenceLinks,
  type EvidenceTarget,
} from '@/lib/decision/audit-and-evidence';
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
  } as EvidenceTarget;
  const graph = buildEvidenceGraph(target, {
    user_id: user.id,
    computed_at: new Date().toISOString(),
  });

  try {
    await persistEvidenceLinks(
      supabase as never,
      user.id,
      row.target_kind,
      row.target_id ?? undefined,
      graph,
      row.id
    );
  } catch {
    /* best effort */
  }

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: { kind: 'recommendation', text: subjectTextFromPayload(graph) },
    emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({ graph, governance: { verdict: g.decision.verdict } });
}
