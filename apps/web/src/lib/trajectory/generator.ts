/**
 * Scenario generator. Given a single base ProjectorState (the "current
 * behavior" snapshot), produces the canonical 5 paths:
 *
 *   - current_behavior    no changes
 *   - conservative        cash-heavy, debt-down, modest investing
 *   - balanced            standard rule-of-thumb allocation
 *   - aggressive_upside   max investing, accept variance
 *   - goal_optimized      bias allocation toward the user's stated goal
 *
 * Each variant is a tuple of (state, decisions[]). The API layer calls
 * `project(state, decisions)` for each.
 *
 * The variants intentionally differ only on a small set of knobs so
 * differences in the output are attributable to the strategy, not noise.
 */

import type { ProjectorState, ScenarioDecision, ScenarioLabel } from '@/types/trajectory';
import { ALL_LABELS } from '@/types/trajectory';

export interface GeneratorOptions {
  /** Optional stated goal — biases the goal_optimized variant. */
  stated_goal?: string | null;
  /** Optional monthly surplus to allocate; defaults to the state's existing allocations. */
  monthly_surplus_override?: number;
}

export interface GeneratedVariant {
  label: ScenarioLabel;
  state: ProjectorState;
  decisions: ScenarioDecision[];
}

/**
 * Produce all 5 canonical variants from a base state.
 * The base state is treated as the "current_behavior" snapshot.
 */
export function generateAllVariants(
  base: ProjectorState,
  options: GeneratorOptions = {}
): GeneratedVariant[] {
  const surplus = options.monthly_surplus_override ?? estimateMonthlySurplus(base);
  return ALL_LABELS.map((label) => buildVariant(label, base, surplus, options));
}

export function buildVariant(
  label: ScenarioLabel,
  base: ProjectorState,
  surplus: number,
  options: GeneratorOptions
): GeneratedVariant {
  // Each variant is a *copy* of the base state with strategy-specific
  // knobs adjusted. Decisions list is empty for the steady-state strategies
  // (they bias via the recurring monthly contributions), and populated for
  // the goal_optimized strategy when we have a clear stated goal.
  const v = cloneState(base);

  switch (label) {
    case 'current_behavior':
      // No change.
      return { label, state: v, decisions: [] };

    case 'conservative': {
      // 50% surplus to highest-APR debt, 30% emergency fund, 20% retirement.
      v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.5);
      v.monthly_emergency_fund_topup = round(base.monthly_emergency_fund_topup + surplus * 0.3);
      v.monthly_retirement_contribution = round(
        base.monthly_retirement_contribution + surplus * 0.2
      );
      v.monthly_taxable_investing = base.monthly_taxable_investing; // unchanged
      return { label, state: v, decisions: [] };
    }
    case 'balanced': {
      // Optimizer-style split.
      v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.3);
      v.monthly_retirement_contribution = round(
        base.monthly_retirement_contribution + surplus * 0.3
      );
      v.monthly_taxable_investing = round(base.monthly_taxable_investing + surplus * 0.25);
      v.monthly_emergency_fund_topup = round(base.monthly_emergency_fund_topup + surplus * 0.15);
      return { label, state: v, decisions: [] };
    }
    case 'aggressive_upside': {
      // Tilt toward growth: more taxable + retirement, less to debt beyond minimums.
      v.monthly_taxable_investing = round(base.monthly_taxable_investing + surplus * 0.55);
      v.monthly_retirement_contribution = round(
        base.monthly_retirement_contribution + surplus * 0.35
      );
      v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.1);
      // Slightly more optimistic return assumption — annotated as a risk in the output.
      v.expected_real_return_pct = clamp(base.expected_real_return_pct + 0.01, 0, 0.12);
      return { label, state: v, decisions: [] };
    }
    case 'goal_optimized': {
      // If the user told us they want a home, push more to a down-payment
      // fund and project a home purchase in 36 months.
      const s = (options.stated_goal ?? '').toLowerCase();
      if (/(home|house|down\s*payment)/.test(s)) {
        v.monthly_taxable_investing = round(base.monthly_taxable_investing + surplus * 0.6);
        v.monthly_emergency_fund_topup = round(base.monthly_emergency_fund_topup + surplus * 0.2);
        v.monthly_retirement_contribution = round(
          base.monthly_retirement_contribution + surplus * 0.2
        );
        return {
          label,
          state: v,
          decisions: [
            {
              decision_type: 'home_purchase',
              description:
                'Goal-optimized: scheduled home purchase at 36 months using accumulated savings as down payment.',
              at_month: 36,
              amount: Math.max(20000, surplus * 24),
              parameters: {
                home_value: Math.max(200000, base.annual_gross_income * 3),
                mortgage_apr: 0.065,
                mortgage_term_months: 360,
              },
            },
          ],
        };
      }
      if (/(retire|financial\s*independence)/.test(s)) {
        v.monthly_retirement_contribution = round(
          base.monthly_retirement_contribution + surplus * 0.5
        );
        v.monthly_taxable_investing = round(base.monthly_taxable_investing + surplus * 0.3);
        v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.2);
        return { label, state: v, decisions: [] };
      }
      if (/debt|payoff|cards?/.test(s)) {
        v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.8);
        v.monthly_emergency_fund_topup = round(base.monthly_emergency_fund_topup + surplus * 0.2);
        return { label, state: v, decisions: [] };
      }
      // Default: mirror balanced.
      v.monthly_extra_debt_payment = round(base.monthly_extra_debt_payment + surplus * 0.3);
      v.monthly_retirement_contribution = round(
        base.monthly_retirement_contribution + surplus * 0.3
      );
      v.monthly_taxable_investing = round(base.monthly_taxable_investing + surplus * 0.25);
      v.monthly_emergency_fund_topup = round(base.monthly_emergency_fund_topup + surplus * 0.15);
      return { label, state: v, decisions: [] };
    }
  }
}

function cloneState(s: ProjectorState): ProjectorState {
  return { ...s, debts: s.debts.map((d) => ({ ...d })) };
}

function estimateMonthlySurplus(s: ProjectorState): number {
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

function round(n: number): number {
  return Math.round(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
