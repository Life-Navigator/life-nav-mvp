/**
 * @jest-environment node
 *
 * Pure-logic tests for AdvisorReasoningService. The Supabase loader
 * paths are exercised at integration time; this file covers the
 * internal helpers that turn central links + personal context into
 * actions, sequences, and timelines.
 */

import { __test } from '../advisor-reasoning-service';
import type { CentralLink, DiscoveredRootGoal, PersonalContext } from '@/types/advisor';

const { aggregateImpacts, deriveActions, sequenceActions } = __test;

function link(over: Partial<CentralLink>): CentralLink {
  return {
    entity_id: over.entity_id ?? 'e1',
    canonical_name: over.canonical_name ?? 'Income',
    entity_type: over.entity_type ?? 'Concept',
    domain: over.domain ?? 'finance',
    label: over.label ?? 'SUPPORTS',
    direction: over.direction ?? 'supports',
    strength: over.strength ?? 0.7,
    confidence: over.confidence ?? 0.8,
  };
}

const ROOT: DiscoveredRootGoal = {
  inferred_true_goal: 'Financial Independence',
  confidence: 0.8,
  source: 'goal_interpretation',
};

const EMPTY_CTX: PersonalContext = {
  constraints: [],
  capabilities: [],
  motivations: [],
  decision_preferences: [],
  domain_risk_tolerance: [],
  commitment_levels: [],
};

describe('AdvisorReasoningService internals', () => {
  describe('aggregateImpacts', () => {
    test('groups links by domain into supporting/blocking/required buckets', () => {
      const out = aggregateImpacts([
        link({ entity_id: 'a', domain: 'finance', direction: 'supports' }),
        link({ entity_id: 'b', domain: 'finance', direction: 'blocks', label: 'BLOCKS' }),
        link({
          entity_id: 'c',
          domain: 'career',
          direction: 'requires',
          label: 'PREREQUISITE_FOR',
        }),
      ]);
      const fin = out.find((d) => d.domain === 'finance');
      const car = out.find((d) => d.domain === 'career');
      expect(fin?.supporting).toHaveLength(1);
      expect(fin?.blocking).toHaveLength(1);
      expect(car?.required).toHaveLength(1);
    });
  });

  describe('deriveActions', () => {
    test('emits required actions first, then supporting, then blocking', () => {
      const impacts = aggregateImpacts([
        link({ entity_id: 'sup', direction: 'supports', label: 'SUPPORTS' }),
        link({ entity_id: 'req', direction: 'requires', label: 'PREREQUISITE_FOR' }),
        link({ entity_id: 'blk', direction: 'blocks', label: 'BLOCKS' }),
      ]);
      const actions = deriveActions(ROOT, impacts, EMPTY_CTX);
      const reqIdx = actions.findIndex((a) => a.id.includes('_req_'));
      const supIdx = actions.findIndex((a) => a.id.includes('_sup_'));
      const blkIdx = actions.findIndex((a) => a.id.includes('_blk_'));
      expect(reqIdx).toBeLessThan(supIdx);
      expect(supIdx).toBeLessThan(blkIdx);
    });

    test('halves expected_strength when the domain has zero hours_per_week commitment', () => {
      const impacts = aggregateImpacts([
        link({ entity_id: 'x', domain: 'finance', direction: 'supports', strength: 0.8 }),
      ]);
      const ctx: PersonalContext = {
        ...EMPTY_CTX,
        commitment_levels: [{ id: 'c', area: 'finance', level: 0 }],
      };
      const actions = deriveActions(ROOT, impacts, ctx);
      expect(actions[0].expected_strength).toBeCloseTo(0.4);
    });

    test('emits an action per blocker so they can be surfaced even without a personal match', () => {
      const impacts = aggregateImpacts([
        link({ entity_id: 'b1', direction: 'blocks', label: 'BLOCKS' }),
        link({ entity_id: 'b2', direction: 'blocks', label: 'CONFLICTS_WITH' }),
      ]);
      const actions = deriveActions(ROOT, impacts, EMPTY_CTX);
      const blkActions = actions.filter((a) => a.id.includes('_blk_'));
      expect(blkActions).toHaveLength(2);
    });
  });

  describe('sequenceActions', () => {
    test('returns timeline buckets that together cover every action', () => {
      const impacts = aggregateImpacts(
        Array.from({ length: 12 }, (_, i) =>
          link({ entity_id: `e${i}`, direction: 'supports', strength: 0.7 - i * 0.02 })
        )
      );
      const actions = deriveActions(ROOT, impacts, EMPTY_CTX);
      const { recommended_sequence, timeline } = sequenceActions(actions);
      const flat = timeline.flatMap((t) => t.action_ids);
      // Every action should land in exactly one timeline bucket.
      expect(new Set(flat).size).toBe(actions.length);
      // Sequence echoes the timeline order.
      expect(recommended_sequence).toEqual(flat);
    });
  });
});
