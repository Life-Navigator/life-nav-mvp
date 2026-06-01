/**
 * RecommendationQualityService + PathwayEffectivenessService
 *
 * Reads `recommendation_acceptance` + `decision_outcomes` and emits
 * per-(period, type, domain, root_goal) aggregates into
 * `recommendation_quality_metrics`.
 *
 * Also exposes a pathway-effectiveness scorer: given a `GoalPathway`
 * (from GoalPathService), compute a deterministic signature and look
 * up the historical success/completion rate row.
 *
 * Both surfaces are pure-data: input = rows, output = metric rows. No
 * LLM is involved.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { GoalPathway, PathwayEdge } from '@/types/goal-hierarchy';
import type { AcceptanceStatus, RecommendationAcceptance } from '@/types/decision-journal';
import type {
  PathwayEffectiveness,
  ProgressPeriod,
  RecommendationQualityMetric,
} from '@/types/decision-intelligence';

// ---------------------------------------------------------------------------
// Recommendation quality aggregation
// ---------------------------------------------------------------------------

const ACCEPTED_FAMILY: AcceptanceStatus[] = ['accepted', 'completed', 'abandoned', 'modified'];

export interface QualityGroupKey {
  period: ProgressPeriod;
  period_start: string;
  recommendation_type: string;
  domain: string;
  root_goal_id?: string | null;
  advisor_run_id?: string | null;
}

export interface QualityAggregate extends QualityGroupKey {
  total: number;
  accepted: number;
  rejected: number;
  modified: number;
  deferred: number;
  completed: number;
  abandoned: number;
  success_rate: number;
  completion_rate: number;
  mean_outcome_quality: number | null;
  mean_user_satisfaction: number | null;
}

/**
 * Pure aggregation: groups rows by key and computes per-group metrics.
 *
 *   success_rate    = completed / (accepted + completed + abandoned + modified)
 *   completion_rate = completed / max(1, total)
 */
export function aggregateRecommendationQuality(
  rows: RecommendationAcceptance[],
  key: Omit<QualityGroupKey, 'period_start'> & {
    period_window_start: string;
  }
): QualityAggregate {
  const total = rows.length;
  const status = (s: AcceptanceStatus) => rows.filter((r) => r.status === s).length;
  const accepted = status('accepted');
  const rejected = status('rejected');
  const modified = status('modified');
  const deferred = status('deferred');
  const completed = status('completed');
  const abandoned = status('abandoned');
  const acceptedFamilyN = ACCEPTED_FAMILY.reduce((a, s) => a + status(s), 0);

  const completedRows = rows.filter((r) => r.status === 'completed');
  const meanOQ = meanOrNull(completedRows.map((r) => r.outcome_quality ?? null));
  const meanSat = meanOrNull(completedRows.map((r) => r.user_satisfaction ?? null));

  return {
    period: key.period,
    period_start: key.period_window_start,
    recommendation_type: key.recommendation_type,
    domain: key.domain,
    root_goal_id: key.root_goal_id ?? null,
    advisor_run_id: key.advisor_run_id ?? null,
    total,
    accepted,
    rejected,
    modified,
    deferred,
    completed,
    abandoned,
    success_rate: safeDiv(completed, acceptedFamilyN),
    completion_rate: safeDiv(completed, Math.max(1, total)),
    mean_outcome_quality: meanOQ,
    mean_user_satisfaction: meanSat,
  };
}

