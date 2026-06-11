import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

// Structured auth/session/persona/onboarding events (Rule 9). Best-effort; never blocks the UX.
const ALLOWED = [
  'AUTH_SESSION_RESUMED',
  'AUTH_SWITCH_ACCOUNT',
  'AUTH_SIGNOUT',
  'PERSONA_RESUMED',
  'PERSONA_CHANGED',
  'ONBOARDING_RESUMED',
  'ONBOARDING_COMPLETED',
];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let event_type = '';
  let metadata: Record<string, unknown> = {};
  try {
    const b = await req.json();
    event_type = typeof b?.event_type === 'string' ? b.event_type : '';
    metadata = b?.metadata && typeof b.metadata === 'object' ? b.metadata : {};
  } catch {
    /* no body */
  }
  if (!ALLOWED.includes(event_type)) {
    return NextResponse.json({ ok: false, error: 'unknown event' }, { status: 400 });
  }

  await recordUserEvent(supabase, {
    user_id: user.id,
    // event_type union doesn't include the AUTH_* names yet; recorded as metadata-rich events.
    event_type: event_type as never,
    event_metadata: { email: user.email, ts: new Date().toISOString(), ...metadata },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
