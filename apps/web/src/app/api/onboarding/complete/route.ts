import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // DEPRECATED (P0 onboarding hardening): this legacy completion endpoint caused the advisor-gate
  // bypass (it used to write onboarding_completed=true). It is now 410 Gone except for an explicit
  // internal migration/test caller. Do NOT set onboarding_completed here — advisor completion is owned
  // solely by /api/onboarding/advisor-complete. There is one canonical flow: persona → advisor → dashboard.
  const internalAllowed =
    request.headers.get('x-internal-migration') === '1' ||
    process.env.ALLOW_LEGACY_ONBOARDING_COMPLETE === '1';
  if (!internalAllowed) {
    return NextResponse.json(
      {
        error: 'gone',
        message:
          'This onboarding endpoint is retired. Onboarding completion is owned by the advisor (/dashboard/advisor?onboarding=1).',
      },
      { status: 410 }
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the user has submitted at least basic profile data and one goal
  // before allowing onboarding completion. Prevents bypassing the flow.
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const { count: goalCount } = await (supabase as any)
    .from('goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!profile?.display_name && (goalCount ?? 0) === 0) {
    return NextResponse.json(
      {
        error:
          'Please complete at least the basic profile or set a goal before finishing onboarding.',
      },
      { status: 400 }
    );
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      // INVARIANT: only the advisor (POST /api/onboarding/advisor-complete) may set
      // onboarding_completed=true. The legacy questionnaire counts as SETUP, but the user must
      // still pass the advisor before the dashboard unlocks — otherwise this route is a gate bypass
      // (completing the legacy questionnaire skipped persona selection + advisor entirely).
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return safeApiError({ code: 'validation_failed', internal: error });

  await recordUserEvent(supabase, {
    user_id: user.id,
    event_type: 'onboarding_completed',
    event_metadata: { goal_count: goalCount ?? 0 },
  });

  return NextResponse.json({ success: true });
}
