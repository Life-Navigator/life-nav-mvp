/**
 * Portal Dashboard Service (Sprint J, Phase 1).
 *
 * Aggregates lead summaries + engagement rows + recommendation stats
 * + at-risk + upcoming reviews into a single dashboard payload.
 *
 * Pure function — the API route loads the raw rows and calls
 * `assembleDashboard` to project them. Deterministic by `now`.
 */

import { computeRecommendationLifecycleStats } from './recommendation-service';
import type { ProviderEngagement, ProviderRecommendation } from '@/types/provider';
import type {
  DashboardAtRiskRow,
  DashboardClientBuckets,
  DashboardClientRow,
  DashboardLeadBuckets,
  DashboardProviderMetrics,
  DashboardUpcomingRow,
  LeadSummary,
  PortalDashboard,
} from '@/types/provider-portal';
import { classifyEngagementGroup, classifyRecommendationGroup } from '@/types/provider-portal';

// ---------------------------------------------------------------------------
// At-risk thresholds
// ---------------------------------------------------------------------------

const READINESS_LOW = 0.4;
const PROBABILITY_DROP_FLAG = -0.05;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface DashboardInputs {
  provider_id: string;
  now: string;

  leads: LeadSummary[];

  engagements: ProviderEngagement[];
  /** Aggregate per-engagement signal computed by the loader. */
  engagement_signals: Array<{
    engagement_id: string;
    patient_initials: string;
    most_recent_recommendation_at?: string | null;
    most_recent_outcome_at?: string | null;
    most_recent_readiness?: number | null;
    most_recent_probability?: number | null;
    prior_probability?: number | null;
    missed_milestones?: number;
    compliance_score?: number | null;
  }>;
  recommendations: ProviderRecommendation[];
}

// ---------------------------------------------------------------------------
// Lead buckets
// ---------------------------------------------------------------------------

