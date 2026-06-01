/**
 * POST /api/goals/[id]/ahead-of-plan
 *
 * Body:
 *   { target_score: number }
 *
 * Returns an AheadOfPlanPlan: options + recommended_default. May
 * recommend "preserve gain and reduce risk" depending on context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { computeAheadOfPlanPlan } from '@/lib/decision/ahead-of-plan-engine';
import { loadGoalContext } from '@/lib/decision/context-loader';

export const dynamic = 'force-dynamic';

const Body = z.object({
  target_score: z.number().min(0).max(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Bad request', details: parsed.error.flatten() },
      { status: 400 }
    );

  const ctx = await loadGoalContext(supabase, user.id, goalId);
  if (!ctx) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const plan = computeAheadOfPlanPlan({
    goal_id: goalId,
    goal_concept: ctx.goal_concept,
    current_score: ctx.current_progress,
    target_score: parsed.data.target_score,
    available_surplus_usd: ctx.available_surplus_usd,
    commitment_hours_per_week: ctx.commitment_hours_per_week,
    health_recovery_capacity: ctx.health_recovery_capacity,
    risk_tolerance: ctx.risk_tolerance_score,
    domains: ctx.domains,
    hard_constraint_count: ctx.hard_constraint_count,
  });

  return NextResponse.json({ plan });
}
