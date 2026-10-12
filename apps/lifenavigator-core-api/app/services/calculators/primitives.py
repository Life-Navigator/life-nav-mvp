"""Shared financial primitives — NPV, IRR, payback, present value (Phase A).

WHY THIS MODULE EXISTS
----------------------
Phases H–L all need the same handful of time-value-of-money operations, and several planned
calculators are thin wrappers over them: `degree_roi` wants NPV and payback, `purchase_worth_it`
wants NPV + IRR + payback + breakeven hold period, `college_comparison` wants all four plus a
growing annuity, `rent_vs_buy` and `refinance_breakeven` want discounted payback. Writing those
operations once, here, is the difference between one audited implementation and nine ad-hoc ones.

The existing `tools.py` shows what the alternative looks like: `degree_roi` computes
`lifetime = annual_gain * 25 - cost` and states in its own limitations that the result is "not
discounted to present value". That is not a small simplification — undiscounted lifetime earnings
overstate a degree's value substantially, and the number is user-facing.

CONVENTIONS, STATED ONCE
------------------------
* **Cash flows are period-indexed from 0.** `flows[0]` happens NOW and is NOT discounted. This is the
  textbook NPV convention and the one every function here follows.
* **A cost is negative, a benefit is positive.** No function infers sign from argument position.
* **Rates are per-period decimals**, matching `base.require_rate`. A yearly flow list takes an annual
  rate; a monthly flow list takes a monthly one. Nothing here guesses the period from the data.
* **Real vs nominal uses Fisher, not subtraction.** See `real_from_nominal`.

These functions return plain floats, like the rate primitives in `base`. They are building blocks:
the calculators that compose them are responsible for producing a `CalcResult` with the right tier.
The three that the advisor cites directly (`npv`, `irr`, `payback_period`) also have registered
`CalcResult` wrappers at the bottom.
"""
from __future__ import annotations

from typing import Optional, Sequence

from .base import (
    SCENARIO,
    STRICT,
    Assumption,
    CalcResult,
    CalculatorError,
    _finite,
    register,
    require_discount_rate,
    require_months,
    require_rate,
)

# IRR search bounds. The lower bound sits just above -100%/period (a total loss, where the
# discount factor (1+r) hits zero and the arithmetic breaks); the upper bound is deliberately
# generous so a genuinely spectacular return is still found rather than silently clamped.
_IRR_LO, _IRR_HI = -0.9999, 10.0
# Bracket width we refine the rate to. 1e-12 rather than 1e-9 because NPV is steep in r: with a
# $10k outlay, dNPV/dr is on the order of -20,000, so a rate accurate to only 1e-9 leaves a
# residual NPV near 1e-5 — visible as "IRR is the rate where NPV is zero" failing by cents.
_IRR_RATE_TOL = 1e-12
# Residual |NPV| at which we accept a root outright.
_IRR_NPV_TOL = 1e-12
_IRR_MAX_ITER = 200
# Subintervals scanned for a sign change before bisecting. Endpoint-only bracketing cannot see a
# root pair that lies strictly INSIDE the bounds: for flows like [-100, 250, -120] the NPV curve is
# negative at both ends and bulges positive between the two real roots, so an endpoint test reports
# "no IRR" for a series that has two. Scanning subintervals finds the first bracketing pair.
_IRR_SCAN_STEPS = 1000


def _flows(name: str, flows: Sequence[float]) -> list[float]:
    """Validate a cash-flow series. Empty is an error, not an empty NPV of 0.0."""
    if flows is None:
        raise CalculatorError(f"{name} is required")
    out = [_finite(f"{name}[{i}]", v) for i, v in enumerate(flows)]
    if not out:
        raise CalculatorError(f"{name} must contain at least one cash flow")
    return out


# ── Discounting ───────────────────────────────────────────────────────────────────────────────────
def present_value(amount: float, rate: float, periods: float) -> float:
    """Value today of `amount` received `periods` from now, discounted at `rate` per period."""
    r = require_discount_rate("rate", rate)
    n = _finite("periods", periods)
    if n < 0:
        raise CalculatorError(f"periods must not be negative, got {n}")
    return amount / ((1.0 + r) ** n)


def npv(rate: float, flows: Sequence[float]) -> float:
    """Net present value of `flows` at `rate` per period, with `flows[0]` at t=0 (undiscounted).

    NOTE on the convention: Excel's `NPV()` discounts its FIRST argument by one period, which is why
    the common spreadsheet idiom is `=C0 + NPV(r, C1:Cn)`. This function follows the textbook
    definition instead — t=0 is not discounted — so porting a spreadsheet formula here means dropping
    that manual `C0 +`. Getting this backwards understates every NPV by one period of discounting.
    """
    r = require_discount_rate("rate", rate)
    cf = _flows("flows", flows)
    return sum(c / ((1.0 + r) ** t) for t, c in enumerate(cf))


