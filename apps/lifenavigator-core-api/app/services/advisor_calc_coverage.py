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
    # Added 2026-10-12 — the tax- and planning-critical inputs. Each resolves from a REAL column
    # that already existed; none is derived, estimated or defaulted. See financial_resolver.
    "monthly_debts",              # asset_loans.monthly_payment + debts/liabilities.minimum_payment
    "debt_minimum_payments",      # per-debt, so a payoff PLAN is computable
    "capital_gain",               # investment_holdings: current_value - cost_basis (UNREALIZED)
    "itemized_components", "adjusted_gross_income", "modified_agi", "qualifying_children",
    "capital_gain_long_term",     # split by purchase_date, because the rates differ by up to 22pp
    "capital_gain_short_term",
    "annual_savings",             # cash_flow_snapshots.net_cash_flow, measured not self-reported
    "monthly_expenses",           # user_financial_profile.monthly_expenses — PROMOTED from a turn
                                  # input, because it is stored and should not be re-asked
    "va_disability_rating",       # documents:va_award_letter — tax-free income, read since Sprint 20
    "hsa_eligible", "hsa_balance", "fsa_election",   # the B2 tax-treatment rules
    # Added 2026-10-13. The computed path read thirteen tables and every one was finance, so the
    # advisor could DESCRIBE a degree (advisor_facts, Phase 8) and compute nothing about it.
    "salary_before",          # career.compensation_records.base
    "education_programs",     # education.programs — tuition, duration, median salary, grad rate
    "target_compensation", "target_role",   # career.job_targets
})

