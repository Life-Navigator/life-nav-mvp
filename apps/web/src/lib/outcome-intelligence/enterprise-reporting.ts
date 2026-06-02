/**
 * Enterprise Outcome Reporting — Sprint O.
 *
 * Per-tenant anonymous aggregate. Builds the
 * `outcome.tenant_reports` snapshot from a window of safety-compliant
 * recommendations + per-user DQI/LifeProgress.
 *
 * Privacy: this report carries NO per-user identifiers. The tenant
 * can see the aggregate but cannot drill down to a single user from
 * this view (that requires the user's own dashboard, which is owner
 * read-only).
 */

import { checkSafety } from './safety-gate';
import type {
  DecisionQualityIndex,
  LifeProgressSnapshot,
  OutcomeLifecycleState,
  RecommendationContext,
  TenantOutcomeReport,
} from './types';

export interface TenantReportInputs {
  tenant_id: string;
  window_days: number;
  /** Every recommendation in the window — safety-gated below. */
  recommendations: Array<{
    context: RecommendationContext;
    lifecycle: OutcomeLifecycleState;
  }>;
  /** Per-user DQI rows in the window. */
  dqi_rows: DecisionQualityIndex[];
  /** Per-user life-progress snapshots in the window. */
  life_rows: LifeProgressSnapshot[];
}

export function computeTenantReport(inputs: TenantReportInputs): TenantOutcomeReport {
  const total = inputs.recommendations.length;
  let safety_compliant = 0;
  let accepted = 0;
  let completed = 0;
  let active_user_set = new Set<string>();

  for (const r of inputs.recommendations) {
    active_user_set.add(r.context.user_id);
    const is_compliant = checkSafety(r.context).is_safety_compliant;
    if (is_compliant) safety_compliant += 1;
    // Acceptance / completion rates are SAFETY-FILTERED — unsafe recs
    // never count toward acceptance metrics even if their lifecycle
    // shows the user clicked through. Outcome optimization sees the
    // filtered numbers; the safety_compliance_rate exposes the gap.
    if (is_compliant && (r.lifecycle.state === 'accepted' || r.lifecycle.state === 'completed'))
      accepted += 1;
    if (is_compliant && r.lifecycle.state === 'completed') completed += 1;
  }

  const avg_dqi = avgOf(inputs.dqi_rows.map((d) => d.dqi_overall));
  const avg_effectiveness = avgOf(inputs.dqi_rows.map((d) => d.avg_effectiveness));
  const avg_life_progress = avgOf(inputs.life_rows.map((l) => l.overall));

  const safety_compliance_rate = total === 0 ? 1 : safety_compliant / total;
  const acceptance_rate = total === 0 ? 0 : accepted / total;
  const completion_rate = total === 0 ? 0 : completed / total;

  return {
    tenant_id: inputs.tenant_id,
    window_days: inputs.window_days,
    active_users: active_user_set.size,
    recommendations_total: total,
    acceptance_rate: round3(acceptance_rate),
    completion_rate: round3(completion_rate),
    avg_effectiveness: round3(avg_effectiveness),
    avg_dqi: round3(avg_dqi),
    avg_life_progress: round3(avg_life_progress),
    safety_compliance_rate: round3(safety_compliance_rate),
    computed_at: new Date().toISOString(),
  };
}

function avgOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
