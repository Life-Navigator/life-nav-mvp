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
  let reason = 'completed';
  let discoveryAnswerCount: number | null = null;
  let graphIntegrityAtSkip: number | null = null;
  let coverageAtSkip: number | null = null;
  try {
    const body = await request.json();
    skipped = body?.skip === true;
    confirmed = body?.confirmed === true;
    discoveryAnswerCount =
      typeof body?.discovery_answer_count === 'number' ? body.discovery_answer_count : null;
    graphIntegrityAtSkip =
      typeof body?.graph_integrity_at_skip === 'number' ? body.graph_integrity_at_skip : null;
    coverageAtSkip = typeof body?.coverage_at_skip === 'number' ? body.coverage_at_skip : null;
    // Distinct end-states (never one vague "completed"): the caller tells us how onboarding ended.
    const allowed = [
      'confirmation_completed',
      'explicit_skip_after_minimum',
      'early_skip_confirmed',
    ];
    if (typeof body?.reason === 'string' && allowed.includes(body.reason)) reason = body.reason;
    else
      reason = confirmed
        ? 'confirmation_completed'
        : skipped
          ? 'explicit_skip_after_minimum'
          : 'completed';
  } catch {
    /* no body → treat as a normal completion */
  }
  const isEarlySkip = reason === 'early_skip_confirmed';

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  // Record the distinct end-state + skip telemetry so any skip is intentional, persisted, and traceable.
  await recordUserEvent(supabase, {
    user_id: user.id,
    event_type: 'onboarding_completed',
    event_metadata: {
      stage: 'advisor',
      skipped,
      confirmed,
      explicit_skip: skipped,
      end_state: reason,
      skip_reason: skipped ? reason : null,
      skipped_at: skipped ? new Date().toISOString() : null,
      discovery_answer_count: discoveryAnswerCount,
      graph_integrity_at_skip: graphIntegrityAtSkip,
      coverage_at_skip: coverageAtSkip,
      limited_dashboard: isEarlySkip,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, skipped, confirmed, end_state: reason });
}
