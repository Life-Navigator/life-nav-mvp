/**
 * @jest-environment node
 *
 * CatchUpEngine + AheadOfPlanEngine + MarginalImpactRanker tests.
 */

import { __test as catchUpTest } from '../catch-up-engine';
import { __test as aheadTest } from '../ahead-of-plan-engine';
import { __test as rankerTest } from '../marginal-impact-ranker';
import type { CatchUpInputs } from '../catch-up-engine';
import type { AheadOfPlanInputs } from '../ahead-of-plan-engine';
import type { RankerInputs } from '../marginal-impact-ranker';

const { classifyStatus, computeCatchUpPlan, computeFeasibility } = catchUpTest;
const { computeAheadOfPlanPlan } = aheadTest;
const { rankMarginalImpact, computeAccessibility } = rankerTest;

// ---------------------------------------------------------------------------
// classifyStatus
// ---------------------------------------------------------------------------
describe('classifyStatus', () => {
  test.each([
    [{ current_score: 0.5, target_score: 0.4 }, 'ahead'],
    [{ current_score: 0.5, target_score: 0.5 }, 'on_track'],
    [{ current_score: 0.4, target_score: 0.5 }, 'behind'],
    [{ current_score: 0.2, target_score: 0.5 }, 'at_risk'],
    [{ current_score: 0.3, target_score: 0.5, priority: 'essential' }, 'at_risk'],
    [{ current_score: 0.3, target_score: 0.5, priority: 'nice_to_have' }, 'behind'],
  ] as const)('classifies %o → %s', (inp, want) => {
    expect(
      classifyStatus(inp as { current_score: number; target_score: number; priority?: string })
    ).toBe(want);
  });
});

// ---------------------------------------------------------------------------
// computeCatchUpPlan
// ---------------------------------------------------------------------------
function catchInputs(over: Partial<CatchUpInputs> = {}): CatchUpInputs {
  return {
    goal_id: 'g1',
    current_score: 0.3,
    target_score: 0.5,
    target_at_months: 12,
    domains: ['financial', 'career'],
    available_surplus_usd: 500,
    commitment_hours_per_week: 4,
    risk_tolerance: 0.5,
    health_recovery_capacity: 0.8,
    historical_accuracy_mean: 0.55,
    ...over,
  };
}

describe('computeCatchUpPlan', () => {
  test('behind: emits a non-empty action list ordered by expected_probability_delta', () => {
    const plan = computeCatchUpPlan(catchInputs());
    expect(plan.status).toBe('behind');
    expect(plan.catch_up_actions.length).toBeGreaterThan(0);
    for (let i = 1; i < plan.catch_up_actions.length; i += 1) {
      expect(plan.catch_up_actions[i - 1].expected_probability_delta).toBeGreaterThanOrEqual(
        plan.catch_up_actions[i].expected_probability_delta
      );
    }
  });

  test('on_track: no actions surfaced', () => {
    const plan = computeCatchUpPlan(catchInputs({ current_score: 0.5, target_score: 0.5 }));
    expect(plan.status).toBe('on_track');
    expect(plan.catch_up_actions).toHaveLength(0);
    expect(plan.recommended_plan).toMatch(/stay/i);
  });

  test('low surplus reduces feasibility of high-cost financial actions', () => {
    const rich = computeCatchUpPlan(catchInputs({ available_surplus_usd: 2000 }));
    const poor = computeCatchUpPlan(catchInputs({ available_surplus_usd: 50 }));
    const richInvest = rich.catch_up_actions.find((a) =>
      /Increase monthly savings/.test(a.description)
    );
    const poorInvest = poor.catch_up_actions.find((a) =>
      /Increase monthly savings/.test(a.description)
    );
    // The $400-savings action gets pulled in for the surplus-rich user
    // and is either absent or has lower expected delta for the cash-poor user.
    if (richInvest && poorInvest) {
      expect(richInvest.expected_probability_delta).toBeGreaterThanOrEqual(
        poorInvest.expected_probability_delta
      );
    } else {
      expect(richInvest).toBeDefined();
    }
  });

  test('probability_after_catch_up improves on current_score when actions are selected', () => {
    const plan = computeCatchUpPlan(catchInputs());
    expect(plan.probability_after_catch_up).toBeGreaterThan(0.3);
  });

  test('explanation envelope is complete', () => {
    const plan = computeCatchUpPlan(catchInputs());
    expect(plan.explanation.assumptions.length).toBeGreaterThan(0);
    expect(plan.explanation.what_would_change_estimate.length).toBeGreaterThan(0);
    expect(plan.explanation.domains_affected).toContain('financial');
  });

  test('at_risk surfaces a slippage risk note', () => {
    const plan = computeCatchUpPlan(
      catchInputs({ current_score: 0.2, target_score: 0.55, priority: 'essential' })
    );
    expect(plan.status).toBe('at_risk');
    expect(plan.risks.some((r) => /at-risk|re-scop/i.test(r))).toBe(true);
  });
});

