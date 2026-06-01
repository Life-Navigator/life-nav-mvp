/**
 * POST /api/arcana/catch-up
 *
 * Returns the smallest realistic recovery for an Arcana goal.
 *
 * Body: {
 *   arcana_goal_id: string;
 *   target_score: number;
 *   current_score: number;
 *   target_at_months: number;
 *   has_provider_clearance?: boolean;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeHealthCatchUpPlan } from '@/lib/arcana/health-catch-up-service';
import type { ArcanaConstraint, ArcanaGoal } from '@/types/arcana';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    arcana_goal_id: string;
    target_score: number;
    current_score: number;
    target_at_months: number;
    has_provider_clearance?: boolean;
  };
  if (!body?.arcana_goal_id) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const sb = supabase as any;
  const [goalRes, conRes, profRes] = await Promise.all([
    sb
      .from('arcana_goals')
      .select('*')
      .eq('id', body.arcana_goal_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    sb.from('arcana_constraints').select('*').eq('user_id', user.id).eq('is_active', true),
    sb.from('arcana_profiles').select('readiness_score').eq('user_id', user.id).maybeSingle(),
  ]);

  if (goalRes.error || !goalRes.data) {
    return NextResponse.json({ error: 'goal not found' }, { status: 404 });
  }
  const goal = goalRes.data as ArcanaGoal;

  const plan = computeHealthCatchUpPlan({
    goal_kind: goal.goal_kind,
    domains_touched: [goal.domain],
    current_score: body.current_score,
    target_score: body.target_score,
    target_at_months: body.target_at_months,
    constraints: (conRes.data ?? []) as ArcanaConstraint[],
    readiness_score: profRes.data?.readiness_score ?? undefined,
    has_provider_clearance: body.has_provider_clearance ?? false,
  });

  return NextResponse.json({ plan });
}
