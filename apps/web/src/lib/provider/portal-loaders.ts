/**
 * Server-side data loaders for the portal pages.
 *
 * The pages render in React Server Components — calling the API
 * routes from the server would be a roundtrip we don't need. Each
 * loader takes the supabase client + provider_id and returns the
 * fully-projected view-model.
 *
 * NB: every loader trusts that RLS + the provided provider_id are
 * doing access control. The loaders do NOT bypass anything.
 */

import { assembleClientWorkspace } from './client-workspace-service';
import { assembleDashboard } from './portal-dashboard-service';
import { buildEffectiveness } from './portal-analytics-service';
import { projectLeadSummary } from './lead-service';
import { projectThread } from './message-service';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';
import type {
  ClientWorkspaceGoalProgress,
  ClientWorkspaceView,
  LeadEventKind,
  LeadSummary,
  PortalDashboard,
  ProviderEffectivenessAggregate,
  ProviderMessage,
} from '@/types/provider-portal';
import type {
  ProviderDomain,
  ProviderEngagement,
  ProviderOutcome,
  ProviderRecommendation,
} from '@/types/provider';

type Sb = any;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function loadDashboard(sb: Sb, provider_id: string): Promise<PortalDashboard> {
  const [engRes, lpRes, eventsRes, recRes] = await Promise.all([
    sb.from('provider_engagements').select('*').eq('provider_id', provider_id),
    sb
      .from('lead_packages')
      .select('*')
      .eq('recipient_provider_id', provider_id)
      .order('generated_at', { ascending: false })
      .limit(50),
    sb
      .from('lead_workflow_events')
      .select('event_kind, occurred_at, patient_user_id, lead_package_id')
      .eq('provider_id', provider_id),
    sb.from('provider_recommendations').select('*').eq('provider_id', provider_id),
  ]);
  const engagements = (engRes.data ?? []) as ProviderEngagement[];
  const lps = (lpRes.data ?? []) as LeadPackage[];
  const events = (eventsRes.data ?? []) as Array<{
    event_kind: LeadEventKind;
    occurred_at: string;
    lead_package_id?: string | null;
  }>;
  const recommendations = (recRes.data ?? []) as ProviderRecommendation[];

  const consentIds = lps.map((l) => l.consent_id);
  const consentRes = consentIds.length
    ? await sb.from('lead_package_consents').select('*').in('id', consentIds)
    : { data: [] };
  const consents = (consentRes.data ?? []) as LeadPackageConsent[];

  const now = new Date().toISOString();
  const leads: LeadSummary[] = lps.map((lp) => {
    const consent = consents.find((c) => c.id === lp.consent_id) ?? null;
    const engagement = engagements.find((e) => e.patient_user_id === lp.user_id) ?? null;
    const evts = events.filter((e) => e.lead_package_id === lp.id);
    return projectLeadSummary({ lead_package: lp, consent, engagement, events: evts, now });
  });

  const patientIds = engagements.map((e) => e.patient_user_id);
  const probByPatient = new Map<string, Array<{ most_likely_prob: number; computed_at: string }>>();
  const readinessByPatient = new Map<string, number>();
  if (patientIds.length > 0) {
    const probRes = await sb
      .from('goal_probability_distribution')
      .select('user_id, most_likely_prob, computed_at')
      .in('user_id', patientIds)
      .order('computed_at', { ascending: false });
    for (const r of (probRes.data ?? []) as Array<{
      user_id: string;
      most_likely_prob: number;
      computed_at: string;
    }>) {
      if (!probByPatient.has(r.user_id)) probByPatient.set(r.user_id, []);
      probByPatient.get(r.user_id)!.push(r);
    }
    const arcanaRes = await sb
      .from('arcana_profiles')
      .select('user_id, readiness_score')
      .in('user_id', patientIds);
    for (const r of (arcanaRes.data ?? []) as Array<{
      user_id: string;
      readiness_score: number | null;
    }>) {
      if (typeof r.readiness_score === 'number')
        readinessByPatient.set(r.user_id, r.readiness_score);
    }
  }

  const engagement_signals = engagements.map((e) => {
    const probs = probByPatient.get(e.patient_user_id) ?? [];
    return {
      engagement_id: e.id,
      patient_initials: (e.metadata?.patient_initials as string | undefined) ?? '—',
      most_recent_recommendation_at:
        recommendations
          .filter((r) => r.engagement_id === e.id)
          .map((r) => r.issued_at)
          .sort()
          .pop() ?? null,
      most_recent_outcome_at: null,
      most_recent_readiness: readinessByPatient.get(e.patient_user_id) ?? null,
      most_recent_probability: probs[0]?.most_likely_prob ?? null,
      prior_probability: probs[1]?.most_likely_prob ?? null,
    };
  });

  return assembleDashboard({
    provider_id,
    now,
    leads,
    engagements,
    engagement_signals,
    recommendations,
  });
}

// ---------------------------------------------------------------------------
// Leads list
// ---------------------------------------------------------------------------

