"""Advisor calculation planner (Phase 3) — run the calculators the user's REAL data supports.

WHAT THIS CONNECTS
------------------
`services/calculators/` can compute a mortgage payment, a compound projection, an interest-aware
payoff. The advisor could not state any of them: the number gate admits a computed figure only
through a `derivations` expression it re-evaluates, and that verifier has no exponentiation, so
`(1+r)^n` is unsayable. This module is the bridge — it computes the figures BEFORE generation and
registers them, so the gate passes them because they are grounded, not because it was relaxed.

PRE-COMPUTED, NEVER LLM-INVOKED
-------------------------------
Results are assembled during context build and shipped in the prompt. They are not tools the model
calls. Three reasons, in order of importance:
  1. The gate validates OUTPUT. A value has to be in `allowed_numbers` BEFORE the reply is checked;
     a mid-generation tool call would arrive too late.
  2. No extra round-trip on a path already running ~9s.
  3. No dependence on the model choosing to call the right tool with the right arguments.

NO INVENTED INPUTS — THE HARD RULE
----------------------------------
A calculator runs only when every input it needs is REAL: measured from `finance.*` through
`FinancialInputResolver` (which carries each value's origin and refuses to default a missing one), or
stated by the user in this conversation. Anything else is reported as a named GAP carrying the
resolver's own prompt text, so the advisor ASKS instead of guessing. This mirrors
`finance_scenarios`' `needs_*` convention, and it is the same rule the resolver states for itself:
"every value resolves from Supabase with its source; missing inputs are named, never defaulted."

Rates that are not the user's data (return, mortgage rate, withdrawal rate, down-payment %, term)
come from `services/assumptions.py` and travel with the result as citations. The registry is
explicit that no projection may invent an assumption inline.

WHY NOT `services/tools.py`
---------------------------
That platform (10 tools, persisted runs, `tool_run_id` lineage) is the right home for figures the UI
and reports render, and it is NOT duplicated away here. It is a poor fit for THIS path for two
specific reasons:
  * Its `_f()` coercion silently defaults an unparseable input to 0.0. On a rendered card a zero is
    visible and obviously wrong; spoken by the advisor as the user's own number it is a fabrication,
    and the gate would admit it because it was grounded.
  * It has no strict/scenario distinction, so the validator cannot tell a figure derived from the
    user's data from one resting on an assumed rate — which is exactly the judgement
    `advisor_validator._SCENARIO_LABEL` has to make.
Consolidating the two is worth doing; it is a deliberate follow-up, noted in the Phase 3 summary,
not something to do silently underneath an advisor change.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .calculators import (CalcResult, CalculatorError, cash, career, debt, education, housing,
                          money, retirement)
from .calculators import tax as tax_calc
from .calculators import versioned_data as _vd
from .calculators import va_disability as va
from .advisor_treatments import TreatmentPlanner

log = logging.getLogger("core.advisor.calculations")

# An APR above this is read as a PERCENT that was never converted (22 meaning 22%).
#
# The repo is genuinely inconsistent here and the ambiguity is not ours to wish away: migration 062
# documents `interest_rate` as "APR as decimal (e.g. 0.2199)", while `services/tools.py` divides by
# 100 (`apr / 100 / 12`), i.e. expects a percent. Real rows may be either. Consumer APRs above 100%
# essentially do not exist, so >1.0 is overwhelmingly a percent — and reading 22 as 2,200%/yr would
# produce a confidently absurd payoff. The conversion is recorded in the result's inputs so it is
# auditable rather than invisible.
_RATE_IS_PERCENT_ABOVE = 1.0


def _as_decimal_rate(raw: Any) -> Optional[float]:
    """Normalize an APR to a decimal fraction, or None when unusable."""
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v != v or v <= 0:  # NaN or non-positive
        return None
    return v / 100.0 if v > _RATE_IS_PERCENT_ABOVE else v


def _months_to_clear(balance: float, apr: float, payment: float) -> Optional[int]:
    """Months for a fixed payment to clear a balance, or None when it never does.

    `debt.total_interest` needs a TERM, and a minimum payment implies one rather than stating it.
    Returns None when the payment does not cover the interest — the honest answer, and the case
    that produced "600-month payoffs" in the engine this replaced.
    """
    monthly = apr / 12.0
    if payment <= balance * monthly:
        return None
    n = 0
    bal = balance
    while bal > 0 and n < 600:
        bal = bal * (1 + monthly) - payment
        n += 1
    return n if bal <= 0 else None


def _present(inputs: dict[str, Any], key: str) -> Optional[Any]:
    """Value of a resolver field only when it is actually present. Never a default."""
    f = (inputs or {}).get(key) or {}
    return f.get("value") if f.get("present") else None


def _gap(inputs: dict[str, Any], calculator: str, needs: list[str]) -> dict[str, Any]:
    """A named gap carrying the resolver's own prompt, so the advisor asks the right question."""
    prompts = []
    for n in needs:
        f = (inputs or {}).get(n) or {}
        prompts.append(f.get("prompt") or f"Provide {n.replace('_', ' ')}.")
    return {"calculator": calculator, "needs": needs, "ask": prompts}