describe('computeFeasibility', () => {
  test('high surplus + spare hours + tolerant risk → ≈ 1.0', () => {
    const f = computeFeasibility(
      { cost_usd: 100, hours: 1, risk: 0.2 },
      catchInputs({
        available_surplus_usd: 2000,
        commitment_hours_per_week: 20,
        risk_tolerance: 0.9,
      })
    );
    expect(f).toBeCloseTo(1.0);
  });

  test('zero surplus blocks expensive financial action', () => {
    const f = computeFeasibility({ cost_usd: 1000 }, catchInputs({ available_surplus_usd: 0 }));
    expect(f).toBeLessThanOrEqual(0.1);
  });

  test('low risk tolerance discounts risky action', () => {
    const safe = computeFeasibility({ risk: 0.5 }, catchInputs({ risk_tolerance: 0.9 }));
    const cautious = computeFeasibility({ risk: 0.5 }, catchInputs({ risk_tolerance: 0.1 }));
    expect(safe).toBeGreaterThan(cautious);
  });
});

// ---------------------------------------------------------------------------
// AheadOfPlanEngine
// ---------------------------------------------------------------------------
function aheadInputs(over: Partial<AheadOfPlanInputs> = {}): AheadOfPlanInputs {
  return {
    goal_id: 'g1',
    current_score: 0.65,
    target_score: 0.55,
    domains: ['financial', 'health'],
    risk_tolerance: 0.5,
    health_recovery_capacity: 0.7,
    ...over,
  };
}

