/**
 * GET /api/optimizer/runs/[id]
 *
 * Returns the full run: header + interpretation + inputs + assumptions
 * + allocations + tradeoffs + recommendations. RLS handles the user
 * filter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const sb: any = supabase;
  const [
    { data: header, error: hErr },
    { data: inputs },
    { data: assumptions },
    { data: allocations },
    { data: tradeoffs },
    { data: recommendations },
  ] = await Promise.all([
    sb
      .from('goal_optimizer_runs')
      .select(
        'id, user_id, goal_id, interpretation_id, status, engine_version, monthly_surplus, total_allocation, next_best_action, summary, confidence_score, created_at'
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    sb.from('goal_optimizer_inputs').select('inputs').eq('run_id', id).maybeSingle(),
    sb
      .from('goal_optimizer_assumptions')
      .select('assumption_key, assumption_value, rationale')
      .eq('run_id', id),
    sb
      .from('goal_optimizer_allocations')
      .select('category, amount_usd, share_pct, priority, rationale, category_score')
      .eq('run_id', id)
      .order('amount_usd', { ascending: false }),
    sb
      .from('goal_optimizer_tradeoffs')
      .select('axis_a, axis_b, tradeoff_summary, favored_axis')
      .eq('run_id', id),
    sb
      .from('goal_optimizer_recommendations')
      .select('id, title, body, status, accepted_at, rejected_at, confidence_score')
      .eq('run_id', id),
  ]);

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 400 });
  if (!header) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    run: header,
    inputs: inputs?.inputs ?? null,
    assumptions: assumptions ?? [],
    allocations: allocations ?? [],
    tradeoffs: tradeoffs ?? [],
    recommendations: recommendations ?? [],
  });
}
