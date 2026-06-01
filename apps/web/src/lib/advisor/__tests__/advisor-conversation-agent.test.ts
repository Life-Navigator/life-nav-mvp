/**
 * @jest-environment node
 *
 * Tests for AdvisorConversationAgent:
 *   1. Intent classification
 *   2. Missing-info detection
 *   3. Contradiction detection
 *   4. LLM bypass guard — phrasing-only paths are accepted; any
 *      attempt to set recommendation fields is rejected.
 *   5. Turn-kind dispatch
 */

import {
  classifyIntent,
  detectMissingInfo,
  detectContradictions,
  __test,
} from '../advisor-conversation-agent';
import type { PersonalContext, RecommendationOutput, DiscoveredRootGoal } from '@/types/advisor';

const { sanitizeLlmOutput, decideTurnKind } = __test;

function emptyCtx(): PersonalContext {
  return {
    constraints: [],
    capabilities: [],
    motivations: [],
    decision_preferences: [],
    domain_risk_tolerance: [],
    commitment_levels: [],
  };
}

function rec(overrides: Partial<RecommendationOutput> = {}): RecommendationOutput {
  const root: DiscoveredRootGoal = {
    inferred_true_goal: 'Financial Independence',
    confidence: 0.7,
    source: 'goal_interpretation',
  };
  return {
    root_goal: root,
    supporting_goals: [],
    blocked_goals: [],
    required_actions: [
      {
        id: 'act_1_req_x',
        title: 'Build emergency fund',
        domain: 'finance',
        rationale: 'reserve',
        expected_strength: 0.8,
        related_central_entity_ids: ['e1'],
        related_personal_goal_ids: [],
      },
    ],
    recommended_sequence: ['act_1_req_x'],
    confidence_score: 0.65,
    tradeoffs: [],
    timeline: [{ horizon: 'now', action_ids: ['act_1_req_x'] }],
    risks: [],
    assumptions: [],
    cross_domain_impacts: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. classifyIntent
// ---------------------------------------------------------------------------
describe('classifyIntent', () => {
  test.each([
    ['What is my real goal?', 'discover_root_goal'],
    ['Why this recommendation?', 'explain_recommendation'],
    ['What is the tradeoff?', 'explain_tradeoff'],
    ['But I already paid off the card', 'resolve_contradiction'],
    ['What if interest rates rise?', 'challenge_assumption'],
    ["I don't know what my risk tolerance is", 'gather_missing_info'],
    ['What do you mean by Roth?', 'clarify'],
    ['Hello', 'small_talk'],
  ] as const)('"%s" -> %s', (msg, want) => {
    expect(classifyIntent(msg)).toBe(want);
  });
});

// ---------------------------------------------------------------------------
// 2. detectMissingInfo
// ---------------------------------------------------------------------------
describe('detectMissingInfo', () => {
  test('all five buckets empty -> five flags', () => {
    expect(detectMissingInfo(emptyCtx())).toHaveLength(5);
  });

  test('one filled bucket -> four flags', () => {
    const ctx = { ...emptyCtx(), constraints: [{ id: 'c', label: 'no debt', severity: 'hard' }] };
    expect(detectMissingInfo(ctx)).toHaveLength(4);
    expect(detectMissingInfo(ctx).find((f) => f.field === 'user_constraints')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. detectContradictions
// ---------------------------------------------------------------------------
describe('detectContradictions', () => {
  test('home ownership goal + hard money constraint -> hard contradiction', () => {
    const r = rec({
      root_goal: {
        inferred_true_goal: 'Home Ownership',
        confidence: 0.8,
        source: 'goal_interpretation',
      },
    });
    const ctx = {
      ...emptyCtx(),
      constraints: [{ id: 'c', label: 'cap $500/mo savings', severity: 'hard', domain: 'money' }],
    };
    const flags = detectContradictions(r, ctx);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe('hard');
    expect(flags[0].field).toBe('user_constraints');
  });

  test('entrepreneurship goal + low risk tolerance -> soft contradiction', () => {
    const r = rec({
      root_goal: {
        inferred_true_goal: 'Entrepreneurship',
        confidence: 0.8,
        source: 'goal_interpretation',
      },
    });
    const ctx = {
      ...emptyCtx(),
      domain_risk_tolerance: [{ id: 'r', domain: 'entrepreneurship', tolerance: 0.2 }],
    };
    expect(detectContradictions(r, ctx)[0].severity).toBe('soft');
  });

  test('career goal + zero commitment hours -> soft contradiction', () => {
    const r = rec({
      root_goal: {
        inferred_true_goal: 'Career Progress',
        confidence: 0.8,
        source: 'goal_interpretation',
      },
    });
    const ctx = { ...emptyCtx(), commitment_levels: [{ id: 'c', area: 'career', level: 0 }] };
    expect(detectContradictions(r, ctx)).toHaveLength(1);
  });

  test('cycle in goal pathway -> hard contradiction', () => {
    const r = rec({
      pathway: {
        root_goal_id: 'r',
        user_id: 'u',
        required: [],
        supporting: [],
        optional: [],
        blocked: [],
        edges: [],
        topological_order: ['r'],
        cycles: [['a', 'b', 'a']],
        computed_at: new Date().toISOString(),
      },
    });
    const flags = detectContradictions(r, emptyCtx());
    expect(flags.some((f) => f.severity === 'hard' && f.field === 'goal_hierarchy')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. LLM bypass guard
// ---------------------------------------------------------------------------
describe('sanitizeLlmOutput (bypass guard)', () => {
  test('accepts allowed phrasing fields', () => {
    const { cleaned, rejected } = sanitizeLlmOutput({
      ask: { question: 'Q?', why: 'because' },
      explain: { text: 'because of X' },
      propose: { summary: 'Plan with 3 actions' },
    });
    expect(cleaned.ask).toEqual({ question: 'Q?', why: 'because' });
    expect(cleaned.explain).toEqual({ text: 'because of X' });
    expect(cleaned.propose).toEqual({ summary: 'Plan with 3 actions' });
    expect(rejected).toHaveLength(0);
  });

  test('rejects attempts to set recommendation fields', () => {
    const { cleaned, rejected } = sanitizeLlmOutput({
      propose: {
        summary: 'Hi',
        recommendation: { foo: 'evil' }, // disallowed
        required_actions: [{ id: 'fake' }], // disallowed
      },
      // entirely unknown top-level keys must also be rejected
      override_confidence: 0.99,
      mutate_root_goal: { inferred_true_goal: 'sponsor goal' },
    });
    expect(cleaned.propose).toEqual({ summary: 'Hi' });
    expect(rejected).toEqual(
      expect.arrayContaining([
        'propose.recommendation',
        'propose.required_actions',
        'override_confidence',
        'mutate_root_goal',
      ])
    );
  });

  test('rejects ask/explain unknown subkeys', () => {
    const { cleaned, rejected } = sanitizeLlmOutput({
      ask: { question: 'Q', why: 'W', secret_field: 'x' },
      explain: { text: 'T', citations: ['fabricated'] },
    });
    expect(cleaned.ask).toEqual({ question: 'Q', why: 'W' });
    expect(cleaned.explain).toEqual({ text: 'T' });
    expect(rejected).toEqual(expect.arrayContaining(['ask.secret_field', 'explain.citations']));
  });

  test('non-object input returns empty cleaned and no rejects', () => {
    const { cleaned, rejected } = sanitizeLlmOutput(null);
    expect(cleaned).toEqual({});
    expect(rejected).toEqual([]);
  });

  test('drops fields when llm returns the wrong type', () => {
    const { cleaned } = sanitizeLlmOutput({
      ask: { question: 42, why: 'why' }, // question must be string
      explain: { text: null }, // text must be string
    });
    expect(cleaned.ask).toBeUndefined();
    expect(cleaned.explain).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Turn-kind dispatch
// ---------------------------------------------------------------------------
describe('decideTurnKind', () => {
  test('discover_root_goal -> ask', () => {
    expect(decideTurnKind('discover_root_goal', rec(), [], [])).toBe('ask');
  });
  test('many missing fields -> ask', () => {
    const missing = Array.from({ length: 3 }, (_, i) => ({ field: `f${i}`, why_it_matters: 'x' }));
    expect(decideTurnKind('clarify', rec(), missing, [])).toBe('ask');
  });
  test('hard contradiction -> ask', () => {
    expect(
      decideTurnKind(
        'clarify',
        rec(),
        [],
        [{ field: 'x', observed: 'y', conflicts_with: 'z', severity: 'hard' }]
      )
    ).toBe('ask');
  });
  test('explain_recommendation -> explain', () => {
    expect(decideTurnKind('explain_recommendation', rec(), [], [])).toBe('explain');
  });
  test('default to propose when rec present', () => {
    expect(decideTurnKind('small_talk', rec(), [], [])).toBe('propose');
  });
  test('no rec -> acknowledge', () => {
    expect(decideTurnKind('small_talk', undefined, [], [])).toBe('acknowledge');
  });
});
