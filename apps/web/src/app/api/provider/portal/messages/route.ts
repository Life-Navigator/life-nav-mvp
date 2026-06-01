/**
 * POST /api/provider/portal/messages
 *
 * Sends a message tied to an active engagement. Body is validated.
 * The DB function `providers.engagement_writable` is the
 * authoritative gate; we call it before the INSERT so the rejection
 * reason is structured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCompose } from '@/lib/provider/message-service';
import { loadPortalSession } from '@/lib/provider/portal-route-helpers';
import type { MessageKind, MessageSenderRole } from '@/types/provider-portal';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { session, error } = await loadPortalSession();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    engagement_id: string;
    patient_user_id: string;
    kind: MessageKind;
    subject?: string;
    body: string;
    related_recommendation_id?: string | null;
    related_lead_package_id?: string | null;
  };

  // Provider is the sender.
  const compose = {
    engagement_id: body.engagement_id,
    provider_id: session!.provider_id,
    patient_user_id: body.patient_user_id,
    sender_user_id: session!.user_id,
    sender_role: 'provider' as MessageSenderRole,
    kind: body.kind,
    subject: body.subject,
    body: body.body,
    related_recommendation_id: body.related_recommendation_id ?? null,
    related_lead_package_id: body.related_lead_package_id ?? null,
  };
  const v = validateCompose(compose);
  if (!v.ok)
    return NextResponse.json({ error: 'invalid_message', errors: v.errors }, { status: 400 });

  const guard = await session!.supabase.rpc('engagement_writable', {
    p_engagement_id: body.engagement_id,
  });
  // Some RPC clients return rows; some return scalar. Handle both.
  const writable = Array.isArray(guard.data) ? guard.data[0]?.writable : guard.data?.writable;
  const reason = Array.isArray(guard.data) ? guard.data[0]?.reason : guard.data?.reason;
  if (writable === false) {
    return NextResponse.json({ error: 'engagement_not_writable', reason }, { status: 403 });
  }

  const ins = await session!.supabase
    .from('provider_messages')
    .insert(compose)
    .select('*')
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ message: ins.data });
}
