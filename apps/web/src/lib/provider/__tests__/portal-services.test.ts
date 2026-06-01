/**
 * @jest-environment node
 *
 * Provider Portal pure-logic tests.
 *
 * Covers lead-service, portal-dashboard-service, client-workspace,
 * recommendation-builder XAI bundle, progress-monitoring, message
 * validation, and the portal analytics extension.
 */

import { __test as leadTest } from '../lead-service';
import { __test as dashTest } from '../portal-dashboard-service';
import { __test as cwTest } from '../client-workspace-service';
import { __test as rbTest } from '../recommendation-builder-service';
import { __test as pmTest } from '../progress-monitoring-service';
import { __test as msgTest } from '../message-service';
import { __test as paTest } from '../portal-analytics-service';
import type { LeadPackage, LeadPackageConsent, LeadPackagePayload } from '@/types/arcana';
import type { ProviderEngagement, ProviderRecommendation, ProviderOutcome } from '@/types/provider';
import type { LeadEventKind, RecommendationDraft } from '@/types/provider-portal';

// ---------------------------------------------------------------------------
// lead-service
// ---------------------------------------------------------------------------

describe('classifyLeadStatus', () => {
  test('no engagement + active consent → new', () => {
    expect(
      leadTest.classifyLeadStatus({
        consent: { granted_at: '2026-01-01T00:00:00Z' },
        engagement: null,
        now: '2026-05-01T00:00:00Z',
      })
    ).toBe('new');
  });
  test('revoked consent → withdrawn', () => {
    expect(
      leadTest.classifyLeadStatus({
        consent: { granted_at: '2026-01-01T00:00:00Z', revoked_at: '2026-04-01T00:00:00Z' },
        engagement: null,
        now: '2026-05-01T00:00:00Z',
      })
    ).toBe('withdrawn');
  });
  test('expired consent → withdrawn', () => {
    expect(
      leadTest.classifyLeadStatus({
        consent: { granted_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T00:00:00Z' },
        engagement: null,
        now: '2026-05-01T00:00:00Z',
      })
    ).toBe('withdrawn');
  });
  test('engagement active → accepted', () => {
    expect(
      leadTest.classifyLeadStatus({
        consent: { granted_at: '2026-01-01T00:00:00Z' },
        engagement: { status: 'active', accepted_at: '2026-02-01T00:00:00Z', revoked_at: null },
        now: '2026-05-01T00:00:00Z',
      })
    ).toBe('accepted');
  });
  test('engagement declined → declined', () => {
    expect(
      leadTest.classifyLeadStatus({
        consent: { granted_at: '2026-01-01T00:00:00Z' },
        engagement: { status: 'declined', accepted_at: null, revoked_at: null },
        now: '2026-05-01T00:00:00Z',
      })
    ).toBe('declined');
  });
});

describe('isValidDeclineReason', () => {
  test('accepts whitelisted', () => {
    expect(leadTest.isValidDeclineReason('capacity')).toBe(true);
    expect(leadTest.isValidDeclineReason('outside_scope')).toBe(true);
  });
  test('rejects free-text', () => {
    expect(leadTest.isValidDeclineReason("I don't feel like it")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dashboard service
// ---------------------------------------------------------------------------

function leadSummaryFixture(status: 'new' | 'pending' | 'accepted' | 'declined' | 'withdrawn') {
  return {
    lead_package_id: `lp_${status}`,
    patient_user_id: 'u1',
    patient_initials: 'AB',
    age_band: '35-39',
    primary_goal_title: 'VO2max 50',
    dominant_driver: 'performance',
    readiness_score: 0.5,
    probability_of_success: 0.6,
    key_risk_count: 2,
    status,
    generated_at: '2026-05-01T00:00:00Z',
    shared_at: null,
    last_event_at: null,
  };
}

describe('bucketLeads', () => {
  test('correctly counts each status', () => {
    const out = dashTest.bucketLeads([
      leadSummaryFixture('new'),
      leadSummaryFixture('new'),
      leadSummaryFixture('pending'),
      leadSummaryFixture('accepted'),
      leadSummaryFixture('declined'),
      leadSummaryFixture('withdrawn'),
    ]);
    expect(out.new_count).toBe(2);
    expect(out.pending_count).toBe(1);
    expect(out.accepted_count).toBe(1);
    expect(out.declined_count).toBe(2); // declined + withdrawn
  });
});

describe('bucketClients + at-risk', () => {
  function eng(over: Partial<ProviderEngagement> = {}): ProviderEngagement {
    return {
      id: 'e_1',
      provider_id: 'p_1',
      patient_user_id: 'pat_1',
      status: 'active',
      allowed_domains: ['health'],
      max_sensitivity: 'high',
      can_issue_recommendations: true,
      initiated_by: 'patient',
      invited_at: '2026-01-01T00:00:00Z',
      metadata: { patient_initials: 'AB' },
      created_at: '',
      updated_at: '',
      ...over,
    };
  }
  test('at-risk surfaces low readiness AND falling probability with high severity', () => {
    const dashboard = dashTest.bucketClients({
      provider_id: 'p_1',
      now: '2026-05-01T00:00:00Z',
      leads: [],
      engagements: [eng()],
      engagement_signals: [
        {
          engagement_id: 'e_1',
          patient_initials: 'AB',
          most_recent_readiness: 0.2,
          most_recent_probability: 0.4,
          prior_probability: 0.6,
          missed_milestones: 1,
          compliance_score: 0.3,
        },
      ],
      recommendations: [],
    });
    expect(dashboard.rows[0].flag_low_readiness).toBe(true);
    expect(dashboard.rows[0].flag_falling_probability).toBe(true);
    expect(dashboard.rows[0].flag_missed_milestones).toBe(true);
    expect(dashboard.rows[0].flag_poor_compliance).toBe(true);

    const ar = dashTest.buildAtRisk(dashboard);
    expect(ar[0].severity).toBe('high');
    expect(ar[0].reasons).toEqual(
      expect.arrayContaining([
        'low_readiness',
        'falling_probability',
        'missed_milestones',
        'poor_compliance',
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// recommendation-builder XAI bundle
// ---------------------------------------------------------------------------

const baseDraft: RecommendationDraft = {
  engagement_id: 'e_1',
  patient_user_id: 'pat_1',
  domain: 'health',
  title: 'Add 2 weekly Zone 2 sessions',
  body: 'Patient should accumulate ~180 min/week at Z2 over 8 weeks.',
  rationale: 'Highest-leverage CRF stimulus given current low VO2max.',
  expected_horizon_months: 3,
  expected_strength: 0.4,
  related_goal_id: null,
  citations: [
    { label: 'ACSM Guidelines 11th ed.', source: 'ACSM' },
    { label: 'AHA 2019 CV Prevention Guideline', source: 'AHA' },
  ],
  assumptions: [
    'Assumes the patient is currently sedentary.',
    'Treated as a hard constraint that the patient has no contraindicating cardiac condition.',
  ],
  risks: ['May exacerbate plantar fasciitis on hard surfaces.'],
};

describe('validateDraft', () => {
  test('passes a complete draft', () => {
    const v = rbTest.validateDraft(baseDraft);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });
  test('rejects short body / out-of-range strength / nonpositive horizon', () => {
    const v = rbTest.validateDraft({
      ...baseDraft,
      body: 'too short',
      expected_strength: 1.5,
      expected_horizon_months: 0,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
  test('no citations is a warning not an error', () => {
    const v = rbTest.validateDraft({ ...baseDraft, citations: [] });
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => /no citations/.test(w))).toBe(true);
  });
});

describe('buildXAIBundle', () => {
  test('always returns evidence, assumptions, counterfactuals, tradeoffs', () => {
    const b = rbTest.buildXAIBundle(baseDraft, 'r_1');
    expect(b.evidence_links).toHaveLength(2);
    expect(b.assumptions).toHaveLength(2);
    expect(b.counterfactuals.length).toBeGreaterThanOrEqual(2);
    expect(b.tradeoffs.length).toBeGreaterThan(0);
  });

  test('hard-constraint assumption is classified critical', () => {
    const b = rbTest.buildXAIBundle(baseDraft, 'r_1');
    const critical = b.assumptions.find((a) => /hard\s+constraint/i.test(a.text));
    expect(critical?.severity).toBe('critical');
  });

  test('determinism: same draft → byte-identical bundle (computed_at is frozen)', () => {
    const a = rbTest.buildXAIBundle(baseDraft, 'r_1');
    const b = rbTest.buildXAIBundle(baseDraft, 'r_1');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('confidence is capped without citations', () => {
    const c = rbTest.clampConfidence({ ...baseDraft, citations: [] });
    expect(c).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// progress monitoring
// ---------------------------------------------------------------------------

describe('buildBiometricTrends', () => {
  test('groups by metric_kind, sorts chronologically, computes delta', () => {
    const trends = pmTest.buildBiometricTrends([
      {
        id: '1',
        user_id: 'u',
        metric_kind: 'weight',
        value: 200,
        unit: 'lb',
        source: 'self_report',
        collected_at: '2026-04-01T00:00:00Z',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'u',
        metric_kind: 'weight',
        value: 198,
        unit: 'lb',
        source: 'self_report',
        collected_at: '2026-05-01T00:00:00Z',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        user_id: 'u',
        metric_kind: 'hrv',
        value: 55,
        unit: 'ms',
        source: 'wearable',
        collected_at: '2026-05-01T00:00:00Z',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    ]);
    const w = trends.find((t) => t.metric_kind === 'weight')!;
    expect(w.points.map((p) => p.value)).toEqual([200, 198]);
    expect(w.delta).toBe(-2);
  });
});

describe('buildProbabilityTrend', () => {
  test('computes signed delta', () => {
    const t = pmTest.buildProbabilityTrend(0.65, 0.5);
    expect(t.delta).toBeCloseTo(0.15);
  });
  test('null inputs return all-null', () => {
    const t = pmTest.buildProbabilityTrend(null, null);
    expect(t.current).toBeNull();
    expect(t.delta).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// message service
// ---------------------------------------------------------------------------

describe('validateCompose', () => {
  test('happy path', () => {
    const v = msgTest.validateCompose({
      engagement_id: 'e',
      provider_id: 'p',
      patient_user_id: 'pat',
      sender_user_id: 'p_user',
      sender_role: 'provider',
      kind: 'follow_up_request',
      body: 'check in next week?',
    });
    expect(v.ok).toBe(true);
  });
  test('patient cannot send a provider-only kind', () => {
    const v = msgTest.validateCompose({
      engagement_id: 'e',
      provider_id: 'p',
      patient_user_id: 'pat',
      sender_user_id: 'pat',
      sender_role: 'patient',
      kind: 'review_request',
      body: 'nope',
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /provider-only/.test(e))).toBe(true);
  });
  test('empty body rejected', () => {
    const v = msgTest.validateCompose({
      engagement_id: 'e',
      provider_id: 'p',
      patient_user_id: 'pat',
      sender_user_id: 'pat',
      sender_role: 'patient',
      kind: 'patient_reply',
      body: '',
    });
    expect(v.ok).toBe(false);
  });
  test('oversized body rejected', () => {
    const v = msgTest.validateCompose({
      engagement_id: 'e',
      provider_id: 'p',
      patient_user_id: 'pat',
      sender_user_id: 'pat',
      sender_role: 'patient',
      kind: 'patient_reply',
      body: 'x'.repeat(8001),
    });
    expect(v.ok).toBe(false);
  });
});

describe('projectThread', () => {
  test('chronological + unread for viewer', () => {
    const messages = [
      {
        id: 'm1',
        engagement_id: 'e',
        provider_id: 'p',
        patient_user_id: 'pat',
        sender_user_id: 'p_user',
        sender_role: 'provider' as const,
        kind: 'general_note' as const,
        body: 'hi',
        hidden_for_sender: false,
        metadata: {},
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '',
      },
      {
        id: 'm2',
        engagement_id: 'e',
        provider_id: 'p',
        patient_user_id: 'pat',
        sender_user_id: 'pat',
        sender_role: 'patient' as const,
        kind: 'patient_reply' as const,
        body: 'hey',
        hidden_for_sender: false,
        metadata: {},
        created_at: '2026-05-02T00:00:00Z',
        updated_at: '',
      },
    ];
    const t = msgTest.projectThread(messages, 'p_user');
    expect(t.total).toBe(2);
    expect(t.unread_for_viewer).toBe(1); // m2 is from patient, no read_at
    expect(t.messages[0].id).toBe('m1');
  });
});

// ---------------------------------------------------------------------------
// portal analytics
// ---------------------------------------------------------------------------

describe('buildEffectiveness', () => {
  function rec(over: Partial<ProviderRecommendation> = {}): ProviderRecommendation {
    return {
      id: 'r1',
      provider_id: 'p1',
      patient_user_id: 'pat1',
      engagement_id: 'e1',
      domain: 'health',
      title: 't',
      body: 'b',
      citations: [],
      issued_at: '2026-05-01T00:00:00Z',
      status: 'completed',
      metadata: {},
      created_at: '',
      updated_at: '',
      ...over,
    };
  }
  function out(over: Partial<ProviderOutcome> = {}): ProviderOutcome {
    return {
      id: 'o1',
      recommendation_id: 'r1',
      patient_user_id: 'pat1',
      provider_id: 'p1',
      observed_at: '2026-05-01T00:00:00Z',
      dimension: 'q',
      source: 'self_report',
      metadata: {},
      created_at: '',
      updated_at: '',
      ...over,
    };
  }
  test('composite score uses only present inputs', () => {
    const r = paTest.buildEffectiveness({
      provider_id: 'p1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: [rec(), rec({ id: 'r2', status: 'rejected' })],
      outcomes: [out({ outcome_quality: 0.8 })],
      readiness_deltas: [{ patient_user_id: 'pat1', delta: 0.1 }],
    });
    expect(r.active_clients).toBe(1);
    expect(r.mean_outcome_quality).toBeCloseTo(0.8);
    expect(r.effectiveness_score).not.toBeNull();
  });
  test('null inputs do not push the composite to 0', () => {
    const r = paTest.buildEffectiveness({
      provider_id: 'p1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: [rec({ status: 'completed' })],
      outcomes: [out({ outcome_quality: 0.9 })],
    });
    expect(r.effectiveness_score).toBeGreaterThan(0.6);
  });
});

// ---------------------------------------------------------------------------
// projectLeadSummary determinism
// ---------------------------------------------------------------------------

describe('projectLeadSummary', () => {
  function lp(): LeadPackage {
    return {
      id: 'lp_1',
      user_id: 'u_1',
      consent_id: 'c_1',
      recipient_provider_id: 'p_1',
      generated_at: '2026-04-01T00:00:00Z',
      payload: {
        schema_version: 'v1',
        patient_summary: { name_initials: 'AB' },
        key_risks: ['x', 'y'],
        recommended_discussion_topics: [],
      } as LeadPackagePayload,
      payload_version: 'v1',
      readiness_score: 0.42,
      probability_of_success: 0.55,
      key_risks: ['x', 'y'],
      recommended_discussion_topics: [],
      accessed_count: 0,
      metadata: {},
      created_at: '',
      updated_at: '',
    };
  }
  function consent(): LeadPackageConsent {
    return {
      id: 'c_1',
      user_id: 'u_1',
      consent_kind: 'lead_package',
      include_goals: true,
      include_constraints: true,
      include_motivation: true,
      include_biometrics: true,
      include_labs: false,
      include_protocols: true,
      include_supplements: true,
      include_medications: false,
      include_insurance: false,
      granted_at: '2026-04-01T00:00:00Z',
      metadata: {},
      created_at: '',
      updated_at: '',
    };
  }
  test('determinism', () => {
    const args = {
      lead_package: lp(),
      consent: consent(),
      engagement: null,
      events: [
        { event_kind: 'lead_received' as LeadEventKind, occurred_at: '2026-04-01T00:00:00Z' },
      ],
      now: '2026-05-01T00:00:00Z',
    };
    const a = leadTest.projectLeadSummary(args);
    const b = leadTest.projectLeadSummary(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.key_risk_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// client-workspace assembler
// ---------------------------------------------------------------------------

describe('assembleClientWorkspace', () => {
  test('goals sorted by probability_delta ascending (worst first)', () => {
    const w = cwTest.assembleClientWorkspace({
      engagement_id: 'e_1',
      patient_user_id: 'pat_1',
      patient_initials: 'AB',
      scope_domains: ['health'],
      goals: [
        {
          goal_id: 'g1',
          goal_title: 'Aaa',
          domain: 'health',
          probability_delta: 0.1,
          last_observation_at: null,
        },
        {
          goal_id: 'g2',
          goal_title: 'Bbb',
          domain: 'health',
          probability_delta: -0.2,
          last_observation_at: null,
        },
      ],
      recommendations: [],
      now: '2026-05-01T00:00:00Z',
    });
    expect(w.goals.map((g) => g.goal_id)).toEqual(['g2', 'g1']);
  });
});
