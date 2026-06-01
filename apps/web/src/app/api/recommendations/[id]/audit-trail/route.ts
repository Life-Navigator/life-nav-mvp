/**
 * GET /api/recommendations/[id]/audit-trail
 *
 * Straight read of the audit row + its linked why_chains,
 * evidence_links, recommendation_assumptions, counterfactual_scenarios
 * so the UI can render the full deterministic trust surface in one
 * round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { auditToEntry, loadAuditRow } from '@/lib/decision/trust-route-helpers';

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

  const sb = supabase as any;
  const [{ data: chains }, { data: evs }, { data: assumps }, { data: cfs }] = await Promise.all([
    sb.from('why_chains').select('*').eq('user_id', user.id).eq('audit_id', auditId),
    sb.from('evidence_links').select('*').eq('user_id', user.id).eq('audit_id', auditId),
    sb
      .from('recommendation_assumptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('audit_id', auditId),
    sb.from('counterfactual_scenarios').select('*').eq('user_id', user.id).eq('audit_id', auditId),
  ]);

  return NextResponse.json({
    entry: auditToEntry(row),
    why_chains: chains ?? [],
    evidence_links: evs ?? [],
    assumptions: assumps ?? [],
    counterfactual_scenarios: cfs ?? [],
  });
}
