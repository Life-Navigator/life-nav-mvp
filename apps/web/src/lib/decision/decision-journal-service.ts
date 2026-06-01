/**
 * DecisionJournalService
 *
 * Records the full reasoning context behind a decision so the system
 * can close the loop later (compare expected vs actual, harvest
 * lessons, calibrate confidence).
 *
 * Storage lives in the `decision_intelligence` schema (migration 079),
 * surfaced via public read-views.
 *
 * Pure-logic helpers (delta + accuracy computation) are exported
 * separately so they can be unit-tested without Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DecisionExpectation,
  DecisionJournal,
  DecisionOutcome,
  DecisionReview,
  DecisionType,
  ReviewPeriod,
  ReviewVerdict,
} from '@/types/decision-journal';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compute (observed - expected) and a 0..1 accuracy score for numeric
 * expectations. The accuracy curve is symmetric and bounded: a 50%
 * miss scores 0.5, a 100% miss (off by the magnitude of the target)
 * scores 0.
 */
export function computeOutcomeDeltas(
  expected: number | null | undefined,
  observed: number
): { delta_value: number | null; delta_pct: number | null; accuracy_score: number | null } {
  if (expected == null) {
    return { delta_value: null, delta_pct: null, accuracy_score: null };
  }
  const delta = observed - expected;
  const denom = Math.max(1, Math.abs(expected));
  const pct = delta / denom;
  const accuracy = Math.max(0, 1 - Math.min(1, Math.abs(pct)));
  return { delta_value: delta, delta_pct: pct, accuracy_score: accuracy };
}

/**
 * Classify a delta into the six-bucket `ReviewVerdict` enum from 079.
 * Symmetric thresholds: ±10% = as_expected, ±35% = better/worse, beyond = much.
 */
