/**
 * Dynamic Goal Optimizer — orchestrator.
 *
 *   loadInputs(supabase, userId, surplus, goalId?)  reads everything the
 *                                                     scorer needs.
 *   inferTrueGoal(inputs)                            deterministic
 *                                                     surface→root goal mapper.
 *   buildAllocation(scores, surplus)                 normalizes scored
 *                                                     categories to the
 *                                                     given monthly surplus.
 *   buildTradeoffs(scores)                           pairwise tradeoffs the
 *                                                     UI shows.
 *   buildNextBestAction(allocations)                 single line of
 *                                                     guidance.
 *   run(...)                                         top-level convenience.
 *
 * The engine is LLM-agnostic. The `inferTrueGoal` function is the natural
 * plug-in point for an LLM-driven goal-rewriter.
 */

import { scoreAll, ENGINE_VERSION } from './scoring';
import type {
  AllocationCategory,
  AssumptionNote,
  CategoryScore,
  OptimizerAllocation,
  OptimizerInputs,
  OptimizerOutput,
  TradeoffNote,
} from '@/types/optimizer';

// --- Input loading -----------------------------------------------------

export async function loadInputs(
  supabase: unknown,
  userId: string,
  monthly_surplus: number,
  options: { goal_id?: string | null; stated_goal?: string | null } = {}
): Promise<OptimizerInputs> {
  const sb: any = supabase;

  const [
    { data: profile },
    { data: debts },
    { data: insurance },
    { data: risk },
    { data: prefs },
    { data: career },
    { data: education },
    { data: goals },
  ] = await Promise.all([
    sb
      .schema('finance')
      .from('user_financial_profile')
      .select(
        'annual_income, household_annual_income, monthly_expenses, monthly_discretionary_income, emergency_fund_amount, emergency_fund_months, credit_score_range, credit_card_utilization, hsa_eligible, hsa_current_balance, fsa_eligible, employer_match_percent, employer_match_limit_percent, has_pension, estimated_marginal_tax_bracket'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    sb
      .schema('finance')
      .from('debts')
      .select('debt_type, current_balance, interest_rate, minimum_payment')
      .eq('user_id', userId)
      .eq('is_active', true),
    sb.from('insurance_plans').select('plan_type, is_active').eq('user_id', userId),
    sb.from('user_domain_risk_tolerance').select('domain, tolerance_score').eq('user_id', userId),
    sb.from('user_decision_preferences').select('axis, weight').eq('user_id', userId),
    sb
      .from('career_profiles')
      .select('current_income, target_income, skill_gaps, time_for_upskilling_hours_per_week')
      .eq('user_id', userId)
      .maybeSingle(),
    sb
      .from('education_intake')
      .select('current_program, tuition_budget_annual, expected_roi_preference, credential_urgency')
      .eq('user_id', userId)
      .maybeSingle(),
    sb
      .from('goals')
      .select(
        'id, category, title, stated_goal, root_goal, dominant_driver, urgency, target_value, status'
      )
      .eq('user_id', userId)
      .neq('status', 'archived'),
  ]);

  const careerInput = career
    ? {
        current_income: career.current_income != null ? Number(career.current_income) : null,
        target_income: career.target_income != null ? Number(career.target_income) : null,
        skill_gaps: (career.skill_gaps ?? []) as string[],
        time_for_upskilling_hours_per_week:
          career.time_for_upskilling_hours_per_week != null
            ? Number(career.time_for_upskilling_hours_per_week)
            : null,
      }
    : null;

  return {
    monthly_surplus,
    user_goal_id: options.goal_id ?? null,
    stated_goal: options.stated_goal ?? null,
    profile: profile
      ? {
          annual_income: numOrNull(profile.annual_income),
          household_annual_income: numOrNull(profile.household_annual_income),
          monthly_expenses: numOrNull(profile.monthly_expenses),
          monthly_discretionary_income: numOrNull(profile.monthly_discretionary_income),
          emergency_fund_amount: numOrNull(profile.emergency_fund_amount),
          emergency_fund_months: numOrNull(profile.emergency_fund_months),
          credit_score_range: profile.credit_score_range ?? null,
          credit_card_utilization: numOrNull(profile.credit_card_utilization),
          hsa_eligible: profile.hsa_eligible ?? null,
          hsa_current_balance: numOrNull(profile.hsa_current_balance),
          fsa_eligible: profile.fsa_eligible ?? null,
          employer_match_percent: numOrNull(profile.employer_match_percent),
          employer_match_limit_percent: numOrNull(profile.employer_match_limit_percent),
          has_pension: profile.has_pension ?? null,
          estimated_marginal_tax_bracket: numOrNull(profile.estimated_marginal_tax_bracket),
        }
      : null,
    debts: ((debts ?? []) as Array<any>).map((d) => ({
      debt_type: d.debt_type,
      current_balance: Number(d.current_balance ?? 0),
      interest_rate: d.interest_rate != null ? Number(d.interest_rate) : null,
      minimum_payment: d.minimum_payment != null ? Number(d.minimum_payment) : null,
    })),
    insurance: ((insurance ?? []) as Array<any>).map((p) => ({
      plan_type: p.plan_type,
      is_active: !!p.is_active,
    })),
    risk: ((risk ?? []) as Array<any>).map((r) => ({
      domain: r.domain,
      tolerance_score: Number(r.tolerance_score),
    })),
    decision_preferences: ((prefs ?? []) as Array<any>).map((p) => ({
      axis: p.axis,
      weight: Number(p.weight),
    })),
    career: careerInput,
    education: education
      ? {
          has_pending_program: !!education.current_program,
          tuition_budget_annual: numOrNull(education.tuition_budget_annual),
          expected_roi_preference: education.expected_roi_preference ?? null,
          credential_urgency: education.credential_urgency ?? null,
        }
      : null,
    goals: ((goals ?? []) as Array<any>).map((g) => ({
      id: g.id,
      category: g.category,
      title: g.title,
      stated_goal: g.stated_goal,
      root_goal: g.root_goal,
      dominant_driver: g.dominant_driver,
      urgency: g.urgency,
      target_value: numOrNull(g.target_value),
    })),
  };
}

// --- True goal inference (deterministic stub; LLM plug-in point) ------

export function inferTrueGoal(inputs: OptimizerInputs): {
  stated_goal: string;
  inferred_true_goal: string;
  confidence: number;
} {
  // Prefer the explicit stated_goal from the run request; else fall back
  // to the goal row's stated_goal; else "increase financial security".
  const goalRow = inputs.user_goal_id
    ? inputs.goals.find((g) => g.id === inputs.user_goal_id)
    : null;
  const stated =
    inputs.stated_goal?.trim() ||
    goalRow?.stated_goal ||
    goalRow?.title ||
    'Improve my financial position';

  // Heuristic mapping from surface goals to underlying intents.
  let inferred = goalRow?.root_goal ?? stated;
  let confidence = goalRow?.root_goal ? 0.75 : 0.45;

  const s = stated.toLowerCase();
  if (/pay\s*(off|down).*(debt|card|loan|balance)/.test(s) || /\bget\s+out\s+of\s+debt\b/.test(s)) {
    inferred = 'Reduce financial fragility and free up monthly cash flow';
    confidence = 0.7;
  } else if (/(home|house|down\s*payment)/.test(s)) {
    inferred = 'Reach the down-payment threshold without compromising other goals';
    confidence = 0.7;
  } else if (/(retire|financial\s*independence|\bfi\b)/.test(s)) {
    inferred = 'Build a portfolio that covers expenses indefinitely';
    confidence = 0.7;
  } else if (/save\s*more|build\s*savings|emergency/.test(s)) {
    inferred = 'Increase cash reserves to absorb shocks';
    confidence = 0.7;
  } else if (/invest/.test(s)) {
    inferred = 'Grow long-term net worth while respecting risk tolerance';
    confidence = 0.65;
  }

  return { stated_goal: stated, inferred_true_goal: inferred, confidence };
}

// --- Allocation normalization ------------------------------------------

const HARD_PRIORITY_ORDER: AllocationCategory[] = [
  // Hard priorities — if scored, they get capped first-dollar allocations
  // before the proportional split runs over the remainder.
  'emergency_fund',
  'high_interest_debt',
  'retirement_match',
  'insurance_gap_coverage',
];

const HARD_PRIORITY_CAP_PCT: Record<AllocationCategory, number> = {
  emergency_fund: 0.6, // up to 60% of surplus until topped up
  high_interest_debt: 0.5,
  retirement_match: 0.4,
  insurance_gap_coverage: 0.3,
  // others fall through to proportional split.
} as Partial<Record<AllocationCategory, number>> as Record<AllocationCategory, number>;

/**
 * Build the dollar allocation. Approach:
 *   1. Walk hard priorities in order. If a category is scored above a
 *      threshold, take its capped share of `surplus` first.
 *   2. Distribute the remainder proportionally to the remaining
 *      categories' weighted scores.
 *   3. Round to whole dollars; absorb any rounding drift into cash_reserve.
 */
export function buildAllocation(scores: CategoryScore[], surplus: number): OptimizerAllocation[] {
  if (surplus <= 0) return [];

  const byCat = new Map<AllocationCategory, CategoryScore>();
  for (const s of scores) byCat.set(s.category, s);

  let remaining = surplus;
  const dollars: Partial<Record<AllocationCategory, number>> = {};

  // Hard-priority first-dollar allocations.
  for (const cat of HARD_PRIORITY_ORDER) {
    const s = byCat.get(cat);
    if (!s || s.weighted_score < 40) continue;
    const cap = HARD_PRIORITY_CAP_PCT[cat] ?? 0.2;
    // Scale within the cap by how strong the weighted_score is (40 → 0.4 of cap, 100+ → full cap).
    const intensity = Math.max(0, Math.min(1, (s.weighted_score - 40) / 60));
    const target = surplus * cap * intensity;
    const take = Math.min(target, remaining);
    if (take > 0) {
      dollars[cat] = (dollars[cat] ?? 0) + take;
      remaining -= take;
    }
  }

  // Proportional split of the remainder across the *positive* scored
  // categories that aren't already capped to zero.
  if (remaining > 0) {
    const eligible = scores.filter((s) => s.weighted_score > 0);
    const totalScore = eligible.reduce((a, b) => a + b.weighted_score, 0);
    if (totalScore > 0) {
      for (const s of eligible) {
        const share = (s.weighted_score / totalScore) * remaining;
        dollars[s.category] = (dollars[s.category] ?? 0) + share;
      }
    } else {
      // Nothing scored — park in cash_reserve as a safe default.
      dollars.cash_reserve = (dollars.cash_reserve ?? 0) + remaining;
    }
  }

  // Round to whole dollars; absorb drift into cash_reserve.
  let totalRounded = 0;
  const rounded: Partial<Record<AllocationCategory, number>> = {};
  for (const [cat, amt] of Object.entries(dollars) as Array<[AllocationCategory, number]>) {
    const v = Math.round(amt);
    if (v > 0) {
      rounded[cat] = v;
      totalRounded += v;
    }
  }
  const drift = surplus - totalRounded;
  if (Math.abs(drift) >= 1) {
    rounded.cash_reserve = (rounded.cash_reserve ?? 0) + drift;
    if ((rounded.cash_reserve ?? 0) <= 0) delete rounded.cash_reserve;
  }

  const allocations: OptimizerAllocation[] = [];
  for (const [cat, amt] of Object.entries(rounded) as Array<[AllocationCategory, number]>) {
    if (!amt || amt <= 0) continue;
    const s = byCat.get(cat)!;
    allocations.push({
      category: cat,
      amount_usd: amt,
      share_pct: Math.round((amt / surplus) * 10000) / 100,
      priority: Math.round(Math.min(100, s.weighted_score)),
      rationale: rationaleFor(s),
      category_score: Math.round(s.weighted_score * 100) / 100,
    });
  }
  allocations.sort((a, b) => b.amount_usd - a.amount_usd);
  return allocations;
}

function rationaleFor(s: CategoryScore): string {
  const map: Record<string, string> = {
    no_emergency_fund:
      'Building a cushion before anything else preserves choice when things go sideways.',
    thin_emergency_fund:
      'Your emergency fund is still thin; closing the 3-month gap is high-leverage.',
    partial_emergency_fund: 'Topping up to 6 months adds resilience without much downside.',
    full_emergency_fund:
      'Your emergency fund looks complete — additional dollars are better placed elsewhere.',
    high_apr_debt_present:
      'High-APR debt is the highest guaranteed return available; clearing it compounds in your favor.',
    no_high_apr_debt: 'No high-APR debt to attack right now.',
    low_apr_debt_present: 'Low-APR debt is rarely worth paying off ahead of higher-return uses.',
    employer_match_available:
      'Capturing your employer match is the closest thing to a guaranteed return you can get.',
    no_employer_match: 'No employer match available on this plan.',
    higher_bracket: 'Your marginal bracket makes tax-advantaged contributions especially valuable.',
    has_pension_reduces_need: 'Your pension already covers part of the retirement need.',
    hsa_eligible: 'HSA dollars are triple-tax-advantaged when invested through retirement.',
    not_hsa_eligible: 'Not HSA-eligible on the current plan.',
    no_medical_plan:
      'A primary medical plan is foundational coverage — closing this gap is the biggest single risk reduction.',
    no_disability_with_meaningful_income:
      'Long-term disability insurance protects the asset that funds everything else: your income.',
    no_life_with_household_income:
      'With household income to protect, a basic life policy can take a major worry off the table.',
    urgent_health_goal:
      'A health goal you marked as high-urgency suggests investing here pays off across other domains.',
    home_purchase_goal:
      'You declared a home-purchase goal — directing surplus toward the down-payment moves it forward.',
    career_or_program_target_present:
      'A pending program or income-gap goal benefits from a steady education line item.',
    declared_skill_gaps:
      'You named specific skill gaps; closing them tends to compound through career earnings.',
    upskilling_capacity_available:
      'You have time on the calendar for upskilling — small consistent investment goes a long way.',
    taxable_investing_default:
      'Once priorities are satisfied, taxable investing keeps the surplus growing with liquidity.',
    default_residual_sink:
      'Any rounding drift parks here so the total matches your surplus exactly.',
  };
  const keys = s.rationale_keys.length ? s.rationale_keys : ['default_residual_sink'];
  return keys.map((k) => map[k] ?? k).join(' ');
}

// --- Tradeoffs ---------------------------------------------------------

export function buildTradeoffs(allocations: OptimizerAllocation[]): TradeoffNote[] {
  const byCat = new Map<AllocationCategory, OptimizerAllocation>();
  for (const a of allocations) byCat.set(a.category, a);
  const t: TradeoffNote[] = [];

  if (byCat.has('high_interest_debt') && byCat.has('taxable_investing')) {
    const a = byCat.get('high_interest_debt')!;
    const b = byCat.get('taxable_investing')!;
    t.push({
      axis_a: 'high_interest_debt',
      axis_b: 'taxable_investing',
      summary:
        'Paying high-APR debt is a guaranteed return at your APR; taxable investing is a probabilistic return at market rates with downside risk.',
      favored_axis: a.priority >= b.priority ? 'a' : 'b',
    });
  }
  if (byCat.has('retirement_match') && byCat.has('high_interest_debt')) {
    t.push({
      axis_a: 'retirement_match',
      axis_b: 'high_interest_debt',
      summary:
        'Capturing the employer match before paying down high-APR debt is usually correct because the match is an immediate dollar-for-dollar return.',
      favored_axis: 'a',
    });
  }
  if (byCat.has('emergency_fund') && byCat.has('retirement_contribution')) {
    t.push({
      axis_a: 'emergency_fund',
      axis_b: 'retirement_contribution',
      summary:
        'A thin emergency fund makes retirement contributions fragile — a small cushion first preserves the long-term contribution stream.',
      favored_axis: 'a',
    });
  }
  if (byCat.has('hsa_contribution') && byCat.has('retirement_contribution')) {
    t.push({
      axis_a: 'hsa_contribution',
      axis_b: 'retirement_contribution',
      summary:
        'HSA dollars are triple-tax-advantaged when invested for healthcare in retirement; they often outrank traditional 401(k) dollars beyond the match.',
      favored_axis: 'a',
    });
  }
  return t;
}

// --- Next best action --------------------------------------------------

export function buildNextBestAction(allocations: OptimizerAllocation[]): string {
  if (allocations.length === 0) return 'Set a monthly surplus to receive an allocation plan.';
  const top = allocations[0];
  const labels: Record<AllocationCategory, string> = {
    emergency_fund: 'top up your emergency fund',
    high_interest_debt: 'attack your highest-APR debt',
    low_interest_debt: 'pay down low-APR debt',
    retirement_match: 'contribute to capture your employer match',
    retirement_contribution: 'contribute to a tax-advantaged retirement account',
    hsa_contribution: 'contribute to your HSA',
    taxable_investing: 'invest in a taxable brokerage account',
    education_investment: 'invest in a pending program or credential',
    career_development: 'invest in closing your declared skill gaps',
    insurance_gap_coverage: 'close your most material insurance gap',
    health_wellness_investment: 'invest in health and wellness aligned to your goal',
    home_down_payment_fund: 'build your down-payment fund',
    cash_reserve: 'park dollars in a high-yield cash reserve',
  };
  return `This month, direct $${top.amount_usd.toLocaleString()} to ${labels[top.category]}.`;
}

// --- Top-level runner --------------------------------------------------

export function run(inputs: OptimizerInputs): OptimizerOutput {
  const { stated_goal, inferred_true_goal, confidence } = inferTrueGoal(inputs);
  const scores = scoreAll(inputs);
  const allocations = buildAllocation(scores, inputs.monthly_surplus);
  const tradeoffs = buildTradeoffs(allocations);
  const assumptions = buildAssumptions(inputs);
  const summary = buildSummary(inferred_true_goal, allocations);
  return {
    stated_goal,
    inferred_true_goal,
    confidence,
    monthly_surplus: inputs.monthly_surplus,
    allocations,
    tradeoffs,
    assumptions,
    summary,
    next_best_action: buildNextBestAction(allocations),
    engine_version: ENGINE_VERSION,
  };
}

function buildAssumptions(inputs: OptimizerInputs): AssumptionNote[] {
  return [
    {
      key: 'planning_language_only',
      value: true,
      rationale:
        'This plan is presented in planning language and is not a recommendation of specific securities, products, or individualized investment advice.',
    },
    {
      key: 'expected_return_long_term_pct',
      value: 0.07,
      rationale:
        'Long-run real-return assumption used to compare paying down low-APR debt vs investing. Conservative for diversified portfolios.',
    },
    {
      key: 'safe_apr_threshold_for_payoff_priority',
      value: 0.1,
      rationale:
        'Debts at 10%+ APR are treated as high-priority because the guaranteed return from paying them outpaces typical long-term portfolio expectations.',
    },
    {
      key: 'emergency_fund_target_months',
      value: 6,
      rationale:
        'Six months of expenses is used as the target for a "complete" emergency fund. Lower if your income is highly stable and you have other liquid assets.',
    },
    {
      key: 'engine_input_source',
      value: 'supabase_user_owned_tables',
      rationale:
        'Every input was loaded from your own user-owned tables via RLS — no cross-user data is read or used.',
    },
  ];
}

function buildSummary(trueGoal: string, allocations: OptimizerAllocation[]): string {
  if (allocations.length === 0) {
    return `Your inferred goal is: ${trueGoal}. Set a monthly surplus to generate an allocation plan.`;
  }
  const top = allocations
    .slice(0, 3)
    .map((a) => `${a.share_pct.toFixed(0)}% to ${a.category.replace(/_/g, ' ')}`);
  return `Your inferred goal is: ${trueGoal}. The plan starts with ${top.join(', ')}.`;
}

// --- helpers -----------------------------------------------------------

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
