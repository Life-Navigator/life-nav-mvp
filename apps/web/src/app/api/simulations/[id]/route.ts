/**
 * GET /api/simulations/[id]
 *
 * Returns the scenario, every version, the outputs row, and a metric
 * series for net worth / debt / cash flow that the UI can chart.
 * RLS handles the user filter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CHARTABLE_KEYS = ['net_worth', 'total_debt', 'monthly_cash_flow', 'emergency_months'];

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

  const [{ data: scenario }, { data: versions }] = await Promise.all([
    sb
      .from('life_scenarios')
      .select('id, title, description, status, primary_goal_id, metadata, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    sb
      .from('life_scenario_versions')
      .select('id, version_index, label, horizon_years, status, ran_at')
      .eq('scenario_id', id)
      .eq('user_id', user.id)
      .order('version_index'),
  ]);
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const versionIds = (versions ?? []).map((v: any) => v.id);
  if (versionIds.length === 0) {
    return NextResponse.json({ scenario, versions: [], outputs: [], metrics: [], comparisons: [] });
  }

  const [{ data: outputs }, { data: metrics }, { data: comparisons }] = await Promise.all([
    sb
      .from('life_scenario_outputs')
      .select(
        'scenario_version_id, final_net_worth, final_debt, final_annual_income, emergency_fund_months_final, health_cost_exposure_final, retirement_ready, recommended, rationale, risks, upside_factors'
      )
      .in('scenario_version_id', versionIds),
    sb
      .from('life_scenario_metrics')
      .select('scenario_version_id, at_month, metric_key, metric_value')
      .in('scenario_version_id', versionIds)
      .in('metric_key', CHARTABLE_KEYS)
      .order('at_month', { ascending: true }),
    sb
      .from('life_scenario_comparisons')
      .select(
        'id, version_a_id, version_b_id, comparison_summary, favored_version_id, diffs, created_at'
      )
      .eq('scenario_id', id)
      .eq('user_id', user.id),
  ]);

  return NextResponse.json({
    scenario,
    versions: versions ?? [],
    outputs: outputs ?? [],
    metrics: metrics ?? [],
    comparisons: comparisons ?? [],
  });
}
