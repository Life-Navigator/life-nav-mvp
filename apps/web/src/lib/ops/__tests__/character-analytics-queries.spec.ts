/**
 * @jest-environment node
 */

import { computeCharacterAnalyticsSnapshot } from '../character-analytics-queries';

function makeSupabase(fixture: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = fixture[table] ?? [];
      const chain = {
        eq() {
          return chain;
        },
        gte() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return Promise.resolve({ data: rows.slice(0, 1), error: null });
        },
        then(onF: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onF);
        },
      };
      return { select: () => chain };
    },
  };
}

describe('computeCharacterAnalyticsSnapshot', () => {
  test('empty fixture returns zero snapshot', async () => {
    const s = await computeCharacterAnalyticsSnapshot(makeSupabase({}));
    expect(s.totals.audits).toBe(0);
    expect(s.totals.regeneration_rate).toBe(0);
    expect(s.top_failing_rules).toEqual([]);
    expect(s.avg_scores.overall).toBeNull();
    expect(s.data_freshness.audit).toBeNull();
  });

  test('aggregates audit rows + finding counts', async () => {
    const now = new Date().toISOString();
    const s = await computeCharacterAnalyticsSnapshot(
      makeSupabase({
        decision_governance_audit: [
          {
            character_score_overall: 0.95,
            character_score_weakest: 0.9,
            character_weakest_dimension: 'humility',
            character_needs_regeneration: false,
            character_family_table_passes: true,
            character_trusted_advisor_passes: true,
            character_dignity_violation: false,
            character_family_audiences_failed: null,
            created_at: now,
          },
          {
            character_score_overall: 0.4,
            character_score_weakest: 0.2,
            character_weakest_dimension: 'respect',
            character_needs_regeneration: true,
            character_family_table_passes: false,
            character_trusted_advisor_passes: false,
            character_dignity_violation: true,
            character_family_audiences_failed: ['future_self'],
            created_at: now,
          },
        ],
        character_findings: [
          { rule_id: 'sg.shaming_v1', severity: 'high', created_at: now },
          { rule_id: 'sg.shaming_v1', severity: 'high', created_at: now },
          { rule_id: 'sg.partisan_v1', severity: 'critical', created_at: now },
        ],
      })
    );

    expect(s.totals.audits).toBe(2);
    expect(s.totals.regenerated).toBe(1);
    expect(s.totals.regeneration_rate).toBe(0.5);
    expect(s.totals.dignity_violations).toBe(1);
    expect(s.totals.family_table_failures).toBe(1);
    expect(s.totals.trusted_advisor_failures).toBe(1);
    expect(s.weakest_dimension_distribution.humility).toBe(1);
    expect(s.weakest_dimension_distribution.respect).toBe(1);
    expect(s.family_failures_by_audience.future_self).toBe(1);
    expect(s.avg_scores.overall).toBeCloseTo(0.675, 3);
    expect(s.top_failing_rules.length).toBe(2);
    expect(s.top_failing_rules[0].rule_id).toBe('sg.shaming_v1');
    expect(s.top_failing_rules[0].count).toBe(2);
  });
});
