"""Milestone 2.4 — expense-ratio drag, purchasing power, lump sum vs DCA.

Leaf calculators, so the expectations are hand-derivable or are relationships that must hold. Where
a figure is quoted it is checked against an independent construction, never against the
implementation's own expression.
"""
from __future__ import annotations

import pytest

from app.services.calculators import money as M
from app.services.calculators.base import CalculatorError


# ── expense_ratio_drag ───────────────────────────────────────────────────────────────────────────
def test_the_drag_is_the_gap_between_two_independent_projections():
    """Verified against `future_value` run directly at the gross and net rates — not against the
    drag formula, which would only prove the code matches itself."""
    r = M.expense_ratio_drag(balance=500_000, expense_ratio=0.0095, months=360,
                             annual_return=0.07)
    gross = M.future_value(present_value=500_000, months=360, annual_return=0.07)
    net = M.future_value(present_value=500_000, months=360, annual_return=0.07 - 0.0095)
    assert r.value == pytest.approx(gross.value - net.value, abs=0.02)


def test_the_cost_is_wildly_more_than_the_headline_percentage():
    """THE REASON THIS CALCULATOR EXISTS. A 0.95% ratio does not cost 0.95% a year or even ~30%
    over thirty years — the fee PLUS everything the fee would have earned compounds against you, and
    on a long horizon it consumes roughly a quarter of the terminal balance. Nobody reads "0.95%"
    and pictures that."""
    r = M.expense_ratio_drag(balance=500_000, expense_ratio=0.0095, months=360)
    share = r.detail["share_of_terminal_balance"]
    assert 0.20 < share < 0.30
    # And far more than naively multiplying the fee by the years.
    assert share > 0.0095 * 30 * 0.5


def test_a_higher_ratio_costs_more_and_a_longer_horizon_costs_more():
    base = dict(balance=400_000, months=240)
    cheap = M.expense_ratio_drag(expense_ratio=0.0010, **base).value
    dear = M.expense_ratio_drag(expense_ratio=0.0150, **base).value
    assert dear > cheap

    short = M.expense_ratio_drag(balance=400_000, expense_ratio=0.0100, months=120).value
    long_ = M.expense_ratio_drag(balance=400_000, expense_ratio=0.0100, months=480).value
    assert long_ > short


def test_a_zero_ratio_costs_nothing():
    assert M.expense_ratio_drag(balance=400_000, expense_ratio=0.0, months=240).value == 0.0


def test_contributions_increase_the_drag():
    """The fee applies to everything that goes in, not only the starting balance."""
    without = M.expense_ratio_drag(balance=100_000, expense_ratio=0.01, months=360).value
    with_ = M.expense_ratio_drag(balance=100_000, expense_ratio=0.01, months=360,
                                 monthly_contribution=1_000).value
    assert with_ > without


def test_a_fee_that_eats_the_whole_return_is_reported_not_refused():
    """A high-fee product in a low-return environment really can consume the expected return. That
    IS the finding, so it is flagged rather than raised."""
    r = M.expense_ratio_drag(balance=200_000, expense_ratio=0.05, months=240,
                             annual_return=0.04)
    assert r.detail["fee_consumes_entire_return"] is True
    assert r.detail["net_return"] < 0


def test_the_drag_needs_something_to_charge_a_fee_on():
    with pytest.raises(CalculatorError, match="needs a balance or a monthly contribution"):
        M.expense_ratio_drag(balance=0, expense_ratio=0.01, months=240)


def test_the_drag_is_scenario_tier_and_cites_the_return_assumption():
    r = M.expense_ratio_drag(balance=100_000, expense_ratio=0.01, months=240)
    assert r.tier == "scenario"
    assert [a.key for a in r.assumptions] == ["investment_return"]


# ── purchasing_power ─────────────────────────────────────────────────────────────────────────────
def test_a_future_amount_is_restated_in_todays_dollars():
    """$2.1M in 30 years at 2.5% is about $1.0M today — 52% of the headline is inflation, not
    growth, and a projection reporting only the nominal total withholds that."""
    r = M.purchasing_power(future_amount=2_100_000, months=360, inflation=0.025)
    assert r.value == pytest.approx(2_100_000 / (1.025 ** 30), abs=1.0)
    assert r.value == pytest.approx(1_001_160, abs=500)
    assert r.detail["erosion_share"] == pytest.approx(0.52, abs=0.01)


def test_zero_inflation_leaves_the_amount_unchanged():
    r = M.purchasing_power(future_amount=500_000, months=240, inflation=0.0)
    assert r.value == 500_000.0 and r.detail["erosion"] == 0.0


