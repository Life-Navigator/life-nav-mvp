/**
 * POST /api/discovery/[id]/turn
 *
 * Body: { answer }
 *
 * Records the user's answer, computes the next drill-down step using
 * NeedBehindNeedEngine, scores drivers, and updates the session.
 * Returns the next prompt or — if the drill-down has terminated —
 * the inferred root goal + driver summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { buildDrillDown } from '@/lib/conversation/need-behind-need-engine';
import { inferDrivers } from '@/lib/conversation/driver-inference-engine';
import type { DiscoveryDomain, DriverScores, PromptKind } from '@/types/conversation-intel';

export const dynamic = 'force-dynamic';

const Body = z.object({
  answer: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const sb = supabase as any;

  // 1. Load session.
  const { data: session } = await sb
    .from('discovery_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.status !== 'active')
    return NextResponse.json({ error: 'Session is not active' }, { status: 409 });

  // 2. Load prior turns from goal_discovery_turns by session_token.
  const token = session.primary_session_token as string | null;
  const priorTurns: Array<{ prompt_kind: PromptKind; user_answer: string | null }> = [];
  if (token) {
    const { data: turns } = await sb
      .from('goal_discovery_turns')
      .select('prompt_kind, user_answer, turn_index')
      .eq('user_id', user.id)
      .eq('session_id', token)
      .order('turn_index', { ascending: true });
    for (const t of turns ?? []) {
      priorTurns.push({
        prompt_kind: t.prompt_kind as PromptKind,
        user_answer: t.user_answer ?? '',
      });
    }
  }

  // 3. Build the full drill-down history including the new answer.
  const turnIndex = priorTurns.length;
  const nextKind: PromptKind = nextKindFor(turnIndex);
  const history = [
    ...priorTurns.map((t) => ({ prompt_kind: t.prompt_kind, answer: t.user_answer ?? '' })),
    { prompt_kind: nextKind, answer: parsed.data.answer },
  ];
  const drill = buildDrillDown({
    domain: session.domain as DiscoveryDomain,
    history,
    max_depth: session.max_depth ?? 3,
  });

  // 4. Score drivers across the cumulative session.
  const driversList: DriverScores[] = drill.nodes.map((n) => n.drivers_at_node);
  const cumulative = inferDrivers({ current_text: '', prior_per_turn_scores: driversList });

  // 5. Persist the new turn into goal_discovery_turns.
  if (token) {
    await sb.from('goal_discovery_turns').insert({
      user_id: user.id,
      goal_id: session.goal_id,
      session_id: token,
      turn_index: turnIndex,
      prompt_kind: nextKind,
      prompt_text: nextKind, // exact text in agent response
      user_answer: parsed.data.answer,
      detected_drivers: drill.nodes[turnIndex]?.drivers_at_node ?? {},
      inferred_root_goal: drill.inferred_root_goal ?? null,
      confidence_after_turn: drill.inferred_root_confidence ?? cumulative.confidence,
      agent_persona: 'advisor_conversation',
      source: 'discovery_api',
    });
  }

  // 6. Update the session row.
  const updates = {
    current_depth: drill.nodes.length,
    financial_security_score: cumulative.cumulative.financial_security,
    image_score: cumulative.cumulative.image,
    performance_score: cumulative.cumulative.performance,
    dominant_driver: cumulative.dominant ?? null,
    secondary_driver: cumulative.secondary ?? null,
    driver_confidence: cumulative.confidence,
    inferred_root_goal: drill.inferred_root_goal ?? null,
    inferred_root_goal_confidence: drill.inferred_root_confidence ?? null,
    status: drill.next_prompt ? 'active' : 'completed',
    completed_at: drill.next_prompt ? null : new Date().toISOString(),
  };
  await sb.from('discovery_sessions').update(updates).eq('id', sessionId);

  return NextResponse.json({
    next_prompt: drill.next_prompt,
    drill_down_so_far: drill,
    driver_summary: {
      cumulative: cumulative.cumulative,
      dominant: cumulative.dominant,
      secondary: cumulative.secondary,
      confidence: cumulative.confidence,
    },
    session_state: { ...session, ...updates },
  });
}

function nextKindFor(turnIndex: number): PromptKind {
  if (turnIndex === 0) return 'what_accomplish';
  if (turnIndex === 1) return 'what_unlock';
  return 'why_important';
}
