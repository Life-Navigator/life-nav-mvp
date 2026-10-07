"""Retirement calculators: balance at a target age, and what that balance supports.

Both are SCENARIO tier without exception. A retirement projection rests on a return assumption over
decades, where small differences compound into very different answers — presenting one as if it were
the user's own figure would be the most consequential version of the fabrication this platform is
built to avoid.
"""
from __future__ import annotations

from typing import Any

from .base import (
    SCENARIO,
    Assumption,
    CalcResult,
    CalculatorError,
    from_registry,
    register,
    require_money,
    require_rate,
)
from .money import future_value

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
