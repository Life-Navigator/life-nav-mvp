/**
 * Persist a finished or in-progress root-goal discovery session.
 *
 *  POST /api/onboarding/goal-discovery
 *    - upserts a public.goals row from the discovery summary
 *    - inserts every captured turn into public.goal_discovery_turns
 *
 *  GET  /api/onboarding/goal-discovery?goal_id=<uuid>
 *    - returns the latest discovery summary + transcript for a goal
 *
 * Both ends respect RLS via createServerSupabaseClient(). No userId is
 * trusted from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

const DRIVER = z.enum(['financial_security', 'image', 'performance']);
const URGENCY = z.enum(['low', 'medium', 'high', 'critical']);
const PERSONA = z.enum([
  'financial_advisor',
  'physician_intake',
  'career_coach',
  'education_counselor',
  'benefits_navigator',
  'estate_advisor',
  'general',
]);
const PROMPT_KIND = z.enum([
  'what_accomplish',
  'what_unlock',
  'why_important',
  'success_definition',
  'consequence_of_inaction',
  'urgency',
  'confirmation',
  'free_text',
  'agent_summary',
]);

const TurnSchema = z.object({
  turn_index: z.number().int().min(0),
  prompt_kind: PROMPT_KIND,
  prompt_text: z.string().trim().min(1).max(2000),
  user_answer: z.string().trim().max(8000).optional().nullable(),
  detected_drivers: z
    .object({
      financial_security: z.number().min(0).max(1),
      image: z.number().min(0).max(1),
      performance: z.number().min(0).max(1),
    })
    .optional(),
  inferred_root_goal: z.string().trim().max(2000).optional().nullable(),
  confidence_after_turn: z.number().min(0).max(1).optional().nullable(),
});

const BodySchema = z.object({
  session_id: z.string().uuid(),
  goal_id: z.string().uuid().optional().nullable(),
  agent_persona: PERSONA,
  category: z.string().trim().min(1).max(64).default('general'),
  stated_goal: z.string().trim().min(1).max(2000),
  need_behind_need: z.string().trim().max(2000).optional().nullable(),
  root_goal: z.string().trim().max(2000).optional().nullable(),
  success_definition: z.string().trim().max(4000).optional().nullable(),
  consequence_of_inaction: z.string().trim().max(4000).optional().nullable(),
  urgency: URGENCY.optional().nullable(),
  driver_scores: z.object({
    financial_security: z.number().min(0).max(1),
    image: z.number().min(0).max(1),
    performance: z.number().min(0).max(1),
  }),
  dominant_driver: DRIVER.optional().nullable(),
  secondary_driver: DRIVER.optional().nullable(),
  confidence: z.number().min(0).max(1),
  turns: z.array(TurnSchema).min(1).max(50),
  finalize: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const p = parsed.data;

  // --- 1. Upsert the goal row ------------------------------------------
  const goalUpsert: Record<string, unknown> = {
    user_id: user.id,
    title: (p.root_goal || p.stated_goal).slice(0, 256),
    category: p.category,
    status: 'active',
    stated_goal: p.stated_goal,
    need_behind_need: p.need_behind_need ?? null,
    root_goal: p.root_goal ?? null,
    success_definition: p.success_definition ?? null,
    consequence_of_inaction: p.consequence_of_inaction ?? null,
    urgency: p.urgency ?? null,
    financial_security_score: p.driver_scores.financial_security,
    image_score: p.driver_scores.image,
    performance_score: p.driver_scores.performance,
    dominant_driver: p.dominant_driver ?? null,
    secondary_driver: p.secondary_driver ?? null,
    root_goal_confidence_score: p.confidence,
    discovery_completed_at: p.finalize ? new Date().toISOString() : null,
  };

  let goalId = p.goal_id ?? null;
  if (goalId) {
    const { error } = await (supabase as any)
      .from('goals')
      .update(goalUpsert)
      .eq('id', goalId)
      .eq('user_id', user.id);
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
  } else {
    const { data, error } = await (supabase as any)
      .from('goals')
      .insert(goalUpsert)
      .select('id')
      .single();
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
    goalId = data?.id ?? null;
  }

  // --- 2. Insert turns -------------------------------------------------
  const turnRows = p.turns.map((t) => ({
    user_id: user.id,
    goal_id: goalId,
    session_id: p.session_id,
    turn_index: t.turn_index,
    prompt_kind: t.prompt_kind,
    prompt_text: t.prompt_text,
    user_answer: t.user_answer ?? null,
    detected_drivers: t.detected_drivers ?? {},
    inferred_root_goal: t.inferred_root_goal ?? null,
    confidence_after_turn: t.confidence_after_turn ?? null,
    agent_persona: p.agent_persona,
    source: 'onboarding',
  }));

  // We "replay" the session by deleting and re-inserting turns for this
  // session_id so the audit log matches the engine's current view.
  const { error: delErr } = await (supabase as any)
    .from('goal_discovery_turns')
    .delete()
    .eq('user_id', user.id)
    .eq('session_id', p.session_id);
  if (delErr) return safeApiError({ code: 'validation_failed', internal: delErr });

  const { error: insErr } = await (supabase as any).from('goal_discovery_turns').insert(turnRows);
  if (insErr) return safeApiError({ code: 'validation_failed', internal: insErr });

  return NextResponse.json({ success: true, goal_id: goalId, turn_count: turnRows.length });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goalId = request.nextUrl.searchParams.get('goal_id');
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!goalId && !sessionId) {
    return NextResponse.json(
      { error: 'goal_id or session_id query parameter is required' },
      { status: 400 }
    );
  }

  let goal: any = null;
  if (goalId) {
    const { data, error } = await (supabase as any)
      .from('goals')
      .select(
        'id, title, category, status, stated_goal, need_behind_need, root_goal, success_definition, consequence_of_inaction, urgency, financial_security_score, image_score, performance_score, dominant_driver, secondary_driver, root_goal_confidence_score, discovery_completed_at'
      )
      .eq('id', goalId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return safeApiError({ code: 'validation_failed', internal: error });
    goal = data;
  }

  let turnsQuery = (supabase as any)
    .from('goal_discovery_turns')
    .select(
      'id, session_id, turn_index, prompt_kind, prompt_text, user_answer, detected_drivers, inferred_root_goal, confidence_after_turn, agent_persona, created_at'
    )
    .eq('user_id', user.id)
    .order('turn_index', { ascending: true });
  if (goalId) turnsQuery = turnsQuery.eq('goal_id', goalId);
  if (sessionId) turnsQuery = turnsQuery.eq('session_id', sessionId);
  const { data: turns, error: tErr } = await turnsQuery;
  if (tErr) return safeApiError({ code: 'validation_failed', internal: tErr });

  return NextResponse.json({ goal, turns: turns ?? [] });
}