describe('computeAheadOfPlanPlan', () => {
  test('classifies as ahead', () => {
    const plan = computeAheadOfPlanPlan(aheadInputs());
    expect(plan.status).toBe('ahead');
    expect(plan.cushion.delta).toBeLessThan(0);
  });

  test('LOW risk tolerance defaults to preserve / reduce_intensity / add_protection', () => {
    const plan = computeAheadOfPlanPlan(aheadInputs({ risk_tolerance: 0.2 }));
    expect(['preserve_and_reduce_risk', 'reduce_intensity', 'add_protection']).toContain(
      plan.recommended_default.kind
    );
  });

  test('HIGH risk tolerance + capacity defaults to accelerate / invest_more', () => {
    const plan = computeAheadOfPlanPlan(
      aheadInputs({ risk_tolerance: 0.85, health_recovery_capacity: 0.9 })
    );
    expect(['accelerate', 'invest_more', 'diversify_into_new_domain']).toContain(
      plan.recommended_default.kind
    );
  });

  test('LOW health recovery → reduce_intensity / preserve', () => {
    const plan = computeAheadOfPlanPlan(aheadInputs({ health_recovery_capacity: 0.2 }));
    expect(['reduce_intensity', 'preserve_and_reduce_risk', 'add_protection']).toContain(
      plan.recommended_default.kind
    );
  });

  test('options list is non-empty across the requested domains', () => {
    const plan = computeAheadOfPlanPlan(aheadInputs());
    expect(plan.options.length).toBeGreaterThan(0);
    const domains = new Set(plan.options.map((o) => o.domain));
    for (const d of ['financial', 'health'])
      expect(domains.has(d as 'financial' | 'health')).toBe(true);
  });

  test('explanation reminds the system not to blindly push optimization', () => {
    const plan = computeAheadOfPlanPlan(aheadInputs());
    expect(
      plan.explanation.assumptions.some((a) => /preservation|preserve|conservative/i.test(a))
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MarginalImpactRanker
// ---------------------------------------------------------------------------
function rankerInputs(over: Partial<RankerInputs> = {}): RankerInputs {
  return {
    user_id: 'u1',
    candidates: [
      {
        decision_label_canonical: 'reduce_credit_utilization',
        decision_label_user_friendly: 'Reduce credit utilization below 10%',
        target_goal_concept: 'Home Ownership',
        domain: 'financial',
        base_magnitude: 0.18,
        is_structural: false,
      },
      {
        decision_label_canonical: 'finish_law_school',
        decision_label_user_friendly: 'Finish law school',
        target_goal_concept: 'Income Growth',
        domain: 'education',
        base_magnitude: 0.55,
        is_structural: true,
        structural_variable: 'education_credential',
        cost_usd: 30000,
        hours_per_week: 25,
        risk_required: 0.5,
      },
      {
        decision_label_canonical: 'add_zone_2',
        decision_label_user_friendly: 'Add 2 weekly Zone 2 sessions',
        target_goal_concept: 'VO2max',
        domain: 'health',
        base_magnitude: 0.08,
        is_structural: false,
        hours_per_week: 3,
      },
    ],
    available_surplus_usd: 500,
    commitment_hours_per_week: 5,
    risk_tolerance: 0.5,
    health_recovery_capacity: 0.7,
    ...over,
  };
}

describe('rankMarginalImpact', () => {
  test('returns ranked output with rank starting at 1', () => {
    const r = rankMarginalImpact(rankerInputs());
    expect(r.ranked.length).toBeGreaterThan(0);
    expect(r.ranked[0].rank).toBe(1);
    for (let i = 1; i < r.ranked.length; i += 1) expect(r.ranked[i].rank).toBe(i + 1);
  });

  test('at 1_year horizon, high-magnitude credit utilization beats high-cost structural', () => {
    // At 1y, accessibility-discounted law school (cost too high) loses to credit util.
    const r = rankMarginalImpact(rankerInputs({ scoring_horizon: '1_year' }));
    const top = r.ranked[0];
    expect(top.decision_label_canonical).toBe('reduce_credit_utilization');
  });

  test('at 10_year horizon, structural law school dominates non-structural credit util', () => {
    // For a HIGH-surplus / HIGH-hours / HIGH-tolerance user, structural wins long-horizon.
    const r = rankMarginalImpact(
      rankerInputs({
        scoring_horizon: '10_year',
        available_surplus_usd: 50000,
        commitment_hours_per_week: 30,
        risk_tolerance: 0.9,
      })
    );
    expect(r.ranked[0].decision_label_canonical).toBe('finish_law_school');
  });

  test('respects top_k', () => {
    const r = rankMarginalImpact(rankerInputs({ top_k: 1 }));
    expect(r.ranked).toHaveLength(1);
  });

  test('explanation envelope present', () => {
    const r = rankMarginalImpact(rankerInputs());
    expect(r.explanation.assumptions.length).toBeGreaterThan(0);
    expect(r.explanation.what_would_change_estimate.length).toBeGreaterThan(0);
  });
});

describe('computeAccessibility', () => {
  test('limit by surplus drops accessibility', () => {
    const a = computeAccessibility(
      {
        decision_label_canonical: 'x',
        decision_label_user_friendly: 'x',
        target_goal_concept: 'g',
        domain: 'financial',
        base_magnitude: 0.5,
        is_structural: false,
        cost_usd: 1000,
      } as Parameters<typeof computeAccessibility>[0],
      rankerInputs({ available_surplus_usd: 100 })
    );
    expect(a).toBeLessThan(0.5);
  });
});
