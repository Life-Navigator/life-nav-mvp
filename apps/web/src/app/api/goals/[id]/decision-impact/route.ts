/**
 * POST /api/goals/[id]/decision-impact
 *
 * Body:
 *   {
 *     decision_label: string,
 *     base_magnitude: number,         // 0..1
 *     is_structural: boolean,
 *     structural_variable?: string,
 *     peak_months?: number,
 *     decay_tau_months?: number,
 *     related_goal_effects?: [{ goal_id, effect_ratio }],
 *     blocked_goal_effects?: [{ goal_id, effect_ratio }],
 *     timeline_shift_months_at_peak?: number,
 *     risk_delta_at_peak?: number,
 *     base_confidence?: number,
 *     persist?: boolean,
 *   }
 *
 * Returns the full per-horizon impact + XAI envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { computeDecisionImpact } from '@/lib/decision/decision-impact-engine';
import { loadGoalContext } from '@/lib/decision/context-loader';
import type { StructuralVariable } from '@/types/decision-impact';

export const dynamic = 'force-dynamic';

const StructuralVariableEnum = z.enum([
  'income_trajectory',
  'education_credential',
  'health_trajectory',
  'debt_structure',
  'family_obligations',
  'business_ownership',
  'career_path',
  'legal_estate_structure',
]);

const Body = z.object({
  decision_label: z.string().trim().min(1).max(200),
  base_magnitude: z.number().min(0).max(1),
  is_structural: z.boolean().default(false),
  structural_variable: StructuralVariableEnum.optional(),
  peak_months: z.number().min(1).max(360).optional(),
  decay_tau_months: z.number().min(1).max(360).optional(),
  related_goal_effects: z
    .array(z.object({ goal_id: z.string().uuid(), effect_ratio: z.number().min(-1).max(1) }))
    .optional(),
  blocked_goal_effects: z
    .array(z.object({ goal_id: z.string().uuid(), effect_ratio: z.number().min(-1).max(1) }))
    .optional(),
  timeline_shift_months_at_peak: z.number().optional(),
  risk_delta_at_peak: z.number().min(-1).max(1).optional(),
  base_confidence: z.number().min(0).max(1).optional(),
  persist: z.boolean().default(false),
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

  const impact = computeDecisionImpact({
    goal_id: goalId,
    goal_concept: ctx.goal_concept,
    decision_label: parsed.data.decision_label,
    base_magnitude: parsed.data.base_magnitude,
    peak_months: parsed.data.peak_months,
    decay_tau_months: parsed.data.decay_tau_months,
    is_structural: parsed.data.is_structural,
    structural_variable: parsed.data.structural_variable as StructuralVariable | undefined,
    related_goal_effects: parsed.data.related_goal_effects as
      | Array<{ goal_id: string; effect_ratio: number }>
      | undefined,
    blocked_goal_effects: parsed.data.blocked_goal_effects as
      | Array<{ goal_id: string; effect_ratio: number }>
      | undefined,
    timeline_shift_months_at_peak: parsed.data.timeline_shift_months_at_peak,
    risk_delta_at_peak: parsed.data.risk_delta_at_peak,
    base_confidence: parsed.data.base_confidence,
    domains: ctx.domains,
  });

  if (parsed.data.persist) {
    try {
      const rows = impact.per_horizon.map((h) => ({
        user_id: user.id,
        goal_id: goalId,
        decision_label: parsed.data.decision_label,
        time_horizon: h.time_horizon,
        probability_delta: h.probability_delta,
        timeline_delta_months: h.timeline_delta_months ?? null,
        risk_delta: h.risk_delta ?? null,
        related_goal_effects: impact.related_goal_effects,
        blocked_goal_effects: impact.blocked_goal_effects,
        is_structural: impact.is_structural,
        structural_variable: impact.structural_variable ?? null,
        confidence: h.confidence,
        reason: impact.reason,
      }));
      const sb = supabase as any;
      await sb
        .from('goal_decision_impacts')
        .upsert(rows, { onConflict: 'user_id,goal_id,decision_id,decision_label,time_horizon' });
    } catch {
      /* best effort */
    }
  }

  return NextResponse.json({ impact });
}
