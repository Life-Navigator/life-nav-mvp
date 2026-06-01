/**
 * @jest-environment node
 *
 * Pure-logic tests for CrossDomainAttributionService.
 */

import { __test } from '../cross-domain-attribution-service';
import type {
  AttributionLabel,
  CrossDomainImpact,
  DomainKey,
  OutcomeAttribution,
} from '@/types/decision-intelligence';

const { normalizeAttributionShares, traverseImpactChain } = __test;

let _id = 0;
function impact(
  source: DomainKey,
  target: DomainKey,
  label: AttributionLabel = 'CONTRIBUTED_TO',
  strength = 1,
  confidence = 0.8
): CrossDomainImpact {
  return {
    id: `i${++_id}`,
    user_id: 'u',
    source_domain: source,
    target_domain: target,
    label,
    strength,
    confidence,
    evidence: [],
    observed_at: new Date().toISOString(),
    metadata: {},
    created_at: '',
    updated_at: '',
  };
}

function attr(share: number): OutcomeAttribution {
  return {
    id: `a${++_id}`,
    user_id: 'u',
    outcome_id: 'o',
    attribution_share: share,
    confidence: 0.8,
    metadata: {},
    created_at: '',
    updated_at: '',
  };
}

describe('normalizeAttributionShares', () => {
  beforeEach(() => {
    _id = 0;
  });

  test('empty input → empty output', () => {
    expect(normalizeAttributionShares([])).toEqual([]);
  });

  test('shares totaling ≤ 1 are unchanged', () => {
    const xs = [attr(0.4), attr(0.3), attr(0.2)];
    const out = normalizeAttributionShares(xs);
    expect(out.map((x) => x.attribution_share)).toEqual([0.4, 0.3, 0.2]);
  });

  test('shares totaling > 1 are scaled to sum to 1', () => {
    const xs = [attr(0.6), attr(0.6), attr(0.8)]; // total = 2.0
    const out = normalizeAttributionShares(xs);
    const sum = out.reduce((a, x) => a + x.attribution_share, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe('traverseImpactChain', () => {
  beforeEach(() => {
    _id = 0;
  });

  test('returns empty nodes when start has no outgoing edges', () => {
    const r = traverseImpactChain({ domain: 'finance' }, []);
    expect(r.nodes).toHaveLength(0);
    expect(r.max_depth_reached).toBe(0);
  });

  test('classic chain: health → career → financial', () => {
    const r = traverseImpactChain({ domain: 'health' }, [
      impact('health', 'career', 'CONTRIBUTED_TO', 0.6),
      impact('career', 'financial', 'INFLUENCED', 0.7),
    ]);
    const ds = r.nodes.map((n) => n.domain);
    expect(ds).toEqual(['career', 'financial']);
    expect(r.max_depth_reached).toBe(2);
    const fin = r.nodes.find((n) => n.domain === 'financial')!;
    expect(fin.cumulative_strength).toBeCloseTo(0.42); // 0.6 * 0.7
    expect(fin.via_labels).toEqual(['CONTRIBUTED_TO', 'INFLUENCED']);
  });

  test('depth limit respected', () => {
    const r = traverseImpactChain(
      { domain: 'health' },
      [impact('health', 'career'), impact('career', 'financial'), impact('financial', 'estate')],
      { max_depth: 2 }
    );
    expect(r.max_depth_reached).toBeLessThanOrEqual(2);
    expect(r.nodes.find((n) => n.domain === 'estate')).toBeUndefined();
  });

  test('multiple paths choose the stronger one for cumulative_strength', () => {
    const r = traverseImpactChain({ domain: 'education' }, [
      impact('education', 'career', 'CONTRIBUTED_TO', 0.3),
      impact('education', 'career', 'ACCELERATED', 0.9),
    ]);
    const cr = r.nodes.find((n) => n.domain === 'career')!;
    expect(cr.cumulative_strength).toBeCloseTo(0.9);
  });

  test('BLOCKED edges still traverse (we track them; downstream decides)', () => {
    const r = traverseImpactChain({ domain: 'health' }, [
      impact('health', 'career', 'BLOCKED', 0.5),
    ]);
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].via_labels).toEqual(['BLOCKED']);
  });
});
