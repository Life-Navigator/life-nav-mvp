/**
 * Character Analytics aggregation — Sprint Q Phase 6.
 *
 * Reads from:
 *   * governance.decision_governance_audit (character_* columns)
 *   * governance.character_findings        (per-finding rows)
 *
 * Returns a snapshot the operator dashboard renders.
 */

export interface CharacterAnalyticsSnapshot {
  generated_at: string;
  window_days: number;
  totals: {
    audits: number;
    regenerated: number;
    regeneration_rate: number;
    dignity_violations: number;
    family_table_failures: number;
    trusted_advisor_failures: number;
  };
  weakest_dimension_distribution: Record<string, number>;
  family_failures_by_audience: Record<string, number>;
  top_failing_rules: Array<{
    rule_id: string;
    count: number;
    severity_breakdown: Record<string, number>;
  }>;
  avg_scores: {
    overall: number | null;
    weakest: number | null;
  };
  data_freshness: {
    audit: string | null;
    findings: string | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxTimestamp(sb: any, table: string, column: string): Promise<string | null> {
  try {
    const r = await sb.from(table).select(column).order(column, { ascending: false }).limit(1);
    if (!Array.isArray(r.data) || r.data.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((r.data[0] as Record<string, any>)[column] as string) ?? null;
  } catch {
    return null;
  }
}

export async function computeCharacterAnalyticsSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  window_days = 7
): Promise<CharacterAnalyticsSnapshot> {
  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();
  const snap: CharacterAnalyticsSnapshot = {
    generated_at: new Date().toISOString(),
    window_days,
    totals: {
      audits: 0,
      regenerated: 0,
      regeneration_rate: 0,
      dignity_violations: 0,
      family_table_failures: 0,
      trusted_advisor_failures: 0,
    },
    weakest_dimension_distribution: {},
    family_failures_by_audience: {},
    top_failing_rules: [],
    avg_scores: { overall: null, weakest: null },
    data_freshness: { audit: null, findings: null },
  };

  // ---- audit roll-up ----------------------------------------------------
  try {
    const r = await supabase
      .from('decision_governance_audit')
      .select(
        'character_score_overall, character_score_weakest, character_weakest_dimension, character_needs_regeneration, character_family_table_passes, character_trusted_advisor_passes, character_dignity_violation, character_family_audiences_failed'
      )
      .gte('created_at', since);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = r.data as Array<{
        character_score_overall: number | null;
        character_score_weakest: number | null;
        character_weakest_dimension: string | null;
        character_needs_regeneration: boolean | null;
        character_family_table_passes: boolean | null;
        character_trusted_advisor_passes: boolean | null;
        character_dignity_violation: boolean | null;
        character_family_audiences_failed: string[] | null;
      }>;

      snap.totals.audits = rows.length;
      let regen = 0;
      let dignity = 0;
      let family_fail = 0;
      let ta_fail = 0;
      let overall_sum = 0;
      let weakest_sum = 0;
      let overall_cnt = 0;
      let weakest_cnt = 0;

      for (const row of rows) {
        if (row.character_needs_regeneration) regen += 1;
        if (row.character_dignity_violation) dignity += 1;
        if (row.character_family_table_passes === false) family_fail += 1;
        if (row.character_trusted_advisor_passes === false) ta_fail += 1;
        if (row.character_weakest_dimension) {
          snap.weakest_dimension_distribution[row.character_weakest_dimension] =
            (snap.weakest_dimension_distribution[row.character_weakest_dimension] ?? 0) + 1;
        }
        if (row.character_family_audiences_failed) {
          for (const a of row.character_family_audiences_failed) {
            snap.family_failures_by_audience[a] = (snap.family_failures_by_audience[a] ?? 0) + 1;
          }
        }
        if (typeof row.character_score_overall === 'number') {
          overall_sum += row.character_score_overall;
          overall_cnt += 1;
        }
        if (typeof row.character_score_weakest === 'number') {
          weakest_sum += row.character_score_weakest;
          weakest_cnt += 1;
        }
      }

      snap.totals.regenerated = regen;
      snap.totals.regeneration_rate = rows.length === 0 ? 0 : regen / rows.length;
      snap.totals.dignity_violations = dignity;
      snap.totals.family_table_failures = family_fail;
      snap.totals.trusted_advisor_failures = ta_fail;
      snap.avg_scores.overall =
        overall_cnt > 0 ? Math.round((overall_sum / overall_cnt) * 1000) / 1000 : null;
      snap.avg_scores.weakest =
        weakest_cnt > 0 ? Math.round((weakest_sum / weakest_cnt) * 1000) / 1000 : null;
    }
  } catch {
    /* keep defaults */
  }

  // ---- per-rule rollup -------------------------------------------------
  try {
    const r = await supabase
      .from('character_findings')
      .select('rule_id, severity')
      .gte('created_at', since);
    if (Array.isArray(r.data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = r.data as Array<{ rule_id: string; severity: string }>;
      const per_rule = new Map<
        string,
        { count: number; severity_breakdown: Record<string, number> }
      >();
      for (const row of rows) {
        const e = per_rule.get(row.rule_id) ?? { count: 0, severity_breakdown: {} };
        e.count += 1;
        e.severity_breakdown[row.severity] = (e.severity_breakdown[row.severity] ?? 0) + 1;
        per_rule.set(row.rule_id, e);
      }
      snap.top_failing_rules = Array.from(per_rule.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([rule_id, v]) => ({
          rule_id,
          count: v.count,
          severity_breakdown: v.severity_breakdown,
        }));
    }
  } catch {
    /* keep defaults */
  }

  // ---- freshness -------------------------------------------------------
  snap.data_freshness.audit = await maxTimestamp(
    supabase,
    'decision_governance_audit',
    'created_at'
  );
  snap.data_freshness.findings = await maxTimestamp(supabase, 'character_findings', 'created_at');

  return snap;
}
