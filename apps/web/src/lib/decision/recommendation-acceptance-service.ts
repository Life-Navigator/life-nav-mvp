/**
 * RecommendationAcceptanceService
 *
 * Per-action tracking: which AdvisorReasoningService actions did the
 * user accept, reject, modify, defer, complete, or abandon? Powers:
 *
 *   * success_rate            — completed / accepted
 *   * adherence_rate          — mean(adherence_score) over completed
 *   * user_satisfaction       — mean(user_satisfaction) over completed
 *   * outcome_quality         — mean(outcome_quality) over completed
 *   * acceptance/rejection/modification rates per domain
 *
 * Storage: decision_intelligence.recommendation_acceptance (079).
 *
 * The metric computations are pure functions over the row set so they
 * are unit-testable; the loader is a thin Supabase wrapper.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AcceptanceMetrics,
  AcceptanceStatus,
  RecommendationAcceptance,
} from '@/types/decision-journal';

// ---------------------------------------------------------------------------
// Record / update
// ---------------------------------------------------------------------------

export interface RecordAcceptanceInput {
  user_id: string;
  action_id: string;
  recommendation_summary: string;
  advisor_run_id?: string;
  journal_id?: string;
  expected_strength?: number;
  domain?: string;
  status: AcceptanceStatus;
  modified_to?: string;
  reason?: string;
  accepted_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Upsert by (user_id, advisor_run_id, action_id). Calling with a new
 * `status` flips the row's lifecycle without losing history (the
 * old status lives in `metadata.status_history` if the caller passes it).
 */
export async function recordAcceptance(
  supabase: SupabaseClient,
  input: RecordAcceptanceInput
): Promise<RecommendationAcceptance> {
  const now = new Date().toISOString();
  const row = {
    user_id: input.user_id,
    advisor_run_id: input.advisor_run_id ?? null,
    journal_id: input.journal_id ?? null,
    action_id: input.action_id,
    recommendation_summary: input.recommendation_summary,
    expected_strength: input.expected_strength ?? null,
    domain: input.domain ?? null,
    status: input.status,
    modified_to: input.modified_to ?? null,
    reason: input.reason ?? null,
    accepted_at: input.accepted_at ?? (input.status === 'accepted' ? now : null),
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('recommendation_acceptance')
    .upsert(row, { onConflict: 'user_id,advisor_run_id,action_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as RecommendationAcceptance;
}

export interface CompleteActionInput {
  user_id: string;
  action_id: string;
  advisor_run_id?: string | null;
  adherence_score?: number;
  user_satisfaction?: number;
  outcome_quality?: number;
  completed_at?: string;
}

export async function completeAction(
  supabase: SupabaseClient,
  input: CompleteActionInput
): Promise<RecommendationAcceptance> {
  const { data, error } = await supabase
    .from('recommendation_acceptance')
    .update({
      status: 'completed',
      completed_at: input.completed_at ?? new Date().toISOString(),
      adherence_score: input.adherence_score ?? null,
      user_satisfaction: input.user_satisfaction ?? null,
      outcome_quality: input.outcome_quality ?? null,
    })
    .eq('user_id', input.user_id)
    .eq('action_id', input.action_id)
    .eq('advisor_run_id', input.advisor_run_id ?? null)
    .select('*')
    .single();
  if (error) throw error;
  return data as RecommendationAcceptance;
}

// ---------------------------------------------------------------------------
// Pure metric computation — testable with fixtures
// ---------------------------------------------------------------------------

const ACCEPTED_FAMILY: AcceptanceStatus[] = ['accepted', 'completed', 'abandoned', 'modified'];

function meanOrUndefined(arr: Array<number | null | undefined>): number | undefined {
  const filtered = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (filtered.length === 0) return undefined;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function computeMetrics(rows: RecommendationAcceptance[]): AcceptanceMetrics {
  const total = rows.length;
  const safeDiv = (n: number, d: number): number => (d === 0 ? 0 : n / d);

  const accepts = rows.filter((r) => r.status === 'accepted').length;
  const rejects = rows.filter((r) => r.status === 'rejected').length;
  const modifies = rows.filter((r) => r.status === 'modified').length;
  const defers = rows.filter((r) => r.status === 'deferred').length;
  const completes = rows.filter((r) => r.status === 'completed').length;
  const abandons = rows.filter((r) => r.status === 'abandoned').length;

  const denomCompletion = ACCEPTED_FAMILY.reduce(
    (a, s) => a + rows.filter((r) => r.status === s).length,
    0
  );

  const completedRows = rows.filter((r) => r.status === 'completed');

  const mean_adherence = meanOrUndefined(completedRows.map((r) => r.adherence_score));
  const mean_user_satisfaction = meanOrUndefined(completedRows.map((r) => r.user_satisfaction));
  const mean_outcome_quality = meanOrUndefined(completedRows.map((r) => r.outcome_quality));

  // Per-domain breakdown
  const domains = new Set(rows.map((r) => r.domain ?? 'unknown'));
  const by_domain: AcceptanceMetrics['by_domain'] = {};
  for (const d of domains) {
    const sub = rows.filter((r) => (r.domain ?? 'unknown') === d);
    const a = sub.filter((r) => r.status === 'accepted').length;
    const c = sub.filter((r) => r.status === 'completed').length;
    const accDenom = sub.length;
    const compDenom = sub.filter((r) => ACCEPTED_FAMILY.includes(r.status)).length;
    by_domain[d] = {
      total: sub.length,
      accept_rate: safeDiv(a, accDenom),
      completion_rate: safeDiv(c, compDenom),
    };
  }

  return {
    total,
    accept_rate: safeDiv(accepts, total),
    reject_rate: safeDiv(rejects, total),
    modify_rate: safeDiv(modifies, total),
    defer_rate: safeDiv(defers, total),
    completion_rate: safeDiv(completes, denomCompletion),
    abandonment_rate: safeDiv(abandons, denomCompletion),
    mean_adherence,
    mean_user_satisfaction,
    mean_outcome_quality,
    by_domain,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export interface MetricsQuery {
  user_id: string;
  since?: string; // ISO timestamp lower bound on created_at
  until?: string;
  advisor_run_id?: string;
  domain?: string;
}

export async function loadAcceptanceMetrics(
  supabase: SupabaseClient,
  q: MetricsQuery
): Promise<AcceptanceMetrics> {
  let qb = supabase.from('recommendation_acceptance').select('*').eq('user_id', q.user_id);
  if (q.since) qb = qb.gte('created_at', q.since);
  if (q.until) qb = qb.lte('created_at', q.until);
  if (q.advisor_run_id) qb = qb.eq('advisor_run_id', q.advisor_run_id);
  if (q.domain) qb = qb.eq('domain', q.domain);
  const { data, error } = await qb;
  if (error) throw error;
  return computeMetrics((data ?? []) as RecommendationAcceptance[]);
}

// ---------------------------------------------------------------------------
// Re-exports for tests.
// ---------------------------------------------------------------------------
export const __test = { computeMetrics, meanOrUndefined };
