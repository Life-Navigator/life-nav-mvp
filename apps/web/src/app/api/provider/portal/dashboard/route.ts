/**
 * GET /api/provider/portal/dashboard
 *
 * Assembles the provider's dashboard: leads + clients + at-risk +
 * upcoming + metrics. Everything is RLS-scoped at the DB layer.
 */

import { NextResponse } from 'next/server';
import { assembleDashboard } from '@/lib/provider/portal-dashboard-service';
import { projectLeadSummary } from '@/lib/provider/lead-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';
import type { LeadEventKind } from '@/types/provider-portal';
import type { ProviderEngagement, ProviderRecommendation } from '@/types/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const s = session!;

  // 1. Engagements
  const engRes = await s.supabase
    .from('provider_engagements')
    .select('*')
    .eq('provider_id', s.provider_id);
  const engagements = (engRes.data ?? []) as ProviderEngagement[];

  // 2. Lead packages addressed to this provider.
  const lpRes = await s.supabase
    .from('lead_packages')
    .select('*')
    .eq('recipient_provider_id', s.provider_id)
    .order('generated_at', { ascending: false })
    .limit(50);
  const leadPackages = (lpRes.data ?? []) as LeadPackage[];

  const consentIds = leadPackages.map((lp) => lp.consent_id).filter(Boolean);
  const consentRes = consentIds.length
    ? await s.supabase.from('lead_package_consents').select('*').in('id', consentIds)
    : { data: [] };
  const consents = (consentRes.data ?? []) as LeadPackageConsent[];

  const eventsRes = await s.supabase
    .from('lead_workflow_events')
    .select('event_kind, occurred_at, patient_user_id, lead_package_id')
    .eq('provider_id', s.provider_id);
  const events = (eventsRes.data ?? []) as Array<{
    event_kind: LeadEventKind;
    occurred_at: string;
    patient_user_id: string;
    lead_package_id?: string | null;
  }>;

  const now = new Date().toISOString();
  const leads = leadPackages.map((lp) => {
    const consent = consents.find((c) => c.id === lp.consent_id) ?? null;
    const engagement = engagements.find((e) => e.patient_user_id === lp.user_id) ?? null;
    const evtsForLead = events.filter((e) => e.lead_package_id === lp.id);
    return projectLeadSummary({
      lead_package: lp,
      consent,
      engagement,
      events: evtsForLead,
      now,
    });
  });

  // 3. Recommendations across the panel.
  const recRes = await s.supabase
    .from('provider_recommendations')
    .select('*')
    .eq('provider_id', s.provider_id);
  const recommendations = (recRes.data ?? []) as ProviderRecommendation[];

  // 4. Per-engagement signals — best-effort denormalization. We pull
  // the latest goal_probability_distribution + readiness for each
  // patient. These are RLS-scoped on the patient's side, but the
  // engagement gives provider read access via has_access_to.
  const patientIds = engagements.map((e) => e.patient_user_id);
  const probRes = patientIds.length
    ? await s.supabase
        .from('goal_probability_distribution')
        .select('user_id, most_likely_prob, computed_at')
        .in('user_id', patientIds)
        .order('computed_at', { ascending: false })
    : { data: [] };
  const readinessRes = patientIds.length
    ? await s.supabase
        .from('arcana_profiles')
        .select('user_id, readiness_score')
        .in('user_id', patientIds)
    : { data: [] };

  const probByPatient = new Map<string, Array<{ most_likely_prob: number; computed_at: string }>>();
  for (const r of (probRes.data ?? []) as Array<{
    user_id: string;
    most_likely_prob: number;
    computed_at: string;
  }>) {
    if (!probByPatient.has(r.user_id)) probByPatient.set(r.user_id, []);
    probByPatient.get(r.user_id)!.push(r);
  }
  const readinessByPatient = new Map<string, number>();
  for (const r of (readinessRes.data ?? []) as Array<{
    user_id: string;
    readiness_score: number | null;
  }>) {
    if (typeof r.readiness_score === 'number') readinessByPatient.set(r.user_id, r.readiness_score);
  }

  const engagement_signals = engagements.map((e) => {
    const probs = probByPatient.get(e.patient_user_id) ?? [];
    const current = probs[0]?.most_likely_prob;
    const prior = probs[1]?.most_likely_prob;
    return {
      engagement_id: e.id,
      patient_initials: (e.metadata?.patient_initials as string | undefined) ?? '—',
      most_recent_recommendation_at:
        recommendations
          .filter((r) => r.engagement_id === e.id)
          .map((r) => r.issued_at)
          .sort()
          .pop() ?? null,
      most_recent_outcome_at: null as string | null,
      most_recent_readiness: readinessByPatient.get(e.patient_user_id) ?? null,
      most_recent_probability: typeof current === 'number' ? current : null,
      prior_probability: typeof prior === 'number' ? prior : null,
    };
  });

  const dashboard = assembleDashboard({
    provider_id: s.provider_id,
    now,
    leads,
    engagements,
    engagement_signals,
    recommendations,
  });

  return NextResponse.json({ dashboard });
}