def irr(flows: Sequence[float]) -> Optional[float]:
    """Internal rate of return — the `rate` where `npv(rate, flows) == 0`. None when undefined.

    BISECTION, NOT NEWTON — deliberately. Newton-Raphson is faster but can diverge or oscillate on
    the irregular, sign-switching flow series that real decisions produce (a renovation mid-hold, a
    tuition year inside an earnings series). Bisection on a bracketed root cannot diverge, and a
    financial number that is occasionally wrong is worth far less than one that is always right.

    Returns None rather than raising when:
      * every flow has the same sign (no root exists — a series of pure costs has no IRR), or
      * no sign change is found across the search bracket.
    `None` means "this question has no answer", which the advisor must report as such. A zero here
    would read as "0% return", a materially different and false claim.

    Caveat the caller must respect: a series with multiple sign changes can have MULTIPLE real IRRs.
    This returns the LOWEST root in [-99.99%, +1000%]. For such series NPV is the sound criterion,
    and `purchase_worth_it` should lead with NPV for exactly that reason — `irr_result` surfaces
    `irr_is_unique` so a caller can make that switch.

    Roots closer together than the scan resolution (~1.1 percentage points) can still be missed. That
    is a real limit, not a hidden one: such series are pathological for IRR anyway, and NPV is the
    answer there.
    """
    cf = _flows("flows", flows)
    if all(c >= 0 for c in cf) or all(c <= 0 for c in cf):
        return None

    def f(r: float) -> float:
        return sum(c / ((1.0 + r) ** t) for t, c in enumerate(cf))

    # Scan for the first subinterval that brackets a root, so interior root pairs are found.
    step = (_IRR_HI - _IRR_LO) / _IRR_SCAN_STEPS
    lo, f_lo = _IRR_LO, f(_IRR_LO)
    if abs(f_lo) < _IRR_NPV_TOL:
        return lo
    bracket: Optional[tuple[float, float, float]] = None
    for i in range(1, _IRR_SCAN_STEPS + 1):
        hi = _IRR_LO + i * step
        f_hi = f(hi)
        if abs(f_hi) < _IRR_NPV_TOL:
            return hi
        if f_lo * f_hi < 0:
            bracket = (lo, hi, f_lo)
            break
        lo, f_lo = hi, f_hi
    if bracket is None:
        return None

    lo, hi, f_lo = bracket
    for _ in range(_IRR_MAX_ITER):
        mid = (lo + hi) / 2.0
        f_mid = f(mid)
        if abs(f_mid) < _IRR_NPV_TOL or (hi - lo) < _IRR_RATE_TOL:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2.0


# ── Payback ───────────────────────────────────────────────────────────────────────────────────────
def payback_period(flows: Sequence[float]) -> Optional[float]:
    """Periods until cumulative cash flow first turns non-negative, interpolated within the period.

    This is the number the owner asked for by name on every purchase decision. Two properties worth
    stating:

    * **Interpolated, not rounded up.** If the balance crosses from -200 to +600 during period 4, the
      answer is 3.25, not 4. "It pays back in the fourth year" and "it pays back in three and a
      quarter years" are different claims; the second is the true one.
    * **None when it never pays back**, not a sentinel like 999. The advisor must say "this does not
      pay back within the horizon you gave me" rather than quote an absurd number.

    Undiscounted by design — payback's whole appeal is that it is simple and legible. Use
    `discounted_payback_period` when the cost of capital matters, and prefer it for anything
    multi-year.
    """
    cf = _flows("flows", flows)
    cumulative = 0.0
    for t, c in enumerate(cf):
        prior = cumulative
        cumulative += c
        if cumulative < 0:
            continue
        if t == 0:
            return 0.0          # no net outlay to recover
        if c == 0:
            return float(t)     # crossed exactly at a period boundary; nothing to interpolate
        # Interpolate across this period: how far in did the balance reach zero?
        return (t - 1) + (-prior / c)
    return None


def discounted_payback_period(rate: float, flows: Sequence[float]) -> Optional[float]:
    """`payback_period` on discounted flows — payback that respects the cost of capital.

    Always >= the undiscounted payback, and often materially longer. For a purchase financed with
    cash, the discount rate IS the opportunity cost of that cash (`investment_return`), which is why
    `finance_cash` is not free.
    """
    r = require_discount_rate("rate", rate)
    cf = _flows("flows", flows)
    return payback_period([c / ((1.0 + r) ** t) for t, c in enumerate(cf)])