export async function loadLeadList(sb: Sb, provider_id: string): Promise<LeadSummary[]> {
  const lpRes = await sb
    .from('lead_packages')
    .select('*')
    .eq('recipient_provider_id', provider_id)
    .order('generated_at', { ascending: false });
  const lps = (lpRes.data ?? []) as LeadPackage[];
  const consentIds = lps.map((l) => l.consent_id);
  const [consentRes, engRes, eventRes] = await Promise.all([
    consentIds.length
      ? sb.from('lead_package_consents').select('*').in('id', consentIds)
      : Promise.resolve({ data: [] }),
    sb.from('provider_engagements').select('*').eq('provider_id', provider_id),
    sb.from('lead_workflow_events').select('*').eq('provider_id', provider_id),
  ]);
  const consents = (consentRes.data ?? []) as LeadPackageConsent[];
  const engagements = (engRes.data ?? []) as ProviderEngagement[];
  const events = (eventRes.data ?? []) as Array<{
    event_kind: LeadEventKind;
    occurred_at: string;
    lead_package_id?: string | null;
  }>;
  const now = new Date().toISOString();
  return lps.map((lp) => {
    const consent = consents.find((c) => c.id === lp.consent_id) ?? null;
    const engagement = engagements.find((e) => e.patient_user_id === lp.user_id) ?? null;
    const evts = events.filter((e) => e.lead_package_id === lp.id);
    return projectLeadSummary({ lead_package: lp, consent, engagement, events: evts, now });
  });
}

// ---------------------------------------------------------------------------
// Client workspace
// ---------------------------------------------------------------------------

export async function loadClientWorkspace(
  sb: Sb,
  provider_id: string,
  engagement_id: string
): Promise<ClientWorkspaceView | { error: string; reason: string }> {
  const e = await sb
    .from('provider_engagements')
    .select('*')
    .eq('id', engagement_id)
    .eq('provider_id', provider_id)
    .maybeSingle();
  if (!e.data) return { error: 'not_found', reason: 'engagement_not_found' };
  const eng = e.data as ProviderEngagement;

  const [goalsRes, probRes, recRes, lpRes] = await Promise.all([
    sb
      .from('arcana_goals')
      .select('id, title, domain, current_value, target_value')
      .eq('user_id', eng.patient_user_id),
    sb
      .from('goal_probability_distribution')
      .select('goal_id, most_likely_prob, computed_at')
      .eq('user_id', eng.patient_user_id)
      .order('computed_at', { ascending: false }),
    sb.from('provider_recommendations').select('*').eq('engagement_id', engagement_id),
    sb
      .from('lead_packages')
      .select('payload')
      .eq('user_id', eng.patient_user_id)
      .eq('recipient_provider_id', provider_id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const probByGoal = new Map<string, Array<{ most_likely_prob: number; computed_at: string }>>();
  for (const r of (probRes.data ?? []) as Array<{
    goal_id: string;
    most_likely_prob: number;
    computed_at: string;
  }>) {
    if (!probByGoal.has(r.goal_id)) probByGoal.set(r.goal_id, []);
    probByGoal.get(r.goal_id)!.push(r);
  }
  const goals: ClientWorkspaceGoalProgress[] = (
    (goalsRes.data ?? []) as Array<{
      id: string;
      title: string;
      domain: string;
      current_value?: number;
      target_value?: number;
    }>
  )
    .filter((g) => eng.allowed_domains.includes(g.domain as ProviderDomain))
    .map((g) => {
      const ps = probByGoal.get(g.id) ?? [];
      const cur = ps[0]?.most_likely_prob;
      const prior = ps[1]?.most_likely_prob;
      return {
        goal_id: g.id,
        goal_title: g.title,
        domain: g.domain as ProviderDomain,
        current_progress:
          typeof g.current_value === 'number' &&
          typeof g.target_value === 'number' &&
          g.target_value > 0
            ? Number((g.current_value / g.target_value).toFixed(4))
            : null,
        target_progress: 1,
        probability_now: typeof cur === 'number' ? cur : null,
        probability_prior: typeof prior === 'number' ? prior : null,
        probability_delta:
          typeof cur === 'number' && typeof prior === 'number'
            ? Number((cur - prior).toFixed(4))
            : null,
        catch_up_status: null,
        last_observation_at: ps[0]?.computed_at ?? null,
      };
    });
  const recs = (recRes.data ?? []) as ProviderRecommendation[];
  const initials =
    (lpRes.data?.payload as { patient_summary?: { name_initials?: string } } | undefined)
      ?.patient_summary?.name_initials ?? '—';

  return assembleClientWorkspace({
    engagement_id,
    patient_user_id: eng.patient_user_id,
    patient_initials: initials,
    scope_domains: eng.allowed_domains as ProviderDomain[],
    goals,
    recommendations: recs,
    now: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function loadAnalytics(
  sb: Sb,
  provider_id: string,
  period: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
): Promise<ProviderEffectivenessAggregate> {
  const [recRes, outRes] = await Promise.all([
    sb.from('provider_recommendations').select('*').eq('provider_id', provider_id),
    sb.from('provider_outcomes').select('*').eq('provider_id', provider_id),
  ]);
  const now = new Date();
  return buildEffectiveness({
    provider_id,
    period,
    period_start: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
    recommendations: (recRes.data ?? []) as ProviderRecommendation[],
    outcomes: (outRes.data ?? []) as ProviderOutcome[],
  });
}

// ---------------------------------------------------------------------------
// Messages (thread for one engagement)
// ---------------------------------------------------------------------------

export async function loadMessageThread(sb: Sb, engagement_id: string, viewer_user_id: string) {
  const r = await sb.from('provider_messages').select('*').eq('engagement_id', engagement_id);
  return projectThread((r.data ?? []) as ProviderMessage[], viewer_user_id);
}
