/**
 * @jest-environment node
 *
 * Tests for the HierarchyAwareEvaluator. Verifies that scenarios are
 * scored according to (1) how far they advance the root + required +
 * supporting goals, and (2) how much they help blockers.
 */

import { evaluate, rankScenarios } from '../hierarchy-aware-evaluator';
import type { ProjectorOutput, ProjectorMetricsPoint } from '@/types/trajectory';
import type { GoalPathway } from '@/types/goal-hierarchy';

function metric(over: Partial<ProjectorMetricsPoint> = {}): ProjectorMetricsPoint {
  return {
    at_month: 0,
    net_worth: 0,
    cash: 0,
    taxable_investments: 0,
    retirement_balance: 0,
    hsa_balance: 0,
    total_debt: 0,
    emergency_months: 0,
    annual_income: 0,
    monthly_cash_flow: 0,
    health_cost_exposure: 0,
    ...over,
  };
}

function projection(
  start: Partial<ProjectorMetricsPoint>,
  end: Partial<ProjectorMetricsPoint>
): ProjectorOutput {
  return {
    final_net_worth: end.net_worth ?? 0,
    final_debt: end.total_debt ?? 0,
    final_annual_income: end.annual_income ?? 0,
    final_emergency_months: end.emergency_months ?? 0,
    final_health_cost_exposure: end.health_cost_exposure ?? 0,
    retirement_ready: false,
    recommended: true,
    rationale: 'test',
    risks: [],
    upside_factors: [],
    metrics: [metric(start), metric({ ...end, at_month: 60 })],
    events: [],
    assumptions: [],
    engine_version: 'test',
  };
}

const ROOT_GOAL = 'g_fi'; // Financial Independence
const REQ_GOAL = 'g_ef'; // Emergency Fund
const SUP_GOAL = 'g_ig'; // Income Growth
const BLK_GOAL = 'g_debt'; // Debt payoff (blocker if scenario *advances* it at expense)

function pathway(): GoalPathway {
  return {
    root_goal_id: ROOT_GOAL,
    user_id: 'u1',
    required: [
      {
        goal_id: REQ_GOAL,
        classification: 'required',
        depth: 1,
        via_edges: [],
        cumulative_strength: 1,
      },
    ],
    supporting: [
      {
        goal_id: SUP_GOAL,
        classification: 'supporting',
        depth: 1,
        via_edges: [],
        cumulative_strength: 0.8,
      },
    ],
    optional: [],
    blocked: [
      {
        goal_id: BLK_GOAL,
        classification: 'blocked',
        depth: 1,
        via_edges: [],
        cumulative_strength: 0.7,
      },
    ],
    edges: [],
    topological_order: [ROOT_GOAL, REQ_GOAL],
    cycles: [],
    computed_at: new Date().toISOString(),
  };
}

const LOOKUP = [
  {
    goal_id: ROOT_GOAL,
    title: 'Financial Independence',
    category: 'wealth',
    target_amount: 1_000_000,
  },
  { goal_id: REQ_GOAL, title: 'Emergency Fund', category: 'protection' },
  { goal_id: SUP_GOAL, title: 'Income Growth', category: 'career' },
  { goal_id: BLK_GOAL, title: 'Debt Payoff', category: undefined },
];

describe('HierarchyAwareEvaluator', () => {
  test('positive score when scenario advances root + required + supporting metrics', () => {
    const proj = projection(
      { net_worth: 0, emergency_months: 1, annual_income: 80000, total_debt: 20000 },
      { net_worth: 250000, emergency_months: 6, annual_income: 130000, total_debt: 18000 }
    );
    const score = evaluate(proj, pathway(), LOOKUP);
    expect(score.scenario_score).toBeGreaterThan(0);
    expect(score.root_goal_advance).toBeGreaterThan(0);
    expect(score.required_advance).toBeGreaterThan(0);
    expect(score.supporting_advance).toBeGreaterThan(0);
  });

  test('penalizes scenarios that reduce required/supporting metrics', () => {
    const good = projection(
      { net_worth: 0, emergency_months: 1, annual_income: 80000 },
      { net_worth: 100000, emergency_months: 6, annual_income: 130000 }
    );
    const bad = projection(
      { net_worth: 0, emergency_months: 6, annual_income: 130000 },
      { net_worth: -50000, emergency_months: 1, annual_income: 100000 }
    );
    const goodScore = evaluate(good, pathway(), LOOKUP).scenario_score;
    const badScore = evaluate(bad, pathway(), LOOKUP).scenario_score;
    expect(goodScore).toBeGreaterThan(badScore);
  });

  test('blocker that goes the *right* way (debt reduction) is rewarded, not penalized', () => {
    // "Debt Payoff" maps to total_debt direction=down via title heuristic.
    // Reducing debt = advance for the blocker node, which the scorer
    // counts as blocked_penalty *positive* only when the metric moves
    // in the goal's preferred direction. Confirm the math by checking
    // the per_goal entry directly.
    const proj = projection({ total_debt: 100000 }, { total_debt: 10000 });
    const s = evaluate(proj, pathway(), LOOKUP);
    const blockerEntry = s.per_goal.find((g) => g.goal_id === BLK_GOAL);
    expect(blockerEntry?.normalized_advance).toBeGreaterThan(0);
  });

  test('rankScenarios orders by descending scenario_score', () => {
    const p1 = projection({ net_worth: 0 }, { net_worth: 50000 });
    const p2 = projection({ net_worth: 0 }, { net_worth: 200000 });
    const p3 = projection({ net_worth: 0 }, { net_worth: 10000 });

    const ranked = rankScenarios(
      [
        { scenario: { id: 's1' }, projection: p1 },
        { scenario: { id: 's2' }, projection: p2 },
        { scenario: { id: 's3' }, projection: p3 },
      ],
      pathway(),
      LOOKUP
    );
    expect(ranked[0].scenario.id).toBe('s2');
    expect(ranked[1].scenario.id).toBe('s1');
    expect(ranked[2].scenario.id).toBe('s3');
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test('returns notes when projector has no metric points', () => {
    const empty: ProjectorOutput = {
      final_net_worth: 0,
      final_debt: 0,
      final_annual_income: 0,
      final_emergency_months: 0,
      final_health_cost_exposure: 0,
      retirement_ready: false,
      recommended: false,
      rationale: 'empty',
      risks: [],
      upside_factors: [],
      metrics: [],
      events: [],
      assumptions: [],
      engine_version: 'test',
    };
    const s = evaluate(empty, pathway(), LOOKUP);
    expect(s.scenario_score).toBe(0);
    expect(s.notes[0]).toMatch(/no metric points/);
  });
});
