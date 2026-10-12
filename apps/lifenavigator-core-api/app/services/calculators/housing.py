"""Housing affordability and the rent-vs-buy comparison (Phase A consolidation).

Both figures here are SCENARIO without exception: each rests on the mortgage rate, the term, and the
DTI ratios, none of which the user states. `tools.py` cited the rate but hardcoded `0.28` / `0.36`
and a 30-year term inline, so three of the four assumptions behind "you can afford a $620,000 home"
were invisible to the person reading it.
"""
from __future__ import annotations

from .base import (
    SCENARIO,
    CalcResult,
    from_registry,
    nominal_monthly_rate,
    register,
    require_money,
    require_months,
    require_rate,
)
from .debt import amortized_payment


def _rate_and_term(apr: float | None, term_months: int | None):
    """Mortgage rate and term, from the caller or the registry, with citations for whatever came
    from the registry."""
    cited = []
    if apr is None:
        apr, a = from_registry("mortgage_rate")
        cited.append(a)
    else:
        apr = require_rate("apr", apr)
    if term_months is None:
        term, a = from_registry("mortgage_term_months")
        term_months = int(term)
        cited.append(a)
    else:
        term_months = require_months("term_months", term_months)
    return apr, term_months, tuple(cited)


@register("housing.max_monthly_payment")
def max_monthly_payment(*, annual_income: float, monthly_debts: float) -> CalcResult:
    """The lower of the front-end and back-end DTI limits — the binding constraint on a purchase.

    Returned as its own figure because it is the number that actually explains the answer. "You can
    afford $620,000" is opaque; "your payment ceiling is $3,500/mo, and it is your existing debt
    that sets it, not your income" is advice.
    """
    income = require_money("annual_income", annual_income, allow_zero=False)
    debts = require_money("monthly_debts", monthly_debts)
    front_pct, front_a = from_registry("dti_front_pct")
    back_pct, back_a = from_registry("dti_back_pct")

    monthly = income / 12.0
    front = monthly * front_pct
    back = monthly * back_pct - debts
    ceiling = max(0.0, min(front, back))
    return CalcResult(
        calculator="housing.max_monthly_payment", label="maximum monthly housing payment",
        value=round(ceiling, 2), unit="usd_per_month", tier=SCENARIO,
        inputs_used={"annual_income": income, "monthly_debts": debts},
        assumptions=(front_a, back_a),
        detail={"front_end_limit": round(front, 2), "back_end_limit": round(back, 2),
                # Which rule binds is the actionable part: a back-end bind means paying down debt
                # raises the ceiling, a front-end bind means only more income does.
                "binding_constraint": "back_end_debt" if back < front else "front_end_income",
                "monthly_gross_income": round(monthly, 2)},
    )


@register("housing.max_home_price")
def max_home_price(*, annual_income: float, monthly_debts: float, down_payment: float,
                   apr: float | None = None, term_months: int | None = None) -> CalcResult:
    """Largest purchase price the DTI ceiling supports, plus the down payment.

    Inverts `debt.amortized_payment` — solving the same closed form for principal rather than
    payment — so the two cannot disagree about what a given payment buys.
    """
    ceiling = max_monthly_payment(annual_income=annual_income, monthly_debts=monthly_debts)
    down = require_money("down_payment", down_payment)
    apr, term_months, rate_cited = _rate_and_term(apr, term_months)

    i = nominal_monthly_rate(apr)
    pmt = ceiling.value
    loan = pmt * term_months if i == 0 else pmt * (1.0 - (1.0 + i) ** -term_months) / i
    price = loan + down

    # Round-trip check: the payment this loan implies must match the ceiling we solved from.
    implied = (amortized_payment(principal=loan, apr=apr, term_months=term_months).value
               if loan > 0 else 0.0)
    return CalcResult(
        calculator="housing.max_home_price", label="maximum home price",
        value=round(price, 2), unit="usd", tier=SCENARIO,
        inputs_used={**ceiling.inputs_used, "down_payment": down, "apr": apr,
                     "term_months": term_months},
        assumptions=ceiling.assumptions + rate_cited,
        detail={"max_loan": round(loan, 2), "max_monthly_payment": pmt,
                "implied_payment_check": round(implied, 2),
                "binding_constraint": ceiling.detail["binding_constraint"],
                # Stated rather than buried: this is principal + interest only. Taxes, insurance,
                # HOA and PMI are real monthly cost that this ceiling does not reserve room for,
                # which is why the figure reads high against what a lender finally approves.
                "excludes": ["property_tax", "insurance", "hoa", "pmi", "maintenance"]},
    )


@register("housing.rent_vs_buy")
def rent_vs_buy(*, home_price: float, monthly_rent: float, years: int | None = None,
                down_payment: float | None = None, apr: float | None = None) -> CalcResult:
    """Net cost of buying minus the cost of renting over the horizon. Negative favours buying.

    Returns the DIFFERENCE as the cited value, not a "favors" string, because the magnitude is the
    decision: $4,000 apart over seven years is a coin flip that other factors should settle, and
    $140,000 apart is not. `tools.py` returned the verdict and left the margin in a side field.
    """
    price = require_money("home_price", home_price, allow_zero=False)
    rent = require_money("monthly_rent", monthly_rent, allow_zero=False)
    cited = []

    if down_payment is None:
        pct, a = from_registry("down_payment_pct")
        down = price * pct
        cited.append(a)
    else:
        down = require_money("down_payment", down_payment)
    if years is None:
        y, a = from_registry("rent_vs_buy_horizon")
        years = int(y)
        cited.append(a)
    else:
        years = int(years)
    apr, term_months, rate_cited = _rate_and_term(apr, None)
    cited.extend(rate_cited)
    appreciation, appr_a = from_registry("home_appreciation")
    rent_growth, infl_a = from_registry("inflation")
    cited.extend([appr_a, infl_a])

    loan = max(0.0, price - down)
    pmt = amortized_payment(principal=loan, apr=apr, term_months=term_months).value if loan else 0.0
    buy_outlay = down + pmt * 12 * years
    home_value = price * (1.0 + appreciation) ** years
    # Equity recovered on sale, net of the loan still outstanding at the horizon.
    remaining = loan * ((1.0 + nominal_monthly_rate(apr)) ** (years * 12)) - (
        pmt * (((1.0 + nominal_monthly_rate(apr)) ** (years * 12) - 1.0) / nominal_monthly_rate(apr))
    ) if nominal_monthly_rate(apr) else max(0.0, loan - pmt * 12 * years)
    remaining = max(0.0, remaining)
    equity_out = max(0.0, home_value - remaining)
    net_buy = buy_outlay - equity_out
    rent_total = sum(rent * 12 * (1.0 + rent_growth) ** y for y in range(years))

    return CalcResult(
        calculator="housing.rent_vs_buy", label="buying cost minus renting cost over the horizon",
        value=round(net_buy - rent_total, 2), unit="usd", tier=SCENARIO,
        inputs_used={"home_price": price, "monthly_rent": rent, "years": years,
                     "down_payment": down, "apr": apr},
        assumptions=tuple(cited),
        detail={"net_buy_cost": round(net_buy, 2), "total_rent_cost": round(rent_total, 2),
                "favors": "buy" if net_buy < rent_total else "rent",
                "monthly_payment": round(pmt, 2),
                "home_value_at_horizon": round(home_value, 2),
                "loan_remaining_at_horizon": round(remaining, 2),
                "equity_recovered": round(equity_out, 2),
                "excludes": ["closing_costs", "maintenance", "property_tax", "insurance",
                             "tax_deductions", "opportunity_cost_of_down_payment"]},
    )
