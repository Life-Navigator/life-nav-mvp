/**
 * @jest-environment node
 *
 * Tests for the PersonalLearningProfile — emphasizing the
 * no-manipulation guard. The learning layer is allowed to reorder and
 * surface diagnostics; it is NOT allowed to drop actions, rename ids,
 * change confidence, or strip citations / risks / assumptions.
 */

import {
  applyToRecommendation,
  buildProfile,
  ALLOWED_LEARNING_EFFECTS,
  __test,
} from '../personal-learning-profile';
import type {
  LearningProfile,
  LearningSignal,
  RecommendationAcceptance,
} from '@/types/decision-journal';
import type { RecommendationOutput, RecommendedAction } from '@/types/advisor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sig(over: Partial<LearningSignal>): LearningSignal {
  return {
    id: 'lsig',
    user_id: 'u1',
    signal_kind: 'follow_through_pattern',
    signal_key: 'overall',
    signal_value: { completion_rate: 0.7 },
    support_count: 12,
    confidence: 0.6,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

function action(id: string, over: Partial<RecommendedAction> = {}): RecommendedAction {
  return {
    id,
    title: id,
    domain: 'finance',
    rationale: 'because',
    expected_strength: 0.6,
    related_central_entity_ids: ['e1'],
    related_personal_goal_ids: [],
    ...over,
  };
}

function rec(): RecommendationOutput {
  return {
    root_goal: {
      inferred_true_goal: 'Financial Independence',
      confidence: 0.7,
      source: 'goal_interpretation',
    },
    supporting_goals: [],
    blocked_goals: [],
    required_actions: [
      action('a1', { expected_strength: 0.4, title: 'Reduce credit utilization' }),
      action('a2', { expected_strength: 0.9, title: 'Max employer match' }),
      action('a3', { expected_strength: 0.6, title: 'Open Roth IRA' }),
    ],
    recommended_sequence: ['a1', 'a2', 'a3'],
    confidence_score: 0.62,
    tradeoffs: [{ summary: 'speed vs certainty', gives_up: 'speed', gains: 'certainty' }],
    timeline: [{ horizon: 'now', action_ids: ['a1', 'a2', 'a3'] }],
    risks: ['rate hike'],
    assumptions: ['employer match continues'],
    cross_domain_impacts: [{ domain: 'finance', supporting: [], blocking: [], required: [] }],
  };
}

// ---------------------------------------------------------------------------
// Whitelist contract
// ---------------------------------------------------------------------------
describe('allowed learning effects', () => {
  test('whitelist is exactly the 4 documented effects', () => {
    expect(ALLOWED_LEARNING_EFFECTS).toEqual([
      'reorder_actions_within_same_horizon',
      'add_phrasing_hint',
      'dedupe_repeat_rejected_actions',
      'surface_self_diagnostics',
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildProfile — respects MIN_SUPPORT
// ---------------------------------------------------------------------------
describe('buildProfile', () => {
  test('signal with support_count < 5 is ignored', () => {
    const p = buildProfile('u', [
      sig({ signal_value: { completion_rate: 0.95 }, support_count: 2 }),
    ]);
    expect(p.follow_through_rate).toBeUndefined();
  });

  test('signal with adequate support is applied', () => {
    const p = buildProfile('u', [
      sig({ signal_value: { completion_rate: 0.9 }, support_count: 30 }),
    ]);
    expect(p.follow_through_rate).toBeCloseTo(0.9);
  });

  test('preferred_style only set when proxy is one of the three options', () => {
    const p = buildProfile('u', [
      sig({
        signal_kind: 'preferred_communication_style',
        signal_value: { style_proxy: 'detailed' },
        support_count: 10,
      }),
    ]);
    expect(p.preferred_style).toBe('detailed');
  });
});

// ---------------------------------------------------------------------------
// applyToRecommendation — allowed behaviors
// ---------------------------------------------------------------------------
describe('applyToRecommendation (allowed effects)', () => {
  test('reorders within a horizon by expected_strength desc (no add/remove)', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      follow_through_rate: 0.5,
    };
    const r = rec();
    const { output, applied_effects } = applyToRecommendation(profile, r);
    // After reorder: a2 (0.9), a3 (0.6), a1 (0.4)
    expect(output.timeline[0].action_ids).toEqual(['a2', 'a3', 'a1']);
    expect(output.recommended_sequence).toEqual(['a2', 'a3', 'a1']);
    expect(applied_effects).toContain('reorder_actions_within_same_horizon');
    // Action SET is unchanged
    expect(output.required_actions.map((a) => a.id).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  test('adds phrasing_hint when style signal present', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      preferred_style: 'brief',
    };
    const r = rec();
    const { phrasing_hint, applied_effects } = applyToRecommendation(profile, r);
    expect(phrasing_hint).toBe('brief');
    expect(applied_effects).toContain('add_phrasing_hint');
  });

  test('surfaces self-diagnostics back to user', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      follow_through_rate: 0.3,
      accept_rate: 0.6,
      procrastination_median_days: 14,
    };
    const r = rec();
    const { self_diagnostics, applied_effects } = applyToRecommendation(profile, r);
    expect(self_diagnostics?.follow_through_rate).toBe(0.3);
    expect(self_diagnostics?.procrastination_median_days).toBe(14);
    expect(applied_effects).toContain('surface_self_diagnostics');
  });

  test('demotes (but never removes) actions matching ≥ 3 prior rejections', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [] };
    const r = rec();
    const history: RecommendationAcceptance[] = Array.from(
      { length: 3 },
      () =>
        ({
          id: 'r',
          user_id: 'u',
          action_id: 'a3',
          recommendation_summary: 'Open Roth IRA',
          status: 'rejected',
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }) as RecommendationAcceptance
    );
    const { output, applied_effects } = applyToRecommendation(profile, r, {
      acceptance_history: history,
    });
    expect(applied_effects).toContain('dedupe_repeat_rejected_actions');
    // a3 is still present — never removed
    expect(output.required_actions.find((a) => a.id === 'a3')).toBeDefined();
    // and pushed to the end of the sequence
    expect(output.recommended_sequence[output.recommended_sequence.length - 1]).toBe('a3');
  });
});

// ---------------------------------------------------------------------------
// applyToRecommendation — forbidden behaviors are reverted
// ---------------------------------------------------------------------------
describe('applyToRecommendation (no-manipulation guard)', () => {
  test('cannot drop an action — invariant restored if downstream code tries', () => {
    // Inject a synthetic LearningProfile that attempts to remove a2.
    const profile: LearningProfile = { user_id: 'u', signals: [] };
    const r = rec();
    const before = r.required_actions.length;
    // Use the exposed actionsHaveSameIds helper to simulate the guard
    // catching a maliciously-mutated `after`.
    const mutated = {
      ...r,
      required_actions: r.required_actions.filter((a) => a.id !== 'a2'),
      recommended_sequence: ['a1', 'a3'],
    };
    expect(__test.actionsHaveSameIds(r.required_actions, mutated.required_actions)).toBe(false);
    // And confirm the public apply() never produces such a mutation by itself.
    const { output, rejected_mutations } = applyToRecommendation(profile, r);
    expect(output.required_actions).toHaveLength(before);
    expect(rejected_mutations).toEqual([]); // nothing illegal was attempted
  });

  test('confidence_score is byte-identical after apply()', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      follow_through_rate: 0.8,
      preferred_style: 'detailed',
    };
    const r = rec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.confidence_score).toBe(r.confidence_score);
  });

  test('tradeoffs / risks / assumptions / cross_domain_impacts / pathway preserved', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      follow_through_rate: 0.8,
    };
    const r = rec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.tradeoffs).toEqual(r.tradeoffs);
    expect(output.risks).toEqual(r.risks);
    expect(output.assumptions).toEqual(r.assumptions);
    expect(output.cross_domain_impacts).toEqual(r.cross_domain_impacts);
    expect(output.pathway).toEqual(r.pathway);
  });

  test('root_goal cannot be altered', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.8 };
    const r = rec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.root_goal).toEqual(r.root_goal);
  });

  test('blocked_goals stay surfaced — learning cannot hide them', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.8 };
    const r = rec();
    r.blocked_goals = [
      {
        goal_id: 'gb',
        classification: 'blocked',
        depth: 1,
        via_edges: [],
        cumulative_strength: 0.7,
      },
    ];
    const { output } = applyToRecommendation(profile, r);
    expect(output.blocked_goals).toEqual(r.blocked_goals);
  });

  test('procrastination signal does not delay surfacing — output is returned immediately, not gated by timing', () => {
    // Validates the contract: there is no `delay_until` or `defer` knob
    // in LearningApplication. apply() is synchronous and returns a
    // structure with no temporal manipulation surface.
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      procrastination_median_days: 45,
      follow_through_rate: 0.3,
    };
    const r = rec();
    const result = applyToRecommendation(profile, r);
    // result.output has no `surface_at` or `delay` field — by design.
    expect((result as Record<string, unknown>).surface_at).toBeUndefined();
    expect((result.output as Record<string, unknown>).delay_until).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRejectedAcceptances helper
// ---------------------------------------------------------------------------
describe('getRejectedAcceptances', () => {
  const { getRejectedAcceptances } = __test;
  test('counts rejected by normalized summary, threshold 3', () => {
    const history: RecommendationAcceptance[] = [
      {
        ...({
          id: '1',
          user_id: 'u',
          action_id: 'a',
          recommendation_summary: 'Foo Bar',
          status: 'rejected',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as RecommendationAcceptance),
      },
      {
        ...({
          id: '2',
          user_id: 'u',
          action_id: 'a',
          recommendation_summary: 'foo bar',
          status: 'rejected',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as RecommendationAcceptance),
      },
      {
        ...({
          id: '3',
          user_id: 'u',
          action_id: 'a',
          recommendation_summary: 'FOO BAR',
          status: 'rejected',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as RecommendationAcceptance),
      },
      {
        ...({
          id: '4',
          user_id: 'u',
          action_id: 'b',
          recommendation_summary: 'Other',
          status: 'rejected',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as RecommendationAcceptance),
      },
    ];
    const set = getRejectedAcceptances(history);
    expect(set.has('foo bar')).toBe(true);
    expect(set.has('other')).toBe(false);
  });
});
