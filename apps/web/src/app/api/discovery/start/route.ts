/**
 * POST /api/discovery/start
 *
 * Body: { domain, goal_id?, max_depth? }
 *
 * Opens a new `discovery_session` row + returns the FIRST drill-down
 * prompt for the chosen domain. user_id from the server session only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { selectPrompt } from '@/lib/conversation/domain-prompts';

export const dynamic = 'force-dynamic';

const Body = z.object({
  domain: z.enum(['financial', 'career', 'health', 'education', 'estate', 'general']),
  goal_id: z.string().uuid().optional().nullable(),
  max_depth: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const sb = supabase as any;
  const row = {
    user_id: user.id,
    goal_id: parsed.data.goal_id ?? null,
    domain: parsed.data.domain,
    status: 'active',
    current_depth: 0,
    max_depth: parsed.data.max_depth ?? 3,
    primary_session_token: crypto.randomUUID(),
  };
  const { data: session, error } = await sb
    .from('discovery_sessions')
    .insert(row)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const text = selectPrompt(parsed.data.domain, 'what_accomplish');

  return NextResponse.json({
    session,
    first_prompt: {
      prompt_kind: 'what_accomplish',
      text,
      rationale: 'Drill-down at depth 0; next step is what_accomplish.',
    },
  });
}
