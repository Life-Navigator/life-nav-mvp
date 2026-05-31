/**
 * @jest-environment node
 *
 * Pure-logic tests for GoalPathService's resolver layer. The Supabase
 * loader is tested separately at integration time; here we exercise
 * the BFS + classification + cycle detection on fixture edges.
 */

import { resolvePathway } from '../goal-path-service';
import type { GoalEdge, GoalRelationshipType } from '@/types/goal-hierarchy';

let edgeIdCounter = 0;
function E(
  parent: string,
  child: string,
  type: GoalRelationshipType,
  strength = 1,
  table: GoalEdge['source_table'] = 'goal_relationships'
): GoalEdge {
  return {
    id: `edge_${++edgeIdCounter}`,
    user_id: 'u1',
    parent_goal_id: parent,
    child_goal_id: child,
    relationship_type: type,
    strength_score: strength,
    confidence_score: 0.9,
    source: 'test',
    source_table: table,
  };
}

describe('GoalPathService.resolvePathway', () => {
  beforeEach(() => {
    edgeIdCounter = 0;
  });

  test('supporting bucket includes goals with incoming SUPPORTS / ACCELERATES', () => {
    // emergency_fund SUPPORTS financial_independence
    // income_growth ACCELERATES financial_independence
    const edges = [
      E('emergency_fund', 'financial_independence', 'SUPPORTS'),
      E('income_growth', 'financial_independence', 'ACCELERATES'),
    ];
    const p = resolvePathway('financial_independence', 'u1', edges);
    const ids = p.supporting.map((n) => n.goal_id).sort();
    expect(ids).toEqual(['emergency_fund', 'income_growth']);
    expect(p.blocked).toHaveLength(0);
    expect(p.required).toHaveLength(0);
  });

  test('required bucket includes both incoming PREREQUISITE_FOR and outgoing DEPENDS_ON', () => {
    const edges = [
      E('down_payment', 'home_ownership', 'PREREQUISITE_FOR'), // incoming
      E('home_ownership', 'good_credit', 'DEPENDS_ON'), // outgoing
    ];
    const p = resolvePathway('home_ownership', 'u1', edges);
    const ids = p.required.map((n) => n.goal_id).sort();
    expect(ids).toEqual(['down_payment', 'good_credit']);
  });

  test('blocked bucket captures BLOCKS / CONFLICTS_WITH / COMPETES_FOR_RESOURCES', () => {
    const edges = [
      E('poor_health', 'income_growth', 'BLOCKS'),
      E('debt_payoff', 'income_growth', 'COMPETES_FOR_RESOURCES'),
      E('lifestyle_inflation', 'income_growth', 'CONFLICTS_WITH'),
    ];
    const p = resolvePathway('income_growth', 'u1', edges);
    const ids = p.blocked.map((n) => n.goal_id).sort();
    expect(ids).toEqual(['debt_payoff', 'lifestyle_inflation', 'poor_health']);
  });

  test('optional bucket walks PARENT_OF subtree (outgoing)', () => {
    const edges = [
      E('financial_independence', 'retirement_account', 'PARENT_OF'),
      E('retirement_account', 'roth_ira', 'PARENT_OF'),
      E('financial_independence', 'taxable_brokerage', 'PARENT_OF'),
    ];
    const p = resolvePathway('financial_independence', 'u1', edges);
    const ids = p.optional.map((n) => n.goal_id).sort();
    expect(ids).toEqual(['retirement_account', 'roth_ira', 'taxable_brokerage']);
    // Depth: direct children at 1, grandchildren at 2
    const roth = p.optional.find((n) => n.goal_id === 'roth_ira');
    expect(roth?.depth).toBe(2);
  });

  test('cumulative strength multiplies along the path', () => {
    const edges = [E('a', 'b', 'PARENT_OF', 0.5), E('b', 'c', 'PARENT_OF', 0.5)];
    const p = resolvePathway('a', 'u1', edges);
    const c = p.optional.find((n) => n.goal_id === 'c');
    expect(c?.cumulative_strength).toBeCloseTo(0.25);
  });

  test('cycle detection flags SCCs > 1', () => {
    const edges = [
      E('a', 'b', 'PARENT_OF'),
      E('b', 'c', 'PARENT_OF'),
      E('c', 'a', 'PARENT_OF'), // closes the loop
    ];
    const p = resolvePathway('a', 'u1', edges);
    expect(p.cycles.length).toBeGreaterThan(0);
    const cycleSet = new Set(p.cycles[0]);
    expect(cycleSet.has('a')).toBe(true);
    expect(cycleSet.has('b')).toBe(true);
    expect(cycleSet.has('c')).toBe(true);
  });

  test('topological order places root first, then required+optional by depth', () => {
    const edges = [
      E('prereq1', 'root', 'PREREQUISITE_FOR'),
      E('root', 'opt1', 'PARENT_OF'),
      E('opt1', 'opt2', 'PARENT_OF'),
    ];
    const p = resolvePathway('root', 'u1', edges);
    expect(p.topological_order[0]).toBe('root');
    expect(p.topological_order).toContain('prereq1');
    expect(p.topological_order).toContain('opt1');
    expect(p.topological_order.indexOf('opt1')).toBeLessThan(p.topological_order.indexOf('opt2'));
  });

  test('two users with disjoint edges produce disjoint pathways', () => {
    const edges = [
      E('a', 'root_u1', 'SUPPORTS'),
      { ...E('b', 'root_u2', 'SUPPORTS'), user_id: 'u2' },
    ];
    const p1 = resolvePathway(
      'root_u1',
      'u1',
      edges.filter((e) => e.user_id === 'u1')
    );
    const p2 = resolvePathway(
      'root_u2',
      'u2',
      edges.filter((e) => e.user_id === 'u2')
    );
    expect(p1.supporting.map((n) => n.goal_id)).toEqual(['a']);
    expect(p2.supporting.map((n) => n.goal_id)).toEqual(['b']);
  });
});