# ── Annuities ─────────────────────────────────────────────────────────────────────────────────────
def growing_annuity_pv(payment: float, rate: float, growth: float, periods: int) -> float:
    """PV of `periods` payments starting at `payment`, growing `growth`/period, discounted at `rate`.

    An ORDINARY annuity: the first payment lands at the END of period 1. (`money.future_value` is an
    annuity-DUE, matching `projector.ts`, which contributes then grows — the two conventions are
    both correct for their purpose and are deliberately kept apart. See `base`'s module docstring.)

    This is the right shape for a salary path, a rent series, or a tuition series — anything that
    escalates. The `rate == growth` branch is a genuine singularity, not a rounding concern: the
    closed form divides by (rate - growth), so a 3% raise discounted at 3% must take the limit
    `payment * periods / (1 + rate)` instead of dividing by zero.
    """
    r = require_discount_rate("rate", rate)
    # Growth may be negative: a declining rent roll or a shrinking earnings path is a real series.
    g = require_discount_rate("growth", growth)
    n = require_months("periods", periods)  # periods, not necessarily months; same validation
    p = _finite("payment", payment)
    if abs(r - g) < 1e-12:
        return p * n / (1.0 + r)
    return (p / (r - g)) * (1.0 - ((1.0 + g) / (1.0 + r)) ** n)


# ── Rate conversions ──────────────────────────────────────────────────────────────────────────────
def real_from_nominal(nominal: float, inflation: float) -> float:
    """Inflation-adjusted rate via FISHER: (1+n)/(1+i) - 1. NOT `nominal - inflation`.

    The subtraction approximation is close at low rates and wrong in the direction that flatters a
    projection. At the registry's own values (`investment_return` 6%, `inflation` 2.5%) subtraction
    gives 3.50% and Fisher gives 3.41% — a 9bp overstatement that compounds. Over a 30-year
    retirement projection on a $500k balance, that is a materially different number presented with
    identical confidence, which is exactly the class of error the calculators exist to remove.
    """
    n = require_rate("nominal", nominal)
    i = require_rate("inflation", inflation)
    return (1.0 + n) / (1.0 + i) - 1.0


def annualize_monthly(monthly_rate: float) -> float:
    """Monthly rate → the annual rate it compounds to: (1+m)^12 - 1.

    The exact inverse of `base.effective_monthly_rate`, so a round-trip is lossless. Deliberately
    NOT `monthly * 12`, which is the lender's nominal convention — see `base.nominal_monthly_rate`.
    """
    m = _finite("monthly_rate", monthly_rate)
    if m <= -1.0:
        raise CalculatorError(f"monthly_rate={m} implies total loss or worse; cannot annualize")
    return (1.0 + m) ** 12 - 1.0


# ── Registered, citable wrappers ──────────────────────────────────────────────────────────────────
# The advisor cites these three directly. They are SCENARIO whenever the discount rate came from the
# registry rather than from the user, which `rate_source` records explicitly: a payback period
# computed against an assumed cost of capital is an estimate, not the user's own arithmetic.
def _rate_assumptions(rate_source: str) -> tuple[tuple[Assumption, ...], str]:
    if rate_source == "registry":
        from .base import from_registry
        _, a = from_registry("investment_return")
        return (a,), SCENARIO
    return (), STRICT


@register("primitives.npv")
def npv_result(*, rate: float, flows: Sequence[float], rate_source: str = "caller",
               label: str = "Net present value") -> CalcResult:
    assumptions, tier = _rate_assumptions(rate_source)
    value = npv(rate, flows)
    return CalcResult(calculator="primitives.npv", label=label, value=round(value, 2), unit="usd",
                      tier=tier, inputs_used={"rate": rate, "periods": len(list(flows))},
                      assumptions=assumptions,
                      detail={"flows": [round(float(f), 2) for f in flows]})


@register("primitives.irr")
def irr_result(*, flows: Sequence[float], label: str = "Internal rate of return") -> CalcResult:
    """STRICT: IRR is derived from the flows alone and assumes no rate."""
    value = irr(flows)
    if value is None:
        raise CalculatorError(
            "these cash flows have no internal rate of return (no sign change) — report net "
            "present value or total cost instead"
        )
    sign_changes = sum(1 for a, b in zip(flows, list(flows)[1:]) if (a < 0) != (b < 0))
    return CalcResult(calculator="primitives.irr", label=label, value=round(value, 6), unit="pct",
                      tier=STRICT, inputs_used={"periods": len(list(flows))},
                      # Surfaced so a caller can downgrade to NPV when the root is not unique.
                      detail={"sign_changes": sign_changes, "irr_is_unique": sign_changes <= 1})


@register("primitives.payback_period")
def payback_period_result(*, flows: Sequence[float], rate: Optional[float] = None,
                          rate_source: str = "caller",
                          label: str = "Payback period") -> CalcResult:
    """Payback in periods. Pass `rate` to discount it; omit for the simple form."""
    if rate is None:
        value, assumptions, tier = payback_period(flows), (), STRICT
    else:
        assumptions, tier = _rate_assumptions(rate_source)
        value = discounted_payback_period(rate, flows)
    if value is None:
        raise CalculatorError(
            "this does not pay back within the horizon given — say so rather than quoting a period"
        )
    return CalcResult(calculator="primitives.payback_period", label=label, value=round(value, 2),
                      unit="years", tier=tier,
                      inputs_used={"periods": len(list(flows)), "discounted": rate is not None},
                      assumptions=assumptions)
