/**
 * GET /api/recommendations/[id]/assumptions
 *
 * Returns the deduped, severity-ranked assumption list extracted from
 * the audit row's output_summary. Persists into
 * `recommendation_assumptions` so subsequent reads can use the
 * indexed table directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import {
  aggregateAssumptions,
  extractFromAhead,
  extractFromCatchUp,
  extractFromDecisionImpact,
  extractFromProbability,
  extractFromRanker,
  extractFromRecommendation,
} from '@/lib/decision/assumption-engine';
import { loadAuditRow } from '@/lib/decision/trust-route-helpers';

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
  let items: ReturnType<typeof aggregateAssumptions> = [];
  switch (row.target_kind) {
    case 'recommendation_output':
      items = aggregateAssumptions([extractFromRecommendation(value)]);
      break;
    case 'goal_decision_impact':
      items = aggregateAssumptions([extractFromDecisionImpact(value)]);
      break;
    case 'goal_probability_distribution':
      items = aggregateAssumptions([extractFromProbability(value)]);
      break;
    case 'catch_up_plan':
      items = aggregateAssumptions([extractFromCatchUp(value)]);
      break;
    case 'ahead_of_plan_plan':
      items = aggregateAssumptions([extractFromAhead(value)]);
      break;
    case 'marginal_impact_ranking':
      items = aggregateAssumptions([extractFromRanker(value)]);
      break;
  }

  try {
    const sb = supabase as any;
    const rows = items.map((x) => ({
      user_id: user.id,
      audit_id: row.id,
      target_kind: row.target_kind,
      target_id: row.target_id,
      assumption_text: x.text,
      severity: x.severity,
      sensitivity: x.sensitivity,
      source_engine: x.source_engine,
      source_field: x.source_field ?? null,
    }));
    if (rows.length > 0) await sb.from('recommendation_assumptions').insert(rows);
  } catch {
    /* best effort */
  }

  return NextResponse.json({ assumptions: items });
}
