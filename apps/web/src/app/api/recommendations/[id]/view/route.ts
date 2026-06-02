/**
 * POST /api/recommendations/[id]/view — Sprint O.0.1 Phase 1.
 *
 * Idempotent. Client emits this when a recommendation enters the
 * viewport. Body: {} (the recommendation id is in the URL).
 *
 *   - Transitions `decision_outcomes` to `viewed` if currently
 *     `generated`.
 *   - Emits a `recommendation_viewed` user event.
 *
 * Both calls are best-effort; the route always returns 200 unless
 * auth fails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';
import { recordUserEvent } from '@/lib/analytics/events';
import { transitionOutcome } from '@/lib/outcomes/decision-outcomes';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return safeApiError({ code: 'bad_request' });
  }

  await transitionOutcome(supabase, { user_id: user.id, recommendation_id: id }, 'viewed', {
    trigger: 'client_view',
  });
  await recordUserEvent(supabase, {
    user_id: user.id,
    event_type: 'recommendation_viewed',
    event_metadata: { source: 'client_view' },
    subject_kind: 'recommendation',
    subject_id: id,
  });

  return NextResponse.json({ ok: true });
}