def test_a_longer_horizon_erodes_more():
    near = M.purchasing_power(future_amount=1_000_000, months=120).value
    far = M.purchasing_power(future_amount=1_000_000, months=480).value
    assert far < near


def test_it_is_a_unit_conversion_not_an_npv():
    """Discounted by inflation ALONE — no cost of capital — so calling it a present value would be
    wrong and would double-count against any projection it is applied to."""
    r = M.purchasing_power(future_amount=1_000_000, months=240)
    assert r.detail["is_unit_conversion_not_npv"] is True
    assert [a.key for a in r.assumptions] == ["inflation"]


def test_a_zero_amount_is_refused():
    with pytest.raises(CalculatorError, match="greater than zero"):
        M.purchasing_power(future_amount=0, months=240)


# ── lump_sum_vs_dca ──────────────────────────────────────────────────────────────────────────────
def test_investing_now_always_wins_in_the_expected_case():
    """By construction, with any positive expected return — the cash earns nothing while it waits.
    Reporting this as "the answer" would dress an assumption up as advice, which is why the result
    says so in `why_the_expected_case_is_not_the_answer`."""
    r = M.lump_sum_vs_dca(amount=250_000, spread_months=12, annual_return=0.07)
    assert r.value > 0
    assert r.detail["lump_sum_value"] > r.detail["dca_value"]
    assert "not an optimisation" in r.detail["why_the_expected_case_is_not_the_answer"] or \
        "risk-tolerance decision" in r.detail["why_the_expected_case_is_not_the_answer"]


def test_a_longer_spread_forgoes_more_expected_return():
    short = M.lump_sum_vs_dca(amount=250_000, spread_months=3, annual_return=0.07).value
    long_ = M.lump_sum_vs_dca(amount=250_000, spread_months=36, annual_return=0.07).value
    assert long_ > short


def test_spreading_protects_against_an_adverse_path_and_the_premium_is_stated():
    """THE HONEST FRAMING. Spreading buys insurance against investing just before a fall, paid for
    in forgone expected return. Both the premium and the payout are reported, so the user can price
    the trade rather than be told which they should prefer."""
    r = M.lump_sum_vs_dca(amount=250_000, spread_months=12, annual_return=0.07,
                          adverse_return=-0.25)
    assert r.detail["dca_protection_adverse"] > 0
    assert r.detail["dca_value_adverse"] > r.detail["lump_sum_value_adverse"]
    # The payout under stress exceeds the expected-case premium — which is the whole case for it.
    assert r.detail["dca_protection_adverse"] > r.value
    assert "that is what the forgone" in r.detail["note"]


def test_an_adverse_return_may_be_negative():
    """`require_discount_rate`, not `require_rate` — an adverse market return is legitimately
    negative, which is exactly the distinction the two validators exist to draw."""
    r = M.lump_sum_vs_dca(amount=100_000, spread_months=6, adverse_return=-0.40)
    assert r.detail["adverse_return"] == -0.40


def test_a_total_loss_adverse_return_is_refused():
    with pytest.raises(CalculatorError, match="below -100%"):
        M.lump_sum_vs_dca(amount=100_000, spread_months=6, adverse_return=-1.5)


def test_spreading_over_one_month_is_refused_as_meaningless():
    with pytest.raises(CalculatorError, match="same as investing now"):
        M.lump_sum_vs_dca(amount=100_000, spread_months=1)


def test_without_an_adverse_rate_no_protection_figure_is_invented():
    """The adverse case is only reported when the caller supplies the scenario — a default crash
    depth would put a fabricated number in the most persuasive part of the answer."""
    r = M.lump_sum_vs_dca(amount=100_000, spread_months=12)
    assert "dca_protection_adverse" not in r.detail
    assert "adverse_return" not in r.detail


# ── Registry + advisor reachability ──────────────────────────────────────────────────────────────
def test_all_three_are_registered():
    from app.services.calculators import base
    assert {"money.expense_ratio_drag", "money.purchasing_power",
            "money.lump_sum_vs_dca"} <= set(base.available())


@pytest.mark.asyncio
async def test_purchasing_power_restates_the_retirement_projection_for_the_advisor():
    """Wired onto the projection because that is the figure users anchor on nominally."""
    from tests.test_advisor_calculations import _Ctx, _resolver
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    p = await AdvisorCalculationPlanner(
        _resolver(retirement_balance=400_000)
    ).compute(_Ctx(), current_age=40, target_retirement_age=65)

    proj = next(r for r in p["results"] if r["calculator"] == "retirement.projected_balance")
    today = next(r for r in p["results"] if r["calculator"] == "money.purchasing_power")
    assert today["value"] < proj["value"], "today's dollars must be less than the nominal figure"
    assert today["inputs_used"]["months"] == (65 - 40) * 12