function bucketLeads(rows: LeadSummary[]): DashboardLeadBuckets {
  let n = 0,
    p = 0,
    a = 0,
    d = 0;
  for (const r of rows) {
    if (r.status === 'new') n++;
    else if (r.status === 'pending') p++;
    else if (r.status === 'accepted') a++;
    else if (r.status === 'declined' || r.status === 'withdrawn') d++;
  }
  return {
    new_count: n,
    pending_count: p,
    accepted_count: a,
    declined_count: d,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Client buckets (Active / Paused / Completed)
// ---------------------------------------------------------------------------

function bucketClients(inputs: DashboardInputs): DashboardClientBuckets {
  const signalMap = new Map(inputs.engagement_signals.map((s) => [s.engagement_id, s]));

  const recsOpenByEngagement = new Map<string, number>();
  for (const r of inputs.recommendations) {
    if (classifyRecommendationGroup(r.status) === 'open') {
      const c = recsOpenByEngagement.get(r.engagement_id) ?? 0;
      recsOpenByEngagement.set(r.engagement_id, c + 1);
    }
  }

  let active = 0,
    paused = 0,
    completed = 0;
  const rows: DashboardClientRow[] = [];
  for (const eng of inputs.engagements) {
    const bucket = classifyEngagementGroup(eng.status);
    if (bucket === 'active') active++;
    else if (bucket === 'paused') paused++;
    else if (bucket === 'completed') completed++;

    const s = signalMap.get(eng.id);
    const probability_delta =
      typeof s?.most_recent_probability === 'number' && typeof s?.prior_probability === 'number'
        ? Number((s.most_recent_probability - s.prior_probability).toFixed(4))
        : undefined;

    rows.push({
      engagement_id: eng.id,
      patient_user_id: eng.patient_user_id,
      patient_initials: s?.patient_initials ?? '—',
      status: eng.status,
      scope_domains: eng.allowed_domains,
      most_recent_recommendation_at: s?.most_recent_recommendation_at ?? null,
      most_recent_outcome_at: s?.most_recent_outcome_at ?? null,
      most_recent_readiness: s?.most_recent_readiness ?? null,
      most_recent_probability: s?.most_recent_probability ?? null,
      probability_delta: probability_delta ?? null,
      open_recommendation_count: recsOpenByEngagement.get(eng.id) ?? 0,
      flag_low_readiness:
        typeof s?.most_recent_readiness === 'number' && s.most_recent_readiness < READINESS_LOW,
      flag_falling_probability:
        typeof probability_delta === 'number' && probability_delta <= PROBABILITY_DROP_FLAG,
      flag_missed_milestones: (s?.missed_milestones ?? 0) > 0,
      flag_poor_compliance: typeof s?.compliance_score === 'number' && s.compliance_score < 0.5,
    });
  }
  return { active_count: active, paused_count: paused, completed_count: completed, rows };
}

// ---------------------------------------------------------------------------
// At-risk projection
// ---------------------------------------------------------------------------

function buildAtRisk(clientBuckets: DashboardClientBuckets): DashboardAtRiskRow[] {
  const out: DashboardAtRiskRow[] = [];
  for (const c of clientBuckets.rows) {
    const reasons: string[] = [];
    if (c.flag_low_readiness) reasons.push('low_readiness');
    if (c.flag_falling_probability) reasons.push('falling_probability');
    if (c.flag_missed_milestones) reasons.push('missed_milestones');
    if (c.flag_poor_compliance) reasons.push('poor_compliance');
    if (reasons.length === 0) continue;
    const severity: DashboardAtRiskRow['severity'] =
      reasons.length >= 3 ? 'high' : reasons.length === 2 ? 'medium' : 'low';
    out.push({
      engagement_id: c.engagement_id,
      patient_user_id: c.patient_user_id,
      patient_initials: c.patient_initials,
      reasons,
      severity,
      last_observed_at: c.most_recent_outcome_at ?? c.most_recent_recommendation_at ?? null,
    });
  }
  // Deterministic sort: high → low, then engagement_id.
  out.sort((a, b) => {
    const sev: Record<DashboardAtRiskRow['severity'], number> = { high: 0, medium: 1, low: 2 };
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
    return a.engagement_id < b.engagement_id ? -1 : a.engagement_id > b.engagement_id ? 1 : 0;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Upcoming reviews — derived from expires_at + review metadata
// ---------------------------------------------------------------------------

function buildUpcoming(inputs: DashboardInputs): DashboardUpcomingRow[] {
  const now = new Date(inputs.now).getTime();
  const horizonMs = 1000 * 60 * 60 * 24 * 30; // next 30 days
  const out: DashboardUpcomingRow[] = [];
  for (const eng of inputs.engagements) {
    // Expiring engagement.
    if (eng.expires_at) {
      const t = new Date(eng.expires_at).getTime();
      if (t >= now && t - now <= horizonMs) {
        out.push({
          engagement_id: eng.id,
          patient_user_id: eng.patient_user_id,
          patient_initials:
            inputs.engagement_signals.find((s) => s.engagement_id === eng.id)?.patient_initials ??
            '—',
          kind: 'expiring_engagement',
          due_at: eng.expires_at,
          reason: 'engagement expiring',
        });
      }
    }
    // Scheduled review pulled from engagement.metadata.next_review_at.
    const meta = eng.metadata ?? {};
    const next = (meta as Record<string, string | undefined>).next_review_at;
    if (typeof next === 'string') {
      const t = new Date(next).getTime();
      if (!Number.isNaN(t) && t >= now && t - now <= horizonMs) {
        out.push({
          engagement_id: eng.id,
          patient_user_id: eng.patient_user_id,
          patient_initials:
            inputs.engagement_signals.find((s) => s.engagement_id === eng.id)?.patient_initials ??
            '—',
          kind: 'scheduled_review',
          due_at: next,
        });
      }
    }
  }
  out.sort((a, b) => (a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function buildMetrics(inputs: DashboardInputs, activeClients: number): DashboardProviderMetrics {
  const stats = computeRecommendationLifecycleStats(inputs.recommendations);

  // Mean outcome quality is loader-supplied via engagement_signals when
  // available; otherwise null.
  const qualities = inputs.engagement_signals
    .map((s) => (typeof s.most_recent_probability === 'number' ? s.most_recent_probability : null))
    .filter((v): v is number => v != null);
  const meanQuality =
    qualities.length > 0 ? qualities.reduce((a, b) => a + b, 0) / qualities.length : null;

  return {
    active_clients: activeClients,
    recommendation_acceptance_rate: Number(stats.acceptance_rate.toFixed(4)),
    completion_rate: Number(stats.completion_rate.toFixed(4)),
    mean_outcome_quality: meanQuality != null ? Number(meanQuality.toFixed(4)) : null,
  };
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

export function assembleDashboard(inputs: DashboardInputs): PortalDashboard {
  const leads = bucketLeads(inputs.leads);
  const clients = bucketClients(inputs);
  const at_risk = buildAtRisk(clients);
  const upcoming = buildUpcoming(inputs);
  const metrics = buildMetrics(inputs, clients.active_count);
  return {
    generated_at: inputs.now,
    provider_id: inputs.provider_id,
    leads,
    clients,
    at_risk,
    upcoming,
    metrics,
  };
}

export const __test = {
  assembleDashboard,
  bucketLeads,
  bucketClients,
  buildAtRisk,
  buildUpcoming,
  buildMetrics,
};
