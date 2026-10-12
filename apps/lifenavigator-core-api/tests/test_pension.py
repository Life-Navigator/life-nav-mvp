"""Pension lump sum vs annuity (Milestone 2.5).

The headline is the IMPLIED RETURN, so the tests check it against independent annuity algebra and
then check that every derived figure agrees with it. Internal consistency is the real risk here:
four numbers (implied return, PV comparison, verdict, breakeven) all describe the same choice, and
any two of them disagreeing makes the whole answer untrustworthy.
"""
from __future__ import annotations

import pytest

from app.services.calculators import retirement as R
from app.services.calculators.base import CalculatorError


# ── The implied return, checked against annuity algebra ──────────────────────────────────────────
def test_the_implied_return_matches_the_annuity_factor():
    """$500,000 for $32,000/yr over 25 years means an annuity factor of 500,000/32,000 = 15.625.
    Solving (1 - (1+r)^-25)/r = 15.625 gives r = 4.00% — derived independently of the solver."""
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=65, life_expectancy=90)
    assert r.value == pytest.approx(0.0400, abs=0.0005)

    factor = (1 - (1 + r.value) ** -25) / r.value
    assert factor == pytest.approx(500_000 / 32_000, rel=1e-4)


def test_a_bigger_payment_on_the_same_lump_implies_a_higher_return():
    base = dict(lump_sum=500_000, current_age=65, life_expectancy=90)
    low = R.pension_lump_sum_vs_annuity(annual_annuity=28_000, **base).value
    high = R.pension_lump_sum_vs_annuity(annual_annuity=45_000, **base).value
    assert high > low


def test_a_longer_life_expectancy_implies_a_higher_return():
    """The annuity is longevity insurance, so its value rises with how long you collect."""
    base = dict(lump_sum=500_000, annual_annuity=32_000, current_age=65)
    short = R.pension_lump_sum_vs_annuity(life_expectancy=78, **base).value
    long_ = R.pension_lump_sum_vs_annuity(life_expectancy=98, **base).value
    assert long_ > short


def test_a_cola_raises_the_implied_return():
    base = dict(lump_sum=500_000, annual_annuity=32_000, current_age=65, life_expectancy=90)
    fixed = R.pension_lump_sum_vs_annuity(cola=0.0, **base).value
    indexed = R.pension_lump_sum_vs_annuity(cola=0.03, **base).value
    assert indexed > fixed


# ── Every derived figure must agree with the headline ────────────────────────────────────────────
@pytest.mark.parametrize("annuity,cola", [(24_000, 0.0), (32_000, 0.0), (45_000, 0.0),
                                          (32_000, 0.02), (60_000, 0.03)])
def test_the_verdict_the_pv_and_the_breakeven_all_agree(annuity, cola):
    """INTERNAL CONSISTENCY IS THE REAL RISK. Four numbers describe the same choice; any two
    disagreeing makes the answer untrustworthy.

    My first breakeven compared UNDISCOUNTED cumulative payments against a lump sum COMPOUNDED at
    the expected return — two different bases — so it reported "never overtakes" for a pension the
    implied return had just called the better choice.
    """
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=annuity,
                                      current_age=65, life_expectancy=90, cola=cola)
    favours_pension = r.value > r.detail["expected_return"]
    assert (r.detail["favours"] == "pension") == favours_pension
    assert (r.detail["pv_advantage_of_pension"] > 0) == favours_pension
    assert (r.detail["breakeven_age"] is not None) == favours_pension


def test_the_breakeven_note_disambiguates_a_missing_breakeven():
    """`None` would otherwise read as "not computed" rather than "never happens"."""
    poor = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=22_000,
                                         current_age=65, life_expectancy=85)
    assert poor.detail["breakeven_age"] is None
    assert "never overtakes" in poor.detail["breakeven_note"]
    assert "living longer" in poor.detail["breakeven_note"]

    good = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=60_000,
                                         current_age=65, life_expectancy=95)
    assert good.detail["breakeven_age"] is not None
    assert "overtake" in good.detail["breakeven_note"]