class AdvisorCalculationPlanner:
    """Selects and runs calculators for one turn from canonical inputs."""

    def __init__(self, resolver: Any, store: Any = None) -> None:
        self._resolver = resolver  # FinancialInputResolver — provenance-carrying canonical inputs
        # CalculationStore (optional). Absent in tests and in any caller that has no Supabase
        # handle; persistence is an enhancement and the planner must work without it.
        self._store = store

    async def compute(
        self,
        ctx: Any,
        *,
        home_price_goal: Optional[float] = None,
        monthly_income: Optional[float] = None,
        monthly_expenses: Optional[float] = None,
        monthly_debt_payment: Optional[float] = None,
        savings_goal_amount: Optional[float] = None,
        savings_goal_months: Optional[int] = None,
        current_age: Optional[int] = None,
        target_retirement_age: Optional[int] = None,
        tax_year: Optional[int] = None,
        turn: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Run every calculator this user's real data supports. Never raises into the turn.

        `turn` carries the DECISION the user is weighing right now — a degree's cost, a pension
        offer, a lump sum, the individual ratings on a VA letter. These are deliberately not
        stored and not resolved: they describe a hypothetical, and persisting one would make it
        look like a standing fact on the next turn ("your tuition is $90,000"). Supplying them
        here, per turn, is what makes the education, pension, lump-sum and combined-rating
        calculators reachable at all.
        """
        t = turn or {}

        def _tv(key: str) -> Optional[Any]:
            """A turn value, or None. Never a default — same rule as the resolver."""
            v = t.get(key)
            return v if v not in (None, "") else None
        try:
            resolved = await self._resolver.resolve(ctx)
            inputs = resolved.get("inputs") or {}
        except Exception as exc:  # noqa: BLE001 — grounding is an enhancement, never a turn-breaker
            log.warning("calculation planner: canonical inputs unavailable: %s", exc)
            return _empty("canonical finance inputs unavailable")

        results: list[CalcResult] = []
        gaps: list[dict[str, Any]] = []
        # Treatment amounts reach the number gate through these rather than through `results`,
        # because a determination is not a CalcResult and must not be ranked or tiered as one.
        strict_extra: set[str] = set()
        scenario_extra: set[str] = set()

        def run(fn: Any, **kwargs: Any) -> None:
            """Run one calculator, converting a refusal into a gap rather than a wrong number."""
            try:
                results.append(fn(**kwargs))
            except CalculatorError as exc:
                # A refusal is INFORMATION ("this payment never clears the balance"), not a failure
                # to hide. It becomes a gap so the advisor can say it.
                gaps.append({"calculator": getattr(fn, "calc_id", getattr(fn, "__name__", "?")),
                             "refused": str(exc)})
            except Exception as exc:  # noqa: BLE001
                log.warning("calculator %s failed: %s", getattr(fn, "calc_id", fn), exc)

        # ── Cash flow ────────────────────────────────────────────────────────────────────────────
        # Monthly income falls back to the resolver's canonical ANNUAL income / 12.
        #
        # Without this the strict tier was unreachable in production, and the confirmation pass is
        # what surfaced it: `advisor_context` sources cash flow from `finance_scenarios.cash_flow`,
        # but it calls that engine with `home_price_goal` ONLY — so its `monthly_income` is always
        # None, so `money.monthly_surplus` could never fire, so EVERY figure the advisor got was a
        # scenario. Deriving from the resolver (provenance-carrying, refuses to default) makes the
        # strict path real instead of theoretical.
        if monthly_income is None:
            _annual = _present(inputs, "income")
            if _annual:
                monthly_income = float(_annual) / 12.0
        if monthly_income is not None and monthly_expenses is not None:
            run(money.monthly_surplus, monthly_income=monthly_income,
                monthly_expenses=monthly_expenses)
        else:
            needs = ([] if monthly_income is not None else ["income"]) + \
                    ([] if monthly_expenses is not None else ["monthly_expenses"])
            gaps.append(_gap(inputs, "money.monthly_surplus", needs))

        # ── Retirement: what the balance on file already supports ────────────────────────────────
        retirement_balance = _present(inputs, "retirement_balance")
        if retirement_balance:
            run(retirement.sustainable_income, balance=retirement_balance)
            # The projection needs AGES, which are never measured from finance.* — user-entered
            # only. Absent, this is a gap, not a 40-year-old guess.
            if current_age and target_retirement_age:
                before_proj = len(results)
                run(retirement.projected_balance, current_balance=retirement_balance,
                    current_age=current_age, target_age=target_retirement_age)
                # Restate it in today's dollars. A user who hears "$2.1 million" anchors on a number
                # that will not buy what they think — roughly half of a 30-year projection is
                # inflation rather than growth, and reporting only the nominal total withholds that.
                if len(results) > before_proj:
                    projected = results[-1].value
                    horizon_months = max(1, int((target_retirement_age - current_age) * 12))
                    run(money.purchasing_power, future_amount=projected,
                        months=horizon_months)
            else:
                gaps.append({
                    "calculator": "retirement.projected_balance",
                    "needs": [k for k, v in (("current_age", current_age),
                                             ("target_retirement_age", target_retirement_age)) if not v],
                    "ask": ["How old are you now, and at what age do you want to retire? "
                            "(We won't guess — the projection depends entirely on the horizon.)"],
                })
        else:
            gaps.append(_gap(inputs, "retirement.sustainable_income", ["retirement_balance"]))

        # ── Retirement: what the user's income implies they will NEED ───────────────────────────
        annual_income = _present(inputs, "income")
        if annual_income:
            repl, repl_cited = _registry("retirement_replacement")
            run(retirement.balance_needed, desired_annual_income=annual_income * repl)
            if results and results[-1].calculator == "retirement.balance_needed":
                results[-1] = _with_extra_assumption(results[-1], repl_cited, {
                    "basis_annual_income": annual_income,
                    "replacement_pct": repl,
                })

        # ── Debt: an interest-aware payoff, which finance_scenarios explicitly cannot do ────────
        # Its own note says: "Simplified (excludes interest) — a precise payoff needs each debt's APR."
        debt_total = _present(inputs, "debt_total")
        debt_apr = _as_decimal_rate(_present(inputs, "debt_apr"))
        if debt_total and debt_apr and monthly_debt_payment:
            run(debt.payoff_months, balance=debt_total, apr=debt_apr,
                monthly_payment=monthly_debt_payment)
        elif debt_total:
            needs = [n for n, ok in (("debt_apr", debt_apr), ("monthly_payment", monthly_debt_payment))
                     if not ok]
            gaps.append(_gap(inputs, "debt.payoff_months", needs))

        # ── Housing: the mortgage payment on a price the user named ─────────────────────────────
        if home_price_goal and home_price_goal > 0:
            dp_pct, dp_cited = _registry("down_payment_pct")
            rate, rate_cited = _registry("mortgage_rate")
            term, term_cited = _registry("mortgage_term_months")
            principal = home_price_goal * (1.0 - dp_pct)
            before = len(results)
            run(debt.amortized_payment, principal=principal, apr=rate, term_months=int(term))
            if len(results) > before:
                # The payment rests on three registry assumptions, so it is a SCENARIO despite
                # amortized_payment being strict on its own inputs — the price is the user's, the
                # rate/term/down-payment are not.
                results[-1] = _rescope_as_scenario(
                    results[-1],
                    assumptions=(dp_cited, rate_cited, term_cited),
                    extra_inputs={"home_price_goal": home_price_goal, "down_payment_pct": dp_pct},
                    label="estimated monthly mortgage payment",
                )

        # ── Debt payoff ORDER ────────────────────────────────────────────────────────────────────
        # Which debt to attack first, from per-debt rows. Distinct from `debt.payoff_months`, which
        # answers "how long" on the aggregate: this answers "in what order", which is the question
        # that actually changes behaviour and saves interest.
        #
        # `debt.payoff_plan` (months + total interest for a whole set) stays unreachable because it
        # needs each debt's MINIMUM PAYMENT, and finance.financial_accounts has no such column.
        # That is a migration, not a wiring gap — recorded in advisor_calc_coverage.
        debt_list = _present(inputs, "debt_list")
        if debt_list:
            rated = [d for d in debt_list if d.get("apr") is not None]
            if len(rated) >= 2:
                run(debt.avalanche_order,
                    debts=[{"label": d["label"], "balance": d["balance"],
                            "apr": _as_decimal_rate(d["apr"])} for d in rated])
            elif rated:
                # One debt has no ordering decision to make; saying so beats a one-item "plan".
                gaps.append({"calculator": "debt.avalanche_order",
                             "refused": "only one debt carries a rate, so there is no payoff order "
                                        "to optimize"})
            else:
                gaps.append(_gap(inputs, "debt.avalanche_order", ["debt_apr"]))

        # ── Employer match: free money, from three inputs already on file ───────────────────────
        # The cheapest high-value wiring in the whole planner. All three inputs are canonical, and
        # the output is the one figure a user acts on immediately — employer money they are leaving
        # behind. It was unreachable only because nothing dispatched it.
        match_rate = _present(inputs, "employer_match_rate")
        contrib_rate = _present(inputs, "retirement_contribution_rate")
        if annual_income and match_rate is not None and contrib_rate is not None:
            run(career.uncaptured_match, income=annual_income,
                current_rate=float(contrib_rate), employer_match_rate=float(match_rate))
        elif annual_income:
            gaps.append(_gap(inputs, "career.uncaptured_match",
                             [k for k, v in (("retirement_contribution_rate", contrib_rate),
                                             ("employer_match_rate", match_rate)) if v is None]))

        # ── Balance sheet ────────────────────────────────────────────────────────────────────────
        cash_bal = _present(inputs, "cash_balance")
        invest_bal = _present(inputs, "investment_balance")
        debt_total = _present(inputs, "debt_total")
        assets = sum(float(v) for v in (cash_bal, invest_bal, retirement_balance) if v)
        if assets or debt_total:
            run(cash.net_worth, assets=assets, liabilities=float(debt_total or 0.0))

        # ── Emergency fund ───────────────────────────────────────────────────────────────────────
        # Two figures, two tiers, deliberately: months_covered is the user's own cash over their own
        # expenses (STRICT), while the target rests on an assumed number of months (SCENARIO). The
        # per-figure tiering from the Phase A consolidation is what makes that expressible.
        if monthly_expenses:
            # The target runs unconditionally: "how big should my emergency fund be?" is asked
            # directly and often, and it needs only the user's expenses. It was originally only in
            # the no-cash branch, which the coverage test caught — the inventory claimed it was
            # wired while a complete profile never fired it.
            run(cash.emergency_fund_target, monthly_expenses=monthly_expenses)
            if cash_bal is not None:
                run(cash.months_covered, monthly_expenses=monthly_expenses,
                    current_cash=float(cash_bal))
                run(cash.emergency_fund_gap, monthly_expenses=monthly_expenses,
                    current_cash=float(cash_bal))
            else:
                gaps.append(_gap(inputs, "cash.months_covered", ["cash_balance"]))

        # ── Tax ──────────────────────────────────────────────────────────────────────────────────
        # `filing_status` was the single highest-impact canonical addition: it unblocks seven
        # calculators at once. Every one is wrapped so that an UNVERIFIED tax table degrades to a
        # gap the advisor can speak ("I can't quote a 2026 figure until the tables are verified")
        # rather than an exception inside the turn.
        filing_status = _present(inputs, "filing_status")
        if annual_income and filing_status:
            def run_tax(fn: Any, **kwargs: Any) -> None:
                try:
                    results.append(fn(**kwargs))
                except _vd.VersionedDataError as exc:
                    gaps.append({"calculator": getattr(fn, "calc_id", "tax"),
                                 "refused": f"tax reference data unavailable: {exc}"})
                except CalculatorError as exc:
                    gaps.append({"calculator": getattr(fn, "calc_id", "tax"),
                                 "refused": str(exc)})
                except Exception as exc:  # noqa: BLE001
                    log.warning("tax calculator %s failed: %s", getattr(fn, "calc_id", fn), exc)

            def run_tax_get(fn: Any, **kwargs: Any) -> Optional[CalcResult]:
                """As `run_tax`, but hands the result back so a later calculator can CHAIN off it.

                Needed because two of these take figures only the federal calculation knows.
                `tax.capital_gains_tax` wants ORDINARY TAXABLE income — passing gross income would
                place the gain too high in the 0/15/20% stack and overstate the tax — and
                `tax.tax_credits` wants tax BEFORE credits, which is the federal result itself.
                """
                before = len(results)
                run_tax(fn, **kwargs)
                return results[-1] if len(results) > before else None

            # PRIOR-YEAR QUESTIONS. "What did I pay in 2024?" is answerable because every table is
            # kept, not replaced — but only if the year reaches the calculators. Without this the
            # advisor silently answered every tax question on the current year, which is wrong in a
            # way the user cannot see: the figure looks like an answer to what they asked.
            fed = run_tax_get(tax_calc.federal_income_tax, gross_income=annual_income,
                              filing_status=filing_status, tax_year=tax_year)
            run_tax(tax_calc.fica, wages=annual_income, filing_status=filing_status,
                    tax_year=tax_year)
            # The highest-value tax figure for an advisor: every Roth, pre-tax-contribution and
            # raise question turns on the marginal rate, and `assumptions.marginal_tax_rate` has
            # been standing in for it.
            run_tax(tax_calc.effective_marginal_rate, gross_income=annual_income,
                    filing_status=filing_status, tax_year=tax_year)
            # Room left in the current bracket. The actionable companion to the marginal rate: the
            # rate says what the next dollar costs, this says how many more dollars cost that much.
            run_tax(tax_calc.bracket_headroom, ordinary_income=annual_income,
                    filing_status=filing_status, tax_year=tax_year)
            tax_state = _present(inputs, "tax_state")
            if tax_state:
                run_tax(tax_calc.state_income_tax, taxable_income=annual_income,
                        state=str(tax_state), filing_status=filing_status, tax_year=tax_year)

            # CREDITS. Chained off the federal result, because the credit calculation needs the
            # tax BEFORE credits — nonrefundable credits can only reduce liability to zero.
            #
            # `qualifying_children` is NOT taken from the dependent count. The child credit is
            # $2,200 and the other-dependent credit is $500, so treating an adult dependent as a
            # child overstates the credit by $1,700 each. Until the split is stored (migration
            # 20261012000000) this is a named gap rather than a guess.
            children = _present(inputs, "qualifying_children")
            dependents = _present(inputs, "dependents")
            if fed is not None and children is not None:
                run_tax(tax_calc.tax_credits, agi=float(fed.detail["agi"]),
                        filing_status=filing_status,
                        tax_before_credits=float(fed.value),
                        qualifying_children=int(children),
                        other_dependents=max(0, int(dependents or 0) - int(children)),
                        tax_year=tax_year)
            elif fed is not None and dependents:
                gaps.append(_gap(inputs, "tax.tax_credits", ["qualifying_children"]))

            # CAPITAL GAINS. The gain is UNREALIZED — what selling today would trigger — which is
            # what answers "what would it cost me to get out of this position?"
            #
            # Run ONCE PER HOLDING PERIOD rather than on the blended total: long-term gain is taxed
            # at 0/15/20% and short-term as ordinary income up to 37%, so a single call would have
            # to pick one and be wrong by up to 22 percentage points on the other.
            ordinary_taxable = float(fed.detail["taxable_income"]) if fed is not None else None
            if ordinary_taxable is not None:
                for key, is_long in (("capital_gain_long_term", True),
                                     ("capital_gain_short_term", False)):
                    g = _present(inputs, key)
                    if g:
                        run_tax(tax_calc.capital_gains_tax, gain=float(g), long_term=is_long,
                                ordinary_taxable_income=ordinary_taxable,
                                filing_status=filing_status, tax_year=tax_year)

            # ITEMIZE VS STANDARD. Only with AGI, because the medical floor is a percentage of it;
            # without AGI the engine would silently treat every medical dollar as deductible.
            components = _present(inputs, "itemized_components") or {}
            agi = _present(inputs, "adjusted_gross_income")
            if components and agi is not None:
                itemized = run_tax_get(
                    tax_calc.itemized_deductions, filing_status=filing_status,
                    agi=float(agi), magi=_present(inputs, "modified_agi"),
                    tax_year=tax_year, **{k: float(v) for k, v in components.items()})
                # Chained: `standard_vs_itemized` answers "is itemizing worth it", and the only
                # defensible input is the CAPPED total from above. Feeding it the raw sum of
                # components — the obvious shortcut — would recommend itemizing to people whose
                # SALT is mostly disallowed.
                if itemized is not None:
                    run_tax(tax_calc.standard_vs_itemized, filing_status=filing_status,
                            itemized_deductions=float(itemized.value), tax_year=tax_year)
            elif components:
                gaps.append(_gap(inputs, "tax.itemized_deductions", ["adjusted_gross_income"]))
        elif annual_income:
            gaps.append(_gap(inputs, "tax.effective_marginal_rate", ["filing_status"]))

        # ── VA disability: tax-free income, read off an award letter since Sprint 20 ─────────────
        #
        # Wired here rather than in the tax block because it needs NEITHER income nor filing
        # status: a veteran's rating alone determines the figure. Gating it behind the tax block
        # would have kept it unreachable for exactly the users who had uploaded the document.
        va_rating = _present(inputs, "va_disability_rating")
        if va_rating is not None:
            run(va.disability_compensation, rating=int(va_rating),
                spouse=str(_present(inputs, "filing_status") or "").startswith("married"),
                children_under_18=int(_present(inputs, "dependents") or 0))

        # ── Debt payoff ORDER, not just a payoff date ───────────────────────────────────────────
        debt_list = _present(inputs, "debt_list")
        minimums = _present(inputs, "debt_minimum_payments")
        if minimums:
            # Mapped explicitly rather than passed through. The resolver returns DB-shaped rows
            # (`minimum_payment`) and the calculator wants `min_payment`; handing the row straight
            # over would make `require_money` refuse on every debt and the whole plan would vanish
            # into a gap that read like missing data rather than a key mismatch.
            #
            # The APR goes through `_as_decimal_rate` for the percent-vs-decimal ambiguity
            # documented at the top of this module: migration 062 calls `interest_rate` a decimal
            # while other code treats it as a percent, and 22 read as 2,200%/yr would produce a
            # confidently absurd payoff order.
            priced = [
                {"label": d.get("label"), "balance": d.get("balance"),
                 "apr": _as_decimal_rate(d.get("apr")),
                 "min_payment": d.get("minimum_payment")}
                for d in minimums
            ]
            unpriced = [d["label"] for d in priced if d["apr"] is None]
            if unpriced:
                # An unknown APR is not a zero one. Ordering debts by interest rate is the entire
                # point of a payoff plan, so a missing rate is named rather than defaulted.
                gaps.append({"calculator": "debt.payoff_plan",
                             "needs": ["debt_apr"],
                             "ask": [f"What APR are you paying on {', '.join(unpriced[:3])}? "
                                     f"Without it we cannot say which debt to attack first."]})
            else:
                run(debt.payoff_plan, debts=priced,
                    extra_payment=float(_present(inputs, "monthly_debt_payment") or 0.0))
        elif debt_list:
            gaps.append(_gap(inputs, "debt.payoff_plan", ["debt_minimum_payments"]))

        # ── Savings rate ───────────────────────────────────────────────────────────────────────
        annual_savings = _present(inputs, "annual_savings")
        if annual_income and annual_savings is not None:
            run(cash.savings_rate, annual_income=annual_income, annual_savings=float(annual_savings))
        elif annual_income:
            gaps.append(_gap(inputs, "cash.savings_rate", ["annual_savings"]))

        # ── Home affordability: DTI needs the debt side ────────────────────────────────────────
        monthly_debts = _present(inputs, "monthly_debts")
        if annual_income and monthly_debts is not None:
            run(housing.max_monthly_payment, annual_income=annual_income,
                monthly_debts=float(monthly_debts))
        elif annual_income:
            # Named rather than assumed: a missing debt figure makes affordability look BETTER, so
            # defaulting it to zero would be the one error the user never catches.
            gaps.append(_gap(inputs, "housing.max_monthly_payment", ["monthly_debts"]))

        # ── A savings goal the user named ────────────────────────────────────────────────────────
        if savings_goal_amount and savings_goal_months:
            run(money.monthly_contribution_for_target, target=savings_goal_amount,
                current=_present(inputs, "cash_balance") or 0.0, months=int(savings_goal_months))

        # Shared inputs for the growth and interest figures below.
        balance_for_growth = _present(inputs, "investment_balance")
        _hz = _present(inputs, "time_horizon")
        try:
            growth_months = int(float(_hz) * 12) if _hz else None
        except (TypeError, ValueError):
            growth_months = None

        # ── Decisions the user named this turn ───────────────────────────────────────────────────
        #
        # Each of these was declared "ready to wire" while `compute()` had no parameter to carry
        # the input, so the input could never arrive and the calculator could never fire. The
        # inventory said ready; the code said unreachable.

        # A degree, with the cost of the years NOT working included.
        tuition, years = _tv("tuition_total"), _tv("years_in_school")
        sal_before, sal_after = _tv("salary_before"), _tv("salary_after")
        if tuition is not None and years and sal_before is not None:
            run(education.degree_total_cost, tuition_total=float(tuition),
                years_in_school=float(years), salary_before=float(sal_before))
            if sal_after is not None:
                run(education.degree_payback_years, tuition_total=float(tuition),
                    years_in_school=float(years), salary_before=float(sal_before),
                    salary_after=float(sal_after))
                run(education.degree_lifetime_value, tuition_total=float(tuition),
                    years_in_school=float(years), salary_before=float(sal_before),
                    salary_after=float(sal_after))

        # A pension offer. Answered as an implied return, because "which is bigger" depends
        # entirely on how long you live and what the money would otherwise earn.
        lump, annuity = _tv("pension_lump_sum"), _tv("pension_annual_annuity")
        if lump and annuity and current_age:
            run(retirement.pension_lump_sum_vs_annuity, lump_sum=float(lump),
                annual_annuity=float(annuity), current_age=int(current_age))

        # Invest it now or spread it out.
        ls_amount, spread = _tv("lump_sum_amount"), _tv("spread_months")
        if ls_amount and spread:
            run(money.lump_sum_vs_dca, amount=float(ls_amount), spread_months=int(spread))

        # Fund drag over the user's OWN stated horizon, taken from the canonical `time_horizon`
        # (years) and converted to months. Not defaulted: a drag figure is meaningless without
        # knowing how long the money compounds, and inventing 30 years would manufacture the
        # headline number.
        er = _tv("expense_ratio")
        balance = _present(inputs, "investment_balance")
        horizon_years = _present(inputs, "time_horizon")
        if er is not None and balance and horizon_years:
            try:
                months = int(float(horizon_years) * 12)
            except (TypeError, ValueError):
                months = 0
            if months > 0:
                run(money.expense_ratio_drag, balance=float(balance),
                    expense_ratio=float(er), months=months)

        # VA: individual ratings combine against remaining efficiency, never by adding.
        ratings = _tv("va_individual_ratings")
        if ratings:
            run(va.combined_rating, ratings=[float(r) for r in ratings])

        # DIC needs no input at all — the surviving-spouse base rate is flat. Only run it when the
        # household is actually a veteran's, so a non-veteran is not handed a survivor benefit.
        if _present(inputs, "va_disability_rating") is not None:
            run(va.dic)

        # Home affordability, once the down payment is known.
        down = _tv("down_payment")
        monthly_debts_v = _present(inputs, "monthly_debts")
        if annual_income and monthly_debts_v is not None and down:
            run(housing.max_home_price, annual_income=annual_income,
                monthly_debts=float(monthly_debts_v), down_payment=float(down))
        rent = _tv("monthly_rent")
        if rent and home_price_goal:
            run(housing.rent_vs_buy, monthly_rent=float(rent),
                home_price=float(home_price_goal))

        # Competing job offers, compared on TOTAL compensation rather than salary.
        offers = _tv("offers")
        if offers:
            run(career.offer_total_comp, offers=offers)

        # What a debt costs in total, not just when it clears. The figure people are most surprised
        # by, and the one `tools.py` accumulated and then threw away.
        if annual_income is not None:
            for d in (_present(inputs, "debt_minimum_payments") or []):
                apr_d = _as_decimal_rate(d.get("apr"))
                bal, pay = d.get("balance"), d.get("minimum_payment")
                if apr_d and bal and pay:
                    months_p = _months_to_clear(float(bal), apr_d, float(pay))
                    if months_p:
                        run(debt.total_interest, principal=float(bal), apr=apr_d,
                            term_months=months_p)

        # Growth of what they already hold, over their OWN horizon.
        if balance_for_growth is not None and growth_months:
            run(money.future_value, present_value=float(balance_for_growth),
                months=growth_months)

        # ── Tax DETERMINATIONS (Milestone 3.1) ───────────────────────────────────────────────────
        #
        # Run last, because two of the rules need figures the calculator pass produces: the
        # marginal rate (for the after-tax cost of debt and the HSA's value) and whether the user
        # is itemizing (which gates every interest deduction). Recomputing either here would risk a
        # determination that disagreed with the figure sitting next to it in the same packet.
        marginal = next((r.value for r in results
                         if r.calculator == "tax.effective_marginal_rate"), None)
        itemizing = next((r.detail.get("should_itemize") for r in results
                          if r.calculator == "tax.itemized_deductions"), None)
        treatments: dict[str, Any] = {}
        try:
            treatments = TreatmentPlanner().run(
                inputs, turn=t, age=int(current_age) if current_age else None,
                marginal_rate=marginal, itemizing=itemizing, tax_year=tax_year,
                loans=list(_present(inputs, "debt_minimum_payments") or []))
            # The quantified halves join the number gate. A computed amount the gate has not been
            # told about is indistinguishable from a fabricated one, so registering it IS the
            # wiring — but the VERDICT stays in `treatments`, where its authority, failed tests
            # and traps survive. Reducing a determination to its dollar figure would throw away
            # everything that makes it advice.
            for amt in treatments.get("amounts", []):
                bucket = scenario_extra if amt["tier"] == "scenario" else strict_extra
                value = float(amt["value"])
                # A RATE is registered as the percent, not the decimal. `_citable_forms` drops
                # anything below 1.0 on purpose — a decimal like 0.0526 reduces, through the gate's
                # own notation forms, to the string "0", which would license "0" in any sentence.
                # But the model writes "5.26%", so without this the advisor was BLOCKED from
                # stating an after-tax cost of debt the engine had just computed for it.
                if amt.get("unit") == "pct" and abs(value) < 1.0:
                    bucket.update(_citable_forms(round(value * 100, 2)))
                else:
                    bucket.update(_citable_forms(value))
        except Exception as exc:  # noqa: BLE001 — grounding never breaks the turn
            log.warning("treatment planner failed: %s", exc)
            treatments = {}

        strict = [r for r in results if not r.is_scenario]
        scenario = [r for r in results if r.is_scenario]
        packet: dict[str, Any] = {
            "available": bool(results),
            "results": [r.as_dict() for r in results],
            # TIER 1 (advisor_validator's three-tier policy): arithmetic on the user's OWN figures.
            # Statable plainly, because it IS their data.
            "allowed_numbers": sorted(_allowed_numbers(strict) | strict_extra),
            # TIER 3: figures resting on an assumption. The validator admits these EXCEPT inside a
            # possessive personal claim, so "your balance will be $1.2M" stays blocked while
            # "that projects to about $1.2M" passes. Routing scenario results here instead of into
            # allowed_numbers is what makes `tier` load-bearing rather than decorative — dumping
            # everything into Tier 1 would let a 25-year projection be asserted as a present fact.
            "scenario_numbers": sorted(_allowed_numbers(scenario) | scenario_extra),
            # MILESTONE 3.1. Determinations: a verdict, its authority, the test that decided it,
            # and the trap it trails. Prose plus provenance, NOT a number — see
            # advisor_treatments for why `CalcResult` is the wrong shape.
            "treatments": treatments.get("treatments") or [],
            "treatment_gaps": treatments.get("gaps") or [],
            # Fact patterns actively costing the user money — an HSA funded without qualifying
            # coverage, for instance. Not a gap (a missing fact) and not a trap (a future risk):
            # a conflict is a loss in progress, and it outranks everything else in the packet.
            "tax_conflicts": treatments.get("conflicts") or [],
            "unfavourable_with_levers": treatments.get("unfavourable_with_levers") or [],
            "tax_traps": treatments.get("traps") or [],
            "gaps": gaps,
            "tax_year_requested": tax_year,
            "source": "Deterministic calculators over canonical finance inputs",
            "constraints": [
                "Cite these computed figures as given; never recompute or adjust them.",
                "A result with tier='scenario' MUST be presented as an estimate and its assumptions "
                "named — never as the user's actual figure.",
                "A gap is a question to ASK, never a number to assume.",
                "A tax figure states the year's law it was computed on. Never present a figure "
                "from one tax year as though it answered a question about another.",
            ] + (treatments.get("constraints") or []),
        }

        # ── Persistence (Milestone 3.6) ──────────────────────────────────────────────────────────
        #
        # Written AFTER the packet is assembled and before it is returned, so what is stored is
        # exactly what the advisor saw. Best-effort throughout: a storage failure must not cost the
        # user their answer.
        if self._store is not None:
            try:
                uid = getattr(ctx, "user_id", None)
                if uid:
                    # What moved since last time, so the advisor can say WHY a figure changed
                    # rather than silently presenting a different number than it did in June.
                    packet["changes_since_last"] = await self._store.what_changed(
                        uid, packet, inputs)
                    await self._store.save_snapshot(uid, packet, tax_year=tax_year, inputs=inputs)
            except Exception as exc:  # noqa: BLE001 — never break a turn to store a snapshot
                log.warning("calculation persistence skipped: %s", exc)

        return packet


# ── Helpers ───────────────────────────────────────────────────────────────────────────────────────
def _registry(key: str) -> tuple[float, Any]:
    """Registry value plus a calculator-shaped citation."""
    from .calculators.base import from_registry
    return from_registry(key)


def _with_extra_assumption(r: CalcResult, extra: Any, extra_inputs: dict[str, Any]) -> CalcResult:
    """Append an assumption and extra inputs to an already-scenario result."""
    from dataclasses import replace
    return replace(r, assumptions=r.assumptions + (extra,),
                   inputs_used={**r.inputs_used, **extra_inputs})


def _rescope_as_scenario(
    r: CalcResult, *, assumptions: tuple[Any, ...], extra_inputs: dict[str, Any], label: str,
) -> CalcResult:
    """Re-tier a strict result whose INPUTS came from assumptions rather than from the user.

    `debt.amortized_payment` is strict about what it is handed. But when the principal, rate and term
    were themselves derived from registry assumptions, the ANSWER is an estimate — and a strict tier
    would let it be stated as the user's actual payment with no hedge. Tiering follows where the
    inputs came from, not which function produced them.
    """
    from dataclasses import replace
    from .calculators.base import SCENARIO
    return replace(r, tier=SCENARIO, label=label,
                   assumptions=r.assumptions + assumptions,
                   inputs_used={**r.inputs_used, **extra_inputs})


def _allowed_numbers(results: list[CalcResult]) -> set[str]:
    """Every notation a computed value may legitimately appear as in prose.

    Reuses `advisor_math._forms`, which is what the number gate itself normalizes against — so a
    value registered here matches however the model writes it ($45k / 45,000 / 45000). Deriving the
    notations independently would drift from the gate and reject correct answers.
    """
    out: set[str] = set()
    for r in results:
        out |= _citable_forms(float(r.value))
        # Figures in `detail` are the ones that make an answer concrete — total interest, the
        # years-equivalent, what the current balance grows to. Registered too, or the advisor can
        # state the headline and not the context that makes it mean something.
        for v in (r.detail or {}).values():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                out |= _citable_forms(float(v))
    return {s for s in out if s}


# Magnitudes below this are not registered. Two reasons, both about not loosening the gate:
#   * 0 is the single most common token in financial prose. Registering it (a zero turns up in
#     `detail` whenever a contribution or an interest total is nil) would let the model write "0"
#     into any sentence, including a claim about the user's balance.
#   * A fraction like 0.04 reduces, through the gate's own notation forms, to the string "0" — so a
#     rate would silently license that same token. Rates are cited as named assumptions with their
#     own values, not as free-floating figures.
_MIN_CITABLE_MAGNITUDE = 1.0


def _citable_forms(v: float) -> set[str]:
    """Notation forms for a value worth citing; empty for values that would only loosen the gate."""
    if v != v or abs(v) < _MIN_CITABLE_MAGNITUDE:
        return set()
    from .advisor_math import _forms
    return _forms(v)


def _empty(reason: str) -> dict[str, Any]:
    return {"available": False, "results": [], "allowed_numbers": [], "scenario_numbers": [],
            "gaps": [{"calculator": "*", "unavailable": reason}], "source": "unavailable",
            "constraints": []}
