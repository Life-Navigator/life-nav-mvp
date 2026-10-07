"""Growth calculators: future value, and the contribution needed to hit a target.

These use `effective_monthly_rate` ((1+r)^(1/12) − 1), matching `projector.ts monthlyRate`, because
a stated annual RETURN is an annual outcome: 6%/yr must compound to exactly 6% over 12 months, not
to 6.17% as r/12 would.

Everything here that takes a return rate is SCENARIO tier. A projection is not the user's data no
matter how carefully it is computed, and the assumption that produced it has to travel with it.
"""
from __future__ import annotations

from .base import (
    SCENARIO,
    STRICT,
    Assumption,
    CalcResult,
    CalculatorError,
    effective_monthly_rate,
    register,
    require_money,
    require_months,
    require_rate,
)

# Used only when a caller asks for a projection WITHOUT naming a return. Deliberately conservative:
# a long-run real (after-inflation) equity return, not a nominal headline figure, so a projection is
# in today's dollars and does not flatter itself with inflation it then ignores.
_DEFAULT_REAL_RETURN = 0.05
_DEFAULT_REAL_RETURN_RATIONALE = (
    "5%/yr real (after-inflation) return — a conservative long-run diversified-portfolio assumption; "
    "results are in today's dollars"
)


def _return_rate(annual_return: float | None) -> tuple[float, tuple[Assumption, ...]]:
    """Resolve the return rate, recording an Assumption when the caller did not supply one."""
    if annual_return is None:
        return _DEFAULT_REAL_RETURN, (
            Assumption("annual_return", _DEFAULT_REAL_RETURN, _DEFAULT_REAL_RETURN_RATIONALE),
        )
    r = require_rate("annual_return", annual_return)
    # A caller-supplied rate is still an assumption about the future — it is just THEIR assumption.
    return r, (Assumption("annual_return", r, "return rate used for this projection"),)


@register("money.future_value")
def future_value(
    *, present_value: float, months: int, annual_return: float | None = None,
    monthly_contribution: float = 0.0,
) -> CalcResult:
    """Value of a balance plus optional monthly contributions after `months`.

        FV = PV·(1+i)^n + C·((1+i)^n − 1)/i·(1+i)        i = effective monthly rate

    ANNUITY-DUE, NOT ORDINARY — the trailing `(1+i)` is load-bearing.
    `projector.ts` adds each month's contribution and THEN applies growth in the same month, so every
    contribution earns return in the month it is made. That is an annuity *due*. The ordinary-annuity
    form (no trailing factor) assumes end-of-month contributions that earn nothing until the
    following month, and it understates the result by exactly one month's growth — about 0.5%/yr at
    a 6% return, compounding into a visible gap over a 20-year horizon. Matching the existing engine
    matters more than which convention is textbook-default.

    `(1+i)^n` is the exponentiation the derivation verifier cannot express — the whole reason this
    function exists rather than being left to the model.
    """
    pv = require_money("present_value", present_value)
    n = require_months("months", months)
    c = require_money("monthly_contribution", monthly_contribution)
    if pv == 0 and c == 0:
        raise CalculatorError("future_value needs a starting balance or a monthly contribution")

    r, assumptions = _return_rate(annual_return)
    i = effective_monthly_rate(r)

    if i == 0:
        fv = pv + c * n
    else:
        growth = (1.0 + i) ** n
        # The (1 + i) factor makes this an annuity DUE — see the docstring.
        fv = pv * growth + c * ((growth - 1.0) / i) * (1.0 + i)

    contributed = c * n
    return CalcResult(
        calculator="money.future_value",
        label="projected balance",
        value=round(fv, 2),
        unit="usd",
        tier=SCENARIO,
        inputs_used={"present_value": pv, "months": n, "monthly_contribution": c,
                     "annual_return": r},
        assumptions=assumptions,
        detail={
            "years": round(n / 12.0, 1),
            "total_contributed": round(contributed, 2),
            # The persuasive decomposition: how much of the end balance you put in vs. what growth added.
            "growth_earned": round(fv - pv - contributed, 2),
        },
    )


@register("money.monthly_contribution_for_target")
def monthly_contribution_for_target(
    *, target: float, current: float, months: int, annual_return: float | None = None,
) -> CalcResult:
    """Monthly contribution needed to reach `target` from `current` in `months`.

        C = (target − PV·(1+i)^n) · i / (((1+i)^n − 1)·(1+i))

    NOTE this is NOT the TypeScript `calculateMonthlyContribution`, which differs in TWO ways:
      * it ignores growth on the EXISTING balance (it solves `remaining / annuity_factor`, where
        `remaining = target − current`), understating what the current balance contributes and so
        overstating the required saving; and
      * it uses the NOMINAL monthly rate (`annualReturn / 12 / 100`) on a percent-valued argument,
        where this module uses the effective rate on a decimal fraction.
    Here the present value is grown forward first and the annuity-due factor is used, which is the
    solution that actually lands on the target. The divergence is deliberate and is asserted by
    simulation in the tests.

    Returns 0 when the current balance already grows past the target unaided — a real and useful
    answer ("you don't need to add anything"), not a negative contribution.
    """
    t = require_money("target", target, allow_zero=False)
    pv = require_money("current", current)
    n = require_months("months", months)
    r, assumptions = _return_rate(annual_return)
    i = effective_monthly_rate(r)

    if i == 0:
        needed = max(0.0, t - pv)
        pmt = needed / n
        projected_pv = pv
    else:
        growth = (1.0 + i) ** n
        projected_pv = pv * growth
        shortfall = t - projected_pv
        # Annuity DUE, matching future_value and projector.ts (contribute, then grow). Solving with
        # the ordinary-annuity factor here would overstate the required contribution and the result
        # would overshoot the target.
        pmt = 0.0 if shortfall <= 0 else shortfall * i / ((growth - 1.0) * (1.0 + i))

    return CalcResult(
        calculator="money.monthly_contribution_for_target",
        label="monthly contribution needed",
        value=round(pmt, 2),
        unit="usd_per_month",
        tier=SCENARIO,
        inputs_used={"target": t, "current": pv, "months": n, "annual_return": r},
        assumptions=assumptions,
        detail={
            "years": round(n / 12.0, 1),
            "current_balance_grows_to": round(projected_pv, 2),
            "already_on_track": pmt == 0.0,
            "total_contributions": round(pmt * n, 2),
        },
    )


@register("money.monthly_surplus")
def monthly_surplus(*, monthly_income: float, monthly_expenses: float) -> CalcResult:
    """Income minus expenses.

    STRICT — the only calculator here that assumes nothing. It is pure subtraction of two figures the
    user stated, so it is their data and needs no scenario hedge. Included because it is the input
    almost every other calculator wants, and routing it through the same contract means its
    provenance is recorded identically.
    """
    inc = require_money("monthly_income", monthly_income)
    exp = require_money("monthly_expenses", monthly_expenses)
    surplus = inc - exp
    return CalcResult(
        calculator="money.monthly_surplus",
        label="monthly surplus",
        value=round(surplus, 2),
        unit="usd_per_month",
        tier=STRICT,
        inputs_used={"monthly_income": inc, "monthly_expenses": exp},
        detail={
            "is_deficit": surplus < 0,
            # Savings rate is a ratio of the user's own numbers, so it stays strict too.
            "savings_rate_pct": round(100.0 * surplus / inc, 1) if inc > 0 else None,
        },
    )