# Values the ADVISOR TURN supplies (parsed from the message or passed by the caller), not resolved
# from stored data. Distinct from canonical inputs because they are per-turn and unpersisted.
TURN_INPUTS = frozenset({
    # `monthly_expenses` is ALSO canonical now (user_financial_profile). It stays here because a
    # turn may override the stored figure — "what if I cut spending to $4,000?" — and the override
    # must not be mistaken for the stored fact.
    "home_price_goal", "monthly_income", "monthly_expenses", "monthly_debt_payment",
    "savings_goal_amount", "savings_goal_months", "current_age", "target_retirement_age",
    # Added 2026-10-12. These are genuinely per-turn and should NOT be stored: they describe a
    # decision the user is weighing right now ("should I take the $400k lump sum?", "this degree
    # costs $90k"), not a standing fact about them. Storing them would make a hypothetical look
    # like a commitment on the next turn.
    "down_payment", "monthly_rent",
    "tuition_total", "years_in_school", "salary_before", "salary_after",
    "lump_sum_amount", "spread_months",
    "pension_lump_sum", "pension_annual_annuity",
    "va_individual_ratings",
    "offers",
    # No column stores a fund expense ratio, so it only ever arrives in conversation.
    "expense_ratio",
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
    _r("money.future_value", ("investment_balance", "time_horizon"), wired=True,
       optional=("monthly_income",)),
    # Restates any projected balance in today's dollars. Not independently reachable — it is a
    # TRANSFORM on another calculator's output — so it is wired onto the retirement projection,
    # which is the figure users most often anchor on nominally.
    _r("money.purchasing_power", ("retirement_balance", "current_age",
                                   "target_retirement_age"), wired=True,
       note="the honest reframe of every projection: $2.1M in 30 years is ~$1.0M of today's "
            "purchasing power, and 52% of the headline is inflation rather than growth"),
    _r("money.expense_ratio_drag", ("investment_balance", "time_horizon", "expense_ratio"), wired=True,
       note="the single most actionable number in a portfolio review — a 0.95% ratio on $500k over "
            "30 years costs 24% of the terminal balance. BLOCKED on the user's actual fund fees; a "
            "typical ratio would be an invented assumption about their portfolio"),
    _r("money.lump_sum_vs_dca", ("lump_sum_amount", "spread_months"), wired=True),
    _r("retirement.pension_lump_sum_vs_annuity",
       ("pension_lump_sum", "pension_annual_annuity", "current_age"), wired=True,
       note="an irreversible, high-stakes election. Needs the two figures from the pension's own "
            "offer letter, which no canonical source holds — but it is a strong candidate for "
            "Document Intelligence extraction rather than a chat question"),
    _r("debt.total_interest", ("home_price_goal",), wired=True,
       note="same registry-sourced scenario path as amortized_payment"),

    # BLOCKED ON INPUTS — the resolver cannot supply these yet.
    _r("cash.savings_rate", ("income", "annual_savings"), wired=True),
    # `monthly_debts` is the DTI input, and it needs actual monthly PAYMENTS — blocked on the same
    # missing minimum_payment column as debt.payoff_plan.
    _r("housing.max_monthly_payment", ("income", "monthly_debts"), wired=True,
       note="monthly_debts is reported MISSING when any debt's payment is unknown, because "
            "understating obligations overstates what the borrower can afford"),
    _r("housing.max_home_price", ("income", "monthly_debts", "down_payment"), wired=True),
    _r("housing.rent_vs_buy", ("home_price_goal", "monthly_rent"), wired=True),
    _r("debt.payoff_plan", ("debt_list", "debt_minimum_payments"), wired=True,
       note="BLOCKED ON A MIGRATION, not on wiring: finance.financial_accounts has no "
            "minimum_payment column, and months-to-debt-free plus total interest cannot be "
            "simulated without one. debt_list alone is enough for the ORDER, which is wired"),
    _r("debt.avalanche_order", ("debt_list",), wired=True),
    _r("career.offer_total_comp", ("offers",), wired=True),
    _r("education.degree_total_cost", ("education_programs", "salary_before"), wired=True,
       optional=("tuition_total", "years_in_school"),
       note="runs PER PROGRAM: more than one candidate is a comparison, not an ambiguity. Reads "
            "education.programs and career.compensation_records; the turn still overrides, "
            "because 'what if it cost $120k' is a real question"),
    _r("education.degree_payback_years",
       ("education_programs", "salary_before"), wired=True,
       optional=("salary_after", "target_compensation"),
       note="salary_after prefers the program's published median, then the user's stated target — "
            "a target is what they aim at, not what the program delivers, so the source is "
            "recorded on the result"),
    _r("education.degree_lifetime_value",
       ("education_programs", "salary_before"), wired=True,
       optional=("salary_after", "target_compensation")),
    _r("tax.federal_income_tax", ("income", "filing_status"), wired=True),
    _r("tax.fica", ("income", "filing_status"), wired=True),
    _r("tax.state_income_tax", ("income", "filing_status", "tax_state"), wired=True),
    _r("tax.capital_gains_tax", ("filing_status", "capital_gain"), wired=True,
       optional=("capital_gain_long_term", "capital_gain_short_term"),
       note="the gain is UNREALIZED — what a sale today would trigger. Long/short are split by "
            "purchase_date because the rates differ by up to 22 percentage points"),
    _r("tax.standard_vs_itemized",
       ("filing_status", "adjusted_gross_income", "itemized_components"), wired=True,
       note="fed by tax.itemized_deductions, which turns the stored COMPONENTS into a capped "
            "total. Kept distinct because this one answers 'is itemizing worth it' while that one "
            "answers 'how much can I actually deduct'"),
    _r("tax.itemized_deductions",
       ("filing_status", "adjusted_gross_income", "itemized_components"), wired=True,
       optional=("modified_agi",),
       note="applies the IRC 164(b)(6) SALT cap AND its MAGI phase-down, plus the 7.5%-of-AGI "
            "medical floor. Summing the raw components instead would overstate the itemized total "
            "and recommend itemizing when the standard deduction wins. The IRC 68 2/37ths "
            "limitation (new for 2026) is DETECTED and flagged, not modelled"),
    _r("tax.effective_marginal_rate", ("income", "filing_status"), wired=True,
       note="THE highest-value tax figure for the advisor — every Roth, pre-tax and raise question "
            "turns on it, and it needs only income + filing status"),
    _r("tax.tax_credits", ("income", "filing_status", "qualifying_children"), wired=True,
       optional=("dependents",),
       note="needs the CHILD count, not the dependent count: the child credit is $2,200 and the "
            "other-dependent credit $500, so treating an adult dependent as a child overstates it "
            "by $1,700 each. Chained off tax.federal_income_tax for tax-before-credits, because "
            "nonrefundable credits can only reduce liability to zero"),
    _r("tax.bracket_headroom", ("income", "filing_status"), wired=True,
       note="how much more ordinary income fits before the next rate. Answers 'how big a bonus "
            "before it costs 32%', 'how much can I convert to Roth this year', 'how much gain can "
            "I realise' — and it is what the Phase F conversion ladder is built from"),

    # VA benefits. Blocked on inputs that exist in the DOCUMENTS tier but have never been promoted
    # to the resolver: `military.py` already reads a disability rating and monthly benefit off a
    # parsed VA award letter, and nothing carries them to the advisor. So the advisor cannot state a
    # veteran's own, tax-free, largest-single-line income — the figure they are most certain about.
    _r("va.disability_compensation", ("va_disability_rating",), wired=True,
       optional=("va_dependent_parents", "va_children_under_18",
                 "va_children_over_18_in_school", "va_spouse_aid_attendance"),
       note="the rating already exists in documents (va_award_letter.disability_rating, read by "
            "military.py) — promoting it to the resolver is the whole of the work. Spouse comes "
            "from filing_status/dependents"),
    _r("va.combined_rating", ("va_individual_ratings",), wired=True,
       note="a TURN input in practice ('I'm rated 60 for my back and 30 for tinnitus'), and worth "
            "wiring because veterans systematically over-estimate the combined figure: 60 and 30 "
            "combine to 70, not 90"),
    _r("va.dic", (), wired=True,
       note="needs no user input at all beyond optional flags — the surviving-spouse base rate is "
            "flat. Reachable TODAY, and it is the number a veteran's spouse most needs before the "
            "death rather than after"),
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
# ── Treatment rules (Milestone 3.1) ──────────────────────────────────────────────────────────────
#
# All eleven now reach the advisor through `advisor_treatments.TreatmentPlanner`, which puts the
# VERDICT in the packet's `treatments` section and routes only the quantified half through the
# number gate. The inputs each one tests against are recorded so a rule that stops firing has a
# named cause rather than silently disappearing.
#
# `source` is where the fact comes from, and the distinction is load-bearing. A stored fact is a
# standing attribute of the person; a TURN fact is one the user states about a decision they are
# weighing. `heloc_proceeds_used_for` is the clearest case: the same HELOC is deductible or not
# depending on what the money bought (IRC 163(h)(3)), it can differ per draw, and storing it would
# turn one draw's use into a permanent characteristic.
TREATMENT_REACH: dict[str, tuple[str, ...]] = {
    "wrapper.hdhp_qualifies": ("health_coverage_tier", "hdhp_annual_deductible",
                               "hdhp_out_of_pocket_max"),
    "wrapper.hsa_contribution": ("health_coverage_tier", "hsa_annual_contribution",
                                 "current_age"),
    "wrapper.fsa_hsa_compatibility": ("fsa_type",),
    "wrapper.k401_deferral": ("income", "retirement_contribution_rate", "current_age"),
    "wrapper.ira_deduction": ("ira_contribution", "adjusted_gross_income", "filing_status",
                              "current_age", "covered_by_workplace_plan"),
    "debt_interest.mortgage": ("debt_minimum_payments", "itemized_components"),
    "debt_interest.heloc": ("heloc_annual_interest", "heloc_proceeds_used_for"),
    "debt_interest.investment": ("margin_annual_interest", "net_investment_income"),
    "debt_interest.business": ("business_annual_interest", "adjusted_taxable_income",
                               "gross_receipts"),
    "debt_interest.student_loan": ("student_loan_interest", "adjusted_gross_income",
                                   "filing_status"),
    "debt_interest.after_tax_cost": ("debt_apr", "marginal_rate"),
}

# Facts that arrive per TURN rather than from storage, per the reasoning above.
TREATMENT_TURN_INPUTS = frozenset({
    "ira_contribution", "heloc_proceeds_used_for", "heloc_annual_interest",
    "margin_annual_interest", "net_investment_income",
    "business_annual_interest", "adjusted_taxable_income", "gross_receipts",
})

# Figures produced by the calculator pass and handed to the rules rather than recomputed — a
# determination that disagreed with the number beside it in the same packet would be worse than
# either alone.
TREATMENT_DERIVED_INPUTS = frozenset({"marginal_rate", "itemizing", "current_age"})


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
        # All eleven are wired as of Milestone 3.1; kept as a key so a regression is visible
        # rather than merely absent from the report.
        "treatment_rules_unwired": [],
        "treatment_rules_wired": sorted(TREATMENT_REACH),
        # The ordered resolver work list: the input blocking the MOST calculators comes first.
        "missing_inputs_by_impact": sorted(
            ({"input": k, "unblocks": sorted(v), "count": len(v)} for k, v in missing.items()),
            key=lambda d: (-d["count"], d["input"]),
        ),
    }