export function verdictFromAccuracy(delta_pct: number | null | undefined): ReviewVerdict {
  if (delta_pct == null) return 'no_signal_yet';
  if (delta_pct >= 0.35) return 'much_better_than_expected';
  if (delta_pct >= 0.1) return 'better_than_expected';
  if (delta_pct > -0.1) return 'as_expected';
  if (delta_pct > -0.35) return 'worse_than_expected';
  return 'much_worse_than_expected';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface RecordDecisionInput {
  user_id: string;
  title: string;
  description?: string;
  decision_type: DecisionType;
  source?: 'user' | 'advisor' | 'scenario_lab' | 'optimizer' | 'external';
  source_run_id?: string;
  related_goal_id?: string;
  related_root_goal_id?: string;
  recommendation_summary?: string;
  reasoning?: string;
  assumptions?: string[];
  system_confidence_at_decision?: number;
  made_at?: string; // ISO; if provided, status -> 'made'
  metadata?: Record<string, unknown>;
}

export interface RecordExpectationInput {
  dimension: string;
  expected_value?: number;
  expected_text?: string;
  expected_unit?: string;
  expected_by?: string;
  confidence?: number;
  rationale?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordOutcomeInput {
  expectation_id?: string;
  dimension: string;
  observed_value?: number;
  observed_text?: string;
  observed_unit?: string;
  observed_at?: string;
  source?: 'self_report' | 'computed' | 'integration' | 'admin';
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Open a journal entry. If `made_at` is set the status flips to `made`
 * immediately; otherwise it stays `pending`.
 */
export async function recordDecision(
  supabase: SupabaseClient,
  input: RecordDecisionInput
): Promise<DecisionJournal> {
  const row = {
    user_id: input.user_id,
    title: input.title,
    description: input.description ?? null,
    decision_type: input.decision_type,
    source: input.source ?? 'user',
    source_run_id: input.source_run_id ?? null,
    related_goal_id: input.related_goal_id ?? null,
    related_root_goal_id: input.related_root_goal_id ?? null,
    recommendation_summary: input.recommendation_summary ?? null,
    reasoning: input.reasoning ?? null,
    assumptions: input.assumptions ?? [],
    system_confidence_at_decision: input.system_confidence_at_decision ?? null,
    status: input.made_at ? 'made' : 'pending',
    made_at: input.made_at ?? null,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase.from('decision_journals').insert(row).select('*').single();
  if (error) throw error;
  return data as DecisionJournal;
}

/** Attach expectations to an existing journal entry. */
export async function recordExpectations(
  supabase: SupabaseClient,
  userId: string,
  journalId: string,
  expectations: RecordExpectationInput[]
): Promise<DecisionExpectation[]> {
  if (expectations.length === 0) return [];
  const rows = expectations.map((e) => ({
    user_id: userId,
    journal_id: journalId,
    dimension: e.dimension,
    expected_value: e.expected_value ?? null,
    expected_text: e.expected_text ?? null,
    expected_unit: e.expected_unit ?? null,
    expected_by: e.expected_by ?? null,
    confidence: e.confidence ?? null,
    rationale: e.rationale ?? null,
    metadata: e.metadata ?? {},
  }));
  const { data, error } = await supabase.from('decision_expectations').insert(rows).select('*');
  if (error) throw error;
  return (data ?? []) as DecisionExpectation[];
}

/**
 * Record an outcome and (if linked to a numeric expectation) auto-fill
 * `delta_value` / `delta_pct` / `accuracy_score`.
 */
export async function recordOutcome(
  supabase: SupabaseClient,
  userId: string,
  journalId: string,
  outcome: RecordOutcomeInput
): Promise<DecisionOutcome> {
  let expectedValue: number | null = null;
  if (outcome.expectation_id) {
    const { data: exp } = await supabase
      .from('decision_expectations')
      .select('expected_value')
      .eq('id', outcome.expectation_id)
      .maybeSingle();
    expectedValue = (exp?.expected_value as number | null) ?? null;
  }
  const { delta_value, delta_pct, accuracy_score } =
    outcome.observed_value != null
      ? computeOutcomeDeltas(expectedValue, outcome.observed_value)
      : { delta_value: null, delta_pct: null, accuracy_score: null };

  const row = {
    user_id: userId,
    journal_id: journalId,
    expectation_id: outcome.expectation_id ?? null,
    dimension: outcome.dimension,
    observed_value: outcome.observed_value ?? null,
    observed_text: outcome.observed_text ?? null,
    observed_unit: outcome.observed_unit ?? null,
    observed_at: outcome.observed_at ?? new Date().toISOString(),
    delta_value,
    delta_pct,
    accuracy_score,
    source: outcome.source ?? 'self_report',
    notes: outcome.notes ?? null,
    metadata: outcome.metadata ?? {},
  };
  const { data, error } = await supabase.from('decision_outcomes').insert(row).select('*').single();
  if (error) throw error;
  return data as DecisionOutcome;
}

export interface RecordReviewInput {
  period: ReviewPeriod;
  verdict?: ReviewVerdict;
  lessons_learned?: string;
  would_repeat?: boolean;
  sentiment_score?: number;
  next_check_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Periodic retrospective. If `verdict` is omitted, infer from outcomes
 * attached to this journal (mean delta_pct over all numeric outcomes).
 */
export async function recordReview(
  supabase: SupabaseClient,
  userId: string,
  journalId: string,
  input: RecordReviewInput
): Promise<DecisionReview> {
  let verdict = input.verdict;
  if (!verdict) {
    const { data: outs } = await supabase
      .from('decision_outcomes')
      .select('delta_pct')
      .eq('journal_id', journalId)
      .not('delta_pct', 'is', null);
    const arr = (outs ?? []).map((o) => Number(o.delta_pct)).filter((n) => Number.isFinite(n));
    const mean = arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
    verdict = verdictFromAccuracy(mean);
  }
  const row = {
    user_id: userId,
    journal_id: journalId,
    reviewed_at: new Date().toISOString(),
    period: input.period,
    verdict,
    lessons_learned: input.lessons_learned ?? null,
    would_repeat: input.would_repeat ?? null,
    sentiment_score: input.sentiment_score ?? null,
    next_check_at: input.next_check_at ?? null,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('decision_reviews')
    .upsert(row, { onConflict: 'journal_id,period' })
    .select('*')
    .single();
  if (error) throw error;
  return data as DecisionReview;
}

/** Mark a decision rescinded; chain to a superseding journal if provided. */
export async function rescindDecision(
  supabase: SupabaseClient,
  journalId: string,
  supersededBy?: string
): Promise<void> {
  const { error } = await supabase
    .from('decision_journals')
    .update({
      status: supersededBy ? 'superseded' : 'rescinded',
      rescinded_at: new Date().toISOString(),
      superseded_by: supersededBy ?? null,
    })
    .eq('id', journalId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Re-exports for tests.
// ---------------------------------------------------------------------------
export const __test = { computeOutcomeDeltas, verdictFromAccuracy };
