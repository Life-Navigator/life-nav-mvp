"""Phase A primitives — verified against hand-derived and published values, never self-consistently.

Rule R8: a test written from the same formula as the implementation proves only that the code
matches itself. Every expected value below is derived independently — closed-form algebra, a
published worked example, or an explicit simulation.
"""
from __future__ import annotations

import math

import pytest

from app.services.calculators import primitives as P
from app.services.calculators.base import CalculatorError, effective_monthly_rate


# ── NPV ───────────────────────────────────────────────────────────────────────────────────────────
def test_npv_matches_hand_discounting():
    # -100 + 60/1.1 + 60/1.21 = -100 + 54.545454... + 49.586776... = 4.132231...
    expected = -100 + 60 / 1.1 + 60 / 1.1**2
    assert P.npv(0.10, [-100, 60, 60]) == pytest.approx(expected, abs=1e-9)
    assert P.npv(0.10, [-100, 60, 60]) == pytest.approx(4.1322314, abs=1e-6)


def test_npv_leaves_t0_undiscounted():
    """The convention that differs from Excel's NPV(). t=0 must not be discounted."""
    assert P.npv(0.25, [-1000]) == -1000.0
    # If t=0 were discounted by one period this would be -800.
    assert P.npv(0.25, [-1000, 0]) == -1000.0


def test_npv_zero_rate_is_plain_sum():
    assert P.npv(0.0, [-100, 30, 30, 50]) == pytest.approx(10.0)


def test_npv_requires_flows():
    with pytest.raises(CalculatorError, match="at least one cash flow"):
        P.npv(0.05, [])


# ── IRR ───────────────────────────────────────────────────────────────────────────────────────────
def test_irr_matches_closed_form_quadratic():
    """-100 + 60x + 60x^2 = 0 where x = 1/(1+r) → 3x^2 + 3x - 5 = 0.

    x = (-3 + sqrt(69)) / 6, so r = 1/x - 1. Solved algebraically, not by re-running the solver.
    """
    x = (-3 + math.sqrt(69)) / 6
    expected = 1 / x - 1
    assert P.irr([-100, 60, 60]) == pytest.approx(expected, abs=1e-7)
    assert P.irr([-100, 60, 60]) == pytest.approx(0.1306623, abs=1e-6)


def test_irr_is_the_rate_where_npv_is_zero():
    """The defining property, checked against the independent npv implementation.

    Tolerance scales with the flows: NPV is steep in r, so a fixed dollar tolerance would be
    strict for a $100 decision and loose for a $10k one.
    """
    for flows in ([-1000, 400, 400, 400], [-500, 100, 150, 200, 250], [-10000, 3000, 4000, 5000]):
        r = P.irr(flows)
        assert r is not None
        scale = max(abs(c) for c in flows)
        assert abs(P.npv(r, flows)) < 1e-6 * scale


def test_irr_brackets_zero_so_the_rate_itself_is_precise():
    """Scale-free check on the RATE's precision: nudging it either way must straddle zero."""
    flows = [-10000, 3000, 4000, 5000]
    r = P.irr(flows)
    assert P.npv(r - 1e-6, flows) * P.npv(r + 1e-6, flows) < 0


def test_irr_can_be_negative():
    """A loss-making purchase has a real, negative IRR, and the user needs to be told it."""
    assert P.irr([-100, 80]) == pytest.approx(-0.20, abs=1e-9)
    assert P.irr([-1000, 250, 250, 250]) < 0


def test_irr_finds_a_root_strictly_inside_the_bounds():
    """Endpoint-only bracketing missed these: NPV is negative at both ends and bulges positive
    between two real roots. 120x^2 - 250x + 100 = 0 gives x = 1.5434, so r = 1/x - 1 = -0.35208."""
    x = (2.5 + math.sqrt(1.45)) / 2.4
    assert P.irr([-100, 250, -120]) == pytest.approx(1 / x - 1, abs=1e-7)


def test_irr_returns_none_when_no_real_root_exists():
    """250x^2 - 300x + 100 = 0 has a negative discriminant — genuinely no IRR, not a solver miss."""
    assert (300**2 - 4 * 250 * 100) < 0
    assert P.irr([-100, 300, -250]) is None


def test_irr_doubling_in_one_period_is_100_pct():
    assert P.irr([-100, 200]) == pytest.approx(1.0, abs=1e-7)


def test_irr_returns_none_for_all_negative_flows():
    """A series of pure costs has no IRR. None, never 0.0 — '0% return' would be a false claim."""
    assert P.irr([-100, -50, -25]) is None


