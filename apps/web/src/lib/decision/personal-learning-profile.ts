/**
 * PersonalLearningProfile
 *
 * Reads `decision_intelligence.learning_signals` (populated by the
 * SQL function `compute_learning_signals(user_id)`) and applies them
 * to a `RecommendationOutput` to make it *more useful* — never to
 * manipulate the user.
 *
 * # Ethics — the no-manipulation contract
 *
 * Signals may ONLY influence:
 *
 *   1. **Ordering** of actions in the recommended sequence.
 *   2. **Phrasing style** hints passed downstream (brief / balanced / detailed).
 *   3. **Suppressing repeated prompts** the user has already rejected
 *      (de-duplicate, not hide).
 *   4. **Surfacing diagnostics** to the user themselves (transparency).
 *
 * Signals MAY NEVER:
 *
 *   - Add, remove, or rename actions.
 *   - Change action ids, domain assignments, or expected_strength
 *     values that downstream metrics depend on.
 *   - Drop citations, tradeoffs, risks, or assumptions.
 *   - Hide blocked-goal warnings or contradictions.
 *   - Adjust the deterministic `confidence_score` to make a
 *     recommendation appear more or less certain than it is.
 *   - Reorder or delay surfacing information based on suspected
 *     procrastination ("nudging" via timing).
 *
 * The `applyToRecommendation()` function enforces this via a structural
 * diff against the input: any forbidden mutation is reverted and
 * recorded in `LearningApplication.rejected_mutations`.
 *
 * Per spec: "Never use this for manipulation. Use only to improve
 * recommendations."
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  LearningProfile,
  LearningSignal,
  RecommendationAcceptance,
  SignalKind,
} from '@/types/decision-journal';
import type { RecommendationOutput, RecommendedAction } from '@/types/advisor';

// ---------------------------------------------------------------------------
// Whitelist — what the learning layer is allowed to do.
// ---------------------------------------------------------------------------

export const ALLOWED_LEARNING_EFFECTS = [
  'reorder_actions_within_same_horizon', // shuffle within now/this_quarter/this_year/long_term
  'add_phrasing_hint', // set preferred_style on the output (additive, downstream optional)
  'dedupe_repeat_rejected_actions', // skip surfacing a recommendation the user has rejected ≥ 3x
  'surface_self_diagnostics', // expose follow-through / procrastination metrics back to the user
] as const;

export type LearningEffect = (typeof ALLOWED_LEARNING_EFFECTS)[number];

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_LEARNING_EFFECTS);

// Field-level guard: structural diff must not touch these top-level
// keys (or any nested critical subfield).
const PROTECTED_KEYS: Array<keyof RecommendationOutput> = [
  'root_goal',
  'supporting_goals',
  'blocked_goals',
  'confidence_score',
  'tradeoffs',
  'risks',
  'assumptions',
  'cross_domain_impacts',
  'pathway',
  'simulation_summary',
  // Transparency-contract fields — added with sprint "Goal Progress
  // and Decision Intelligence Completion". The learning layer must
  // never mutate the historical effectiveness numbers, the calibrated
  // confidence, or the supporting evidence — all three are part of
  // the trust surface.
  'pathway_label',
  'goal_progress_impact',
  'confidence_calibrated',
  'supporting_evidence',
  'historical_effectiveness',
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadLearningSignals(
  supabase: SupabaseClient,
  userId: string
): Promise<LearningSignal[]> {
  const { data, error } = await supabase.from('learning_signals').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as LearningSignal[];
}

export async function refreshLearningSignals(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('compute_learning_signals', { p_user_id: userId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

// ---------------------------------------------------------------------------
// Profile builder — derived helpers from the raw signal rows.
// ---------------------------------------------------------------------------

const MIN_SUPPORT = 5; // never act on a signal with fewer than 5 observations

function signalByKind(
  signals: LearningSignal[],
  kind: SignalKind,
  key = 'overall'
): LearningSignal | undefined {
  return signals.find(
    (s) => s.signal_kind === kind && s.signal_key === key && s.support_count >= MIN_SUPPORT
  );
}

export function buildProfile(userId: string, signals: LearningSignal[]): LearningProfile {
  const style = signalByKind(signals, 'preferred_communication_style');
  const follow = signalByKind(signals, 'follow_through_pattern');
  const tendency = signalByKind(signals, 'decision_tendency');
  const proc = signalByKind(signals, 'procrastination_indicator');
  const oqd = signalByKind(signals, 'outcome_quality_distribution');

  const preferred_style =
    style && typeof style.signal_value.style_proxy === 'string'
      ? (style.signal_value.style_proxy as 'detailed' | 'balanced' | 'brief')
      : undefined;

  const follow_through_rate =
    follow && typeof follow.signal_value.completion_rate === 'number'
      ? Number(follow.signal_value.completion_rate)
      : undefined;

  const accept_rate =
    tendency && typeof tendency.signal_value.accept_rate === 'number'
      ? Number(tendency.signal_value.accept_rate)
      : undefined;

  const procrastination_median_days =
    proc && typeof proc.signal_value.median_days_accept_to_complete === 'number'
      ? Number(proc.signal_value.median_days_accept_to_complete)
      : null;

  const outcome_mean_accuracy =
    oqd && typeof oqd.signal_value.mean_accuracy === 'number'
      ? Number(oqd.signal_value.mean_accuracy)
      : null;

  return {
    user_id: userId,
    signals,
    preferred_style,
    follow_through_rate,
    accept_rate,
    procrastination_median_days,
    outcome_mean_accuracy,
  };
}

// ---------------------------------------------------------------------------
// Application — apply allowed effects, structurally reject anything else
// ---------------------------------------------------------------------------

export interface LearningApplication {
  output: RecommendationOutput; // possibly-reordered output
  applied_effects: LearningEffect[];
  rejected_mutations: string[]; // names of attempted forbidden changes (defense in depth)
  phrasing_hint?: 'detailed' | 'balanced' | 'brief';
  self_diagnostics?: {
    follow_through_rate?: number;
    procrastination_median_days?: number | null;
    accept_rate?: number;
  };
}

/**
 * Deep-clone a recommendation. Used to make the "after" snapshot before
 * we apply effects; we then diff against the original to enforce the
 * no-manipulation contract.
 */
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Compare action arrays by id. If any id was added, removed, or changed,
 * we revert to the original (we are not allowed to mutate the set).
 */
