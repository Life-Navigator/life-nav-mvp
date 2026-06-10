import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding/advisor-complete  { skip?: boolean }
 *
 * Marks the advisor onboarding as done by setting `profiles.onboarding_completed`.
 * This is the ONLY thing that unlocks the dashboard after persona activation
 * (the middleware gate in proxy.ts enforces advisor-first). `skip: true` records
 * an explicit, persisted skip — the user chose to bypass the advisor, which is
 * allowed, but it must be a deliberate, recorded action (never a silent default).
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let skipped = false;
  try {
    const body = await request.json();
    skipped = body?.skip === true;
  } catch {
    /* no body → treat as a normal completion */
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  await recordUserEvent(supabase, {
    user_id: user.id,
    event_type: 'onboarding_completed',
    event_metadata: { stage: 'advisor', skipped },
  }).catch(() => {});

  return NextResponse.json({ success: true, skipped });
}