def test_irr_returns_none_for_all_positive_flows():
    assert P.irr([100, 50]) is None


def test_irr_reports_non_uniqueness_rather_than_hiding_it():
    """Multiple sign changes ⇒ possibly multiple real roots. The caller must be able to tell, so
    `purchase_worth_it` can lead with NPV instead."""
    res = P.irr_result(flows=[-100, 250, -120])
    assert res.detail["sign_changes"] == 2
    assert res.detail["irr_is_unique"] is False

    clean = P.irr_result(flows=[-100, 60, 60])
    assert clean.detail["sign_changes"] == 1
    assert clean.detail["irr_is_unique"] is True


def test_irr_result_raises_rather_than_returning_a_sentinel():
    with pytest.raises(CalculatorError, match="no internal rate of return"):
        P.irr_result(flows=[-100, -50])


# ── Payback ───────────────────────────────────────────────────────────────────────────────────────
def test_payback_interpolates_within_the_period():
    """Cumulative: -100, -40, +20. Zero is crossed 40/60 of the way through period 2 → 1.667.

    Rounding up to 2.0 would be a different and less true claim.
    """
    assert P.payback_period([-100, 60, 60]) == pytest.approx(1 + 40 / 60, abs=1e-9)


def test_payback_exact_boundary_is_a_whole_period():
    assert P.payback_period([-100, 50, 50]) == pytest.approx(2.0)
    assert P.payback_period([-100, 100]) == pytest.approx(1.0)


def test_payback_none_when_it_never_recovers():
    assert P.payback_period([-100, 10, 10]) is None


def test_payback_zero_when_there_is_no_outlay():
    assert P.payback_period([0, 50]) == 0.0
    assert P.payback_period([25, 50]) == 0.0


def test_discounted_payback_is_never_shorter_than_simple():
    flows = [-1000, 300, 300, 300, 300, 300]
    simple = P.payback_period(flows)
    disc = P.discounted_payback_period(0.08, flows)
    assert simple is not None and disc is not None
    assert disc > simple


def test_discounted_payback_matches_manual_discounting():
    flows = [-100, 60, 60]
    manual = P.payback_period([-100, 60 / 1.1, 60 / 1.1**2])
    assert P.discounted_payback_period(0.10, flows) == pytest.approx(manual, abs=1e-12)


def test_discounted_payback_can_be_none_where_simple_is_not():
    """The cost of capital is what turns a nominal win into a loss — the whole point of discounting."""
    flows = [-1000, 200, 200, 200, 200, 210]
    assert P.payback_period(flows) is not None
    assert P.discounted_payback_period(0.20, flows) is None


def test_payback_result_raises_when_it_never_pays_back():
    with pytest.raises(CalculatorError, match="does not pay back"):
        P.payback_period_result(flows=[-100, 10])


# ── Growing annuity ───────────────────────────────────────────────────────────────────────────────
def test_growing_annuity_matches_explicit_summation():
    """Independent check: sum the discounted payments one by one."""
    pay, r, g, n = 1000.0, 0.07, 0.03, 10
    manual = sum(pay * (1 + g) ** t / (1 + r) ** (t + 1) for t in range(n))
    assert P.growing_annuity_pv(pay, r, g, n) == pytest.approx(manual, abs=1e-8)


def test_growing_annuity_singularity_when_rate_equals_growth():
    """r == g divides by zero in the closed form; the limit is payment*n/(1+r)."""
    assert P.growing_annuity_pv(100, 0.03, 0.03, 10) == pytest.approx(100 * 10 / 1.03, abs=1e-9)


def test_growing_annuity_is_continuous_across_the_singularity():
    """Approaching r == g from either side must converge on the limit, or the branch is a cliff."""
    limit = P.growing_annuity_pv(100, 0.03, 0.03, 10)
    near_below = P.growing_annuity_pv(100, 0.03, 0.03 - 1e-7, 10)
    near_above = P.growing_annuity_pv(100, 0.03, 0.03 + 1e-7, 10)
    assert near_below == pytest.approx(limit, rel=1e-5)
    assert near_above == pytest.approx(limit, rel=1e-5)


def test_growing_annuity_zero_growth_is_an_ordinary_annuity():
    pay, r, n = 500.0, 0.06, 12
    ordinary = pay * (1 - (1 + r) ** -n) / r
    assert P.growing_annuity_pv(pay, r, 0.0, n) == pytest.approx(ordinary, abs=1e-8)


