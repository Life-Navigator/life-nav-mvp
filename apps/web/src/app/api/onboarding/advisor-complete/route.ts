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
  let confirmed = false;
  try {
    const body = await request.json();
    skipped = body?.skip === true;
    confirmed = body?.confirmed === true;
  } catch {
    /* no body → treat as a normal completion */
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  // Step 6: record the distinct end-state (reviewed-and-confirmed vs explicit skip) so the
  // onboarding stage is not collapsed into a single boolean. `onboarding_completed` gates the
  // dashboard; the event metadata preserves HOW it was reached.
  await recordUserEvent(supabase, {
    user_id: user.id,
    event_type: 'onboarding_completed',
    event_metadata: {
      stage: 'advisor',
      skipped,
      confirmed,
      end_state: skipped ? 'explicit_skip' : confirmed ? 'confirmation_completed' : 'completed',
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, skipped, confirmed });
}
