import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyInviteKey, inviteGateConfigured } from '@/lib/auth/inviteKey';

export const dynamic = 'force-dynamic';

// Private-beta account creation. The ONLY server path that may create a real tester account. Requires a valid
// email-bound invite key (minted by the founder). Creates the user with the service role and stamps
// app_metadata.invited=true so the proxy beta-gate lets them in without an env change. Public Supabase signup
// MUST be disabled for this to be the exclusive creation path (see docs/beta/PRIVATE_SIGNUP_GATE.md).
export async function POST(request: NextRequest) {
  // Fail CLOSED if the gate isn't configured — never silently allow account creation.
  if (!inviteGateConfigured()) {
    return NextResponse.json({ error: 'signup_disabled' }, { status: 503 });
  }

  let body: { email?: string; password?: string; key?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const password = String(body.password || '');
  const key = String(body.key || '');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json(
      { error: 'weak_password', message: 'Use at least 10 characters.' },
      { status: 400 }
    );
  }
  // The gate: a valid invite key for THIS email, or nothing happens.
  if (!verifyInviteKey(email, key)) {
    return NextResponse.json({ error: 'invalid_invite_key' }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // invited tester — no email round-trip needed
    user_metadata: { full_name: (body.name || '').trim() || undefined },
    app_metadata: { invited: true, invited_at: new Date().toISOString() },
  });

  if (error) {
    // Already-registered → the invite was effectively single-use; tell them to sign in.
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({ error: 'already_registered' }, { status: 409 });
    }
    return NextResponse.json({ error: 'create_failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
