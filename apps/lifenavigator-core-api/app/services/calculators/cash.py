"""Cash-flow and balance-sheet calculators (Phase A consolidation).

WHY ONE TOOL BECAME SEVERAL CALCULATORS
---------------------------------------
`tools.py:emergency_fund` returned five outputs from one function with one confidence score and no
tier. But the five are not the same KIND of number:

    months_covered   = user's cash ÷ user's expenses            → STRICT, it is their data
    target           = user's expenses × an ASSUMED 6 months    → SCENARIO
    gap              = target − cash, so it inherits the assumption → SCENARIO

A single tier per tool cannot express that, so the strict figures were being hedged as estimates and
the assumption-backed ones were not being hedged at all. `CalcResult` carries one figure and one
tier precisely so the validator can treat each correctly — see `base`'s module docstring.

`tools.py` is now a thin adapter that composes these and recomposes the legacy response shape, so
the HTTP contract and every existing caller are unchanged.
"""
from __future__ import annotations

from .base import (
    SCENARIO,
    STRICT,
    CalcResult,
    CalculatorError,
    from_registry,
    register,
    require_money,
)


@register("cash.months_covered")
def months_covered(*, monthly_expenses: float, current_cash: float) -> CalcResult:
    """How many months of expenses the user's cash covers. STRICT — both inputs are theirs."""
    exp = require_money("monthly_expenses", monthly_expenses, allow_zero=False)
    cash = require_money("current_cash", current_cash)
    return CalcResult(
        calculator="cash.months_covered", label="months of expenses your cash covers",
        value=round(cash / exp, 1), unit="months", tier=STRICT,
        inputs_used={"monthly_expenses": exp, "current_cash": cash},
    )


@register("cash.emergency_fund_target")
def emergency_fund_target(*, monthly_expenses: float, target_months: float | None = None) -> CalcResult:
    """Cash needed for a full emergency fund.

    SCENARIO whenever `target_months` comes from the registry: "six months" is guidance, not the
    user's own figure, and the user is entitled to see that it was assumed. `tools.py` previously
    hardcoded `6` inline, which is the inline-assumption rule (R2) broken in the most common tool in
    the suite.
    """
    exp = require_money("monthly_expenses", monthly_expenses, allow_zero=False)
    if target_months is None:
        months, cited = from_registry("emergency_fund_months")
        assumptions, tier = (cited,), SCENARIO
    else:
        months, assumptions, tier = float(target_months), (), STRICT
    if months <= 0:
        raise CalculatorError(f"target_months must be greater than zero, got {months}")
    return CalcResult(
        calculator="cash.emergency_fund_target", label="emergency fund target",
        value=round(exp * months, 2), unit="usd", tier=tier,
        inputs_used={"monthly_expenses": exp, "target_months": months},
        assumptions=assumptions,
    )


@register("cash.emergency_fund_gap")
def emergency_fund_gap(*, monthly_expenses: float, current_cash: float,
                       target_months: float | None = None) -> CalcResult:
    """Shortfall to a full emergency fund. Zero when funded — never negative, which would read as
    'you are $4,000 short' with the sign quietly inverted."""
    target = emergency_fund_target(monthly_expenses=monthly_expenses, target_months=target_months)
    cash = require_money("current_cash", current_cash)
    gap = max(0.0, target.value - cash)
    return CalcResult(
        calculator="cash.emergency_fund_gap", label="emergency fund shortfall",
        value=round(gap, 2), unit="usd", tier=target.tier,
        inputs_used={**target.inputs_used, "current_cash": cash},
        assumptions=target.assumptions,
        detail={"target": target.value, "funded": gap == 0.0,
                "surplus": round(max(0.0, cash - target.value), 2)},
    )


@register("cash.savings_rate")
def savings_rate(*, annual_income: float, annual_savings: float) -> CalcResult:
    """Share of income saved. STRICT — the user's own two numbers.

    The 15-20% "healthy" target that `tools.py` reported alongside this is guidance about the
    figure, not part of it, so it stays in `detail` and out of the cited value.
    """
    inc = require_money("annual_income", annual_income, allow_zero=False)
    sav = require_money("annual_savings", annual_savings)
    return CalcResult(
        calculator="cash.savings_rate", label="savings rate",
        value=round(sav / inc, 4), unit="ratio", tier=STRICT,
        inputs_used={"annual_income": inc, "annual_savings": sav},
        detail={"pct": round(sav / inc * 100, 1), "common_target_pct": 20},
    )


@register("cash.net_worth")
def net_worth(*, assets: float, liabilities: float) -> CalcResult:
    """Assets minus liabilities. STRICT, and the one figure here that may legitimately be negative,
    so it is computed directly rather than through `require_money`'s non-negative guard."""
    a = require_money("assets", assets)
    li = require_money("liabilities", liabilities)
    return CalcResult(
        calculator="cash.net_worth", label="net worth",
        value=round(a - li, 2), unit="usd", tier=STRICT,
        inputs_used={"assets": a, "liabilities": li},
        detail={"negative": (a - li) < 0},
    )
