"""Retirement calculators: balance at a target age, and what that balance supports.

Both are SCENARIO tier without exception. A retirement projection rests on a return assumption over
decades, where small differences compound into very different answers — presenting one as if it were
the user's own figure would be the most consequential version of the fabrication this platform is
built to avoid.
"""
from __future__ import annotations

from typing import Any

from .base import (
    Assumption,
    CalcResult,
    CalculatorError,
    SCENARIO,
    from_registry,
    register,
    require_money,
    require_rate,
)
from .money import future_value
from .primitives import irr, npv

# The withdrawal rate comes from the CENTRAL assumption registry (`withdrawal_rate`, the "4% rule"),
# not from a constant here — the registry is the one place the platform states what it assumes, and
# it carries the basis text shown to the user. `advisor_validator` treats public planning constants
# differently from the user's own numbers precisely so a figure like this can be used without being
# passed off as personal data.
_MAX_AGE = 120


def _withdrawal(withdrawal_rate: float | None) -> tuple[float, tuple[Assumption, ...]]:
    """Resolve the withdrawal rate, citing the registry when the caller did not supply one."""
    if withdrawal_rate is None:
        rate, cited = from_registry("withdrawal_rate")
        if rate <= 0:
            raise CalculatorError("registry withdrawal_rate must be greater than zero")
        return rate, (cited,)
    rate = require_rate("withdrawal_rate", withdrawal_rate)
    if rate == 0:
        raise CalculatorError("withdrawal_rate must be greater than zero")
    return rate, (Assumption("withdrawal_rate", rate, "withdrawal rate supplied for this estimate"),)


@register("retirement.projected_balance")
def projected_balance(
    *, current_balance: float, current_age: int, target_age: int,
    monthly_contribution: float = 0.0, annual_return: float | None = None,
) -> CalcResult:
    """Balance at `target_age`, compounding `current_balance` plus monthly contributions.

    Delegates the arithmetic to `money.future_value` rather than re-deriving it: one compound-growth
    implementation means a fix lands everywhere, and two would eventually disagree.
    """
    ages = _ages(current_age, target_age)
    months = ages["years_to_target"] * 12

    fv = future_value(
        present_value=current_balance,
        months=months,
        annual_return=annual_return,
        monthly_contribution=monthly_contribution,
    )

    return CalcResult(
        calculator="retirement.projected_balance",
        label=f"projected retirement balance at {ages['target_age']}",
        value=fv.value,
        unit="usd",
        tier=SCENARIO,
        inputs_used={
            "current_balance": fv.inputs_used["present_value"],
            "monthly_contribution": fv.inputs_used["monthly_contribution"],
            "annual_return": fv.inputs_used["annual_return"],
            **ages,
        },
        assumptions=fv.assumptions,
        detail={
            "years_of_growth": ages["years_to_target"],
            "total_contributed": fv.detail["total_contributed"],
            "growth_earned": fv.detail["growth_earned"],
        },
    )


@register("retirement.sustainable_income")
def sustainable_income(
    *, balance: float, withdrawal_rate: float | None = None,
) -> CalcResult:
    """Annual income a balance supports at a safe withdrawal rate.

    Answers the question a projected balance always provokes and rarely gets: a seven-figure number
    is meaningless until it is expressed as the income it replaces.
    """
    b = require_money("balance", balance, allow_zero=False)
    rate, assumptions = _withdrawal(withdrawal_rate)
    annual = b * rate
    return CalcResult(
        calculator="retirement.sustainable_income",
        label="sustainable annual income from this balance",
        value=round(annual, 2),
        unit="usd_per_year",
        tier=SCENARIO,
        inputs_used={"balance": b, "withdrawal_rate": rate},
        assumptions=assumptions,
        detail={"monthly": round(annual / 12.0, 2)},
    )


@register("retirement.balance_needed")
def balance_needed(
    *, desired_annual_income: float, withdrawal_rate: float | None = None,
) -> CalcResult:
    """Balance required to support a desired annual income — the inverse of `sustainable_income`.

    This is the direction users actually think in ("I want $80k/yr"), and at a 4% rate the answer is
    25x, which is the kind of figure that reframes a plan.
    """
    income = require_money("desired_annual_income", desired_annual_income, allow_zero=False)
    rate, assumptions = _withdrawal(withdrawal_rate)
    needed = income / rate
    return CalcResult(
        calculator="retirement.balance_needed",
        label="balance needed to support that income",
        value=round(needed, 2),
        unit="usd",
        tier=SCENARIO,
        inputs_used={"desired_annual_income": income, "withdrawal_rate": rate},
        assumptions=assumptions,
        detail={"multiple_of_income": round(1.0 / rate, 1)},
    )


