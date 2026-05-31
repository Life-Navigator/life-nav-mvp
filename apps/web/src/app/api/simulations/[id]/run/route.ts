/**
 * POST /api/simulations/[id]/run
 *
 * Loads the user's snapshot, generates a strategy per version using the
 * version's label, projects forward, and persists:
 *   life_scenario_outputs   (one per version)
 *   life_scenario_metrics   (one per version × month × metric_key)
 *   life_scenario_events    (one per scheduled decision firing)
 *   life_scenario_assumptions (per-version frozen assumption set)
 *
 * Versions are flipped to status='completed' / 'failed' as they finish.
 * Returns a short summary; full results are read via GET /api/simulations/[id].
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildBaseStateForUser } from '@/lib/trajectory/inputs';
import { buildVariant } from '@/lib/trajectory/generator';
import { project } from '@/lib/trajectory/projector';
import type { ScenarioLabel } from '@/types/trajectory';

export const dynamic = 'force-dynamic';

const METRIC_KEYS = [
  'net_worth',
  'cash',
  'taxable_investments',
  'retirement_balance',
  'hsa_balance',
  'total_debt',
  'emergency_months',
  'annual_income',
  'monthly_cash_flow',
  'health_cost_exposure',
] as const;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: scenarioId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(scenarioId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const sb: any = supabase;

  // Load scenario + versions.
  const [{ data: scenario }, { data: versions }] = await Promise.all([
    sb
      .from('life_scenarios')
      .select('id, title, metadata')
      .eq('id', scenarioId)
      .eq('user_id', user.id)
      .maybeSingle(),
    sb
      .from('life_scenario_versions')
      .select('id, label, version_index, horizon_years')
      .eq('scenario_id', scenarioId)
      .eq('user_id', user.id)
      .order('version_index'),
  ]);
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!versions || versions.length === 0) {
    return NextResponse.json({ error: 'Scenario has no versions to run' }, { status: 400 });
  }

  const stated_goal: string | null = (scenario.metadata?.stated_goal as string) ?? null;
  // We use the longest horizon across versions to build the base state.
  const maxHorizonYears = Math.max(...versions.map((v: any) => Number(v.horizon_years)));
  const baseState = await buildBaseStateForUser(supabase, user.id, {
    horizon_years: maxHorizonYears,
  });

  const summaries: Array<{
    version_id: string;
    label: string;
    final_net_worth: number;
    final_debt: number;
    final_emergency_months: number;
  }> = [];

  // Run each version sequentially. They are independent — we keep this
  // sequential to bound concurrent DB writes; horizon×months×metric_keys
  // is the biggest row driver.
  for (const v of versions) {
    await sb.from('life_scenario_versions').update({ status: 'simulating' }).eq('id', v.id);

    try {
      const baseForVersion = {
        ...baseState,
        horizon_months: Math.max(1, Math.min(720, Number(v.horizon_years) * 12)),
      };
      const variant = buildVariant(
        v.label as ScenarioLabel,
        baseForVersion,
        estimateSurplus(baseForVersion),
        {
          stated_goal,
        }
      );
      const output = project(variant.state, variant.decisions);

      // Outputs row.
      await sb.from('life_scenario_outputs').upsert(
        {
          user_id: user.id,
          scenario_version_id: v.id,
          final_net_worth: output.final_net_worth,
          final_debt: output.final_debt,
          final_annual_income: output.final_annual_income,
          retirement_ready: output.retirement_ready,
          emergency_fund_months_final: output.final_emergency_months,
          health_cost_exposure_final: output.final_health_cost_exposure,
          recommended: false,
          rationale: output.rationale,
          risks: output.risks,
          upside_factors: output.upside_factors,
          source: 'engine',
          confidence_score: 0.5,
        },
        { onConflict: 'scenario_version_id' }
      );

      // Metrics rows — sample at most ~120 points per metric to keep volume sane.
      const sampled = sampleMetrics(output.metrics, 120);
      const metricRows: Array<Record<string, unknown>> = [];
      for (const point of sampled) {
        for (const key of METRIC_KEYS) {
          const val = (point as any)[key];
          if (val == null || !Number.isFinite(val)) continue;
          metricRows.push({
            user_id: user.id,
            scenario_version_id: v.id,
            at_month: point.at_month,
            metric_key: key,
            metric_value: val,
            source: 'engine',
          });
        }
      }
      if (metricRows.length > 0) {
        // upsert by the table's UNIQUE(scenario_version_id, at_month, metric_key)
        await sb.from('life_scenario_metrics').upsert(metricRows, {
          onConflict: 'scenario_version_id,at_month,metric_key',
        });
      }

      // Events.
      if (output.events.length > 0) {
        await sb.from('life_scenario_events').insert(
          output.events.map((e) => ({
            user_id: user.id,
            scenario_version_id: v.id,
            at_month: e.at_month,
            event_type: e.event_type,
            description: e.description,
            impact: e.impact,
            source: 'engine',
          }))
        );
      }

      // Assumptions.
      if (output.assumptions.length > 0) {
        await sb.from('life_scenario_assumptions').upsert(
          output.assumptions.map((a) => ({
            user_id: user.id,
            scenario_version_id: v.id,
            assumption_key: a.key,
            assumption_value: a.value as unknown,
            rationale: a.rationale,
            source: 'engine',
          })),
          { onConflict: 'scenario_version_id,assumption_key' }
        );
      }

      await sb
        .from('life_scenario_versions')
        .update({ status: 'completed', ran_at: new Date().toISOString() })
        .eq('id', v.id);

      summaries.push({
        version_id: v.id,
        label: v.label,
        final_net_worth: output.final_net_worth,
        final_debt: output.final_debt,
        final_emergency_months: output.final_emergency_months,
      });
    } catch (e) {
      await sb.from('life_scenario_versions').update({ status: 'failed' }).eq('id', v.id);
      summaries.push({
        version_id: v.id,
        label: v.label,
        final_net_worth: NaN,
        final_debt: NaN,
        final_emergency_months: NaN,
      });
    }
  }

  // Mark the parent scenario active once at least one version completes.
  await sb.from('life_scenarios').update({ status: 'active' }).eq('id', scenarioId);

  // Snapshot the user's current trajectory (a separate dashboard read).
  // We use the current_behavior version's month-0 numbers as the snapshot.
  const cb = summaries[0];
  if (cb) {
    await sb.from('life_trajectory_snapshots').insert({
      user_id: user.id,
      net_worth: cb.final_net_worth,
      total_debt: cb.final_debt,
      emergency_months: cb.final_emergency_months,
      source: 'engine',
    });
  }

  return NextResponse.json({ success: true, scenario_id: scenarioId, summaries });
}

function estimateSurplus(s: ReturnType<typeof emptySurplusFor>): number {
  // Same surplus estimate the generator uses; duplicated here so callers
  // don't have to import generator internals.
  const surplus =
    s.monthly_take_home -
    s.monthly_expenses -
    s.monthly_retirement_contribution -
    s.monthly_hsa_contribution -
    s.monthly_taxable_investing -
    s.monthly_emergency_fund_topup -
    s.monthly_extra_debt_payment;
  return Math.max(0, Math.round(surplus));
}

function emptySurplusFor(_unused?: never) {
  return {
    monthly_take_home: 0,
    monthly_expenses: 0,
    monthly_retirement_contribution: 0,
    monthly_hsa_contribution: 0,
    monthly_taxable_investing: 0,
    monthly_emergency_fund_topup: 0,
    monthly_extra_debt_payment: 0,
  };
}

function sampleMetrics<T extends { at_month: number }>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const out: T[] = [];
  const step = points.length / maxPoints;
  // Always include first and last.
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(points.length - 1, Math.floor(i * step));
    out.push(points[idx]);
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
