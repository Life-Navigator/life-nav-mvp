/**
 * @jest-environment node
 *
 * Sprint S — enterprise projection tests.
 *
 * Covers:
 *   * 4-tier layer resolution (global → industry → org → user)
 *   * Hard `is_overridable=false` invariant
 *   * Stable rule_set_version hashing
 *   * Policy engine outcomes + tie-breaking
 *   * Enterprise analytics aggregation + ROI
 */

import { filterApplicable, resolveLayers, ruleSetVersion } from '../layer-resolver';
import { evaluatePolicies, __test as polTest } from '../policy-engine';
import { buildEnterpriseAnalyticsReport } from '../analytics';
import { ALL_INDUSTRIES } from '../types';
import type { LayerRule, OrganizationPolicy } from '../types';
import type { EngagementRow, CostRow, OutcomeRow } from '../analytics';

function rule(overrides: Partial<LayerRule> = {}): LayerRule {
  return {
    layer: 'global',
    industry: null,
    tenant_id: null,
    user_id: null,
    entity_kind: 'principle',
    slug: 'no_harm',
    name: 'No harm',
    body: 'Never recommend harmful action.',
    version: '1.0',
    is_overridable: false,
    review_status: 'active',
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Industry list
// ---------------------------------------------------------------------------

describe('ALL_INDUSTRIES', () => {
  test('exposes the 6 Sprint S industries', () => {
    expect(ALL_INDUSTRIES).toEqual([
      'financial_services',
      'healthcare',
      'payroll',
      'education',
      'government',
      'energy',
    ]);
  });
});

// ---------------------------------------------------------------------------
// filterApplicable
// ---------------------------------------------------------------------------

describe('filterApplicable', () => {
  test('keeps global rules with no tenant/industry/user', () => {
    const r = rule({ layer: 'global' });
    expect(filterApplicable([r], 'financial_services').length).toBe(1);
  });

  test('keeps industry rules only for matching industry', () => {
    const r = rule({ layer: 'industry', industry: 'healthcare', slug: 'phi_min' });
    expect(filterApplicable([r], 'healthcare').length).toBe(1);
    expect(filterApplicable([r], 'financial_services').length).toBe(0);
  });

  test('drops non-active rules', () => {
    const r = rule({ review_status: 'draft' });
    expect(filterApplicable([r], 'financial_services').length).toBe(0);
  });

  test('organization rules require matching tenant_id', () => {
    const r = rule({ layer: 'organization', tenant_id: 'tenant-A', slug: 'rule-org' });
    expect(filterApplicable([r], 'financial_services', 'tenant-A').length).toBe(1);
    expect(filterApplicable([r], 'financial_services', 'tenant-B').length).toBe(0);
    expect(filterApplicable([r], 'financial_services').length).toBe(0);
  });

  test('user rules require matching tenant + user', () => {
    const r = rule({ layer: 'user', tenant_id: 'tenant-A', user_id: 'user-1', slug: 'rule-u' });
    expect(filterApplicable([r], 'financial_services', 'tenant-A', 'user-1').length).toBe(1);
    expect(filterApplicable([r], 'financial_services', 'tenant-A', 'user-2').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveLayers
// ---------------------------------------------------------------------------

describe('resolveLayers', () => {
  test('most-specific layer wins when higher layer is_overridable', () => {
    const global_rule = rule({
      layer: 'global',
      slug: 'tone',
      is_overridable: true,
      version: '1.0',
      body: 'Plain',
    });
    const org_rule = rule({
      layer: 'organization',
      tenant_id: 'tA',
      slug: 'tone',
      version: '1.1',
      is_overridable: true,
      body: 'Formal',
    });
    const r = resolveLayers({
      rules: [global_rule, org_rule],
      industry: 'financial_services',
      tenant_id: 'tA',
    });
    expect(r.rules.length).toBe(1);
    expect(r.rules[0].origin_layer).toBe('organization');
    expect(r.rules[0].rule.body).toBe('Formal');
    expect(r.blocked_overrides.length).toBe(0);
  });

  test('hard invariant: lower-layer override is blocked when higher is is_overridable=false', () => {
    const global_rule = rule({
      layer: 'global',
      slug: 'no_harm',
      is_overridable: false,
      body: 'Never recommend harmful action.',
    });
    const org_override = rule({
      layer: 'organization',
      tenant_id: 'tA',
      slug: 'no_harm',
      is_overridable: true,
      body: 'Harmful action is OK if cleared by compliance.',
    });
    const user_override = rule({
      layer: 'user',
      tenant_id: 'tA',
      user_id: 'u1',
      slug: 'no_harm',
      is_overridable: true,
      body: 'I accept harmful suggestions.',
    });
    const r = resolveLayers({
      rules: [global_rule, org_override, user_override],
      industry: 'financial_services',
      tenant_id: 'tA',
      user_id: 'u1',
    });
    expect(r.rules.length).toBe(1);
    expect(r.rules[0].origin_layer).toBe('global');
    expect(r.rules[0].rule.body).toBe('Never recommend harmful action.');
    expect(r.blocked_overrides.length).toBe(2);
    expect(r.blocked_overrides.map((b) => b.attempted_layer).sort()).toEqual([
      'organization',
      'user',
    ]);
  });

  test('industry rule with is_overridable=false blocks org override', () => {
    const industry_rule = rule({
      layer: 'industry',
      industry: 'financial_services',
      slug: 'fiduciary',
      is_overridable: false,
      body: 'Act in client best interest.',
    });
    const org_override = rule({
      layer: 'organization',
      tenant_id: 'tA',
      slug: 'fiduciary',
      is_overridable: true,
      body: 'Prioritize firm revenue.',
    });
    const r = resolveLayers({
      rules: [industry_rule, org_override],
      industry: 'financial_services',
      tenant_id: 'tA',
    });
    expect(r.rules[0].origin_layer).toBe('industry');
    expect(r.blocked_overrides.length).toBe(1);
    expect(r.blocked_overrides[0].higher_layer).toBe('industry');
  });

  test('different slugs do not interfere', () => {
    const a = rule({ slug: 'a' });
    const b = rule({ slug: 'b' });
    const r = resolveLayers({ rules: [a, b], industry: 'financial_services' });
    expect(r.rules.length).toBe(2);
  });

  test('shadowed_count tracks overridden lower-layer rules', () => {
    const global_rule = rule({ layer: 'global', slug: 't', is_overridable: true });
    const org_rule = rule({
      layer: 'organization',
      tenant_id: 'tA',
      slug: 't',
      is_overridable: true,
      body: 'org body',
    });
    const r = resolveLayers({
      rules: [global_rule, org_rule],
      industry: 'financial_services',
      tenant_id: 'tA',
    });
    expect(r.rules[0].shadowed_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ruleSetVersion
// ---------------------------------------------------------------------------

describe('ruleSetVersion', () => {
  test('is stable across input ordering', () => {
    const a = rule({ slug: 'a', version: '1.0' });
    const b = rule({ slug: 'b', version: '2.0' });
    const v1 = ruleSetVersion(resolveLayers({ rules: [a, b], industry: 'energy' }).rules);
    const v2 = ruleSetVersion(resolveLayers({ rules: [b, a], industry: 'energy' }).rules);
    expect(v1).toBe(v2);
  });

  test('changes when a rule version changes', () => {
    const a = rule({ slug: 'a', version: '1.0' });
    const a2 = rule({ slug: 'a', version: '1.1' });
    const v1 = ruleSetVersion(resolveLayers({ rules: [a], industry: 'energy' }).rules);
    const v2 = ruleSetVersion(resolveLayers({ rules: [a2], industry: 'energy' }).rules);
    expect(v1).not.toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// Policy engine
// ---------------------------------------------------------------------------

function pol(overrides: Partial<OrganizationPolicy> = {}): OrganizationPolicy {
  return {
    tenant_id: 'tA',
    policy_key: 'k',
    display_name: 'A policy',
    applies_to: ['recommendation.optimizer'],
    outcome: 'approved',
    priority: 100,
    active: true,
    ...overrides,
  };
}

describe('evaluatePolicies', () => {
  test('returns allow when no policies match', () => {
    const r = evaluatePolicies({
      policies: [],
      subject_kind: 'recommendation.optimizer',
      subject_text: '...',
    });
    expect(r.outcome).toBe('allow');
    expect(r.matched.length).toBe(0);
  });

  test('returns prohibited when a prohibited policy matches', () => {
    const r = evaluatePolicies({
      policies: [
        pol({ policy_key: 'p_prohibit', outcome: 'prohibited', display_name: 'Block FX' }),
      ],
      subject_kind: 'recommendation.optimizer',
      subject_text: 'whatever',
    });
    expect(r.outcome).toBe('prohibited');
    expect(r.policy_key).toBe('p_prohibit');
  });

  test('strictest outcome wins regardless of priority', () => {
    const r = evaluatePolicies({
      policies: [
        pol({ policy_key: 'approve', outcome: 'approved', priority: 1 }),
        pol({ policy_key: 'block', outcome: 'prohibited', priority: 999 }),
      ],
      subject_kind: 'recommendation.optimizer',
      subject_text: 'whatever',
    });
    expect(r.outcome).toBe('prohibited');
    expect(r.policy_key).toBe('block');
  });

  test('escalate carries escalation_to', () => {
    const r = evaluatePolicies({
      policies: [pol({ outcome: 'escalate', escalation_to: 'compliance@firm' })],
      subject_kind: 'recommendation.optimizer',
      subject_text: 'x',
    });
    expect(r.outcome).toBe('escalate');
    expect(r.escalation_to).toBe('compliance@firm');
  });

  test('match_pattern regex filters out non-matching subjects', () => {
    const r = evaluatePolicies({
      policies: [pol({ match_pattern: '\\bFX\\b', outcome: 'prohibited' })],
      subject_kind: 'recommendation.optimizer',
      subject_text: 'buy gold instead',
    });
    expect(r.outcome).toBe('allow');
  });

  test('applies_to=* matches any subject_kind', () => {
    const r = evaluatePolicies({
      policies: [pol({ applies_to: ['*'], outcome: 'requires_compliance_review' })],
      subject_kind: 'arbitrary.kind',
      subject_text: 'x',
    });
    expect(r.outcome).toBe('requires_compliance_review');
  });

  test('inactive policy is ignored', () => {
    const r = evaluatePolicies({
      policies: [pol({ outcome: 'prohibited', active: false })],
      subject_kind: 'recommendation.optimizer',
      subject_text: 'x',
    });
    expect(r.outcome).toBe('allow');
  });

  test('invalid regex falls back to substring match', () => {
    expect(polTest.subjectMatches('[unbalanced', 'foo [unbalanced bar')).toBe(true);
    expect(polTest.subjectMatches('[unbalanced', 'unrelated text')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enterprise analytics
// ---------------------------------------------------------------------------

describe('buildEnterpriseAnalyticsReport', () => {
  test('computes engagement metrics from event rows', () => {
    const engagement_rows: EngagementRow[] = [
      { user_id: 'u1', occurred_at: '2026-05-01T00:00:00Z', event_type: 'recommendation.viewed' },
      { user_id: 'u1', occurred_at: '2026-05-01T01:00:00Z', event_type: 'recommendation.viewed' },
      { user_id: 'u2', occurred_at: '2026-05-01T00:00:00Z', event_type: 'recommendation.accepted' },
    ];
    const r = buildEnterpriseAnalyticsReport({
      tenant_id: 'tA',
      window_days: 30,
      engagement_rows,
      cost_rows: [],
      outcome_row: null,
    });
    expect(r.engagement.active_users).toBe(2);
    expect(r.engagement.events_total).toBe(3);
    expect(r.engagement.events_per_active_user).toBe(1.5);
    expect(r.engagement.top_events[0]).toEqual({ event_type: 'recommendation.viewed', count: 2 });
  });

  test('cost from micros and roi ratio', () => {
    const cost_rows: CostRow[] = [
      { cost_usd_micros: 250_000, created_at: '2026-05-01T00:00:00Z' }, // $0.25
      { cost_usd_micros: 750_000, created_at: '2026-05-02T00:00:00Z' }, // $0.75
    ];
    const outcome_row: OutcomeRow = {
      recommendations_total: 100,
      acceptance_rate: 0.5,
      completion_rate: 0.2, // 20 completed
      avg_effectiveness: 0.5,
      avg_dqi: 0.7,
      avg_life_progress: 0.1,
      safety_compliance_rate: 1.0,
    };
    const r = buildEnterpriseAnalyticsReport({
      tenant_id: 'tA',
      window_days: 30,
      engagement_rows: [],
      cost_rows,
      outcome_row,
      value_per_completed_usd: 100,
    });
    expect(r.roi.cost_usd).toBe(1);
    // 20 completed × 0.5 effectiveness × $100 = $1000
    expect(r.roi.estimated_value_usd).toBe(1000);
    expect(r.roi.roi_ratio).toBe(1000);
  });

  test('zero cost with non-zero value returns 0 roi_ratio (sanitized Infinity)', () => {
    const outcome_row: OutcomeRow = {
      recommendations_total: 10,
      acceptance_rate: 1.0,
      completion_rate: 1.0,
      avg_effectiveness: 1.0,
      avg_dqi: 1.0,
      avg_life_progress: 0.0,
      safety_compliance_rate: 1.0,
    };
    const r = buildEnterpriseAnalyticsReport({
      tenant_id: 'tA',
      window_days: 30,
      engagement_rows: [],
      cost_rows: [],
      outcome_row,
    });
    expect(r.roi.cost_usd).toBe(0);
    expect(r.roi.estimated_value_usd).toBe(1000);
    expect(r.roi.roi_ratio).toBe(0); // Infinity sanitized to 0
  });

  test('null outcome_row → zero value', () => {
    const r = buildEnterpriseAnalyticsReport({
      tenant_id: 'tA',
      window_days: 30,
      engagement_rows: [],
      cost_rows: [],
      outcome_row: null,
    });
    expect(r.roi.estimated_value_usd).toBe(0);
    expect(r.outcome).toBeNull();
  });
});