def _ages(current_age: Any, target_age: Any) -> dict[str, int]:
    """Validate an age pair and return the span. Ages are years, not months."""
    try:
        cur, tgt = int(current_age), int(target_age)
    except (TypeError, ValueError) as exc:
        raise CalculatorError(
            f"ages must be whole years, got current_age={current_age!r} target_age={target_age!r}"
        ) from exc
    if cur < 0 or tgt < 0:
        raise CalculatorError("ages must not be negative")
    if tgt > _MAX_AGE or cur > _MAX_AGE:
        raise CalculatorError(f"ages must be at most {_MAX_AGE}")
    if tgt <= cur:
        raise CalculatorError(
            f"target_age ({tgt}) must be after current_age ({cur}) — there is nothing to project"
        )
    return {"current_age": cur, "target_age": tgt, "years_to_target": tgt - cur}


@register("retirement.pension_lump_sum_vs_annuity")
def pension_lump_sum_vs_annuity(
    *, lump_sum: float, annual_annuity: float, current_age: int,
    life_expectancy: int = 95, cola: float = 0.0,
    survivor_pct: float = 0.0, spouse_age: int | None = None,
    spouse_life_expectancy: int | None = None,
    annual_return: float | None = None,
) -> CalcResult:
    """Take the lump sum, or the pension? Answered as an IMPLIED RETURN.

    WHY THE IMPLIED RETURN IS THE RIGHT HEADLINE. Comparing "$500,000 today" with "$32,000 a year
    for life" has no common unit, so people compare the wrong things — usually the lump sum against
    one year of payments, which makes the annuity look tiny. The honest question is: **what rate
    would you have to earn on the lump sum to reproduce that income stream for as long as you live?**
    That number is directly comparable to what the household can actually expect, and it converts an
    incomparable choice into a single judgement.

    If the implied return is 3% and the portfolio assumption is 6%, the lump sum is likely better on
    expectation. If it is 7%, the pension is offering a guaranteed rate the market may not beat —
    and it is offering it *with* longevity insurance, which no portfolio provides.

    THREE THINGS THAT DECIDE REAL CASES AND GET FORGOTTEN
    ----------------------------------------------------
    1. **COLA.** Most private pensions are NOT inflation-adjusted. A fixed $32,000 is worth about
       $15,000 of today's money after 30 years at 2.5%, so an un-indexed annuity quietly loses half
       its value over a long retirement. `cola=0.0` is therefore the DEFAULT and the result says so
       loudly, because a comparison that ignores it systematically flatters the pension.
    2. **Longevity.** The annuity is insurance against living a long time, so the answer depends on
       how long you live. `detail.breakeven_age` is the age at which the annuity's payments have
       matched investing the lump sum at the expected return.
    3. **Survivorship.** A joint-and-survivor election pays less but continues to the spouse. Taking
       the single-life payment because it is larger, while a dependent spouse would outlive it, is
       among the most consequential irreversible mistakes in this area.

    NOT MODELLED, and stated rather than implied: the credit risk of the sponsor (PBGC guarantees
    are capped and a plan CAN fail), the tax difference between a direct lump sum and one rolled to
    an IRA, and any early-retirement subsidy inside the pension formula.
    """
    lump = require_money("lump_sum", lump_sum, allow_zero=False)
    payment = require_money("annual_annuity", annual_annuity, allow_zero=False)
    ages = _ages(current_age, life_expectancy)
    years = ages["years_to_target"]
    if years < 1:
        raise CalculatorError(
            f"life_expectancy {life_expectancy} must be at least a year beyond current_age "
            f"{current_age} for there to be a stream to value")

    indexation = require_rate("cola", cola)
    survivor = require_rate("survivor_pct", survivor_pct)
    rate, assumptions = _return_rate_for_pension(annual_return)

    # The payment stream the pension actually delivers, year by year.
    stream: list[float] = []
    for t in range(years):
        stream.append(payment * ((1.0 + indexation) ** t))

    # Survivor continuation: after the member's life expectancy, a reduced payment continues for
    # the spouse's remaining years. Modelled only when a spouse is actually supplied — inventing one
    # would change the answer on the most consequential election here.
    survivor_years = 0
    if survivor > 0 and spouse_age is not None:
        spouse_le = spouse_life_expectancy or life_expectancy
        member_death_spouse_age = spouse_age + years
        survivor_years = max(0, spouse_le - member_death_spouse_age)
        for t in range(survivor_years):
            stream.append(payment * survivor * ((1.0 + indexation) ** (years + t)))

    # Implied return: the rate at which the lump sum exactly funds the stream.
    implied = irr([-lump] + stream)

    # Present value of the stream at the household's expected return — the apples-to-apples
    # comparison against the lump sum sitting in the portfolio.
    pv_at_expected = npv(rate, [0.0] + stream)

    # Breakeven: the age at which the PRESENT VALUE of the payments received so far equals the lump
    # sum.
    #
    # MUST BE DISCOUNTED, and my first version was not. Comparing UNDISCOUNTED cumulative payments
    # against a lump sum COMPOUNDED at the expected return mixes two bases: the lump grows
    # geometrically while the payments accumulate linearly, so on a long horizon the lump "wins"
    # that comparison even for a pension the implied return clearly favours. It reported "never
    # overtakes" for a pension it had just called the better choice — internally contradictory.
    #
    # Discounting both sides to today makes the breakeven consistent with `implied_return` by
    # construction: when the implied return exceeds the expected one, a breakeven exists within the
    # horizon, and when it does not, there is none.
    breakeven_age: int | None = None
    pv_to_date = 0.0
    for t, cash in enumerate(stream):
        pv_to_date += cash / ((1.0 + rate) ** (t + 1))
        if pv_to_date >= lump:
            breakeven_age = ages["current_age"] + t + 1
            break

    erosion = None
    if indexation == 0.0:
        from . import versioned_data as _vd  # noqa: F401  (kept local; see note below)
        inflation, infl_cited = from_registry("inflation")
        assumptions = assumptions + (infl_cited,)
        erosion = payment / ((1.0 + inflation) ** years)

    return CalcResult(
        calculator="retirement.pension_lump_sum_vs_annuity",
        label="return the lump sum would have to earn to match the pension",
        value=round(implied, 6) if implied is not None else 0.0,
        unit="pct", tier=SCENARIO,
        inputs_used={"lump_sum": lump, "annual_annuity": payment,
                     "current_age": ages["current_age"], "life_expectancy": life_expectancy,
                     "cola": indexation, "survivor_pct": survivor,
                     "spouse_age": spouse_age, "expected_return": rate},
        assumptions=assumptions,
        detail={
            "implied_return": round(implied, 6) if implied is not None else None,
            "expected_return": rate,
            # The verdict, in the only terms that compare.
            "favours": ("pension" if implied is not None and implied > rate else "lump sum"),
            "margin_vs_expected": (round(implied - rate, 6) if implied is not None else None),
            "annuity_present_value": round(pv_at_expected, 2),
            "lump_sum": lump,
            "pv_advantage_of_pension": round(pv_at_expected - lump, 2),
            "breakeven_age": breakeven_age,
            # Disambiguates `None`, which would otherwise read as "not computed".
            "breakeven_note": (
                f"the pension's payments overtake the lump sum invested at {rate:.1%} at age "
                f"{breakeven_age}" if breakeven_age is not None else
                f"the pension never overtakes the lump sum invested at {rate:.1%} within this "
                f"life expectancy — living longer is what would change that"),
            "payments_valued": len(stream),
            "survivor_years_included": survivor_years,
            "survivor_modelled": survivor > 0 and spouse_age is not None,
            "cola": indexation,
            "is_inflation_adjusted": indexation > 0,
            # The warning that decides real cases.
            "inflation_warning": (
                None if indexation > 0 else
                f"This pension is NOT inflation-adjusted. ${payment:,.0f}/yr will buy about "
                f"${erosion:,.0f} of today's goods by age {life_expectancy} — a fixed annuity "
                f"quietly loses about half its value over a long retirement, and a comparison that "
                f"ignores it flatters the pension."),
            "survivor_warning": (
                None if survivor > 0 or spouse_age is None else
                "No survivor benefit is modelled. Electing the larger single-life payment while a "
                "dependent spouse would outlive it is among the most consequential irreversible "
                "mistakes available here."),
            "excludes": ["sponsor credit risk (PBGC guarantees are capped and plans can fail)",
                         "the tax difference between a direct lump sum and an IRA rollover",
                         "any early-retirement subsidy inside the pension formula"],
        },
    )


def _return_rate_for_pension(annual_return: float | None) -> tuple[float, tuple[Assumption, ...]]:
    """Expected portfolio return for the comparison, from the registry unless supplied."""
    if annual_return is None:
        rate, cited = from_registry("investment_return")
        return rate, (cited,)
    return require_rate("annual_return", annual_return), ()
