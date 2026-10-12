"""Which calculators can the advisor actually REACH? (structural gap #1)

THE PROBLEM THIS MAKES VISIBLE
------------------------------
Phase 3 wired ten calculators into `allowed_numbers`/`scenario_numbers` with a hand-written dispatch
block each. Phases A, B and B2 then added twenty-plus more calculators and eleven treatment rules —
and `advisor_calculations.py` does not know any of them exist. Every one is tested, registered, and
completely unreachable by the advisor. The engine has been growing faster than the advisor can cite
it, and nothing failed, because "registered but unreachable" has no symptom.

This module is the inventory and the gate. Every registered calculator must be declared here as
either REACHABLE (with the canonical inputs it consumes) or NOT_ADVISOR_FACING (with a reason).
A new calculator that is neither fails `test_every_calculator_is_declared_reachable_or_not`, so the
gap cannot silently re-open.

THE FINDING, ONCE MEASURED
--------------------------
Most of the unreachable calculators are not blocked by the dispatch at all — they are blocked by the
CANONICAL INPUT VOCABULARY. `FinancialInputResolver` resolves eleven inputs. `tax_credits` needs a
filing status and a dependent count; `education.*` needs tuition and salaries; `debt.payoff_plan`
needs a per-debt list where canonical data holds only an aggregate `debt_total`/`debt_apr`.

So structural gaps #1 and #2 are the same gap, approached from two ends, and the binding constraint
is the resolver. `BLOCKED_ON_INPUTS` names exactly which inputs each calculator is waiting for, which
turns "wire up the advisor" into a short, ordered list of resolver work.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Canonical inputs `FinancialInputResolver.resolve()` provides today.
CANONICAL_INPUTS = frozenset({
    "income", "cash_balance", "investment_balance", "retirement_balance",
    "debt_total", "debt_apr", "retirement_contribution_rate", "employer_match_rate",
    "risk_profile", "time_horizon", "housing_target",
    # Added 2026-10-11 from finance.tax_profiles. `filing_status` was the single highest-impact
    # addition in the whole inventory — it unblocks seven tax calculators at once.
    "filing_status", "dependents", "tax_state",
    # Per-debt rows, so a payoff ORDER is computable rather than only an aggregate.
    "debt_list",
})

# Values the ADVISOR TURN supplies (parsed from the message or passed by the caller), not resolved
# from stored data. Distinct from canonical inputs because they are per-turn and unpersisted.
TURN_INPUTS = frozenset({
    "home_price_goal", "monthly_income", "monthly_expenses", "monthly_debt_payment",
    "savings_goal_amount", "savings_goal_months", "current_age", "target_retirement_age",
})

AVAILABLE = CANONICAL_INPUTS | TURN_INPUTS


@dataclass(frozen=True)
class Reach:
    """How a calculator gets its inputs, and whether that is possible today."""

    calc_id: str
    needs: tuple[str, ...]              # input names it cannot run without
    wired: bool                         # is it actually dispatched in advisor_calculations today?
    note: str = ""
    optional: tuple[str, ...] = ()

    @property
    def missing_inputs(self) -> tuple[str, ...]:
        return tuple(n for n in self.needs if n not in AVAILABLE)

    @property
    def inputs_available(self) -> bool:
        return not self.missing_inputs

    @property
    def status(self) -> str:
        if self.wired:
            return "wired"
        if self.inputs_available:
            # The cheap tier: the data exists, only the dispatch is missing.
            return "ready_to_wire"
        return "blocked_on_inputs"


def _r(calc_id: str, needs: tuple[str, ...], *, wired: bool = False, note: str = "",
       optional: tuple[str, ...] = ()) -> Reach:
    return Reach(calc_id=calc_id, needs=needs, wired=wired, note=note, optional=optional)


# ── Advisor-facing calculators ────────────────────────────────────────────────────────────────────
REACHABLE: dict[str, Reach] = {r.calc_id: r for r in (
    # Already dispatched (Phase 3).
    _r("money.monthly_surplus", ("monthly_income", "monthly_expenses"), wired=True),
    _r("retirement.sustainable_income", ("retirement_balance",), wired=True),
    _r("retirement.projected_balance", ("retirement_balance", "current_age",
                                        "target_retirement_age"), wired=True),
    _r("retirement.balance_needed", ("income",), wired=True,
       note="desired income derived from income x retirement_replacement"),
    _r("debt.payoff_months", ("debt_total", "debt_apr", "monthly_debt_payment"), wired=True),
    _r("debt.amortized_payment", ("home_price_goal",), wired=True,
       note="re-scoped to SCENARIO: rate/term/down-payment come from the registry"),
    _r("money.monthly_contribution_for_target", ("savings_goal_amount", "savings_goal_months"),
       wired=True, optional=("cash_balance",)),

    # READY TO WIRE — every input already exists. Nothing but dispatch is missing.
    _r("career.uncaptured_match", ("income", "retirement_contribution_rate",
                                    "employer_match_rate"), wired=True,
       note="all three inputs are canonical TODAY — the cheapest high-value wiring on the list, "
            "and it quantifies free employer money the user is leaving behind"),
    _r("cash.net_worth", ("cash_balance", "investment_balance", "retirement_balance",
                           "debt_total"), wired=True,
       note="assets summed from the three balances, liabilities from debt_total"),
    _r("cash.months_covered", ("cash_balance", "monthly_expenses"), wired=True),
    _r("cash.emergency_fund_target", ("monthly_expenses",), wired=True),
    _r("cash.emergency_fund_gap", ("cash_balance", "monthly_expenses"), wired=True),
    _r("money.future_value", ("investment_balance", "time_horizon"),
       optional=("monthly_income",)),
    # Restates any projected balance in today's dollars. Not independently reachable — it is a
    # TRANSFORM on another calculator's output — so it is wired onto the retirement projection,
    # which is the figure users most often anchor on nominally.
    _r("money.purchasing_power", ("retirement_balance", "current_age",
                                   "target_retirement_age"), wired=True,
       note="the honest reframe of every projection: $2.1M in 30 years is ~$1.0M of today's "
            "purchasing power, and 52% of the headline is inflation rather than growth"),
    _r("money.expense_ratio_drag", ("investment_balance", "time_horizon", "expense_ratio"),
       note="the single most actionable number in a portfolio review — a 0.95% ratio on $500k over "
            "30 years costs 24% of the terminal balance. BLOCKED on the user's actual fund fees; a "
            "typical ratio would be an invented assumption about their portfolio"),
    _r("money.lump_sum_vs_dca", ("lump_sum_amount", "spread_months")),
    _r("debt.total_interest", ("home_price_goal",),
       note="same registry-sourced scenario path as amortized_payment"),

    # BLOCKED ON INPUTS — the resolver cannot supply these yet.
    _r("cash.savings_rate", ("income", "annual_savings")),
    # `monthly_debts` is the DTI input, and it needs actual monthly PAYMENTS — blocked on the same
    # missing minimum_payment column as debt.payoff_plan.
    _r("housing.max_monthly_payment", ("income", "monthly_debts")),
    _r("housing.max_home_price", ("income", "monthly_debts", "down_payment")),
    _r("housing.rent_vs_buy", ("home_price_goal", "monthly_rent")),
    _r("debt.payoff_plan", ("debt_list", "debt_minimum_payments"),
       note="BLOCKED ON A MIGRATION, not on wiring: finance.financial_accounts has no "
            "minimum_payment column, and months-to-debt-free plus total interest cannot be "
            "simulated without one. debt_list alone is enough for the ORDER, which is wired"),
    _r("debt.avalanche_order", ("debt_list",), wired=True),
    _r("career.offer_total_comp", ("offers",)),
    _r("education.degree_total_cost", ("tuition_total", "years_in_school", "salary_before")),
    _r("education.degree_payback_years", ("tuition_total", "years_in_school", "salary_before",
                                           "salary_after")),
    _r("education.degree_lifetime_value", ("tuition_total", "years_in_school", "salary_before",
                                            "salary_after")),
    _r("tax.federal_income_tax", ("income", "filing_status"), wired=True),
    _r("tax.fica", ("income", "filing_status"), wired=True),
    _r("tax.state_income_tax", ("income", "filing_status", "tax_state"), wired=True),
    _r("tax.capital_gains_tax", ("filing_status", "capital_gain")),
    _r("tax.standard_vs_itemized", ("filing_status", "itemized_deductions")),
    _r("tax.effective_marginal_rate", ("income", "filing_status"), wired=True,
       note="THE highest-value tax figure for the advisor — every Roth, pre-tax and raise question "
            "turns on it, and it needs only income + filing status"),
    _r("tax.tax_credits", ("income", "filing_status", "dependents")),
    _r("tax.bracket_headroom", ("income", "filing_status"), wired=True,
       note="how much more ordinary income fits before the next rate. Answers 'how big a bonus "
            "before it costs 32%', 'how much can I convert to Roth this year', 'how much gain can "
            "I realise' — and it is what the Phase F conversion ladder is built from"),
)}


# ── Deliberately not advisor-facing ───────────────────────────────────────────────────────────────
# Each needs a REASON. "Not wired" without one is how a calculator goes missing.
NOT_ADVISOR_FACING: dict[str, str] = {
    "primitives.npv": "a building block composed by other calculators; an NPV with no stated "
                      "cash-flow series means nothing to a user on its own",
    "primitives.irr": "building block — and IRR is only meaningful attached to a specific decision, "
                      "which is what Phase J/L composites provide",
    "primitives.payback_period": "building block; surfaced through education.degree_payback_years "
                                 "and, later, purchase_worth_it",
}


# ── Treatment rules (Phase B2) ────────────────────────────────────────────────────────────────────
# A different pipeline: a determination is prose plus a quantified amount, so it reaches the advisor
# through the packet's `treatments` section rather than through allowed_numbers. None are wired yet.
TREATMENT_REACH: dict[str, tuple[str, ...]] = {
    "wrapper.hdhp_qualifies": ("plan_deductible", "plan_out_of_pocket_max", "coverage_tier"),
    "wrapper.hsa_contribution": ("coverage_tier", "hsa_contribution", "age"),
    "wrapper.fsa_hsa_compatibility": ("fsa_type",),
    "wrapper.k401_deferral": ("income", "retirement_contribution_rate", "employer_match_rate",
                              "age"),
    "wrapper.ira_deduction": ("income", "filing_status", "age", "covered_by_workplace_plan"),
    "debt_interest.mortgage": ("mortgage_balance", "mortgage_annual_interest", "itemizing"),
    "debt_interest.heloc": ("heloc_annual_interest", "heloc_proceeds_used_for", "itemizing"),
    "debt_interest.investment": ("margin_annual_interest", "net_investment_income"),
    "debt_interest.business": ("business_annual_interest", "adjusted_taxable_income",
                               "gross_receipts"),
    "debt_interest.student_loan": ("student_loan_annual_interest", "income", "filing_status"),
    "debt_interest.after_tax_cost": ("apr", "deductible_share", "marginal_rate"),
}


# ── Reporting ─────────────────────────────────────────────────────────────────────────────────────
def coverage_report() -> dict[str, Any]:
    """What the advisor can reach, what is one dispatch away, and what is waiting on the resolver."""
    by_status: dict[str, list[str]] = {"wired": [], "ready_to_wire": [], "blocked_on_inputs": []}
    missing: dict[str, list[str]] = {}
    for calc_id, reach in sorted(REACHABLE.items()):
        by_status[reach.status].append(calc_id)
        for name in reach.missing_inputs:
            missing.setdefault(name, []).append(calc_id)
    return {
        "wired": by_status["wired"],
        "ready_to_wire": by_status["ready_to_wire"],
        "blocked_on_inputs": by_status["blocked_on_inputs"],
        "not_advisor_facing": sorted(NOT_ADVISOR_FACING),
        "treatment_rules_unwired": sorted(TREATMENT_REACH),
        # The ordered resolver work list: the input blocking the MOST calculators comes first.
        "missing_inputs_by_impact": sorted(
            ({"input": k, "unblocks": sorted(v), "count": len(v)} for k, v in missing.items()),
            key=lambda d: (-d["count"], d["input"]),
        ),
    }