export async function persistRecommendationQuality(
  supabase: SupabaseClient,
  userId: string,
  agg: QualityAggregate
): Promise<RecommendationQualityMetric> {
  const row = {
    user_id: userId,
    period: agg.period,
    period_start: agg.period_start,
    recommendation_type: agg.recommendation_type,
    domain: agg.domain,
    root_goal_id: agg.root_goal_id ?? null,
    advisor_run_id: agg.advisor_run_id ?? null,
    total: agg.total,
    accepted: agg.accepted,
    rejected: agg.rejected,
    modified: agg.modified,
    deferred: agg.deferred,
    completed: agg.completed,
    abandoned: agg.abandoned,
    success_rate: agg.success_rate,
    completion_rate: agg.completion_rate,
    mean_outcome_quality: agg.mean_outcome_quality,
    mean_user_satisfaction: agg.mean_user_satisfaction,
    computed_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('recommendation_quality_metrics')
    .upsert(row, {
      onConflict: 'user_id,period,period_start,recommendation_type,domain,root_goal_id',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as RecommendationQualityMetric;
}

// ---------------------------------------------------------------------------
// Pathway effectiveness
// ---------------------------------------------------------------------------

/**
 * Deterministic signature for a pathway. We use the ordered sequence
 * of `(label, target_id)` pairs so two pathways that visit the same
 * nodes in the same order share a signature, but rearrangements do
 * not. SHA-1 truncated to 16 hex chars is plenty for collision
 * resistance at the per-user scale.
 */
export function pathwaySignature(pathway: { edges: PathwayEdge[] }): string {
  const canon = pathway.edges.map((e) => `${e.label}:${e.target}`).join('|');
  return createHash('sha1').update(canon).digest('hex').slice(0, 16);
}

export function pathwayLabelFor(pathway: GoalPathway): string {
  // Concise label derived from the most-traversed labels.
  if (pathway.edges.length === 0) return 'Empty pathway';
  const counts = new Map<string, number>();
  for (const e of pathway.edges) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([l]) => prettyLabel(l));
  if (top.length === 1) return `${top[0]} pathway`;
  return `${top[0]} + ${top[1]} pathway`;
}

function prettyLabel(l: string): string {
  return l
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PersistPathwayEffectivenessInput {
  user_id?: string | null; // NULL = global cohort
  root_goal_concept: string;
  pathway: GoalPathway;
  sample_size?: number;
  success_count?: number;
  success_rate?: number;
  completion_rate?: number;
  mean_duration_months?: number;
  confidence?: number;
}

export async function persistPathwayEffectiveness(
  supabase: SupabaseClient,
  input: PersistPathwayEffectivenessInput
): Promise<PathwayEffectiveness> {
  const signature = pathwaySignature(input.pathway);
  const label = pathwayLabelFor(input.pathway);
  const row = {
    user_id: input.user_id ?? null,
    root_goal_concept: input.root_goal_concept,
    pathway_signature: signature,
    pathway_label: label,
    pathway_edges: input.pathway.edges.map((e) => ({
      label: e.label,
      target_canonical_name: e.target,
    })),
    sample_size: input.sample_size ?? 1,
    success_count: input.success_count ?? 0,
    success_rate:
      input.success_rate ??
      (input.success_count != null && input.sample_size
        ? input.success_count / input.sample_size
        : null),
    completion_rate: input.completion_rate ?? null,
    mean_duration_months: input.mean_duration_months ?? null,
    confidence: input.confidence ?? null,
    computed_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('goal_pathway_effectiveness')
    .upsert(row, { onConflict: 'user_id,root_goal_concept,pathway_signature' })
    .select('*')
    .single();
  if (error) throw error;
  return data as PathwayEffectiveness;
}

export async function loadPathwayEffectiveness(
  supabase: SupabaseClient,
  userId: string | null,
  rootGoalConcept: string,
  pathwaySignatureValue?: string
): Promise<PathwayEffectiveness[]> {
  let qb = supabase
    .from('goal_pathway_effectiveness')
    .select('*')
    .eq('root_goal_concept', rootGoalConcept);
  if (userId === null) {
    qb = qb.is('user_id', null);
  } else {
    qb = qb.or(`user_id.eq.${userId},user_id.is.null`);
  }
  if (pathwaySignatureValue) qb = qb.eq('pathway_signature', pathwaySignatureValue);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as PathwayEffectiveness[];
}

/**
 * Pick the best-scoring effectiveness row from a list. Prefers
 * personal rows when present, otherwise global cohort.
 */
export function pickBestEffectiveness(
  rows: PathwayEffectiveness[]
): PathwayEffectiveness | undefined {
  if (rows.length === 0) return undefined;
  const personal = rows.filter((r) => r.user_id != null);
  const candidates = personal.length > 0 ? personal : rows;
  return candidates.sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0))[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}
function meanOrNull(arr: Array<number | null | undefined>): number | null {
  const f = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

export const __test = {
  aggregateRecommendationQuality,
  pathwaySignature,
  pathwayLabelFor,
  pickBestEffectiveness,
};
