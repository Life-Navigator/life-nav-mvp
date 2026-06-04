import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getRecommendations } from '@/lib/finance/recommendations';
import { recordUserEvent } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/recommendations
 *
 * Returns the persona-aware recommendation set (>=3 categorized recs) for the
 * authenticated user, computed deterministically from persisted finance data.
 * No model call — safe, fast, and always available (no 502 surface).
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const set = await getRecommendations(svc, user.id);

  if (set.has_data && set.recommendations.length > 0) {
    await recordUserEvent(svc, {
      user_id: user.id,
      event_type: 'recommendation_generated',
      event_metadata: {
        persona_id: set.persona_id ?? null,
        count: set.recommendations.length,
        categories: set.recommendations.map((r) => r.category),
      },
      subject_kind: 'recommendation',
      subject_id: null,
    }).catch(() => {});
  }

  return NextResponse.json(set);
}
