"""Debt calculators: amortized payment, payoff time, total interest, avalanche ordering.

All of these use the LENDER convention `nominal_monthly_rate` (apr / 12), matching how APRs are
quoted and how `projector.ts` computes its mortgage payment. Using the exact-equivalent monthly rate
here would produce a payment that no lender would recognise.

Every figure in this module is STRICT when it rests only on the user's own numbers: a payment
computed from the user's balance, their APR and their term is arithmetic on their data, not a
forecast, so it needs no hedging. The one exception is marked.
"""
from __future__ import annotations

from typing import Any, Iterable

from .base import (
    STRICT,
    CalcResult,
    CalculatorError,
    nominal_monthly_rate,
    register,
    require_money,
    require_months,
    require_rate,
)


@register("debt.amortized_payment")
def amortized_payment(*, principal: float, apr: float, term_months: int) -> CalcResult:
    """Level monthly payment that retires `principal` over `term_months` at `apr`.

        pmt = P·r / (1 − (1+r)^−n)        r = apr/12

    This is the formula the advisor could not express: `(1+r)^-n` needs exponentiation, and the
    derivation verifier has none. Identical to `projector.ts`'s `home_purchase` branch.

    The zero-APR case is a genuine singularity (the denominator collapses to 0), not an edge case to
    paper over — an interest-free loan amortizes to plain `P/n`.
    """
    p = require_money("principal", principal, allow_zero=False)
    r_annual = require_rate("apr", apr)
    n = require_months("term_months", term_months)

    if r_annual == 0:
        pmt = p / n
    else:
        r = nominal_monthly_rate(r_annual)
        pmt = (p * r) / (1.0 - (1.0 + r) ** (-n))

    return CalcResult(
        calculator="debt.amortized_payment",
        label="monthly payment",
        value=round(pmt, 2),
        unit="usd_per_month",
        tier=STRICT,
        inputs_used={"principal": p, "apr": r_annual, "term_months": n},
        detail={"total_paid": round(pmt * n, 2), "total_interest": round(pmt * n - p, 2)},
    )


@register("debt.total_interest")
def total_interest(*, principal: float, apr: float, term_months: int) -> CalcResult:
    """Total interest paid over the full term — `pmt·n − P`.

    Separate from the payment because it is the number that actually changes behaviour: the monthly
    figure feels affordable; the lifetime figure is what makes a 30-year term legible.
    """
    pay = amortized_payment(principal=principal, apr=apr, term_months=term_months)
    p = pay.inputs_used["principal"]
    n = pay.inputs_used["term_months"]
    return CalcResult(
        calculator="debt.total_interest",
        label="total interest over the full term",
        value=round(pay.value * n - p, 2),
        unit="usd",
        tier=STRICT,
        inputs_used=dict(pay.inputs_used),
        detail={"monthly_payment": pay.value, "total_paid": round(pay.value * n, 2)},
    )


@register("debt.payoff_months")
def payoff_months(*, balance: float, apr: float, monthly_payment: float) -> CalcResult:
    """How many months a fixed payment takes to clear a balance.

        n = −ln(1 − r·B/pmt) / ln(1+r)        r = apr/12

    Raises when the payment does not exceed the first month's interest: the balance then GROWS and
    there is no finite answer. That has to be an error rather than a large number, because "it never
    gets paid off" is the single most important thing the user could be told here — and a calculator
    that returned 9,999 months would let the advisor bury it as a figure.
    """
    b = require_money("balance", balance, allow_zero=False)
    r_annual = require_rate("apr", apr)
    pmt = require_money("monthly_payment", monthly_payment, allow_zero=False)

    if r_annual == 0:
        import math
        n = math.ceil(b / pmt)
        return _payoff_result(b, r_annual, pmt, n, interest=0.0)

    r = nominal_monthly_rate(r_annual)
    first_month_interest = b * r
    if pmt <= first_month_interest:
        raise CalculatorError(
            f"a {pmt:,.2f}/mo payment never clears a {b:,.2f} balance at {r_annual:.2%} APR — "
            f"the first month's interest alone is {first_month_interest:,.2f}, so the balance grows"
        )

    import math
    exact = -math.log(1.0 - (r * b) / pmt) / math.log(1.0 + r)
    n = math.ceil(exact)
    return _payoff_result(b, r_annual, pmt, n, interest=round(pmt * exact - b, 2))


def _payoff_result(balance: float, apr: float, pmt: float, months: int, *, interest: float) -> CalcResult:
    return CalcResult(
        calculator="debt.payoff_months",
        label="months to pay off",
        value=float(months),
        unit="months",
        tier=STRICT,
        inputs_used={"balance": balance, "apr": apr, "monthly_payment": pmt},
        detail={"years": round(months / 12.0, 1), "total_interest": interest},
    )


@register("debt.avalanche_order")
def avalanche_order(*, debts: Iterable[dict[str, Any]]) -> CalcResult:
    """Order debts highest-APR-first — the avalanche, which minimises total interest paid.

    Matches `projector.ts applyExtraDebtPayment`, which sorts by APR descending. The VALUE here is
    the count of debts ordered; the ordering itself is in `detail` because a list is not a citable
    figure and must not enter the number allowlist as one.

    Ties keep their input order (Python's sort is stable), so the result is deterministic — two
    identical-APR debts must not swap places between turns and make the advice look unstable.
    """
    rows: list[dict[str, Any]] = []
    for i, d in enumerate(debts or []):
        if not isinstance(d, dict):
            raise CalculatorError(f"debts[{i}] must be a mapping, got {type(d).__name__}")
        rows.append({
            "label": str(d.get("label") or f"debt_{i + 1}"),
            "balance": require_money(f"debts[{i}].balance", d.get("balance", 0)),
            "apr": require_rate(f"debts[{i}].apr", d.get("apr", 0)),
        })
    if not rows:
        raise CalculatorError("avalanche_order needs at least one debt")

    ordered = sorted(rows, key=lambda r: r["apr"], reverse=True)
    return CalcResult(
        calculator="debt.avalanche_order",
        label="debts ordered highest-interest first",
        value=float(len(ordered)),
        unit="count",
        tier=STRICT,
        inputs_used={"debt_count": len(ordered)},
        detail={
            "order": [r["label"] for r in ordered],
            "debts": ordered,
            "target": ordered[0]["label"],
            "total_balance": round(sum(r["balance"] for r in ordered), 2),
        },
    )
