/**
 * GET /api/goals/[id]/marginal-impact-ranking?horizon=1_year&top_k=10
 *
 * Returns the top-K decisions across domains ranked by marginal
 * impact on the chosen goal at the requested horizon.
 *
 * Candidates are derived from a fixed catalog scoped to the goal's
 * domain (and adjacent domains) — the catalog can be extended without
 * touching the ranker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { rankMarginalImpact } from '@/lib/decision/marginal-impact-ranker';
import { loadGoalContext } from '@/lib/decision/context-loader';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import { TIME_HORIZONS_ORDER, type TimeHorizon, type DomainKey } from '@/types/decision-impact';

export const dynamic = 'force-dynamic';

interface CandidateTemplate {
  decision_label_canonical: string;
  decision_label_user_friendly: string;
  target_goal_concept: string;
  domain: DomainKey;
  base_magnitude: number;
  peak_months?: number;
  decay_tau_months?: number;
  is_structural: boolean;
  structural_variable?: import('@/types/decision-impact').StructuralVariable;
  cost_usd?: number;
  hours_per_week?: number;
  risk_required?: number;
  reason?: string;
}

const CATALOG: CandidateTemplate[] = [
  // financial
  {
    decision_label_canonical: 'reduce_credit_utilization',
    decision_label_user_friendly: 'Reduce credit utilization below 10%',
    target_goal_concept: 'Home Ownership',
    domain: 'financial',
    base_magnitude: 0.18,
    is_structural: false,
    reason: 'Direct FICO uplift unlocks better mortgage terms.',
  },
  {
    decision_label_canonical: 'increase_emergency_fund',
    decision_label_user_friendly: 'Build 6-month emergency fund',
    target_goal_concept: 'Financial Independence',
    domain: 'financial',
    base_magnitude: 0.1,
    is_structural: false,
    cost_usd: 500,
    reason: 'Reduces forced-sell risk; supports entrepreneurship optionality.',
  },
  {
    decision_label_canonical: 'max_401k_match',
    decision_label_user_friendly: 'Max employer 401(k) match',
    target_goal_concept: 'Financial Independence',
    domain: 'financial',
    base_magnitude: 0.15,
    is_structural: true,
    structural_variable: 'income_trajectory',
    reason: 'Compounding tax-advantaged growth.',
  },
  // career / education (structural)
  {
    decision_label_canonical: 'finish_credential',
    decision_label_user_friendly: 'Finish stretch credential (CFA / PMP / JD)',
    target_goal_concept: 'Income Growth',
    domain: 'education',
    base_magnitude: 0.4,
    is_structural: true,
    structural_variable: 'education_credential',
    hours_per_week: 8,
    reason: 'Long-horizon income trajectory shift.',
  },
  {
    decision_label_canonical: 'pursue_promotion',
    decision_label_user_friendly: 'Pursue promotion this cycle',
    target_goal_concept: 'Income Growth',
    domain: 'career',
    base_magnitude: 0.2,
    is_structural: true,
    structural_variable: 'career_path',
    reason: 'Locks in a new salary band that compounds.',
  },
  // health
  {
    decision_label_canonical: 'fix_sleep',
    decision_label_user_friendly: 'Improve sleep duration & consistency',
    target_goal_concept: 'Productivity',
    domain: 'health',
    base_magnitude: 0.12,
    is_structural: true,
    structural_variable: 'health_trajectory',
    reason: 'Cardiometabolic + cognitive baseline shift.',
  },
  {
    decision_label_canonical: 'aerobic_target',
    decision_label_user_friendly: 'Hit AHA aerobic target (150 min/week)',
    target_goal_concept: 'VO2max',
    domain: 'health',
    base_magnitude: 0.1,
    is_structural: false,
    hours_per_week: 3,
    reason: 'Direct VO2max improvement; secondary career productivity.',
  },
  // insurance
  {
    decision_label_canonical: 'add_term_life',
    decision_label_user_friendly: 'Add 20-year term life insurance',
    target_goal_concept: 'Financial Independence',
    domain: 'insurance',
    base_magnitude: 0.06,
    is_structural: true,
    structural_variable: 'family_obligations',
    reason: 'Protective floor on dependents.',
  },
  {
    decision_label_canonical: 'add_ltd',
    decision_label_user_friendly: 'Add long-term disability insurance',
    target_goal_concept: 'Financial Independence',
    domain: 'insurance',
    base_magnitude: 0.05,
    is_structural: false,
    reason: 'Caps income-disruption tail.',
  },
  // estate
  {
    decision_label_canonical: 'complete_estate_docs',
    decision_label_user_friendly: 'Complete will + POA + healthcare directive',
    target_goal_concept: 'Financial Independence',
    domain: 'estate',
    base_magnitude: 0.04,
    is_structural: true,
    structural_variable: 'legal_estate_structure',
    reason: 'Removes probate friction; protects dependents.',
  },
  // benefits
  {
    decision_label_canonical: 'enroll_hsa',
    decision_label_user_friendly: 'Enroll in HSA + HDHP combo',
    target_goal_concept: 'Financial Independence',
    domain: 'benefits',
    base_magnitude: 0.07,
    is_structural: false,
    reason: 'Triple-tax-advantaged growth on health spend.',
  },
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const horizonParam = request.nextUrl.searchParams.get('horizon') ?? '1_year';
  const horizon: TimeHorizon = (TIME_HORIZONS_ORDER as string[]).includes(horizonParam)
    ? (horizonParam as TimeHorizon)
    : '1_year';
  const topK = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get('top_k') ?? 10)));

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await loadGoalContext(supabase, user.id, goalId);
  if (!ctx) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const ranking = rankMarginalImpact({
    user_id: user.id,
    candidates: CATALOG.map((c) => ({
      ...c,
      target_goal_id: goalId,
    })),
    available_surplus_usd: ctx.available_surplus_usd,
    commitment_hours_per_week: ctx.commitment_hours_per_week,
    risk_tolerance: ctx.risk_tolerance_score,
    health_recovery_capacity: ctx.health_recovery_capacity,
    hard_constraint_count: ctx.hard_constraint_count,
    top_k: topK,
    scoring_horizon: horizon,
  });

  // Persist top-K so GraphRAG can ingest the ranking.
  try {
    const rows = ranking.ranked.map((r) => ({
      user_id: user.id,
      goal_id: goalId,
      rank: r.rank,
      decision_label: r.decision,
      target_goal_concept: r.target_goal,
      domain: r.domain,
      marginal_impact: r.marginal_impact,
      time_horizon: r.time_horizon,
      confidence: r.confidence,
      reason: r.reason,
      tradeoffs: r.tradeoffs,
    }));
    if (rows.length > 0) {
      const sb = supabase as any;
      await sb.from('decision_marginal_impacts').insert(rows);
    }
  } catch {
    /* best effort */
  }

  const g = await guardOutgoing({
    supabase,
    user_id: user.id,
    subject: { kind: 'recommendation', text: subjectTextFromPayload(ranking) },
    emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
  });
  if (!g.ok) return g.response;

  return NextResponse.json({ ranking, governance: { verdict: g.decision.verdict } });
}
