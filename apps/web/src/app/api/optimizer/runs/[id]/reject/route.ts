/**
 * POST /api/optimizer/runs/[id]/reject
 *
 * Marks the run's recommendations rejected. Records a user_decisions
 * row so the rejection is in the User Graph and the engine can learn
 * from it later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

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

  const { data: header, error: hErr } = await sb
    .from('goal_optimizer_runs')
    .select('id, goal_id, next_best_action, summary, engine_version')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (hErr) return safeApiError({ code: 'validation_failed', internal: hErr });
  if (!header) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sb
    .from('goal_optimizer_recommendations')
    .update({ status: 'rejected', rejected_at: now })
    .eq('run_id', run_id)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  await sb.from('user_decisions').insert({
    user_id: user.id,
    goal_id: header.goal_id ?? null,
    decision_type: 'next_dollar_allocation',
    title: `Rejected optimizer plan: ${header.next_best_action ?? run_id.slice(0, 8)}`,
    description: header.summary ?? null,
    chosen_option: { run_id, engine_version: header.engine_version, choice: 'rejected' },
    reversibility: 'reversible',
    status: 'made',
    made_at: now,
    source: 'optimizer',
  });

  return NextResponse.json({ success: true });
}
