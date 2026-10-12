"""Growth calculators: future value, and the contribution needed to hit a target.

These use `effective_monthly_rate` ((1+r)^(1/12) − 1), matching `projector.ts monthlyRate`, because
a stated annual RETURN is an annual outcome: 6%/yr must compound to exactly 6% over 12 months, not
to 6.17% as r/12 would.

Everything here that takes a return rate is SCENARIO tier. A projection is not the user's data no
matter how carefully it is computed, and the assumption that produced it has to travel with it.
"""
from __future__ import annotations

from typing import Any

from .base import (
    Assumption,
    CalcResult,
    CalculatorError,
    SCENARIO,
    STRICT,
    effective_monthly_rate,
    from_registry,
    register,
    require_discount_rate,
    require_money,
    require_months,
    require_rate,
)

def _return_rate(annual_return: float | None, *,
                 allow_loss: bool = False) -> tuple[float, tuple[Assumption, ...]]:
    """Resolve the return rate, recording an Assumption either way.

    An unsupplied rate comes from the CENTRAL assumption registry (`investment_return`), never from a
    constant in this module — see `base.from_registry` for why that distinction is load-bearing.

    `allow_loss` permits a NEGATIVE rate, and is opt-in rather than the default on purpose. For a
    growth projection a negative return is almost always a sign error, so `require_rate` rejecting
    it catches bugs. But a net-of-fee rate legitimately goes negative when the expense ratio exceeds
    the gross return — a real case for some insurance and annuity products — and
    `expense_ratio_drag` needs to PROJECT that rather than refuse it, because the fee consuming the
    whole return IS the finding. One shared implementation, with the guard made explicit.
    """
    if annual_return is None:
        rate, cited = from_registry("investment_return")
        return rate, (cited,)
    r = (require_discount_rate("annual_return", annual_return) if allow_loss
         else require_rate("annual_return", annual_return))
    # A caller-supplied rate is still an assumption about the future — it is just THEIR assumption.
    return r, (Assumption("annual_return", r, "return rate supplied for this projection"),)


