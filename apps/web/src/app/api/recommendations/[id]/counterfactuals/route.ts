/**
 * POST /api/recommendations/[id]/counterfactuals
 *
 * Returns the ranked counterfactual list for the target identified by
 * the audit row. The audit row's `input_snapshot` is the source of
 * truth — we re-run the engines with perturbations applied.
 *
 * Body (optional): { persist?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import {
  counterfactualsForCatchUp,
  counterfactualsForDecisionImpact,
  counterfactualsForProbability,
} from '@/lib/decision/counterfactual-engine';
import { loadAuditRow } from '@/lib/decision/trust-route-helpers';
import { TIME_HORIZONS_ORDER, type TimeHorizon } from '@/types/decision-impact';

export const dynamic = 'force-dynamic';

const Body = z.object({ persist: z.boolean().default(false) }).default({ persist: false });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: auditId } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const row = await loadAuditRow(supabase as never, user.id, auditId);
  if (!row) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

  const snapshot = row.input_snapshot as any;
  let scenarios: ReturnType<typeof counterfactualsForDecisionImpact> = [];
  switch (row.target_kind) {
    case 'goal_decision_impact':
      scenarios = counterfactualsForDecisionImpact(snapshot);
      break;
    case 'goal_probability_distribution': {
      const h: TimeHorizon = (TIME_HORIZONS_ORDER as string[]).includes(snapshot.time_horizon)
        ? snapshot.time_horizon
        : '1_year';
      scenarios = counterfactualsForProbability(snapshot, h);
      break;
    }
    case 'catch_up_plan':
      scenarios = counterfactualsForCatchUp(snapshot);
      break;
    default:
      return NextResponse.json({
        scenarios: [],
        note: 'No counterfactual generator for this target_kind.',
      });
  }

  if (parsed.data.persist) {
    try {
      const sb = supabase as any;
      const rows = scenarios.map((s) => ({
        user_id: user.id,
        audit_id: row.id,
        target_kind: row.target_kind,
        target_id: row.target_id,
        scenario_label: s.scenario_label,
        perturbation: s.perturbation,
        expected_outcome: s.expected_outcome,
        new_top_recommendation: s.new_top_recommendation ?? null,
        new_confidence: s.new_confidence ?? null,
        delta_summary: s.delta_summary,
        sensitivity: s.sensitivity,
      }));
      if (rows.length > 0) await sb.from('counterfactual_scenarios').insert(rows);
    } catch {
      /* best effort */
    }
  }

  return NextResponse.json({ scenarios });
}
