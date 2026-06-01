/**
 * @jest-environment node
 *
 * Conversation explainer tests — every explainer is pure and
 * deterministic. Same input → byte-identical output. LLM cannot
 * mutate the structured fields.
 */

import { __test } from '../conversation-explainers';
import { computeProbabilityDistribution } from '../../decision/probability-engine';
import type { RecommendationOutput } from '@/types/advisor';

const {
  explainTradeoff,
  explainSimulation,
  explainProbability,
  challengeAssumption,
  askFollowup,
  pickChallengeKind,
  humanHorizon,
} = __test;

function baseRec(): RecommendationOutput {
  return {
    root_goal: {
      inferred_true_goal: 'Financial Independence',
      confidence: 0.7,
      source: 'goal_interpretation',
    },
    supporting_goals: [],
    blocked_goals: [],
    required_actions: [
      {
        id: 'a1',
        title: 'Build emergency fund',
        domain: 'finance',
        rationale: 'reserve',
        expected_strength: 0.8,
        related_central_entity_ids: ['e1'],
        related_personal_goal_ids: [],
      },
    ],
    recommended_sequence: ['a1'],
    confidence_score: 0.65,
    tradeoffs: [
      { summary: 'Speed vs certainty', gives_up: 'speed', gains: 'certainty' },
      {
        summary: 'Effort vs lifestyle',
        gives_up: 'discretionary flexibility',
        gains: 'savings rate',
      },
    ],
    timeline: [{ horizon: 'now', action_ids: ['a1'] }],
    risks: [],
    assumptions: ['Hard constraints currently bound the action space.'],
    cross_domain_impacts: [],
    supporting_evidence: [
      {
        kind: 'central_ontology',
        label: 'CFP Six-Step Planning Process',
        citation_reference: 'CFP Board PS',
        confidence: 0.9,
      },
    ],
  };
}

describe('explainTradeoff', () => {
  test('produces a framing per tradeoff', () => {
    const out = explainTradeoff({ recommendation: baseRec() });
    expect(out.body.framings).toHaveLength(2);
    expect(out.headline).toMatch(/tradeoffs?\s+to\s+weigh/);
  });

  test('emits hard-constraint warning when assumption text mentions it', () => {
    const out = explainTradeoff({ recommendation: baseRec() });
    expect(out.body.hard_constraint_warnings.length).toBeGreaterThan(0);
  });

  test('determinism', () => {
    const a = explainTradeoff({ recommendation: baseRec() });
    const b = explainTradeoff({ recommendation: baseRec() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('driver-tuned net assessment', () => {
    const fs = explainTradeoff({
      recommendation: baseRec(),
      dominant_driver: 'financial_security',
    });
    const perf = explainTradeoff({ recommendation: baseRec(), dominant_driver: 'performance' });
    expect(fs.body.framings[0].net_assessment).not.toBe(perf.body.framings[0].net_assessment);
  });
});

describe('explainSimulation', () => {
  test('headline names the best scenario score', () => {
    const out = explainSimulation({
      recommendation: baseRec(),
      ranked: [
        { scenario_id: 's2', rank: 1, score: 0.72, note: 'income growth first' },
        { scenario_id: 's1', rank: 2, score: 0.48 },
      ],
    });
    expect(out.headline).toMatch(/0\.72/);
    expect(out.body.best_scenario_id).toBe('s2');
  });

  test('cycles warning surfaces when cycles > 0', () => {
    const out = explainSimulation({
      recommendation: baseRec(),
      ranked: [{ scenario_id: 's1', rank: 1, score: 0.5 }],
      cycles_count: 2,
    });
    expect(out.body.cycles_warning).toMatch(/cycle\(s\)/);
  });

  test('empty ranked array → headline says run sim first', () => {
    const out = explainSimulation({ recommendation: baseRec(), ranked: [] });
    expect(out.headline).toMatch(/no scenarios/i);
  });
});

describe('explainProbability', () => {
  const dist = computeProbabilityDistribution(
    {
      goal_id: 'g1',
      current_progress: 0.4,
      domains: ['financial'],
      supporting_goals_count: 3,
      hard_constraint_count: 1,
    },
    '1_year'
  );

  test('headline contains the most-likely percentage', () => {
    const out = explainProbability({ distribution: dist });
    expect(out.headline).toMatch(/\d+%/);
  });

  test('uncertainty language includes "not statistical confidence intervals"', () => {
    const out = explainProbability({ distribution: dist });
    expect(out.uncertainty_language.some((u) => /not statistical/.test(u))).toBe(true);
  });

  test('humanHorizon mapping', () => {
    expect(humanHorizon('1_year')).toBe('in 1 year');
    expect(humanHorizon('immediate')).toBe('right now');
    expect(humanHorizon('20_year')).toBe('in 20 years');
  });

  test('determinism', () => {
    const a = explainProbability({ distribution: dist });
    const b = explainProbability({ distribution: dist });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('challengeAssumption', () => {
  test('pickChallengeKind matrix', () => {
    expect(pickChallengeKind('Long-horizon estimates assume no structural life event.')).toBe(
      'what_if'
    );
    expect(pickChallengeKind('No matching pathway history yet for this concept.')).toBe(
      'counter_evidence'
    );
    expect(pickChallengeKind('Estimate assumes the long-term horizon stays consistent.')).toBe(
      'time_pressure'
    );
    expect(pickChallengeKind('Just happened last week.')).toBe('recency_bias');
    expect(pickChallengeKind('Some other assumption text.')).toBe('why_assume');
  });

  test('produces a Socratic prompt that names the assumption', () => {
    const out = challengeAssumption({
      assumption_text: 'No matching pathway history yet for this concept.',
      sensitivity: 0.85,
    });
    expect(out.body.prompt).toMatch(/evidence/i);
    expect(out.body.assumption_text).toMatch(/No matching pathway/);
    expect(out.uncertainty_language[0]).toMatch(/not the same as rejecting/);
  });

  test('determinism', () => {
    const a = challengeAssumption({ assumption_text: 'x', sensitivity: 0.5 });
    const b = challengeAssumption({ assumption_text: 'x', sensitivity: 0.5 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('askFollowup', () => {
  test('binds_to + question + why round-trip', () => {
    const out = askFollowup({
      reason: 'missing_info',
      field: 'user_constraints',
      question_text: 'Are any hard limits on your time / money / health right now?',
      why: 'Without constraints, the action space is unbounded.',
      binds_to: 'user_constraints',
    });
    expect(out.body.question).toMatch(/limits/);
    expect(out.body.binds_to).toBe('user_constraints');
    expect(out.body.why).toMatch(/unbounded/);
  });

  test('discover_root_goal sets prompt_kind to why_important', () => {
    const out = askFollowup({
      reason: 'discover_root_goal',
      question_text: 'Why does that matter?',
      why: 'Need to surface the deeper driver.',
    });
    expect(out.body.prompt_kind).toBe('why_important');
  });
});
