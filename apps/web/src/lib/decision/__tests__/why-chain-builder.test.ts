/**
 * @jest-environment node
 *
 * WhyChainBuilder tests.
 *
 * The KEY contract: same input → same WhyChain (deterministic). This
 * is what makes the five trust questions answerable without an LLM.
 */

import { buildWhyChain } from '../why-chain-builder';
import { computeDecisionImpact } from '../decision-impact-engine';
import { computeProbabilityDistribution } from '../probability-engine';
import { computeCatchUpPlan } from '../catch-up-engine';
import type { RecommendationOutput } from '@/types/advisor';

function rec(): RecommendationOutput {
  return {
    root_goal: {
      inferred_true_goal: 'Financial Independence',
      confidence: 0.7,
      source: 'goal_interpretation',
    },
    supporting_goals: [],
    blocked_goals: [
      {
        goal_id: 'b1',
        classification: 'blocked',
        depth: 1,
        via_edges: [],
        cumulative_strength: 0.6,
      },
    ],
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
    confidence_calibrated: 0.55,
    tradeoffs: [],
    timeline: [{ horizon: 'now', action_ids: ['a1'] }],
    risks: [],
    assumptions: [
      'No matching pathway history yet for this concept.',
      'Long-horizon estimates assume no structural life event.',
    ],
    cross_domain_impacts: [],
    pathway_label: 'Income Growth First',
    historical_effectiveness: {
      pathway_label: 'Income Growth First',
      sample_size: 42,
      success_rate: 0.71,
      scope: 'cohort',
    },
    supporting_evidence: [
      {
        kind: 'central_ontology',
        label: 'CFA Charter',
        central_entity_id: 'e_cfa',
        confidence: 0.9,
      },
      { kind: 'pathway_effectiveness', label: 'Income Growth First (n=42)', confidence: 0.7 },
      { kind: 'personal_history', label: 'Recent completed actions', confidence: 0.6 },
    ],
  };
}

describe('buildWhyChain — determinism contract', () => {
  test('SAME input produces BYTE-IDENTICAL chain (the trust contract)', () => {
    const a = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    const b = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('computed_at is fixed-by-default (no walltime in determinism core)', () => {
    const a = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(a.computed_at).toBe('1970-01-01T00:00:00.000Z');
  });

  test('caller can supply computed_at without affecting determinism of the rest', () => {
    const a = buildWhyChain(
      { kind: 'recommendation_output', value: rec() },
      { user_id: 'u1', computed_at: 'NOW' }
    );
    const b = buildWhyChain(
      { kind: 'recommendation_output', value: rec() },
      { user_id: 'u1', computed_at: 'NOW' }
    );
    expect(a).toEqual(b);
  });
});

describe('buildWhyChain — recommendation', () => {
  test('root node names the inferred root goal', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(w.nodes[0].claim).toMatch(/Financial Independence/);
  });

  test('top action becomes a child of the root', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    const top = w.nodes.find((n) => /Top required action/.test(n.claim));
    expect(top).toBeDefined();
    const edge = w.edges.find((e) => e.child_node_id === top!.id);
    expect(edge?.parent_node_id).toBe(w.nodes[0].id);
  });

  test('supporting evidence surfaces top-3 by confidence', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    const ev = w.nodes.filter((n) => /Evidence \(/.test(n.claim));
    expect(ev.length).toBeGreaterThan(0);
  });

  test('historical effectiveness branch present when historical_effectiveness is set', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(w.nodes.some((n) => /Historical effectiveness/.test(n.claim))).toBe(true);
  });

  test('calibrated confidence surfaces as its own branch when different from confidence_score', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(w.nodes.some((n) => /Calibrated confidence/.test(n.claim))).toBe(true);
  });

  test('blocked goals surface as a depends_on branch', () => {
    const w = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
    expect(w.edges.some((e) => e.label === 'depends_on')).toBe(true);
  });

  test('max_depth caps deepest node depth', () => {
    const shallow = buildWhyChain(
      { kind: 'recommendation_output', value: rec() },
      { user_id: 'u1', max_depth: 1 }
    );
    for (const n of shallow.nodes) expect(n.depth).toBeLessThanOrEqual(1);
  });
});

describe('buildWhyChain — decision impact', () => {
  const impact = computeDecisionImpact({
    goal_id: 'g1',
    decision_label: 'Reduce credit utilization below 10%',
    base_magnitude: 0.18,
    is_structural: false,
    domains: ['financial'],
  });

  test('marks structural / non-structural classification on a child node', () => {
    const w = buildWhyChain({ kind: 'goal_decision_impact', value: impact }, { user_id: 'u1' });
    expect(w.nodes.some((n) => /non-structural/.test(n.claim))).toBe(true);
  });

  test('surfaces top-3 horizons by absolute delta', () => {
    const w = buildWhyChain({ kind: 'goal_decision_impact', value: impact }, { user_id: 'u1' });
    const horizons = w.nodes.filter((n) => /1_year|3_month|3_year/.test(n.claim));
    expect(horizons.length).toBeGreaterThan(0);
  });
});

describe('buildWhyChain — probability distribution', () => {
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

  test('surfaces variance factors with widening/narrowing language', () => {
    const w = buildWhyChain(
      { kind: 'goal_probability_distribution', value: dist },
      { user_id: 'u1' }
    );
    expect(w.nodes.some((n) => /widens|narrows/.test(n.claim))).toBe(true);
  });
});

describe('buildWhyChain — catch-up plan', () => {
  const plan = computeCatchUpPlan({
    goal_id: 'g1',
    current_score: 0.3,
    target_score: 0.5,
    target_at_months: 12,
    domains: ['financial'],
    available_surplus_usd: 500,
    commitment_hours_per_week: 4,
    risk_tolerance: 0.5,
  });

  test('surfaces top catch-up actions with feasibility numbers', () => {
    const w = buildWhyChain({ kind: 'catch_up_plan', value: plan }, { user_id: 'u1' });
    expect(w.nodes.some((n) => /feasibility/.test(n.claim))).toBe(true);
  });
});
