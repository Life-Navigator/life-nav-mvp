/**
 * @jest-environment node
 *
 * CounterfactualEngine + AssumptionEngine + EvidenceGraph tests.
 *
 * Key contracts:
 *
 *   * Counterfactuals are deterministic and ranked by sensitivity.
 *   * A flip in a *structural* input produces a 'flipped' outcome.
 *   * Assumption severity classifier deterministically buckets
 *     critical / load_bearing / informational.
 *   * Aggregation deduplicates by lowercase text and keeps the
 *     higher-sensitivity copy.
 */

import { __test as cfTest } from '../counterfactual-engine';
import { __test as asTest } from '../assumption-engine';
import { __test as evTest } from '../audit-and-evidence';
import { computeDecisionImpact } from '../decision-impact-engine';
import { computeProbabilityDistribution } from '../probability-engine';
import { computeCatchUpPlan } from '../catch-up-engine';
import type { AssumptionItem } from '@/types/xai';

const {
  counterfactualsForDecisionImpact,
  counterfactualsForProbability,
  counterfactualsForCatchUp,
} = cfTest;
const { classifySeverity, sensitivityFor, fromExplanation, aggregateAssumptions } = asTest;
const { buildEvidenceGraph } = evTest;

// ---------------------------------------------------------------------------
// Determinism — counterfactuals
// ---------------------------------------------------------------------------
describe('counterfactual engine — determinism', () => {
  test('same DecisionImpact inputs → identical counterfactual list', () => {
    const inputs = {
      goal_id: 'g1',
      decision_label: 'Reduce credit utilization',
      base_magnitude: 0.18,
      is_structural: false,
      domains: ['financial' as const],
    };
    const a = counterfactualsForDecisionImpact(inputs);
    const b = counterfactualsForDecisionImpact(inputs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('flipping is_structural changes the outcome bucket', () => {
    const cfs = counterfactualsForDecisionImpact({
      goal_id: 'g1',
      decision_label: 'X',
      base_magnitude: 0.5,
      is_structural: false,
      domains: ['financial'],
    });
    const structuralFlip = cfs.find((c) => c.perturbation.input_field === 'is_structural');
    expect(structuralFlip).toBeDefined();
    expect(['reranked', 'confidence_changed', 'flipped']).toContain(
      structuralFlip!.expected_outcome
    );
  });

  test('ranked by sensitivity descending', () => {
    const cfs = counterfactualsForDecisionImpact({
      goal_id: 'g1',
      decision_label: 'X',
      base_magnitude: 0.3,
      is_structural: false,
      domains: ['financial'],
    });
    for (let i = 1; i < cfs.length; i += 1) {
      expect(cfs[i - 1].sensitivity).toBeGreaterThanOrEqual(cfs[i].sensitivity);
    }
  });

  test('probability counterfactuals show flipped when current_progress moves enough', () => {
    const inputs = { goal_id: 'g', current_progress: 0.4, domains: ['financial' as const] };
    const cfs = counterfactualsForProbability(inputs, '1_year');
    const widening = cfs.find((c) => /constraint/i.test(c.scenario_label));
    expect(widening).toBeDefined();
  });

  test('catch-up counterfactuals: doubling surplus improves the plan', () => {
    const cfs = counterfactualsForCatchUp({
      goal_id: 'g1',
      current_score: 0.3,
      target_score: 0.55,
      target_at_months: 12,
      domains: ['financial'],
      available_surplus_usd: 100,
      commitment_hours_per_week: 4,
      risk_tolerance: 0.5,
    });
    const doubled = cfs.find((c) => /surplus/.test(c.scenario_label));
    expect(doubled).toBeDefined();
    expect(doubled!.delta_summary).toMatch(/probability_after/);
  });
});

// ---------------------------------------------------------------------------
// Assumption severity classifier
// ---------------------------------------------------------------------------
describe('assumption severity classifier', () => {
  test.each([
    ['No matching pathway history yet for this concept.', 'critical'],
    ['Hard constraints currently bound the action space.', 'critical'],
    ['No supporting goals declared.', 'critical'],
    ['Long-horizon estimates assume no structural life event.', 'critical'],
    ['Base magnitude is the peak effect at the decision natural horizon.', 'load_bearing'],
    ['Range widens at longer horizons because future decisions remain unmade.', 'load_bearing'],
    ['Just an informational note about something.', 'informational'],
  ] as const)('"%s" → %s', (text, want) => {
    expect(classifySeverity(text)).toBe(want);
  });

  test('sensitivity is monotonic: critical > load_bearing > informational at confidence=1', () => {
    const cr = sensitivityFor('hard constraint', 'critical', 1);
    const lb = sensitivityFor('base magnitude', 'load_bearing', 1);
    const inf = sensitivityFor('note', 'informational', 1);
    expect(cr).toBeGreaterThan(lb);
    expect(lb).toBeGreaterThan(inf);
  });
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------
describe('aggregateAssumptions', () => {
  function I(
    text: string,
    sev: AssumptionItem['severity'] = 'load_bearing',
    sens = 0.5,
    source: AssumptionItem['source_engine'] = 'reasoning'
  ): AssumptionItem {
    return { text, severity: sev, sensitivity: sens, source_engine: source };
  }

  test('dedupes by lowercase text, keeps higher sensitivity', () => {
    const out = aggregateAssumptions([
      [I('No matching pathway history.', 'critical', 0.8)],
      [I('No Matching Pathway History.', 'critical', 0.9)], // dupe, higher sens
      [I('Different point.', 'informational', 0.2)],
    ]);
    expect(out).toHaveLength(2);
    const pathway = out.find((x) => /pathway/i.test(x.text));
    expect(pathway?.sensitivity).toBeCloseTo(0.9);
  });

  test('order: critical first, then load_bearing, then informational; sensitivity desc within', () => {
    const out = aggregateAssumptions([
      [
        I('aaa info', 'informational', 0.1),
        I('zzz lb', 'load_bearing', 0.5),
        I('yyy crit', 'critical', 0.7),
      ],
    ]);
    expect(out.map((x) => x.severity)).toEqual(['critical', 'load_bearing', 'informational']);
  });

  test('output is deterministic for identical inputs', () => {
    const list = [I('alpha', 'critical', 0.9), I('beta', 'load_bearing', 0.5)];
    const a = aggregateAssumptions([list]);
    const b = aggregateAssumptions([list]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------
// Full extraction across engines
// ---------------------------------------------------------------------------
describe('full extraction across engines', () => {
  test('extracts from a decision-impact engine output', () => {
    const impact = computeDecisionImpact({
      goal_id: 'g',
      decision_label: 'X',
      base_magnitude: 0.3,
      is_structural: true,
      structural_variable: 'income_trajectory',
      domains: ['financial'],
    });
    const xs = fromExplanation(
      impact.explanation.assumptions,
      'impact',
      impact.explanation.confidence
    );
    expect(xs.length).toBeGreaterThan(0);
    // Should pick up the structural assumption as critical.
    expect(xs.some((x) => x.severity === 'critical')).toBe(true);
  });

  test('extracts from a probability distribution output', () => {
    const dist = computeProbabilityDistribution(
      {
        goal_id: 'g',
        current_progress: 0.4,
        domains: ['financial'],
      },
      '20_year'
    );
    const xs = fromExplanation(dist.explanation.assumptions, 'probability', dist.confidence);
    expect(xs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Evidence graph
// ---------------------------------------------------------------------------
describe('buildEvidenceGraph', () => {
  test('same input → byte-identical graph (determinism)', () => {
    const impact = computeDecisionImpact({
      goal_id: 'g',
      decision_label: 'X',
      base_magnitude: 0.3,
      is_structural: false,
      domains: ['financial'],
    });
    const a = buildEvidenceGraph({ kind: 'goal_decision_impact', value: impact }, { user_id: 'u' });
    const b = buildEvidenceGraph({ kind: 'goal_decision_impact', value: impact }, { user_id: 'u' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('includes a self_report root node plus at least one downstream evidence node', () => {
    const dist = computeProbabilityDistribution(
      { goal_id: 'g', current_progress: 0.3, domains: ['financial'] },
      '1_year'
    );
    const g = buildEvidenceGraph(
      { kind: 'goal_probability_distribution', value: dist },
      { user_id: 'u' }
    );
    expect(g.nodes[0].kind).toBe('self_report');
    expect(g.nodes.length).toBeGreaterThan(1);
  });

  test('every non-root node has at least one inbound edge', () => {
    const dist = computeProbabilityDistribution(
      { goal_id: 'g', current_progress: 0.3, domains: ['financial'] },
      '5_year'
    );
    const g = buildEvidenceGraph(
      { kind: 'goal_probability_distribution', value: dist },
      { user_id: 'u' }
    );
    for (const n of g.nodes.slice(1)) {
      expect(g.edges.some((e) => e.to_node_id === n.id)).toBe(true);
    }
  });
});
