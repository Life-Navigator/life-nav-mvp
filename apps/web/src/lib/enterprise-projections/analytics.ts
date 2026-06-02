/**
 * Enterprise Analytics — Sprint S Phase 6.
 *
 *   * Outcome reporting — joins Sprint O `outcome.tenant_reports`
 *   * Engagement reporting — derived from `analytics.user_events`
 *   * ROI reporting — cost (Sprint O.0.2) vs outcome (Sprint O)
 *
 * Pure aggregators. Tenant-member RLS enforces the access boundary.
 */

export interface EngagementRow {
  user_id: string;
  occurred_at: string;
  event_type: string;
}

export interface CostRow {
  cost_usd_micros: number;
  created_at: string;
}

export interface OutcomeRow {
  recommendations_total: number;
  acceptance_rate: number;
  completion_rate: number;
  avg_effectiveness: number;
  avg_dqi: number;
  avg_life_progress: number;
  safety_compliance_rate: number;
}

export interface EnterpriseAnalyticsReport {
  tenant_id: string;
  window_days: number;
  engagement: {
    active_users: number;
    events_total: number;
    events_per_active_user: number;
    top_events: Array<{ event_type: string; count: number }>;
  };
  outcome: OutcomeRow | null;
  roi: {
    cost_usd: number;
    /** Estimated "value" — a simple model: avg_effectiveness × #completed recs × $100. */
    estimated_value_usd: number;
    roi_ratio: number;
  };
  computed_at: string;
}

export interface BuildInputs {
  tenant_id: string;
  window_days: number;
  engagement_rows: EngagementRow[];
  cost_rows: CostRow[];
  outcome_row: OutcomeRow | null;
  /** Per completed recommendation value (USD). Default $100. */
  value_per_completed_usd?: number;
}

export function buildEnterpriseAnalyticsReport(inputs: BuildInputs): EnterpriseAnalyticsReport {
  const value_per = inputs.value_per_completed_usd ?? 100;
  const user_set = new Set<string>();
  const per_event = new Map<string, number>();
  for (const row of inputs.engagement_rows) {
    user_set.add(row.user_id);
    per_event.set(row.event_type, (per_event.get(row.event_type) ?? 0) + 1);
  }
  const events_total = inputs.engagement_rows.length;
  const active_users = user_set.size;
  const events_per_user = active_users === 0 ? 0 : events_total / active_users;
  const top_events = Array.from(per_event.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([event_type, count]) => ({ event_type, count }));

  const cost_micros = inputs.cost_rows.reduce((s, r) => s + (r.cost_usd_micros ?? 0), 0);
  const cost_usd = round2(cost_micros / 1_000_000);

  // Estimated value = avg_effectiveness × completed × value_per
  const completed = inputs.outcome_row
    ? Math.round(
        inputs.outcome_row.recommendations_total * (inputs.outcome_row.completion_rate ?? 0)
      )
    : 0;
  const estimated_value_usd = inputs.outcome_row
    ? round2(completed * (inputs.outcome_row.avg_effectiveness ?? 0) * value_per)
    : 0;

  const roi_ratio =
    cost_usd === 0
      ? estimated_value_usd === 0
        ? 0
        : Infinity
      : round2(estimated_value_usd / cost_usd);

  return {
    tenant_id: inputs.tenant_id,
    window_days: inputs.window_days,
    engagement: {
      active_users,
      events_total,
      events_per_active_user: round2(events_per_user),
      top_events,
    },
    outcome: inputs.outcome_row,
    roi: { cost_usd, estimated_value_usd, roi_ratio: Number.isFinite(roi_ratio) ? roi_ratio : 0 },
    computed_at: new Date().toISOString(),
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
