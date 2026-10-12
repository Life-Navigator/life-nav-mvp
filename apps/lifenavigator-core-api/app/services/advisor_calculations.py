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

from .calculators import CalcResult, CalculatorError, cash, career, debt, money, retirement
from .calculators import tax as tax_calc
from .calculators import versioned_data as _vd

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

    def __init__(self, resolver: Any) -> None:
        self._resolver = resolver  # FinancialInputResolver — provenance-carrying canonical inputs

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
    ) -> dict[str, Any]:
        """Run every calculator this user's real data supports. Never raises into the turn."""
        try:
            resolved = await self._resolver.resolve(ctx)
            inputs = resolved.get("inputs") or {}
        except Exception as exc:  # noqa: BLE001 — grounding is an enhancement, never a turn-breaker
            log.warning("calculation planner: canonical inputs unavailable: %s", exc)
            return _empty("canonical finance inputs unavailable")

        results: list[CalcResult] = []
        gaps: list[dict[str, Any]] = []

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
                run(retirement.projected_balance, current_balance=retirement_balance,
                    current_age=current_age, target_age=target_retirement_age)
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

            # PRIOR-YEAR QUESTIONS. "What did I pay in 2024?" is answerable because every table is
            # kept, not replaced — but only if the year reaches the calculators. Without this the
            # advisor silently answered every tax question on the current year, which is wrong in a
            # way the user cannot see: the figure looks like an answer to what they asked.
            run_tax(tax_calc.federal_income_tax, gross_income=annual_income,
                    filing_status=filing_status, tax_year=tax_year)
            run_tax(tax_calc.fica, wages=annual_income, filing_status=filing_status,
                    tax_year=tax_year)
            # The highest-value tax figure for an advisor: every Roth, pre-tax-contribution and
            # raise question turns on the marginal rate, and `assumptions.marginal_tax_rate` has
            # been standing in for it.
            run_tax(tax_calc.effective_marginal_rate, gross_income=annual_income,
                    filing_status=filing_status, tax_year=tax_year)
            tax_state = _present(inputs, "tax_state")
            if tax_state:
                run_tax(tax_calc.state_income_tax, taxable_income=annual_income,
                        state=str(tax_state), filing_status=filing_status, tax_year=tax_year)
        elif annual_income:
            gaps.append(_gap(inputs, "tax.effective_marginal_rate", ["filing_status"]))

        # ── A savings goal the user named ────────────────────────────────────────────────────────
        if savings_goal_amount and savings_goal_months:
            run(money.monthly_contribution_for_target, target=savings_goal_amount,
                current=_present(inputs, "cash_balance") or 0.0, months=int(savings_goal_months))

        strict = [r for r in results if not r.is_scenario]
        scenario = [r for r in results if r.is_scenario]
        return {
            "available": bool(results),
            "results": [r.as_dict() for r in results],
            # TIER 1 (advisor_validator's three-tier policy): arithmetic on the user's OWN figures.
            # Statable plainly, because it IS their data.
            "allowed_numbers": sorted(_allowed_numbers(strict)),
            # TIER 3: figures resting on an assumption. The validator admits these EXCEPT inside a
            # possessive personal claim, so "your balance will be $1.2M" stays blocked while
            # "that projects to about $1.2M" passes. Routing scenario results here instead of into
            # allowed_numbers is what makes `tier` load-bearing rather than decorative — dumping
            # everything into Tier 1 would let a 25-year projection be asserted as a present fact.
            "scenario_numbers": sorted(_allowed_numbers(scenario)),
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
            ],
        }


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
