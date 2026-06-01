/**
 * POST /api/goals/[id]/catch-up
 *
 * Body:
 *   { target_score: number, target_at_months: number,
 *     priority?: 'essential'|'important'|'nice_to_have' }
 *
 * Returns a CatchUpPlan: status / gap / catch_up_actions / probability_after_catch_up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { computeCatchUpPlan } from '@/lib/decision/catch-up-engine';
import { loadGoalContext } from '@/lib/decision/context-loader';

export const dynamic = 'force-dynamic';

const Body = z.object({
  target_score: z.number().min(0).max(1),
  target_at_months: z.number().min(1).max(480),
  priority: z.enum(['essential', 'important', 'nice_to_have']).optional(),
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

  const plan = computeCatchUpPlan({
    goal_id: goalId,
    goal_concept: ctx.goal_concept,
    target_score: parsed.data.target_score,
    current_score: ctx.current_progress,
    target_at_months: parsed.data.target_at_months,
    priority: parsed.data.priority,
    available_surplus_usd: ctx.available_surplus_usd,
    commitment_hours_per_week: ctx.commitment_hours_per_week,
    health_recovery_capacity: ctx.health_recovery_capacity,
    risk_tolerance: ctx.risk_tolerance_score,
    hard_constraint_count: ctx.hard_constraint_count,
    domains: ctx.domains,
    historical_accuracy_mean: ctx.historical_accuracy_mean,
    pathway_effectiveness: ctx.pathway_effectiveness,
  });

  return NextResponse.json({ plan });
}
