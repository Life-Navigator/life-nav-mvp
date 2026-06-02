/**
 * GET /api/goals/[id]/probability?horizon=1_year
 *
 * Returns the probability distribution for this goal at the requested
 * time horizon, with the full XAI envelope. user_id is taken from the
 * server-side Supabase session — never from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { computeProbabilityDistribution } from '@/lib/decision/probability-engine';
import { loadGoalContext } from '@/lib/decision/context-loader';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import { TIME_HORIZONS_ORDER, type TimeHorizon } from '@/types/decision-impact';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const horizonParam = request.nextUrl.searchParams.get('horizon') ?? '1_year';
  const horizon = (TIME_HORIZONS_ORDER as string[]).includes(horizonParam)
    ? (horizonParam as TimeHorizon)
    : '1_year';

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await loadGoalContext(supabase, user.id, goalId);
  if (!ctx) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const distribution = computeProbabilityDistribution(ctx, horizon);

  // Persist (best effort — RLS-bound to user).
  try {
    const row = {
      user_id: user.id,
      goal_id: goalId,
      time_horizon: horizon,
      worst_case: distribution.worst_case,
      p10: distribution.p10,
      p25: distribution.p25,
      most_likely: distribution.most_likely,
      p75: distribution.p75,
      p90: distribution.p90,
      best_case: distribution.best_case,
      confidence: distribution.confidence,
      assumptions: distribution.explanation.assumptions,
      variance_factors: distribution.explanation.variance_factors,
    };
    // Suppress generic-narrowing on dynamic tables not yet in Database types.
    const sb = supabase as any;
    await sb
      .from('goal_probability_distributions')
      .upsert(row, { onConflict: 'user_id,goal_id,time_horizon,scenario_id,decision_id' });
    await sb.from('goal_probability_snapshots').insert({
      user_id: user.id,
      goal_id: goalId,
      time_horizon: horizon,
      most_likely: distribution.most_likely,
      range_width: distribution.best_case - distribution.worst_case,
      confidence: distribution.confidence,
    });
  } catch {
    /* persistence is best-effort; surface the result regardless. */
  }

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: { kind: 'probability_output', text: subjectTextFromPayload(distribution) },
    emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({ distribution, governance: { verdict: g.decision.verdict } });
}
