/**
 * GET /api/outcomes/me?window_days=30 — Sprint O.
 *
 * Owner-only: reads the current user's DQI + life-progress snapshots
 * over the requested window from the outcome.* tables (via the
 * public views). RLS owner-only enforces the user can't see anyone
 * else's data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return safeApiError({ code: 'upstream_unavailable' });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return safeApiError({ code: 'unauthorized' });

  const url = request.nextUrl;
  const window_days = Math.max(
    1,
    Math.min(180, Number.parseInt(url.searchParams.get('window_days') ?? '30', 10) || 30)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString();

  // Latest DQI snapshot.
  const dqiQuery = await sb
    .from('outcome_decision_quality_index')
    .select('*')
    .eq('user_id', user.id)
    .gte('computed_at', since)
    .order('computed_at', { ascending: false })
    .limit(1);
  const dqi = Array.isArray(dqiQuery.data) ? (dqiQuery.data[0] ?? null) : null;

  // Latest life-progress snapshot.
  const lifeQuery = await sb
    .from('outcome_life_progress_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .gte('computed_at', since)
    .order('computed_at', { ascending: false })
    .limit(1);
  const life = Array.isArray(lifeQuery.data) ? (lifeQuery.data[0] ?? null) : null;

  // Top safety-compliant effective recommendations.
  const recsQuery = await sb
    .from('outcome_recommendation_effectiveness')
    .select('recommendation_id, effectiveness_score, computed_at, is_safety_compliant')
    .eq('user_id', user.id)
    .eq('is_safety_compliant', true)
    .gte('computed_at', since)
    .order('effectiveness_score', { ascending: false })
    .limit(10);

  // Recent attribution links.
  const linkQuery = await sb
    .from('outcome_attribution_links')
    .select(
      'recommendation_id, goal_id, delta, attribution_confidence, flourishing_axis, lag_days, attributed_at'
    )
    .eq('user_id', user.id)
    .gte('attributed_at', since)
    .order('attributed_at', { ascending: false })
    .limit(25);

  return NextResponse.json({
    window_days,
    dqi,
    life_progress: life,
    top_recommendations: Array.isArray(recsQuery.data) ? recsQuery.data : [],
    recent_attributions: Array.isArray(linkQuery.data) ? linkQuery.data : [],
  });
}
