/**
 * POST /api/optimizer/runs/[id]/accept
 *
 * Marks every pending recommendation on the run as accepted, then
 * creates a `user_decisions` row (so the User Graph has a record of the
 * decision) and a `user_actions` row (so the Decision Engine can later
 * attribute outcomes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: run_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(run_id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const sb: any = supabase;
  const now = new Date().toISOString();

  // 1. The run row.
  const { data: header, error: hErr } = await sb
    .from('goal_optimizer_runs')
    .select('id, goal_id, summary, next_best_action, monthly_surplus, engine_version')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 400 });
  if (!header) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 2. Flip pending recommendations to accepted.
  await sb
    .from('goal_optimizer_recommendations')
    .update({ status: 'accepted', accepted_at: now })
    .eq('run_id', run_id)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  // 3. Record a user_decisions row.
  const { data: decision } = await sb
    .from('user_decisions')
    .insert({
      user_id: user.id,
      goal_id: header.goal_id ?? null,
      decision_type: 'next_dollar_allocation',
      title: header.next_best_action ?? `Accepted optimizer run ${run_id.slice(0, 8)}`,
      description: header.summary ?? null,
      chosen_option: { run_id, engine_version: header.engine_version },
      reversibility: 'partial',
      status: 'made',
      made_at: now,
      source: 'optimizer',
    })
    .select('id')
    .single();

  // 4. Record a user_actions row tying back to the run + decision.
  await sb.from('user_actions').insert({
    user_id: user.id,
    domain: 'financial',
    action_type: 'accepted_next_dollar_plan',
    action_title: header.next_best_action ?? 'Accepted optimizer plan',
    decision_id: decision?.id ?? null,
    taken_at: now,
    cost_amount: header.monthly_surplus ?? null,
    status: 'planned',
    source: 'optimizer',
  });

  return NextResponse.json({ success: true });
}
