/**
 * Deterministic per-category scoring for the Dynamic Goal Optimizer.
 *
 * Each of the 13 categories is scored against 13 dimensions. The raw
 * sum produces a category-level priority; decision-preference weights
 * then bias the final ranking (e.g. `minimize_stress` boosts
 * emergency_fund + insurance_gap_coverage; `maximize_long_term_net_worth`
 * boosts retirement_match + retirement_contribution).
 *
 * The functions here are pure. The engine in lib/optimizer/engine.ts
 * is responsible for I/O.
 *
 * NOTE: This module produces planning-language scores only. It never
 * recommends specific securities and never frames its output as
 * individualized investment advice.
 */

import type {
  AllocationCategory,
  CategoryScore,
  DimensionScores,
  OptimizerInputs,
  DecisionAxis,
} from '@/types/optimizer';
import { ALL_CATEGORIES } from '@/types/optimizer';

export const ENGINE_VERSION = 'v1';

/** Decision-preference axis → per-category weight boost (multiplicative).
 *  Empty entry == neutral (1.0). */
const AXIS_BOOSTS: Record<DecisionAxis, Partial<Record<AllocationCategory, number>>> = {
  speed: {
    high_interest_debt: 1.3,
    retirement_match: 1.2,
    career_development: 1.2,
  },
  certainty: {
    emergency_fund: 1.3,
    insurance_gap_coverage: 1.25,
    low_interest_debt: 1.1,
  },
  flexibility: {
    emergency_fund: 1.2,
    cash_reserve: 1.15,
    taxable_investing: 1.05,
  },
  upside: {
    retirement_contribution: 1.2,
    taxable_investing: 1.2,
    career_development: 1.1,
    education_investment: 1.05,
  },
  minimize_downside: {
    emergency_fund: 1.3,
    insurance_gap_coverage: 1.25,
    high_interest_debt: 1.15,
  },
  minimize_stress: {
    emergency_fund: 1.35,
    high_interest_debt: 1.2,
    insurance_gap_coverage: 1.2,
  },
  minimize_cost: {
    high_interest_debt: 1.3,
    low_interest_debt: 1.1,
  },
  maximize_long_term_net_worth: {
    retirement_match: 1.4,
    retirement_contribution: 1.3,
    hsa_contribution: 1.25,
    taxable_investing: 1.2,
    education_investment: 1.1,
  },
  maximize_healthspan: {
    hsa_contribution: 1.25,
    insurance_gap_coverage: 1.2,
    health_wellness_investment: 1.4,
  },
  maximize_family_stability: {
    emergency_fund: 1.25,
    insurance_gap_coverage: 1.25,
    home_down_payment_fund: 1.2,
    education_investment: 1.1,
  },
};

function zero(): DimensionScores {
  return {
    net_worth_impact: 0,
    risk_reduction: 0,
    liquidity_improvement: 0,
    goal_alignment: 0,
    timeline_urgency: 0,
    tax_advantage: 0,
    interest_rate_spread: 0,
    behavioral_stress_impact: 0,
    prerequisite_value: 0,
    credit_readiness_impact: 0,
    home_readiness_impact: 0,
    career_income_impact: 0,
    health_cost_prevention_impact: 0,
  };
}

