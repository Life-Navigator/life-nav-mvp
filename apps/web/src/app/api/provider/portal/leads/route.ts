/**
 * GET /api/provider/portal/leads
 *
 * Lists leads for the calling provider. Reuses the same projection
 * the dashboard uses.
 */

import { NextResponse } from 'next/server';
import { projectLeadSummary } from '@/lib/provider/lead-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';
import type { LeadEventKind } from '@/types/provider-portal';
import type { ProviderEngagement } from '@/types/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const s = session!;

  const lpRes = await s.supabase
    .from('lead_packages')
    .select('*')
    .eq('recipient_provider_id', s.provider_id)
    .order('generated_at', { ascending: false });
  const lps = (lpRes.data ?? []) as LeadPackage[];

  const consentIds = lps.map((l) => l.consent_id);
  const [consentRes, engRes, eventRes] = await Promise.all([
    consentIds.length
      ? s.supabase.from('lead_package_consents').select('*').in('id', consentIds)
      : Promise.resolve({ data: [] }),
    s.supabase.from('provider_engagements').select('*').eq('provider_id', s.provider_id),
    s.supabase.from('lead_workflow_events').select('*').eq('provider_id', s.provider_id),
  ]);

  const consents = (consentRes.data ?? []) as LeadPackageConsent[];
  const engagements = (engRes.data ?? []) as ProviderEngagement[];
  const events = (eventRes.data ?? []) as Array<{
    event_kind: LeadEventKind;
    occurred_at: string;
    lead_package_id?: string | null;
  }>;

  const now = new Date().toISOString();
  const leads = lps.map((lp) => {
    const consent = consents.find((c) => c.id === lp.consent_id) ?? null;
    const engagement = engagements.find((e) => e.patient_user_id === lp.user_id) ?? null;
    const evts = events.filter((e) => e.lead_package_id === lp.id);
    return projectLeadSummary({ lead_package: lp, consent, engagement, events: evts, now });
  });

  return NextResponse.json({ leads });
}