def test_the_breakeven_age_is_within_the_life_expectancy():
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=60_000,
                                      current_age=65, life_expectancy=95)
    assert 65 < r.detail["breakeven_age"] <= 95


# ── The inflation warning, which decides real cases ─────────────────────────────────────────────
def test_an_unindexed_pension_is_warned_about_in_todays_dollars():
    """Most private pensions are NOT inflation-adjusted, and a comparison that ignores it
    systematically flatters the pension. $32,000 buys about $17,000 of today's goods after 25
    years."""
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=65, life_expectancy=90)
    assert r.detail["is_inflation_adjusted"] is False
    warning = r.detail["inflation_warning"]
    assert warning and "NOT inflation-adjusted" in warning
    assert "17," in warning, "must quote the eroded purchasing power"
    assert any(a.key == "inflation" for a in r.assumptions)


def test_an_indexed_pension_gets_no_inflation_warning():
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=65, life_expectancy=90, cola=0.025)
    assert r.detail["is_inflation_adjusted"] is True
    assert r.detail["inflation_warning"] is None


# ── Survivorship: the most consequential irreversible election ──────────────────────────────────
def test_a_survivor_benefit_extends_the_stream_and_raises_the_value():
    base = dict(lump_sum=500_000, annual_annuity=40_000, current_age=62, life_expectancy=85)
    single = R.pension_lump_sum_vs_annuity(**base)
    joint = R.pension_lump_sum_vs_annuity(survivor_pct=0.5, spouse_age=60,
                                          spouse_life_expectancy=94, **base)
    assert joint.detail["survivor_years_included"] > 0
    assert joint.detail["payments_valued"] > single.detail["payments_valued"]
    assert joint.value > single.value


def test_a_survivor_percentage_without_a_spouse_is_not_invented():
    """Inventing a spouse would change the answer on the single most consequential election here."""
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=40_000, current_age=62,
                                      life_expectancy=85, survivor_pct=0.5)
    assert r.detail["survivor_modelled"] is False
    assert r.detail["survivor_years_included"] == 0


def test_a_spouse_with_no_survivor_benefit_triggers_the_warning():
    """Electing the larger single-life payment while a dependent spouse would outlive it."""
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=40_000, current_age=62,
                                      life_expectancy=85, spouse_age=60)
    assert r.detail["survivor_warning"] is not None
    assert "irreversible" in r.detail["survivor_warning"]


def test_a_spouse_who_dies_first_adds_no_survivor_years():
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=40_000, current_age=62,
                                      life_expectancy=95, survivor_pct=0.5, spouse_age=70,
                                      spouse_life_expectancy=80)
    assert r.detail["survivor_years_included"] == 0


# ── Contract ─────────────────────────────────────────────────────────────────────────────────────
def test_a_zero_lump_sum_or_payment_is_refused():
    with pytest.raises(CalculatorError, match="greater than zero"):
        R.pension_lump_sum_vs_annuity(lump_sum=0, annual_annuity=32_000, current_age=65)
    with pytest.raises(CalculatorError, match="greater than zero"):
        R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=0, current_age=65)


def test_a_life_expectancy_at_the_current_age_is_refused():
    """There is no stream to value."""
    with pytest.raises(CalculatorError):
        R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=90, life_expectancy=90)


def test_it_is_scenario_tier_and_cites_the_return_assumption():
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=65, life_expectancy=90)
    assert r.tier == "scenario" and r.unit == "pct"
    assert any(a.key == "investment_return" for a in r.assumptions)


def test_it_states_what_it_does_not_model():
    r = R.pension_lump_sum_vs_annuity(lump_sum=500_000, annual_annuity=32_000,
                                      current_age=65, life_expectancy=90)
    joined = " ".join(r.detail["excludes"])
    assert "PBGC" in joined and "rollover" in joined


def test_it_is_registered():
    from app.services.calculators import base
    assert "retirement.pension_lump_sum_vs_annuity" in base.available()
