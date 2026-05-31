/**
 * Aggregator that produces the "LifeNavigator Profile Summary" the Final
 * Review screen shows. Reads from the user's full graph using their
 * authenticated session (so RLS does the filtering).
 *
 *   GET /api/onboarding/profile-summary -> UserGraphProfileSummary
 *
 * The summary deliberately does NOT pull anything from health_meta or
 * the encrypted insurance columns — it's a quick at-a-glance review,
 * not a data export.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Driver, UserGraphProfileSummary } from '@/types/discovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb: any = supabase;

  const [
    { data: profile },
    { data: vision },
    { data: goals },
    { data: constraints },
    { data: capabilities },
    { data: risk },
    { data: decisionPrefs },
    { data: commitment },
    { data: motivations },
    { data: financialProfile },
    { data: debts },
    { data: insurance },
    { data: sections },
  ] = await Promise.all([
    sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    sb
      .from('user_life_vision')
      .select('horizon, vision_text')
      .eq('user_id', user.id)
      .order('horizon', { ascending: true }),
    sb
      .from('goals')
      .select(
        'id, title, category, stated_goal, root_goal, success_definition, urgency, dominant_driver, secondary_driver, root_goal_confidence_score, financial_security_score, image_score, performance_score'
      )
      .eq('user_id', user.id)
      .neq('status', 'archived'),
    sb
      .from('user_constraints')
      .select('dimension, severity, description')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(20),
    sb
      .from('user_capabilities')
      .select('capability_name, proficiency_level')
      .eq('user_id', user.id),
    sb
      .from('user_domain_risk_tolerance')
      .select('domain, tolerance_score, qualitative_level')
      .eq('user_id', user.id),
    sb.from('user_decision_preferences').select('axis, weight').eq('user_id', user.id),
    sb.from('user_commitment_levels').select('domain, hours_per_week').eq('user_id', user.id),
    sb
      .from('user_motivations')
      .select('motivation_text, intensity, motivation_type')
      .eq('user_id', user.id),
    sb
      .schema('finance')
      .from('user_financial_profile')
      .select(
        'annual_income, income_stability, employment_type, emergency_fund_amount, emergency_fund_months, credit_score_range'
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    sb.schema('finance').from('debts').select('debt_type, current_balance').eq('user_id', user.id),
    sb
      .from('insurance_plans')
      .select('plan_type, carrier')
      .eq('user_id', user.id)
      .eq('is_active', true),
    sb.from('user_onboarding_sections').select('section, status').eq('user_id', user.id),
  ]);

  const dominantTotals: Record<Driver, number> = {
    financial_security: 0,
    image: 0,
    performance: 0,
  };
  for (const g of goals ?? []) {
    dominantTotals.financial_security += Number(g.financial_security_score ?? 0);
    dominantTotals.image += Number(g.image_score ?? 0);
    dominantTotals.performance += Number(g.performance_score ?? 0);
  }
  const goalCount = Math.max(1, goals?.length ?? 0);
  const dominant_drivers: Record<Driver, number> = {
    financial_security: dominantTotals.financial_security / goalCount,
    image: dominantTotals.image / goalCount,
    performance: dominantTotals.performance / goalCount,
  };

  // Initial opportunities — simple rules derived from intake.
  const opportunities: string[] = [];
  if (
    financialProfile?.emergency_fund_months != null &&
    Number(financialProfile.emergency_fund_months) < 3
  ) {
    opportunities.push('Build a 3–6 month emergency fund.');
  }
  const highApr = (debts ?? []).find((d: any) => d.debt_type === 'credit_card');
  if (highApr) opportunities.push('Prioritize paying down credit-card debt.');
  if ((insurance ?? []).every((p: any) => p.plan_type !== 'medical')) {
    opportunities.push('Review or add a primary medical plan.');
  }
  if ((vision ?? []).length === 0) {
    opportunities.push('Capture a 1-year vision to anchor recommendations.');
  }
  const incompleteSections = (sections ?? [])
    .filter((s: any) => s.status === 'not_started')
    .map((s: any) => s.section);

  // Missing information surfacing.
  const missing: string[] = [];
  if (!financialProfile) missing.push('financial profile (income, expenses, emergency fund)');
  if ((risk ?? []).length === 0) missing.push('per-domain risk tolerance');
  if ((decisionPrefs ?? []).length === 0) missing.push('decision preferences');
  if ((commitment ?? []).length === 0) missing.push('commitment capacity');
  if ((insurance ?? []).length === 0) missing.push('insurance plans');

  const summary: UserGraphProfileSummary = {
    user_id: user.id,
    display_name: profile?.display_name ?? null,
    life_vision: (vision ?? []) as any,
    root_goals: (goals ?? []).map((g: any) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      stated_goal: g.stated_goal,
      root_goal: g.root_goal,
      success_definition: g.success_definition,
      dominant_driver: g.dominant_driver,
      secondary_driver: g.secondary_driver,
      urgency: g.urgency,
      confidence:
        g.root_goal_confidence_score == null ? null : Number(g.root_goal_confidence_score),
    })),
    dominant_drivers,
    major_constraints: (constraints ?? []) as any,
    capabilities: (capabilities ?? []) as any,
    risk_profile: (risk ?? []).map((r: any) => ({
      domain: r.domain,
      tolerance_score: Number(r.tolerance_score),
      qualitative_level: r.qualitative_level,
    })),
    decision_preferences: (decisionPrefs ?? []).map((p: any) => ({
      axis: p.axis,
      weight: Number(p.weight),
    })),
    commitment_levels: (commitment ?? []).map((c: any) => ({
      domain: c.domain,
      hours_per_week: c.hours_per_week == null ? null : Number(c.hours_per_week),
    })),
    motivations: (motivations ?? []) as any,
    initial_opportunities: opportunities,
    missing_information: missing.concat(
      incompleteSections.length > 0
        ? [`onboarding sections not started: ${incompleteSections.join(', ')}`]
        : []
    ),
  };

  return NextResponse.json({ summary });
}
