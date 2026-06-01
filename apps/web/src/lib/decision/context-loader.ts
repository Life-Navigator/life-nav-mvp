/**
 * Shared loader that builds the input bundle for the decision engines
 * from the user's persisted state. Used by the five API routes.
 *
 * Each engine has its own input contract, so this loader returns a
 * super-set; the route picks the fields it needs.
 *
 * Reads are RLS-bounded: the function is always called with an
 * authenticated Supabase client; nothing here bypasses owner checks.
 */

import type { DomainKey } from '@/types/decision-impact';

// The new decision-intelligence tables aren't yet in the generated
// Database types, so the loader accepts an untyped client. RLS is
// enforced at the database; loss of compile-time narrowing here does
// not weaken security. The five API routes pass `await
// createServerSupabaseClient()` which is a typed client at the call
// site, but we widen here to keep the loader portable.
type SupabaseClient = any;

export interface GoalContext {
  goal_id: string;
  user_id: string;
  goal_concept?: string;
  domains: DomainKey[];
  current_progress: number;
  current_progress_confidence?: number;
  supporting_goals_count: number;
  required_clear_fraction?: number;
  blocked_goals_count: number;
  recommendation_quality_mean?: number;
  historical_accuracy_mean?: number;
  pathway_effectiveness?: {
    sample_size: number;
    success_rate?: number;
    completion_rate?: number;
    confidence?: number;
  };
  hard_constraint_count: number;
  risk_tolerance_score?: number;
  commitment_hours_per_week?: number;
  available_surplus_usd?: number;
  health_recovery_capacity?: number;
  related_goal_ids: string[];
}

const SCALAR_DOMAINS: DomainKey[] = [
  'financial',
  'career',
  'education',
  'health',
  'insurance',
  'benefits',
  'estate',
  'entrepreneurship',
  'family',
];

function asDomainKey(d?: string | null): DomainKey | undefined {
  if (!d) return undefined;
  return SCALAR_DOMAINS.find((x) => x === d);
}

export async function loadGoalContext(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<GoalContext | null> {
  // 1. The goal itself.
  const { data: goal } = await supabase
    .from('goals')
    .select('id, user_id, title, domain, root_goal, category')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!goal) return null;

  // 2. Most recent progress snapshot.
  const { data: snap } = await supabase
    .from('goal_progress_snapshots')
    .select('score, confidence')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .order('snapshot_at', { ascending: false })
    .limit(1);
  const current_progress = snap && snap.length > 0 ? Number(snap[0].score) : 0;
  const current_progress_confidence =
    snap && snap.length > 0 ? Number(snap[0].confidence ?? 0.5) : undefined;

  // 3. Supporting / blocked counts from goal hierarchy edges.
  const { data: edges } = await supabase
    .from('goal_relationships')
    .select('relationship_type, child_goal_id')
    .eq('user_id', userId)
    .eq('child_goal_id', goalId);
  const supporting_goals_count = (edges ?? []).filter(
    (e) => e.relationship_type === 'SUPPORTS' || e.relationship_type === 'ACCELERATES'
  ).length;
  const blocked_goals_count = (edges ?? []).filter(
    (e) => e.relationship_type === 'BLOCKS' || e.relationship_type === 'CONFLICTS_WITH'
  ).length;

  // 4. Recommendation quality + historical accuracy aggregates.
  const { data: quality } = await supabase
    .from('recommendation_quality_metrics')
    .select('mean_outcome_quality')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(1);
  const recommendation_quality_mean =
    quality && quality.length > 0
      ? Number(quality[0].mean_outcome_quality ?? 0) || undefined
      : undefined;

  const { data: accuracy } = await supabase
    .from('advisor_accuracy')
    .select('mean_observed_outcome_quality, mean_predicted_confidence, brier_score')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(1);
  const historical_accuracy_mean =
    accuracy && accuracy.length > 0
      ? Number(accuracy[0].mean_observed_outcome_quality ?? 0) || undefined
      : undefined;

  // 5. Pathway effectiveness for the goal's root concept.
  const concept = goal.root_goal ?? goal.title;
  let pathway_effectiveness: GoalContext['pathway_effectiveness'];
  if (concept) {
    const { data: pe } = await supabase
      .from('goal_pathway_effectiveness')
      .select('sample_size, success_rate, completion_rate, confidence, user_id')
      .eq('root_goal_concept', concept);
    const rows = (pe ?? []) as Array<{
      sample_size: number;
      success_rate?: number;
      completion_rate?: number;
      confidence?: number;
      user_id?: string | null;
    }>;
    const personal = rows.find((r) => r.user_id === userId);
    const cohort = rows.find((r) => r.user_id == null);
    const pick = personal ?? cohort;
    if (pick) {
      pathway_effectiveness = {
        sample_size: Number(pick.sample_size ?? 0),
        success_rate: pick.success_rate ?? undefined,
        completion_rate: pick.completion_rate ?? undefined,
        confidence: pick.confidence ?? undefined,
      };
    }
  }

  // 6. User-graph signals.
  const { data: cons } = await supabase
    .from('user_constraints')
    .select('severity')
    .eq('user_id', userId)
    .eq('is_active', true);
  const hard_constraint_count = (cons ?? []).filter((c) => c.severity === 'hard').length;

  const { data: risk } = await supabase
    .from('user_domain_risk_tolerance')
    .select('tolerance_score')
    .eq('user_id', userId)
    .eq('domain', (goal.domain as string) ?? 'financial')
    .maybeSingle();
  const risk_tolerance_score = risk ? Number(risk.tolerance_score ?? 0.5) : undefined;

  const { data: comm } = await supabase
    .from('user_commitment_levels')
    .select('hours_per_week')
    .eq('user_id', userId)
    .eq('domain', (goal.domain as string) ?? 'overall')
    .maybeSingle();
  const commitment_hours_per_week = comm ? Number(comm.hours_per_week ?? 0) : undefined;

  // 7. Surplus from finance.user_financial_profile (best effort).
  let available_surplus_usd: number | undefined;
  try {
    const { data: ufp } = await supabase
      .from('user_financial_profile')
      .select('monthly_discretionary_income')
      .eq('user_id', userId)
      .maybeSingle();
    if (ufp?.monthly_discretionary_income != null) {
      available_surplus_usd = Number(ufp.monthly_discretionary_income);
    }
  } catch {
    /* swallow */
  }

  // 8. Domains touched. We can compute from the goal's domain plus
  // related edges if needed; for now just use the goal's domain.
  const domains: DomainKey[] = [];
  const d = asDomainKey(goal.domain as string | null);
  if (d) domains.push(d);
  if (domains.length === 0) domains.push('financial');

  return {
    goal_id: goal.id as string,
    user_id: userId,
    goal_concept: concept ?? undefined,
    domains,
    current_progress,
    current_progress_confidence,
    supporting_goals_count,
    required_clear_fraction:
      supporting_goals_count > 0 ? Math.min(1, supporting_goals_count / 5) : 0,
    blocked_goals_count,
    recommendation_quality_mean,
    historical_accuracy_mean,
    pathway_effectiveness,
    hard_constraint_count,
    risk_tolerance_score,
    commitment_hours_per_week,
    available_surplus_usd,
    health_recovery_capacity: undefined, // wired in Sprint C (Arcana / health activation)
    related_goal_ids: [],
  };
}
