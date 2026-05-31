/**
 * POST /api/simulations/compare
 *
 * Computes diffs between two completed versions of the same scenario
 * and writes a life_scenario_comparisons row. Both versions must already
 * have outputs; we read them under RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  scenario_id: z.string().uuid(),
  version_a_id: z.string().uuid(),
  version_b_id: z.string().uuid(),
});

interface OutputRow {
  scenario_version_id: string;
  final_net_worth: number | null;
  final_debt: number | null;
  final_annual_income: number | null;
  emergency_fund_months_final: number | null;
  health_cost_exposure_final: number | null;
  retirement_ready: boolean | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { scenario_id, version_a_id, version_b_id } = parsed.data;
  if (version_a_id === version_b_id) {
    return NextResponse.json({ error: 'Cannot compare a version to itself' }, { status: 400 });
  }

  const sb: any = supabase;
  const { data: outs, error } = await sb
    .from('life_scenario_outputs')
    .select(
      'scenario_version_id, final_net_worth, final_debt, final_annual_income, emergency_fund_months_final, health_cost_exposure_final, retirement_ready'
    )
    .in('scenario_version_id', [version_a_id, version_b_id]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!outs || outs.length !== 2) {
    return NextResponse.json(
      { error: 'Both versions must have outputs before comparing' },
      { status: 400 }
    );
  }

  const a = outs.find((o: OutputRow) => o.scenario_version_id === version_a_id);
  const b = outs.find((o: OutputRow) => o.scenario_version_id === version_b_id);
  if (!a || !b) return NextResponse.json({ error: 'Missing one of the versions' }, { status: 400 });

  const diffs: Record<
    string,
    { a: number | boolean | null; b: number | boolean | null; delta_b_minus_a: number | null }
  > = {
    final_net_worth: pair(a.final_net_worth, b.final_net_worth),
    final_debt: pair(a.final_debt, b.final_debt),
    final_annual_income: pair(a.final_annual_income, b.final_annual_income),
    emergency_fund_months_final: pair(a.emergency_fund_months_final, b.emergency_fund_months_final),
    health_cost_exposure_final: pair(a.health_cost_exposure_final, b.health_cost_exposure_final),
    retirement_ready: { a: a.retirement_ready, b: b.retirement_ready, delta_b_minus_a: null },
  };

  // Simple favored-version heuristic: B wins if it leads net worth without
  // a large emergency-fund regression. Tied → balanced.
  let favored: 'a' | 'b' | 'balanced' = 'balanced';
  const nwDelta = (b.final_net_worth ?? 0) - (a.final_net_worth ?? 0);
  const efDelta = (b.emergency_fund_months_final ?? 0) - (a.emergency_fund_months_final ?? 0);
  if (Math.abs(nwDelta) > 1000) {
    favored = nwDelta > 0 && efDelta > -1 ? 'b' : nwDelta < 0 && efDelta < 1 ? 'a' : 'balanced';
  }
  const favored_version_id = favored === 'a' ? version_a_id : favored === 'b' ? version_b_id : null;

  const summary = `Version B vs A: net worth $${Math.round(nwDelta).toLocaleString()} delta, emergency months ${efDelta.toFixed(1)} delta.`;

  const { data: comparison, error: insErr } = await sb
    .from('life_scenario_comparisons')
    .insert({
      user_id: user.id,
      scenario_id,
      version_a_id,
      version_b_id,
      comparison_summary: summary,
      favored_version_id,
      diffs,
      source: 'engine',
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({
    success: true,
    comparison_id: comparison.id,
    summary,
    favored,
    favored_version_id,
    diffs,
  });
}

function pair(a: number | null | undefined, b: number | null | undefined) {
  return {
    a: a ?? null,
    b: b ?? null,
    delta_b_minus_a: a == null || b == null ? null : Number((b - a).toFixed(2)),
  };
}
