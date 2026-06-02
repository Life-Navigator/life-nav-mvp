/**
 * GET  /api/provider/portal/leads/[leadId]      → workspace view (Phase 2)
 * POST /api/provider/portal/leads/[leadId]      → accept | decline | view  (Phase 1 action)
 *
 * Body for POST: { action: 'accept'|'decline'|'view'; reason?: string }
 *
 * Accept transitions engagement.status → 'active' (or creates one if
 * the patient initiated the share without one); decline writes a
 * lead_workflow_events row only — we never silently change the
 * engagement on decline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyConsentAt, isValidDeclineReason } from '@/lib/provider/lead-service';
import { loadPortalSession, deny } from '@/lib/provider/portal-route-helpers';
import type { LeadPackage, LeadPackageConsent } from '@/types/arcana';
import type { LeadWorkflowEvent } from '@/types/provider-portal';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ leadId: string }>;
}

async function loadLeadOrDeny(
  s: Awaited<ReturnType<typeof loadPortalSession>>['session'],
  leadId: string
) {
  const lpRes = await s!.supabase
    .from('lead_packages')
    .select('*')
    .eq('id', leadId)
    .eq('recipient_provider_id', s!.provider_id)
    .maybeSingle();
  if (!lpRes.data) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  const lp = lpRes.data as LeadPackage;
  const consentRes = await s!.supabase
    .from('lead_package_consents')
    .select('*')
    .eq('id', lp.consent_id)
    .maybeSingle();
  return { lp, consent: (consentRes.data ?? null) as LeadPackageConsent | null };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const { leadId } = await ctx.params;

  const loaded = await loadLeadOrDeny(session, leadId);
  if ('error' in loaded) return loaded.error;
  const { lp, consent } = loaded;

  const now = new Date().toISOString();
  const verdict = consent
    ? verifyConsentAt(consent, now)
    : { ok: false, reasons: ['missing_consent_row'] };

  // Audit-log the view, even if the consent is now invalid.
  await session!.supabase.from('lead_workflow_events').insert({
    provider_id: session!.provider_id,
    patient_user_id: lp.user_id,
    lead_package_id: lp.id,
    event_kind: 'lead_viewed',
    actor_user_id: session!.user_id,
    metadata: { consent_ok: verdict.ok },
  });

  if (!verdict.ok) {
    return NextResponse.json(
      {
        lead_package_id: lp.id,
        consent_active: false,
        consent_reasons: verdict.reasons,
        message: 'Patient has withdrawn or expired consent. Payload not returned.',
      },
      { status: 403 }
    );
  }

  // bump the access count for audit purposes
  await session!.supabase
    .from('lead_packages')
    .update({ accessed_count: lp.accessed_count + 1, shared_at: lp.shared_at ?? now })
    .eq('id', lp.id);

  const workflowRes = await session!.supabase
    .from('lead_workflow_events')
    .select('*')
    .eq('lead_package_id', lp.id)
    .order('occurred_at', { ascending: false });
  const workflow = (workflowRes.data ?? []) as LeadWorkflowEvent[];

  return NextResponse.json({
    workspace: {
      lead_package_id: lp.id,
      patient_user_id: lp.user_id,
      generated_at: lp.generated_at,
      consent_active: true,
      consent_reasons: [],
      payload: lp.payload,
      workflow,
    },
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const { leadId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  const action = body.action;
  if (action !== 'accept' && action !== 'decline' && action !== 'view') {
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  }

  const loaded = await loadLeadOrDeny(session, leadId);
  if ('error' in loaded) return loaded.error;
  const { lp, consent } = loaded;

  if (action === 'view') {
    await session!.supabase.from('lead_workflow_events').insert({
      provider_id: session!.provider_id,
      patient_user_id: lp.user_id,
      lead_package_id: lp.id,
      event_kind: 'lead_viewed',
      actor_user_id: session!.user_id,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'decline') {
    const reason = body.reason ?? 'other';
    if (!isValidDeclineReason(reason)) return deny('invalid_decline_reason', 400);
    await session!.supabase.from('lead_workflow_events').insert({
      provider_id: session!.provider_id,
      patient_user_id: lp.user_id,
      lead_package_id: lp.id,
      event_kind: 'lead_declined',
      actor_user_id: session!.user_id,
      reason,
    });
    return NextResponse.json({ ok: true, status: 'declined' });
  }

  // Accept — consent must currently be active.
  if (!consent) return deny('missing_consent', 409);
  const v = verifyConsentAt(consent, new Date().toISOString());
  if (!v.ok)
    return NextResponse.json({ error: 'consent_invalid', reasons: v.reasons }, { status: 403 });

  // Upsert engagement → active.
  const existing = await session!.supabase
    .from('provider_engagements')
    .select('id, status')
    .eq('provider_id', session!.provider_id)
    .eq('patient_user_id', lp.user_id)
    .maybeSingle();
  let engagementId: string;
  if (existing.data) {
    const upd = await session!.supabase
      .from('provider_engagements')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', existing.data.id)
      .select('id')
      .single();
    if (upd.error) return safeApiError({ code: 'db_persistence_error', internal: upd.error });
    engagementId = upd.data.id;
  } else {
    const ins = await session!.supabase
      .from('provider_engagements')
      .insert({
        provider_id: session!.provider_id,
        patient_user_id: lp.user_id,
        status: 'active',
        initiated_by: 'patient',
        allowed_domains: ['health'],
        max_sensitivity: 'high',
        invited_at: lp.generated_at,
        accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (ins.error) return safeApiError({ code: 'db_persistence_error', internal: ins.error });
    engagementId = ins.data.id;
  }

  await session!.supabase.from('lead_workflow_events').insert({
    provider_id: session!.provider_id,
    patient_user_id: lp.user_id,
    lead_package_id: lp.id,
    engagement_id: engagementId,
    event_kind: 'lead_accepted',
    actor_user_id: session!.user_id,
  });

  return NextResponse.json({ ok: true, status: 'accepted', engagement_id: engagementId });
}
