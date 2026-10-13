"""Education cost and payback calculators (Phase A consolidation).

Phase H/J replace these with `net_price`, `aid_estimate`, `college_529_projection` and
`college_comparison`, which discount properly and risk-adjust for completion. What is here is the
honest minimum: total cost including foregone earnings, and how long the uplift takes to repay it.

ONE DELIBERATE CHANGE FROM `tools.py:degree_roi`
-----------------------------------------------
The old lifetime figure was `annual_gain * 25 - cost` — undiscounted, and its own `limitations`
admitted as much. Undiscounted lifetime earnings overstate a degree's value substantially: at a 6%
discount rate, a dollar earned in year 25 is worth 23 cents today. `degree_lifetime_value` now
returns a present value via `primitives.npv`, and `degree_payback_years` uses the shared
`payback_period` primitive so it interpolates within the year instead of rounding.
"""
from __future__ import annotations

from .base import (
    require_rate,
    SCENARIO,
    STRICT,
    CalcResult,
    CalculatorError,
    from_registry,
    register,
    require_money,
)
from .primitives import npv, payback_period


@register("education.degree_total_cost")
def degree_total_cost(*, tuition_total: float, years_in_school: float,
                      salary_before: float,
                      salary_forgone_share: float = 1.0) -> CalcResult:
    """Tuition plus foregone earnings. STRICT — the user's own tuition, years and current salary.

    Foregone earnings are usually the larger half and the one people omit. A two-year program at
    $80k tuition against a $90k salary costs $260k, not $80k.

    `salary_forgone_share` is how much of that salary actually stops. It defaults to 1.0 —
    full-time study, every caller's previous behaviour — and is the parameter that lets ONE cost
    model serve both enrolment modes. It was previously a hardcoded constant in two places: 1.0
    implicitly here and 0.5 in `education_roi._PART_TIME_FORGONE`, which meant two implementations
    of the same formula that could only ever disagree. `education.programs.modality` makes the
    share a stored fact rather than either module's assumption.
    """
    tuition = require_money("tuition_total", tuition_total)
    years = require_money("years_in_school", years_in_school, allow_zero=False)
    before = require_money("salary_before", salary_before)
    share = require_rate("salary_forgone_share", salary_forgone_share)
    lost = before * years * share
    return CalcResult(
        calculator="education.degree_total_cost", label="total cost of the degree",
        value=round(tuition + lost, 2), unit="usd", tier=STRICT,
        inputs_used={"tuition_total": tuition, "years_in_school": years,
                     "salary_before": before, "salary_forgone_share": share},
        detail={"tuition": tuition, "foregone_earnings": round(lost, 2),
                # NOTE the two similarly-named figures measure different things:
                # `salary_forgone_share` is how much of the salary stops (an input);
                # `foregone_share` is how much of the TOTAL COST is lost earnings (an output).
                "foregone_share": round(lost / (tuition + lost), 3) if (tuition + lost) else 0.0,
                "enrolment": ("full-time" if share >= 0.999 else
                              "part-time" if share > 0 else "no earnings forgone")},
    )


@register("education.degree_payback_years")
def degree_payback_years(*, tuition_total: float, years_in_school: float,
                         salary_before: float, salary_after: float) -> CalcResult:
    """Years of salary uplift needed to repay the total cost.

    STRICT: cost and uplift are both the user's figures, and no rate is applied. Raises when the
    uplift is zero or negative — "this degree does not pay back" is the answer, and a sentinel
    number would be read as a duration.
    """
    cost = degree_total_cost(tuition_total=tuition_total, years_in_school=years_in_school,
                             salary_before=salary_before)
    after = require_money("salary_after", salary_after, allow_zero=False)
    before = cost.inputs_used["salary_before"]
    uplift = after - before
    if uplift <= 0:
        raise CalculatorError(
            f"the stated post-degree salary (${after:,.0f}) is not above the current one "
            f"(${before:,.0f}), so there is no uplift to repay the cost — say that, rather than "
            f"quoting a payback period"
        )
    # Year 0 is the full cost; each later year returns the uplift. The shared primitive interpolates.
    years = int(cost.inputs_used["years_in_school"])
    flows = [-cost.value] + [uplift] * (years + 40)
    pb = payback_period(flows)
    if pb is None:  # unreachable with a positive uplift, but never return None as a number
        raise CalculatorError("cost does not pay back within a 40-year horizon")
    return CalcResult(
        calculator="education.degree_payback_years", label="years to pay back the degree",
        value=round(pb, 1), unit="years", tier=STRICT,
        inputs_used={**cost.inputs_used, "salary_after": after},
        detail={"total_cost": cost.value, "annual_uplift": round(uplift, 2),
                "foregone_earnings": cost.detail["foregone_earnings"]},
    )


@register("education.degree_lifetime_value")
def degree_lifetime_value(*, tuition_total: float, years_in_school: float, salary_before: float,
                          salary_after: float, horizon_years: int | None = None,
                          discount_rate: float | None = None) -> CalcResult:
    """PRESENT VALUE of the degree: the discounted uplift stream minus the cost.

    SCENARIO — it rests on a working-years horizon and a discount rate, neither of which the user
    stated. This is the figure that replaced an undiscounted `annual_gain * 25 - cost`.
    """
    cost = degree_total_cost(tuition_total=tuition_total, years_in_school=years_in_school,
                             salary_before=salary_before)
    after = require_money("salary_after", salary_after, allow_zero=False)
    uplift = after - cost.inputs_used["salary_before"]
    cited = []
    if horizon_years is None:
        h, a = from_registry("working_years_horizon")
        horizon_years = int(h)
        cited.append(a)
    if discount_rate is None:
        discount_rate, a = from_registry("investment_return")
        cited.append(a)

    flows = [-cost.value] + [uplift] * int(horizon_years)
    pv = npv(discount_rate, flows)
    undiscounted = uplift * int(horizon_years) - cost.value
    return CalcResult(
        calculator="education.degree_lifetime_value",
        label="present value of the degree over the horizon",
        value=round(pv, 2), unit="usd", tier=SCENARIO,
        inputs_used={**cost.inputs_used, "salary_after": after,
                     "horizon_years": int(horizon_years), "discount_rate": discount_rate},
        assumptions=tuple(cited),
        detail={"total_cost": cost.value, "annual_uplift": round(uplift, 2),
                # Both shown on purpose: the gap between them IS the cost of discounting, and it is
                # usually large enough that a user who has seen only the undiscounted figure has a
                # materially wrong impression.
                "undiscounted_net_gain": round(undiscounted, 2),
                "discounting_reduces_by": round(undiscounted - pv, 2),
                "worth_it": pv > 0},
    )
