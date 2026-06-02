/**
 * @jest-environment node
 *
 * Sprint O — outcome intelligence tests.
 *
 *   * safety-gate composition
 *   * effectiveness score sub-scores + composite
 *   * DQI sub-rates + safety filtering
 *   * attribution lag windows + confidence decay
 *   * goal-achievement appendSnapshot + summarize
 *   * life-progress aggregation + trend
 *   * tenant-report aggregation + privacy contract
 */

import {
  checkSafety,
  filterSafe,
  computeEffectiveness,
  computeDqi,
  computeDqiSafe,
  computeAttribution,
  MAX_LAG_DAYS,
  appendSnapshot,
  summarizeGoal,
  goalAchievementRate,
  computeLifeProgress,
  computeTenantReport,
} from '..';
import type {
  RecommendationContext,
  OutcomeLifecycleState,
  GoalProgressSnapshot,
  AttributionLink,
  FlourishingAxis,
} from '..';

const ISO = (offset_days: number) =>
  new Date(Date.now() - offset_days * 24 * 60 * 60 * 1000).toISOString();

function baseContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    recommendation_id: 'rec_safe',
    user_id: 'u1',
    governance_audit_id: 'a1',
    generated_at: ISO(7),
    character_score_overall: 0.85,
    character_score_weakest: 0.5,
    character_needs_regeneration: false,
    character_family_table_passes: true,
    character_trusted_advisor_passes: true,
    character_dignity_violation: false,
    character_flourishing_harming_axes: [],
    constitutional_verdict: 'APPROVE',
    risk_level: 'LOW',
    governance_approved: true,
    goal_id: 'goal_1',
    ...overrides,
  };
}

function baseLifecycle(overrides: Partial<OutcomeLifecycleState> = {}): OutcomeLifecycleState {
  return {
    state: 'accepted',
    generated_at: ISO(7),
    viewed_at: ISO(6),
    accepted_at: ISO(5),
    ...overrides,
  };
}

// ===========================================================================
// Safety gate
// ===========================================================================