@register("money.future_value")
def future_value(
    *, present_value: float, months: int, annual_return: float | None = None,
    monthly_contribution: float = 0.0, allow_loss: bool = False,
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

    r, assumptions = _return_rate(annual_return, allow_loss=allow_loss)
    # A negative annual return compounds monthly too; `effective_monthly_rate` guards against
    # percent-vs-decimal confusion and rejects negatives, so the loss path converts directly.
    i = effective_monthly_rate(r) if r >= 0 else (1.0 + r) ** (1.0 / 12.0) - 1.0

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


@register("money.expense_ratio_drag")
def expense_ratio_drag(
    *, balance: float, expense_ratio: float, months: int,
    annual_return: float | None = None, monthly_contribution: float = 0.0,
) -> CalcResult:
    """What a fund's expense ratio costs over the whole horizon.

    WHY THIS IS WORTH ITS OWN CALCULATOR. The headline figure is unintuitive by an order of
    magnitude, because the fee is not the cost — the fee PLUS everything the fee would have earned
    is the cost. A 1% expense ratio does not cost 1% a year or even 30% over thirty years; it
    compounds against you, and on a long horizon it routinely consumes a quarter of the terminal
    balance. Nobody reads "0.95%" and pictures that.

    It is also the single most actionable number in a portfolio review: changing a fund is a
    one-afternoon decision with no change in risk, return expectation or tax, which is not true of
    almost any other lever the advisor can offer.

    Implemented as the difference between two `future_value` runs — gross return versus
    `gross - expense_ratio` — so it cannot drift from the projection engine it is compared against.
    """
    pv = require_money("balance", balance)
    ratio = require_rate("expense_ratio", expense_ratio)
    n = require_months("months", months)
    contribution = require_money("monthly_contribution", monthly_contribution)
    if pv == 0 and contribution == 0:
        raise CalculatorError("expense_ratio_drag needs a balance or a monthly contribution")

    gross, assumptions = _return_rate(annual_return)
    if ratio >= gross:
        # Not an error — a high-fee product in a low-return environment really can consume the whole
        # expected return. Reported rather than refused, because that IS the finding.
        pass
    net = max(-0.99, gross - ratio)

    without = future_value(present_value=pv, months=n, annual_return=gross,
                           monthly_contribution=contribution)
    with_fee = future_value(present_value=pv, months=n, annual_return=net,
                            monthly_contribution=contribution, allow_loss=True)
    drag = without.value - with_fee.value
    share = drag / without.value if without.value else 0.0

    return CalcResult(
        calculator="money.expense_ratio_drag",
        label="lifetime cost of this expense ratio",
        value=round(drag, 2), unit="usd", tier=SCENARIO,
        inputs_used={"balance": pv, "expense_ratio": ratio, "months": n,
                     "monthly_contribution": contribution, "gross_return": gross},
        assumptions=assumptions,
        detail={
            "balance_without_fee": without.value,
            "balance_with_fee": with_fee.value,
            # The number that lands: the fee's share of what you would otherwise have had.
            "share_of_terminal_balance": round(share, 4),
            "net_return": round(net, 6),
            "years": round(n / 12.0, 1),
            "fee_consumes_entire_return": ratio >= gross,
            "note": (f"a {ratio:.2%} expense ratio over {n / 12:.0f} years costs "
                     f"{share:.0%} of the balance you would otherwise have had — the fee plus "
                     f"everything the fee would have earned"),
        },
    )


@register("money.purchasing_power")
def purchasing_power(
    *, future_amount: float, months: int, inflation: float | None = None,
) -> CalcResult:
    """A future amount restated in TODAY's dollars.

    THE HONEST REFRAME OF EVERY PROJECTION. "You will have $2.1 million in thirty years" is true and
    misleading: at 2.5% inflation that is about $1.0 million of today's purchasing power. Users
    anchor on the nominal figure and plan against a number that does not exist, and no projection
    that reports only the nominal total is telling them what they need to know.

    Discounted by inflation alone — this converts units, it does not apply a cost of capital, so it
    is not an NPV. `detail.erosion_share` is how much of the headline figure is inflation rather
    than growth.
    """
    amount = require_money("future_amount", future_amount, allow_zero=False)
    n = require_months("months", months)
    if inflation is None:
        rate, cited = from_registry("inflation")
        assumptions: tuple[Assumption, ...] = (cited,)
    else:
        rate, assumptions = require_rate("inflation", inflation), ()

    today = amount / ((1.0 + rate) ** (n / 12.0))
    return CalcResult(
        calculator="money.purchasing_power",
        label="that amount in today's dollars",
        value=round(today, 2), unit="usd", tier=SCENARIO,
        inputs_used={"future_amount": amount, "months": n, "inflation": rate},
        assumptions=assumptions,
        detail={
            "years": round(n / 12.0, 1),
            "erosion": round(amount - today, 2),
            "erosion_share": round(1 - today / amount, 4),
            "note": (f"${amount:,.0f} in {n / 12:.0f} years is about ${today:,.0f} of today's "
                     f"purchasing power at {rate:.1%} inflation — "
                     f"{1 - today / amount:.0%} of the headline figure is inflation, not growth"),
            "is_unit_conversion_not_npv": True,
        },
    )


@register("money.lump_sum_vs_dca")
def lump_sum_vs_dca(
    *, amount: float, spread_months: int, annual_return: float | None = None,
    adverse_return: float | None = None,
) -> CalcResult:
    """Invest it all now, or spread it over `spread_months`?

    THE DETERMINISTIC ANSWER IS USELESS, so this does not give only that one. With any positive
    expected return, investing immediately wins by construction — the un-invested cash earns
    nothing while it waits. Reporting that as "the answer" would dress an assumption up as advice,
    because the question is not about the expected case at all.

    The real question is sequence risk and regret: a lump sum invested the month before a crash is
    the outcome people are actually trying to avoid, and spreading buys insurance against exactly
    that, paid for in forgone expected return. So BOTH are returned — the expected-case advantage of
    going now, and what happens to each under an adverse path — and the verdict says the choice is
    a risk-tolerance question rather than an optimisation.
    """
    total = require_money("amount", amount, allow_zero=False)
    n = require_months("spread_months", spread_months)
    if n < 2:
        raise CalculatorError(
            "spreading over a single month is the same as investing now — pass at least 2")

    expected, assumptions = _return_rate(annual_return)
    # `require_discount_rate`, not `require_rate`: an ADVERSE market return is legitimately
    # negative, and that is precisely the distinction the two validators exist to draw —
    # `require_rate` guards growth ASSUMPTIONS, where a negative is almost always a sign error.
    adverse = (require_discount_rate("adverse_return", adverse_return)
               if adverse_return is not None else None)

    def outcome(rate: float) -> tuple[float, float]:
        """(lump-sum value, dollar-cost-averaged value) at the end of the spread window."""
        i = effective_monthly_rate(rate) if rate >= 0 else rate / 12.0
        lump = total * ((1.0 + i) ** n)
        # Equal instalments, each invested at the START of its month (annuity-due), matching
        # `future_value` and `projector.ts`.
        per = total / n
        dca = (per * (((1.0 + i) ** n - 1.0) / i) * (1.0 + i)) if i else total
        return lump, dca

    lump_exp, dca_exp = outcome(expected)
    advantage = lump_exp - dca_exp

    detail: dict[str, Any] = {
        "months_spread": n,
        "expected_return": expected,
        "lump_sum_value": round(lump_exp, 2),
        "dca_value": round(dca_exp, 2),
        "lump_sum_advantage": round(advantage, 2),
        "advantage_share": round(advantage / total, 4),
        "verdict": "investing now wins in the expected case, by construction",
        "why_the_expected_case_is_not_the_answer": (
            "With any positive expected return, going now always wins — the cash earns nothing "
            "while it waits. The real question is what happens if the market falls during the "
            "window, and that is a risk-tolerance decision, not an optimisation."),
    }

    if adverse is not None:
        lump_bad, dca_bad = outcome(adverse)
        detail.update({
            "adverse_return": adverse,
            "lump_sum_value_adverse": round(lump_bad, 2),
            "dca_value_adverse": round(dca_bad, 2),
            # Spreading buys insurance here; this is its payout.
            "dca_protection_adverse": round(dca_bad - lump_bad, 2),
            "note": (f"at {adverse:.0%}, spreading leaves ${dca_bad - lump_bad:,.0f} more than "
                     f"investing at once — that is what the forgone "
                     f"${advantage:,.0f} of expected return buys"),
        })

    return CalcResult(
        calculator="money.lump_sum_vs_dca",
        label="advantage of investing now rather than spreading",
        value=round(advantage, 2), unit="usd", tier=SCENARIO,
        inputs_used={"amount": total, "spread_months": n, "annual_return": expected,
                     "adverse_return": adverse},
        assumptions=assumptions,
        detail=detail,
    )