function sum(d: DimensionScores): number {
  return Object.values(d).reduce((a, b) => a + b, 0);
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

// --- per-category scorers ----------------------------------------------

function scoreEmergencyFund(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const months = i.profile?.emergency_fund_months ?? 0;
  if (months < 1) {
    d.risk_reduction = 95;
    d.liquidity_improvement = 90;
    d.behavioral_stress_impact = 90;
    keys.push('no_emergency_fund');
  } else if (months < 3) {
    d.risk_reduction = 80;
    d.liquidity_improvement = 75;
    d.behavioral_stress_impact = 70;
    keys.push('thin_emergency_fund');
  } else if (months < 6) {
    d.risk_reduction = 45;
    d.liquidity_improvement = 40;
    d.behavioral_stress_impact = 35;
    keys.push('partial_emergency_fund');
  } else {
    d.risk_reduction = 5;
    d.liquidity_improvement = 5;
    keys.push('full_emergency_fund');
  }
  d.prerequisite_value = months < 3 ? 70 : 10;
  return finalize('emergency_fund', d, keys, i);
}

function scoreHighInterestDebt(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const high = i.debts.filter((x) => (x.interest_rate ?? 0) >= 0.1 && (x.current_balance ?? 0) > 0);
  if (high.length === 0) return finalize('high_interest_debt', d, ['no_high_apr_debt'], i);
  const maxApr = Math.max(...high.map((x) => x.interest_rate ?? 0));
  d.net_worth_impact = clamp(maxApr * 400); // 22% APR → 88
  d.interest_rate_spread = clamp(maxApr * 400);
  d.behavioral_stress_impact = 60;
  d.credit_readiness_impact =
    i.profile?.credit_card_utilization && i.profile.credit_card_utilization > 30 ? 70 : 25;
  d.risk_reduction = 35;
  d.prerequisite_value = 50;
  keys.push('high_apr_debt_present');
  return finalize('high_interest_debt', d, keys, i);
}

function scoreLowInterestDebt(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const low = i.debts.filter(
    (x) =>
      (x.interest_rate ?? 0) < 0.1 && (x.interest_rate ?? 0) > 0 && (x.current_balance ?? 0) > 0
  );
  if (low.length === 0) return finalize('low_interest_debt', d, ['no_low_apr_debt'], i);
  const avgApr = low.reduce((a, b) => a + (b.interest_rate ?? 0), 0) / low.length;
  // Only meaningfully preferred if APR > ~5% (above long-run "safe" return).
  d.net_worth_impact = clamp(Math.max(0, avgApr - 0.04) * 800);
  d.interest_rate_spread = clamp(Math.max(0, avgApr - 0.04) * 800);
  d.credit_readiness_impact = 15;
  keys.push('low_apr_debt_present');
  return finalize('low_interest_debt', d, keys, i);
}

function scoreRetirementMatch(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const pct = i.profile?.employer_match_percent ?? 0;
  const limitPct = i.profile?.employer_match_limit_percent ?? 0;
  if (pct <= 0 || limitPct <= 0) return finalize('retirement_match', d, ['no_employer_match'], i);
  // Free money — score very high.
  d.net_worth_impact = 95;
  d.tax_advantage = 80;
  d.prerequisite_value = 80;
  d.goal_alignment = 60;
  keys.push('employer_match_available');
  return finalize('retirement_match', d, keys, i);
}

function scoreRetirementContribution(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  // Score baseline; the long-term-net-worth axis amplifies.
  d.net_worth_impact = 70;
  d.tax_advantage = 70;
  d.goal_alignment = 40;
  d.timeline_urgency = 30;
  if (
    i.profile?.estimated_marginal_tax_bracket &&
    i.profile.estimated_marginal_tax_bracket >= 0.24
  ) {
    d.tax_advantage = 85;
    keys.push('higher_bracket');
  }
  if (i.profile?.has_pension) {
    d.net_worth_impact = 50;
    keys.push('has_pension_reduces_need');
  }
  return finalize('retirement_contribution', d, keys, i);
}

function scoreHsaContribution(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  if (!i.profile?.hsa_eligible) return finalize('hsa_contribution', d, ['not_hsa_eligible'], i);
  // Triple-tax-advantaged.
  d.net_worth_impact = 75;
  d.tax_advantage = 95;
  d.health_cost_prevention_impact = 50;
  d.prerequisite_value = 40;
  keys.push('hsa_eligible');
  return finalize('hsa_contribution', d, keys, i);
}

function scoreTaxableInvesting(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  d.net_worth_impact = 60;
  d.liquidity_improvement = 45;
  d.goal_alignment = 30;
  keys.push('taxable_investing_default');
  return finalize('taxable_investing', d, keys, i);
}

function scoreEducationInvestment(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const incomeGap = (i.career?.target_income ?? 0) - (i.career?.current_income ?? 0);
  if (
    i.education?.has_pending_program ||
    incomeGap > 20000 ||
    (i.career?.skill_gaps?.length ?? 0) > 0
  ) {
    d.career_income_impact = clamp(40 + Math.min(50, incomeGap / 2000));
    d.goal_alignment = 60;
    d.timeline_urgency =
      i.education?.credential_urgency === 'within_year'
        ? 80
        : i.education?.credential_urgency === 'within_2_years'
          ? 60
          : 30;
    keys.push('career_or_program_target_present');
  }
  return finalize('education_investment', d, keys, i);
}

function scoreCareerDevelopment(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  if ((i.career?.skill_gaps?.length ?? 0) > 0) {
    d.career_income_impact = 65;
    d.goal_alignment = 50;
    keys.push('declared_skill_gaps');
  }
  if ((i.career?.time_for_upskilling_hours_per_week ?? 0) >= 4) {
    d.prerequisite_value = 30;
    keys.push('upskilling_capacity_available');
  }
  return finalize('career_development', d, keys, i);
}

function scoreInsuranceGap(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const have = new Set(i.insurance.filter((p) => p.is_active).map((p) => p.plan_type));
  if (!have.has('medical')) {
    d.risk_reduction = 95;
    d.health_cost_prevention_impact = 85;
    keys.push('no_medical_plan');
  }
  if (!have.has('long_term_disability') && (i.profile?.annual_income ?? 0) >= 60000) {
    d.risk_reduction = Math.max(d.risk_reduction, 70);
    keys.push('no_disability_with_meaningful_income');
  }
  if (!have.has('life') && (i.profile?.household_annual_income ?? 0) > 0) {
    d.risk_reduction = Math.max(d.risk_reduction, 50);
    keys.push('no_life_with_household_income');
  }
  d.behavioral_stress_impact = d.risk_reduction > 0 ? 40 : 0;
  return finalize('insurance_gap_coverage', d, keys, i);
}

function scoreHealthWellness(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const healthGoal = i.goals.find(
    (g) => g.category === 'health' && (g.urgency === 'high' || g.urgency === 'critical')
  );
  if (healthGoal) {
    d.goal_alignment = 65;
    d.health_cost_prevention_impact = 55;
    d.timeline_urgency = 50;
    keys.push('urgent_health_goal');
  }
  return finalize('health_wellness_investment', d, keys, i);
}

function scoreHomeDownPayment(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = [];
  const homeGoal = i.goals.find(
    (g) => g.category === 'financial' && /home|house|down/i.test(g.title)
  );
  if (homeGoal) {
    d.goal_alignment = 70;
    d.home_readiness_impact = 80;
    d.timeline_urgency = homeGoal.urgency === 'high' || homeGoal.urgency === 'critical' ? 75 : 40;
    keys.push('home_purchase_goal');
  }
  return finalize('home_down_payment_fund', d, keys, i);
}

function scoreCashReserve(i: OptimizerInputs): CategoryScore {
  const d = zero();
  const keys: string[] = ['default_residual_sink'];
  d.liquidity_improvement = 20;
  return finalize('cash_reserve', d, keys, i);
}

const SCORERS: Record<AllocationCategory, (i: OptimizerInputs) => CategoryScore> = {
  emergency_fund: scoreEmergencyFund,
  high_interest_debt: scoreHighInterestDebt,
  low_interest_debt: scoreLowInterestDebt,
  retirement_match: scoreRetirementMatch,
  retirement_contribution: scoreRetirementContribution,
  hsa_contribution: scoreHsaContribution,
  taxable_investing: scoreTaxableInvesting,
  education_investment: scoreEducationInvestment,
  career_development: scoreCareerDevelopment,
  insurance_gap_coverage: scoreInsuranceGap,
  health_wellness_investment: scoreHealthWellness,
  home_down_payment_fund: scoreHomeDownPayment,
  cash_reserve: scoreCashReserve,
};

/** Apply decision-preference weights to the raw category sums. */
function applyDecisionWeights(
  category: AllocationCategory,
  raw: number,
  prefs: OptimizerInputs['decision_preferences']
): number {
  let multiplier = 1.0;
  for (const p of prefs) {
    const boost = AXIS_BOOSTS[p.axis]?.[category];
    if (boost) {
      // Blend toward the boost based on the preference weight (0..1).
      multiplier *= 1 + (boost - 1) * Math.max(0, Math.min(1, p.weight));
    }
  }
  return raw * multiplier;
}

function finalize(
  category: AllocationCategory,
  d: DimensionScores,
  keys: string[],
  i: OptimizerInputs
): CategoryScore {
  const raw = sum(d);
  return {
    category,
    raw_score: raw,
    weighted_score: applyDecisionWeights(category, raw, i.decision_preferences),
    rationale_keys: keys,
    dimensions: d,
  };
}

/** Score every category and return them sorted by weighted_score desc. */
export function scoreAll(i: OptimizerInputs): CategoryScore[] {
  const out = ALL_CATEGORIES.map((c) => SCORERS[c](i));
  return out.sort((a, b) => b.weighted_score - a.weighted_score);
}