describe('safety gate', () => {
  test('clean context is compliant', () => {
    const v = checkSafety(baseContext());
    expect(v.is_safety_compliant).toBe(true);
    expect(v.reasons).toEqual([]);
  });
  test('governance blocked → not compliant', () => {
    const v = checkSafety(baseContext({ governance_approved: false }));
    expect(v.is_safety_compliant).toBe(false);
    expect(v.reasons).toContain('governance_blocked');
  });
  test('constitutional redirection → not compliant', () => {
    const v = checkSafety(baseContext({ constitutional_verdict: 'CONSTITUTIONAL_REDIRECTION' }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('character regeneration → not compliant', () => {
    const v = checkSafety(baseContext({ character_needs_regeneration: true }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('dignity violation → not compliant', () => {
    const v = checkSafety(baseContext({ character_dignity_violation: true }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('family-table failed → not compliant', () => {
    const v = checkSafety(baseContext({ character_family_table_passes: false }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('trusted-advisor failed → not compliant', () => {
    const v = checkSafety(baseContext({ character_trusted_advisor_passes: false }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('harming financial axis → not compliant', () => {
    const v = checkSafety(baseContext({ character_flourishing_harming_axes: ['financial'] }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('HIGH risk_level → not compliant', () => {
    const v = checkSafety(baseContext({ risk_level: 'HIGH' }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('CRITICAL risk_level → not compliant', () => {
    const v = checkSafety(baseContext({ risk_level: 'CRITICAL' }));
    expect(v.is_safety_compliant).toBe(false);
  });
  test('filterSafe removes non-compliant rows', () => {
    const rows = [
      { context: baseContext({ recommendation_id: 'r1' }) },
      { context: baseContext({ recommendation_id: 'r2', character_needs_regeneration: true }) },
      { context: baseContext({ recommendation_id: 'r3', risk_level: 'CRITICAL' }) },
    ];
    const safe = filterSafe(rows);
    expect(safe.length).toBe(1);
    expect(safe[0].context.recommendation_id).toBe('r1');
  });
});

// ===========================================================================
// Effectiveness score
// ===========================================================================

describe('computeEffectiveness', () => {
  test('non-compliant context → score 0 with safety flag false', () => {
    const r = computeEffectiveness({
      context: baseContext({ governance_approved: false }),
      lifecycle: baseLifecycle(),
    });
    expect(r.is_safety_compliant).toBe(false);
    expect(r.effectiveness_score).toBe(0);
  });

  test('completed + improved → high score', () => {
    const r = computeEffectiveness({
      context: baseContext(),
      lifecycle: baseLifecycle({ state: 'completed', completed_at: ISO(2) }),
      feedback: { outcome: 'improved', helpfulness: 'helpful' },
    });
    expect(r.is_safety_compliant).toBe(true);
    expect(r.effectiveness_score).toBeGreaterThan(0.7);
    expect(r.acceptance_score).toBe(1.0);
    expect(r.outcome_score).toBe(1.0);
  });

  test('dismissed after acceptance → reversal penalty', () => {
    const r = computeEffectiveness({
      context: baseContext(),
      lifecycle: {
        state: 'dismissed',
        generated_at: ISO(7),
        accepted_at: ISO(5),
        dismissed_at: ISO(1),
      },
    });
    expect(r.reversal_penalty).toBeGreaterThan(0);
  });

  test('positive attribution links lift the score', () => {
    const links: AttributionLink[] = [
      {
        recommendation_id: 'rec_safe',
        user_id: 'u1',
        goal_id: 'goal_1',
        delta: 0.4,
        attribution_confidence: 0.8,
        lag_days: 14,
      },
    ];
    const r = computeEffectiveness({
      context: baseContext(),
      lifecycle: baseLifecycle({ state: 'completed', completed_at: ISO(2) }),
      attribution_links: links,
    });
    expect(r.attribution_score).toBeGreaterThan(0.4);
    expect(r.attribution_links_count).toBe(1);
  });

  test('negative attribution drags the score', () => {
    const links: AttributionLink[] = [
      {
        recommendation_id: 'rec_safe',
        user_id: 'u1',
        goal_id: 'goal_1',
        delta: -0.5,
        attribution_confidence: 0.9,
        lag_days: 30,
      },
    ];
    const r = computeEffectiveness({
      context: baseContext(),
      lifecycle: baseLifecycle({ state: 'completed', completed_at: ISO(2) }),
      attribution_links: links,
    });
    expect(r.attribution_score).toBeLessThan(0.5);
  });

  test('faster acceptance → higher speed score', () => {
    const fast = computeEffectiveness({
      context: baseContext(),
      lifecycle: { state: 'accepted', generated_at: ISO(2), accepted_at: ISO(1.5) },
    });
    const slow = computeEffectiveness({
      context: baseContext(),
      lifecycle: { state: 'accepted', generated_at: ISO(60), accepted_at: ISO(1) },
    });
    expect(fast.speed_score).toBeGreaterThan(slow.speed_score);
  });
});

// ===========================================================================
// DQI
// ===========================================================================

describe('computeDqi', () => {
  test('empty rows → DQI 0', () => {
    const r = computeDqi({ user_id: 'u1', window_days: 30, rows: [] });
    expect(r.dqi_overall).toBe(0);
    expect(r.recommendations_evaluated).toBe(0);
  });

  test('all-accepted-and-completed rows → DQI > 0.6', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      context: baseContext({ recommendation_id: `r${i}` }),
      lifecycle: baseLifecycle({ state: 'completed', completed_at: ISO(2) }),
      feedback: { outcome: 'improved' as const },
    }));
    const r = computeDqi({ user_id: 'u1', window_days: 30, rows });
    expect(r.dqi_overall).toBeGreaterThan(0.6);
    expect(r.acceptance_rate).toBe(1.0);
    expect(r.completion_rate).toBe(1.0);
  });

  test('reversal lowers the DQI', () => {
    const rows = [
      {
        context: baseContext({ recommendation_id: 'r1' }),
        lifecycle: {
          state: 'dismissed' as const,
          generated_at: ISO(7),
          accepted_at: ISO(5),
          dismissed_at: ISO(1),
        },
      },
    ];
    const r = computeDqi({ user_id: 'u1', window_days: 30, rows });
    expect(r.reversal_rate).toBeGreaterThan(0);
  });

  test('computeDqiSafe excludes non-compliant rows', () => {
    const rows = [
      {
        context: baseContext({ recommendation_id: 'r_safe' }),
        lifecycle: baseLifecycle({ state: 'completed', completed_at: ISO(2) }),
      },
      {
        context: baseContext({ recommendation_id: 'r_unsafe', risk_level: 'CRITICAL' }),
        lifecycle: baseLifecycle(),
      },
    ];
    const r = computeDqiSafe({ user_id: 'u1', window_days: 30, rows });
    expect(r.included).toBe(1);
    expect(r.excluded_unsafe).toBe(1);
    expect(r.dqi.recommendations_evaluated).toBe(1);
  });
});

// ===========================================================================
// Attribution engine
// ===========================================================================

describe('computeAttribution', () => {
  test('rec without goal → no links', () => {
    const links = computeAttribution({
      recommendations: [{ context: baseContext({ goal_id: null }), lifecycle: baseLifecycle() }],
      snapshots: [],
    });
    expect(links.length).toBe(0);
  });

  test('post-decision snapshot within window → link with positive delta', () => {
    const snaps: GoalProgressSnapshot[] = [
      { goal_id: 'goal_1', progress_pct: 0.2, progress_kind: 'baseline', recorded_at: ISO(8) },
      { goal_id: 'goal_1', progress_pct: 0.5, progress_kind: 'milestone', recorded_at: ISO(3) },
    ];
    const links = computeAttribution({
      recommendations: [
        { context: baseContext(), lifecycle: baseLifecycle({ accepted_at: ISO(5) }) },
      ],
      snapshots: snaps,
    });
    expect(links.length).toBe(1);
    expect(links[0].delta).toBeCloseTo(0.3, 2);
    expect(links[0].attribution_confidence).toBeGreaterThan(0);
  });

  test('snapshot beyond MAX_LAG_DAYS → no link', () => {
    // Acceptance was MAX_LAG_DAYS + 5 days ago; snapshot is today.
    // Lag = MAX_LAG_DAYS + 5 days > MAX_LAG_DAYS → no link.
    const accept_iso = ISO(MAX_LAG_DAYS + 5);
    const snaps: GoalProgressSnapshot[] = [
      { goal_id: 'goal_1', progress_pct: 0.5, progress_kind: 'milestone', recorded_at: ISO(0) },
    ];
    const links = computeAttribution({
      recommendations: [
        {
          context: baseContext({ generated_at: ISO(MAX_LAG_DAYS + 10) }),
          lifecycle: {
            state: 'accepted',
            generated_at: ISO(MAX_LAG_DAYS + 10),
            accepted_at: accept_iso,
          },
        },
      ],
      snapshots: snaps,
    });
    expect(links.length).toBe(0);
  });

  test('explicit recommendation_id pointer raises confidence', () => {
    const snaps: GoalProgressSnapshot[] = [
      {
        goal_id: 'goal_1',
        progress_pct: 0.3,
        progress_kind: 'milestone',
        recorded_at: ISO(2),
        recommendation_id: 'rec_safe',
      },
    ];
    const links = computeAttribution({
      recommendations: [
        { context: baseContext(), lifecycle: baseLifecycle({ accepted_at: ISO(3) }) },
      ],
      snapshots: snaps,
    });
    expect(links[0].attribution_confidence).toBeGreaterThan(0.5);
  });

  test('non-compliant rec is excluded from attribution', () => {
    const snaps: GoalProgressSnapshot[] = [
      { goal_id: 'goal_1', progress_pct: 0.5, progress_kind: 'milestone', recorded_at: ISO(3) },
    ];
    const links = computeAttribution({
      recommendations: [
        {
          context: baseContext({ governance_approved: false }),
          lifecycle: baseLifecycle({ accepted_at: ISO(5) }),
        },
      ],
      snapshots: snaps,
    });
    expect(links.length).toBe(0);
  });
});

// ===========================================================================
// Goal achievement
// ===========================================================================

describe('appendSnapshot + summarizeGoal', () => {
  test('first snapshot has progress_kind=baseline', () => {
    const r = appendSnapshot({ goal_id: 'g1', current_pct: 0.2, series: [] });
    expect(r.snapshot.progress_kind).toBe('baseline');
    expect(r.is_new_milestone).toBe(false);
  });

  test('+0.2 increase fires milestone', () => {
    const series: GoalProgressSnapshot[] = [
      { goal_id: 'g1', progress_pct: 0.3, progress_kind: 'baseline', recorded_at: ISO(10) },
    ];
    const r = appendSnapshot({ goal_id: 'g1', current_pct: 0.55, series });
    expect(r.snapshot.progress_kind).toBe('milestone');
    expect(r.is_new_milestone).toBe(true);
  });

  test('reaching 1.0 fires completion', () => {
    const series: GoalProgressSnapshot[] = [
      { goal_id: 'g1', progress_pct: 0.8, progress_kind: 'milestone', recorded_at: ISO(5) },
    ];
    const r = appendSnapshot({ goal_id: 'g1', current_pct: 1.0, series });
    expect(r.snapshot.progress_kind).toBe('completion');
  });

  test('drop > 0.05 fires reversal', () => {
    const series: GoalProgressSnapshot[] = [
      { goal_id: 'g1', progress_pct: 0.7, progress_kind: 'milestone', recorded_at: ISO(5) },
    ];
    const r = appendSnapshot({ goal_id: 'g1', current_pct: 0.4, series });
    expect(r.snapshot.progress_kind).toBe('reversal');
    expect(r.is_reversal).toBe(true);
  });

  test('summarizeGoal reports peaks + milestones + completion', () => {
    const series: GoalProgressSnapshot[] = [
      { goal_id: 'g1', progress_pct: 0.0, progress_kind: 'baseline', recorded_at: ISO(30) },
      { goal_id: 'g1', progress_pct: 0.5, progress_kind: 'milestone', recorded_at: ISO(20) },
      { goal_id: 'g1', progress_pct: 0.3, progress_kind: 'reversal', recorded_at: ISO(15) },
      { goal_id: 'g1', progress_pct: 1.0, progress_kind: 'completion', recorded_at: ISO(2) },
    ];
    const s = summarizeGoal('g1', series);
    expect(s.peak_pct).toBe(1.0);
    expect(s.milestones).toBe(2); // milestone + completion
    expect(s.reversals).toBe(1);
    expect(s.is_completed).toBe(true);
  });

  test('goalAchievementRate is fraction completed', () => {
    const summaries = [
      {
        goal_id: 'a',
        current_pct: 1.0,
        peak_pct: 1.0,
        days_active: 10,
        snapshot_count: 3,
        milestones: 2,
        reversals: 0,
        is_completed: true,
      },
      {
        goal_id: 'b',
        current_pct: 0.6,
        peak_pct: 0.6,
        days_active: 7,
        snapshot_count: 2,
        milestones: 1,
        reversals: 0,
        is_completed: false,
      },
    ];
    expect(goalAchievementRate(summaries)).toBe(0.5);
  });
});

// ===========================================================================
// Life progress
// ===========================================================================

describe('computeLifeProgress', () => {
  test('empty inputs → flat trajectory at 0', () => {
    const r = computeLifeProgress({
      user_id: 'u1',
      window_days: 30,
      attribution_links: [],
      recommendations: [],
    });
    expect(r.overall).toBe(0);
    expect(r.trend).toBe('flat');
  });

  test('positive attribution lifts axes', () => {
    const links: AttributionLink[] = [
      {
        recommendation_id: 'r1',
        user_id: 'u1',
        goal_id: 'g1',
        delta: 0.5,
        attribution_confidence: 0.9,
        flourishing_axis: 'financial',
        lag_days: 10,
      },
      {
        recommendation_id: 'r2',
        user_id: 'u1',
        goal_id: 'g2',
        delta: 0.4,
        attribution_confidence: 0.8,
        flourishing_axis: 'health',
        lag_days: 15,
      },
    ];
    const r = computeLifeProgress({
      user_id: 'u1',
      window_days: 30,
      attribution_links: links,
      recommendations: [],
    });
    expect(r.financial).toBeGreaterThan(0);
    expect(r.health).toBeGreaterThan(0);
    expect(r.overall).toBeGreaterThan(0);
  });

  test('character harming_axes pulls the axis down', () => {
    const r = computeLifeProgress({
      user_id: 'u1',
      window_days: 30,
      attribution_links: [],
      recommendations: [baseContext({ character_flourishing_harming_axes: ['career'] })],
    });
    expect(r.career).toBeLessThan(0);
  });

  test('trend reflects delta over prior snapshot', () => {
    const prior = {
      user_id: 'u1',
      window_days: 30,
      health: 0,
      safety: 0,
      relationships: 0,
      education: 0,
      career: 0,
      financial: 0,
      resilience: 0,
      responsibility: 0,
      future_opportunity: 0,
      overall: -0.2,
      trend: 'flat' as const,
      computed_at: ISO(7),
    };
    // Multiple positive attributions across axes so overall lifts well
    // above the prior overall = -0.2.
    const r = computeLifeProgress({
      user_id: 'u1',
      window_days: 30,
      attribution_links: [
        {
          recommendation_id: 'r1',
          user_id: 'u1',
          goal_id: 'g1',
          delta: 0.8,
          attribution_confidence: 1,
          flourishing_axis: 'financial',
          lag_days: 10,
        },
        {
          recommendation_id: 'r2',
          user_id: 'u1',
          goal_id: 'g2',
          delta: 0.7,
          attribution_confidence: 1,
          flourishing_axis: 'health',
          lag_days: 10,
        },
        {
          recommendation_id: 'r3',
          user_id: 'u1',
          goal_id: 'g3',
          delta: 0.6,
          attribution_confidence: 1,
          flourishing_axis: 'career',
          lag_days: 10,
        },
      ],
      recommendations: [],
      prior,
    });
    expect(r.trend).toBe('up');
  });
});

// ===========================================================================
// Enterprise reporting
// ===========================================================================

describe('computeTenantReport', () => {
  test('aggregates recommendations + safety compliance', () => {
    const r = computeTenantReport({
      tenant_id: 'tenant1',
      window_days: 30,
      recommendations: [
        {
          context: baseContext({ user_id: 'u1', recommendation_id: 'r1' }),
          lifecycle: baseLifecycle({ state: 'completed' }),
        },
        {
          context: baseContext({ user_id: 'u1', recommendation_id: 'r2' }),
          lifecycle: baseLifecycle({ state: 'accepted' }),
        },
        {
          context: baseContext({ user_id: 'u2', recommendation_id: 'r3', risk_level: 'CRITICAL' }),
          lifecycle: baseLifecycle(),
        },
      ],
      dqi_rows: [
        {
          user_id: 'u1',
          window_days: 30,
          dqi_overall: 0.7,
          acceptance_rate: 0.8,
          completion_rate: 0.5,
          reversal_rate: 0,
          avg_effectiveness: 0.6,
          avg_character_score: 0.9,
          future_preservation_score: 1,
          recommendations_evaluated: 2,
          computed_at: ISO(0),
        },
      ],
      life_rows: [
        {
          user_id: 'u1',
          window_days: 30,
          health: 0.2,
          safety: 0,
          relationships: 0,
          education: 0,
          career: 0,
          financial: 0.3,
          resilience: 0,
          responsibility: 0,
          future_opportunity: 0,
          overall: 0.05,
          trend: 'flat',
          computed_at: ISO(0),
        },
      ],
    });
    expect(r.active_users).toBe(2);
    expect(r.recommendations_total).toBe(3);
    expect(r.safety_compliance_rate).toBeCloseTo(2 / 3, 2);
    expect(r.acceptance_rate).toBeCloseTo(2 / 3, 2);
    expect(r.avg_dqi).toBeCloseTo(0.7, 2);
  });

  test('empty windows produce safe defaults', () => {
    const r = computeTenantReport({
      tenant_id: 't',
      window_days: 30,
      recommendations: [],
      dqi_rows: [],
      life_rows: [],
    });
    expect(r.active_users).toBe(0);
    expect(r.recommendations_total).toBe(0);
    expect(r.safety_compliance_rate).toBe(1);
  });
});

// ===========================================================================
// Privacy contract — tenant report carries no per-user identifiers
// ===========================================================================

describe('tenant report privacy contract', () => {
  test('serialized report contains no user_ids', () => {
    const r = computeTenantReport({
      tenant_id: 't',
      window_days: 30,
      recommendations: [
        { context: baseContext({ user_id: 'private_user' }), lifecycle: baseLifecycle() },
      ],
      dqi_rows: [
        {
          user_id: 'private_user',
          window_days: 30,
          dqi_overall: 0.7,
          acceptance_rate: 0.8,
          completion_rate: 0.5,
          reversal_rate: 0,
          avg_effectiveness: 0.6,
          avg_character_score: 0.9,
          future_preservation_score: 1,
          recommendations_evaluated: 2,
          computed_at: ISO(0),
        },
      ],
      life_rows: [],
    });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('private_user');
    expect(serialized).not.toContain('user_id');
  });
});

// ===========================================================================
// End-to-end: prove which recommendation improved a life axis
// ===========================================================================

describe('end-to-end attribution → effectiveness → DQI flow', () => {
  test('a goal-completing rec produces a positive attribution → effectiveness > 0.6 → DQI > 0.5', () => {
    const ctx = baseContext({
      character_score_overall: 0.9,
      character_flourishing_harming_axes: [],
    });
    const lifecycle = baseLifecycle({ state: 'completed', completed_at: ISO(3) });
    const snapshots: GoalProgressSnapshot[] = [
      { goal_id: 'goal_1', progress_pct: 0.1, progress_kind: 'baseline', recorded_at: ISO(8) },
      {
        goal_id: 'goal_1',
        progress_pct: 1.0,
        progress_kind: 'completion',
        recorded_at: ISO(2),
        recommendation_id: 'rec_safe',
      },
    ];
    const goal_axis = new Map<string, FlourishingAxis>([['goal_1', 'health']]);
    const links = computeAttribution({
      recommendations: [{ context: ctx, lifecycle }],
      snapshots,
      goal_axis,
    });
    expect(links.length).toBe(1);
    expect(links[0].delta).toBeGreaterThan(0.5);

    const eff = computeEffectiveness({
      context: ctx,
      lifecycle,
      attribution_links: links,
      feedback: { outcome: 'improved' },
    });
    expect(eff.effectiveness_score).toBeGreaterThan(0.6);

    const dqi = computeDqi({
      user_id: 'u1',
      window_days: 30,
      rows: [{ context: ctx, lifecycle, feedback: { outcome: 'improved' } }],
    });
    expect(dqi.dqi_overall).toBeGreaterThan(0.5);

    const life = computeLifeProgress({
      user_id: 'u1',
      window_days: 30,
      attribution_links: links,
      recommendations: [ctx],
      goal_axis,
      goal_snapshots: snapshots,
    });
    expect(life.health).toBeGreaterThan(0);
    expect(life.overall).toBeGreaterThan(0);
  });
});