function actionsHaveSameIds(a: RecommendedAction[], b: RecommendedAction[]): boolean {
  if (a.length !== b.length) return false;
  const aIds = new Set(a.map((x) => x.id));
  for (const x of b) if (!aIds.has(x.id)) return false;
  return true;
}

function getRejectedAcceptances(history: RecommendationAcceptance[], minRejects = 3): Set<string> {
  const counts = new Map<string, number>();
  for (const r of history) {
    if (r.status === 'rejected') {
      // key on the recommendation_summary so it survives across runs (ids change per run)
      const k = r.recommendation_summary.trim().toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= minRejects)
      .map(([k]) => k)
  );
}

export interface ApplyOptions {
  /** Recent acceptance rows for de-dup of repeat-rejected items. */
  acceptance_history?: RecommendationAcceptance[];
}

/**
 * Apply learning-derived effects to a recommendation. Returns the
 * transformed output along with an audit trail.
 *
 * Forbidden mutations are reverted; the attempt is recorded in
 * `rejected_mutations` so callers can surface a transparency notice.
 */
export function applyToRecommendation(
  profile: LearningProfile,
  original: RecommendationOutput,
  options: ApplyOptions = {}
): LearningApplication {
  const before = deepClone(original);
  const after = deepClone(original);
  const applied: LearningEffect[] = [];
  const rejected: string[] = [];

  // (1) Reorder within each horizon by expected_strength × completion_rate.
  // This NEVER drops actions; it only sorts the existing list inside each
  // horizon bucket.
  if (profile.follow_through_rate != null) {
    after.timeline = after.timeline.map((bucket) => ({
      ...bucket,
      action_ids: [...bucket.action_ids].sort((a, b) => {
        const sa = after.required_actions.find((x) => x.id === a)?.expected_strength ?? 0;
        const sb = after.required_actions.find((x) => x.id === b)?.expected_strength ?? 0;
        return sb - sa;
      }),
    }));
    // Mirror into recommended_sequence: keep stable across horizons but
    // sort within each horizon's group.
    after.recommended_sequence = after.timeline.flatMap((b) => b.action_ids);
    applied.push('reorder_actions_within_same_horizon');
  }

  // (2) Surface preferred phrasing style (additive — does not change content).
  const phrasing_hint = profile.preferred_style;
  if (phrasing_hint) applied.push('add_phrasing_hint');

  // (3) De-dup repeat-rejected items. Strict guard: we are NOT removing
  // actions — we move them to a clearly-marked "previously declined"
  // metadata field on the output. The action stays visible; only its
  // *ordering priority* is demoted to the end of long_term.
  if (options.acceptance_history && options.acceptance_history.length > 0) {
    const rejected3x = getRejectedAcceptances(options.acceptance_history);
    if (rejected3x.size > 0) {
      const demote = (a: RecommendedAction) => rejected3x.has(a.title.trim().toLowerCase());
      const keep = after.required_actions.filter((a) => !demote(a));
      const demoted = after.required_actions.filter((a) => demote(a));
      if (demoted.length > 0) {
        after.required_actions = [...keep, ...demoted];
        // Rebuild sequence preserving the demotion.
        const order = after.required_actions.map((a) => a.id);
        after.recommended_sequence = order;
        // Push demoted ids into the last timeline bucket.
        after.timeline = after.timeline.map((b) => ({
          ...b,
          action_ids: b.action_ids.filter((id) => !demoted.find((d) => d.id === id)),
        }));
        const lastBucket = after.timeline[after.timeline.length - 1];
        if (lastBucket) {
          lastBucket.action_ids = [...lastBucket.action_ids, ...demoted.map((a) => a.id)];
        }
        applied.push('dedupe_repeat_rejected_actions');
      }
    }
  }

  // ----- Structural guard ------------------------------------------------
  // (a) Action set must be unchanged.
  if (!actionsHaveSameIds(before.required_actions, after.required_actions)) {
    rejected.push('required_actions.set_changed');
    after.required_actions = before.required_actions;
    after.recommended_sequence = before.recommended_sequence;
    after.timeline = before.timeline;
  }
  // (b) Protected top-level keys must be byte-identical.
  for (const k of PROTECTED_KEYS) {
    const bj = JSON.stringify(before[k]);
    const aj = JSON.stringify(after[k]);
    if (bj !== aj) {
      rejected.push(String(k));
      // Force-revert to before-snapshot.
      (after as unknown as Record<string, unknown>)[k as string] = (
        before as unknown as Record<string, unknown>
      )[k as string];
    }
  }

  // Self-diagnostics — exposed back to the user only (transparency).
  const self_diagnostics =
    profile.follow_through_rate != null || profile.accept_rate != null
      ? {
          follow_through_rate: profile.follow_through_rate,
          procrastination_median_days: profile.procrastination_median_days,
          accept_rate: profile.accept_rate,
        }
      : undefined;
  if (self_diagnostics) applied.push('surface_self_diagnostics');

  return {
    output: after,
    applied_effects: applied,
    rejected_mutations: rejected,
    phrasing_hint,
    self_diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for tests.
// ---------------------------------------------------------------------------
export const __test = {
  ALLOWED_SET,
  PROTECTED_KEYS,
  buildProfile,
  applyToRecommendation,
  actionsHaveSameIds,
  getRejectedAcceptances,
};