# ── Rate conversions ──────────────────────────────────────────────────────────────────────────────
def test_real_from_nominal_uses_fisher_not_subtraction():
    """At the registry's own values the subtraction approximation overstates by ~9bp."""
    fisher = P.real_from_nominal(0.06, 0.025)
    assert fisher == pytest.approx(1.06 / 1.025 - 1, abs=1e-12)
    assert fisher == pytest.approx(0.0341463, abs=1e-6)
    assert fisher < 0.06 - 0.025           # Fisher is always below the naive difference
    assert (0.06 - 0.025) - fisher == pytest.approx(0.00085366, abs=1e-7)


def test_real_from_nominal_is_negative_when_inflation_wins():
    assert P.real_from_nominal(0.02, 0.05) < 0


def test_annualize_monthly_round_trips_effective_monthly_rate():
    """Exact inverse of base.effective_monthly_rate — a lossless round trip, or they disagree."""
    for annual in (0.0, 0.025, 0.06, 0.12, 0.35):
        assert P.annualize_monthly(effective_monthly_rate(annual)) == pytest.approx(annual, abs=1e-12)


def test_annualize_monthly_is_not_simple_multiplication():
    """0.5%/month compounds to 6.1678%, not 6% — the lender/growth distinction base.py documents."""
    assert P.annualize_monthly(0.005) == pytest.approx(1.005**12 - 1, abs=1e-12)
    assert P.annualize_monthly(0.005) == pytest.approx(0.0616778, abs=1e-6)
    assert P.annualize_monthly(0.005) != pytest.approx(0.06, abs=1e-4)


def test_annualize_rejects_total_loss():
    with pytest.raises(CalculatorError, match="total loss"):
        P.annualize_monthly(-1.0)


# ── Contract ──────────────────────────────────────────────────────────────────────────────────────
def test_registry_rate_makes_the_result_scenario_tier():
    """R3: a figure resting on a registry assumption can never be presented as the user's own."""
    strict = P.npv_result(rate=0.07, flows=[-100, 60, 60], rate_source="caller")
    assert strict.tier == "strict" and strict.assumptions == ()

    scenario = P.npv_result(rate=0.06, flows=[-100, 60, 60], rate_source="registry")
    assert scenario.tier == "scenario"
    assert [a.key for a in scenario.assumptions] == ["investment_return"]
    assert scenario.assumptions[0].source == "registry"


def test_irr_result_is_strict_because_it_assumes_no_rate():
    assert P.irr_result(flows=[-100, 60, 60]).tier == "strict"


def test_all_primitives_are_registered_under_their_ids():
    from app.services.calculators import base
    for cid in ("primitives.npv", "primitives.irr", "primitives.payback_period"):
        assert base.get(cid) is not None, cid
        assert cid in base.available()


def test_rates_above_one_are_rejected_as_unconverted_percents():
    """R5, inherited from require_rate: 7 means 7%, and silently projecting 700% is the failure."""
    with pytest.raises(CalculatorError, match="looks like a percent"):
        P.npv(7.0, [-100, 60])
    with pytest.raises(CalculatorError, match="looks like a percent"):
        P.present_value(100, 25.0, 3)


def test_nan_and_infinity_never_reach_a_citable_figure():
    for bad in (float("nan"), float("inf")):
        with pytest.raises(CalculatorError, match="finite"):
            P.npv(0.05, [-100, bad])


# ── Discount rate vs growth rate ──────────────────────────────────────────────────────────────────
def test_discounting_accepts_a_negative_rate_but_growth_does_not():
    """Two validators, deliberately. A negative RETURN assumption is almost always a sign error;
    a negative DISCOUNT rate is deflation, and a negative IRR is a real answer."""
    assert P.npv(-0.02, [-100, 60, 60]) > P.npv(0.02, [-100, 60, 60])
    assert P.present_value(100, -0.02, 3) > 100

    from app.services.calculators.base import require_rate
    with pytest.raises(CalculatorError, match="must not be negative"):
        require_rate("annual_rate", -0.02)


def test_discount_rate_at_or_below_minus_one_is_rejected():
    """(1 + r) hits zero there and every discount factor divides by it."""
    for bad in (-1.0, -1.5):
        with pytest.raises(CalculatorError, match="below -100%"):
            P.npv(bad, [-100, 60])


def test_growing_annuity_accepts_a_declining_series():
    """A shrinking rent roll or earnings path is real; growth must be allowed to go negative."""
    declining = P.growing_annuity_pv(1000, 0.07, -0.02, 10)
    flat = P.growing_annuity_pv(1000, 0.07, 0.0, 10)
    assert 0 < declining < flat
    manual = sum(1000 * (1 - 0.02) ** t / 1.07 ** (t + 1) for t in range(10))
    assert declining == pytest.approx(manual, abs=1e-8)
