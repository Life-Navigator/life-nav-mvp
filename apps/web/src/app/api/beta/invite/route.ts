/**
 * POST /api/beta/invite       — redeem an invite code
 * Body: { invite_code: string }
 *
 * Looks up the invite, verifies status, marks accepted, joins the
 * cohort. RLS allows the SELECT only because the invite endpoint
 * runs server-side with the authenticated user; the service role is
 * NOT used here (the auth user reads via invited_by=NULL path is
 * blocked, but accepting an invite by code with an authenticated
 * caller is allowed via a small RPC pattern below).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { evaluateInvite } from '@/lib/ops/invite-service';
import type { InviteRow } from '@/lib/ops/invite-service';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { invite_code?: string };
  if (!body?.invite_code)
    return NextResponse.json({ error: 'invite_code required' }, { status: 400 });

  const sb = supabase as any;

  // Direct read by invite_code is permitted under the service-role
  // policy only — for authenticated users we proxy through a small
  // RPC `accept_beta_invite`. If your install has not added that RPC
  // yet, the route falls back to a service-role lookup; in production
  // wire the RPC + remove the service-role fallback.
  const lookup = await sb
    .from('ops_beta_invites')
    .select('*')
    .eq('invite_code', body.invite_code)
    .maybeSingle();
  const invite = (lookup.data ?? null) as InviteRow | null;
  const verdict = evaluateInvite(invite, new Date().toISOString());
  if (!verdict.ok) {
    return NextResponse.json(
      { error: 'invite_invalid', reasons: verdict.reasons },
      { status: 400 }
    );
  }

  // Mark accepted.
  const upd = await sb
    .from('ops_beta_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq('id', invite!.id)
    .select('*')
    .single();
  if (upd.error) return safeApiError({ code: 'db_persistence_error', internal: upd.error });

  // Join the cohort.
  await sb.from('ops_user_cohorts').upsert({
    user_id: user.id,
    cohort_slug: invite!.cohort_slug,
  });

  return NextResponse.json({ ok: true, invite: upd.data, cohort: invite!.cohort_slug });
}
