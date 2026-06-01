/**
 * @jest-environment node
 *
 * Constitutional retrieval — pure helpers + fail-closed contract.
 */

import { ruleSetFromRows, __test } from '../retrieval';
import { retrieveConstitutionalRuleSet } from '../retrieval';

const { partition } = __test;

const fixtures = [
  {
    id: '1',
    entity_kind: 'ConstitutionalPrinciple',
    slug: 'principle.lawfulness',
    name: 'Lawfulness',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
  {
    id: '2',
    entity_kind: 'LegalRule',
    slug: 'legal.no_fraud',
    name: 'No Fraud',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
  {
    id: '3',
    entity_kind: 'SafetyRule',
    slug: 'safety.self_harm',
    name: 'Self-Harm Safety',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
  {
    id: '4',
    entity_kind: 'CrisisIndicator',
    slug: 'crisis.suicidal_ideation',
    name: 'SI',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
  {
    id: '5',
    entity_kind: 'CognitiveDistortionPattern',
    slug: 'cog.catastrophize',
    name: 'Catastrophizing',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
  {
    id: '6',
    entity_kind: 'RealismRule',
    slug: 'realism.no_guarantees',
    name: 'No Guarantees',
    body: 'b',
    version: '1.0.0',
    review_status: 'active',
    tags: [],
  },
];

describe('partition', () => {
  test('groups by entity_kind and computes rule_set_version', () => {
    const r = partition(fixtures);
    expect(r.principles).toHaveLength(1);
    expect(r.legal_rules).toHaveLength(1);
    expect(r.safety_rules).toHaveLength(1);
    expect(r.crisis_indicators).toHaveLength(1);
    expect(r.cognitive_distortion_patterns).toHaveLength(1);
    expect(r.realism_rules).toHaveLength(1);
    expect(r.retrieved_rule_ids.length).toBe(6);
    expect(r.rule_set_version).toMatch(/^[0-9a-f]{8}$/);
  });

  test('rule_set_version is stable for identical rows', () => {
    const a = partition(fixtures).rule_set_version;
    const b = partition(fixtures.slice().reverse()).rule_set_version;
    expect(a).toBe(b);
  });

  test('rule_set_version differs when rows differ', () => {
    const sub = fixtures.slice(0, 3);
    expect(partition(sub).rule_set_version).not.toBe(partition(fixtures).rule_set_version);
  });
});

describe('retrieveConstitutionalRuleSet — fail-closed', () => {
  test('DB error → ok=false', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'connection_refused' } }),
        }),
      }),
    };
    __test._clearCache();
    const r = await retrieveConstitutionalRuleSet({ supabase: sb });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('connection_refused');
  });

  test('empty rule set → ok=false (constitutional layer is not optional)', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
    __test._clearCache();
    const r = await retrieveConstitutionalRuleSet({ supabase: sb });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty_rule_set');
  });

  test('happy path → ok=true with partitioned rule set', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: fixtures, error: null }),
        }),
      }),
    };
    __test._clearCache();
    const r = await retrieveConstitutionalRuleSet({ supabase: sb });
    expect(r.ok).toBe(true);
    expect(r.retrieved!.retrieved_rule_ids.length).toBe(6);
  });

  test('cache hit returns immediately with cache_hit=true', async () => {
    __test._clearCache();
    __test._seedCache(ruleSetFromRows(fixtures));
    const sb = {
      from: () => {
        throw new Error('should not be called');
      },
    };
    const r = await retrieveConstitutionalRuleSet({ supabase: sb });
    expect(r.ok).toBe(true);
    expect(r.cache_hit).toBe(true);
  });
});
