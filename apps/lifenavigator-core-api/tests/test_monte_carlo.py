"""Monte Carlo over the planning ledger (Milestone 1).

Tested by PROPERTIES rather than by expected numbers, because a simulation's output is a
distribution: reproducibility, moment-matching against the stated assumptions, monotonicity, and
ordering invariants. Asserting "success_probability == 0.114" would lock in an implementation detail
and break on any sampling change while proving nothing.

Tax year 2024 throughout — verified law, so a simulation's correctness never depends on the pending
CPA sign-off.
"""
from __future__ import annotations

import math
import statistics

import pytest

from app.services.planning import (
    ROTH,
    TAX_DEFERRED,
    Account,
    Expense,
    Goal,
    Household,
    Person,
    simulate,
)
from app.services.planning.household import PlanningError
from app.services.planning.monte_carlo import _lognormal_params, _percentile

Y = 2024


def _retiree(balance=1_200_000, spend=75_000, life=92):
    return Household(
        people=[Person("Alex", 66, None, life, 0)], filing_status="single",
        accounts=[Account("IRA", balance, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", spend)])


# ── Reproducibility ──────────────────────────────────────────────────────────────────────────────
def test_the_same_seed_always_gives_the_same_answer():
    """REPRODUCIBILITY IS A FEATURE. A plan that reports 82% today and 79% tomorrow on identical
    inputs is not trustworthy, and the user cannot distinguish "the assumption changed" from "you
    re-rolled the dice"."""
    a = simulate(_retiree(), paths=80, seed=7, tax_year=Y)
    b = simulate(_retiree(), paths=80, seed=7, tax_year=Y)
    assert a.success_probability == b.success_probability
    assert a.terminal_assets_percentiles == b.terminal_assets_percentiles
    assert a.assets_band_by_year == b.assets_band_by_year


def test_a_different_seed_gives_a_different_draw():
    # A well-funded household, so the median terminal value is non-zero and CAN differ. With the
    # stressed fixture both medians are $0 because most paths deplete, and the test would pass or
    # fail for the wrong reason.
    a = simulate(_retiree(balance=4_000_000, spend=90_000), paths=80, seed=7, tax_year=Y)
    b = simulate(_retiree(balance=4_000_000, spend=90_000), paths=80, seed=8, tax_year=Y)
    assert a.terminal_assets_percentiles["p50"] != b.terminal_assets_percentiles["p50"]


def test_the_seed_is_reported_so_any_figure_can_be_reproduced():
    r = simulate(_retiree(), paths=20, seed=99, tax_year=Y)
    assert r.seed == 99 and str(99) in r.probability_caveat


# ── The sampled distribution matches the stated assumptions ──────────────────────────────────────
def test_lognormal_params_moment_match_the_inputs():
    """The simulation must be comparable to the deterministic projection, not quietly on a different
    footing. Sample a large draw and check the realised mean and volatility."""
    import random
    mean, vol = 0.07, 0.15
    mu, sigma = _lognormal_params(mean, vol)
    rng = random.Random(1234)
    draws = [math.exp(rng.gauss(mu, sigma)) - 1.0 for _ in range(200_000)]
    assert statistics.fmean(draws) == pytest.approx(mean, abs=0.003)
    assert statistics.stdev(draws) == pytest.approx(vol, abs=0.003)


def test_no_sampled_return_can_fall_below_total_loss():
    """WHY LOGNORMAL AND NOT NORMAL. A normal draw can produce a return below -100% — a negative
    balance, which is impossible and corrupts the exact tail the simulation exists to measure."""
    import random
    mu, sigma = _lognormal_params(0.06, 0.40)   # deliberately violent volatility
    rng = random.Random(5)
    draws = [math.exp(rng.gauss(mu, sigma)) - 1.0 for _ in range(50_000)]
    assert min(draws) > -1.0


def test_zero_volatility_reproduces_the_deterministic_projection():
    """The degenerate case must collapse onto the single-path answer, or the two engines disagree."""
    from app.services.planning import project
    h = _retiree()
    det = project(h, tax_year=Y)
    mc = simulate(h, paths=5, seed=3, tax_year=Y, volatility=0.0)
    assert mc.success_probability in (0.0, 1.0), "no spread, so every path agrees"
    assert mc.terminal_assets_percentiles["p50"] == pytest.approx(det.terminal_assets, rel=1e-6)
    assert mc.depletion_year_percentiles["p50"] == det.depleted_year


def test_the_registry_assumptions_are_cited():
    r = simulate(_retiree(), paths=20, tax_year=Y)
    keys = {a["key"] for a in r.assumptions}
    assert {"investment_return", "return_volatility"} <= keys


# ── Monotonicity: scale-free coherence checks ────────────────────────────────────────────────────
def test_more_assets_raises_the_success_probability():
    low = simulate(_retiree(balance=600_000), paths=120, seed=11, tax_year=Y)
    high = simulate(_retiree(balance=2_500_000), paths=120, seed=11, tax_year=Y)
    assert high.success_probability > low.success_probability


def test_more_spending_lowers_the_success_probability():
    lean = simulate(_retiree(spend=40_000), paths=120, seed=11, tax_year=Y)
    rich = simulate(_retiree(spend=120_000), paths=120, seed=11, tax_year=Y)
    assert rich.success_probability < lean.success_probability


def test_higher_volatility_hurts_a_plan_that_WORKS_on_the_mean():
    """Sequence risk is asymmetric in drawdown: for a plan that succeeds on the average path, more
    dispersion fails more often, because an early loss is realised against a full balance and never
    recovers. Measured on a household funded well enough that the calm case mostly survives."""
    funded = dict(balance=3_000_000, spend=90_000)
    calm = simulate(_retiree(**funded), paths=200, seed=21, tax_year=Y, volatility=0.04)
    wild = simulate(_retiree(**funded), paths=200, seed=21, tax_year=Y, volatility=0.30)
    assert calm.success_probability > 0.9, "the calm case must actually succeed for this to mean anything"
    assert wild.success_probability < calm.success_probability


def test_higher_volatility_HELPS_a_plan_that_fails_on_the_mean():
    """The other direction, and it is not a bug — it is why a probability beats a point estimate.

    A household drawing 7.5% fails on every low-volatility path: the deterministic answer is simply
    "no". Add dispersion and some paths get lucky early and survive, so the success probability
    RISES. Volatility is not uniformly bad; it is optionality for a plan that cannot work on the
    average. A single projection cannot express that at all — it just says "fails".
    """
    stressed = dict(balance=1_200_000, spend=75_000)
    calm = simulate(_retiree(**stressed), paths=200, seed=21, tax_year=Y, volatility=0.04)
    wild = simulate(_retiree(**stressed), paths=200, seed=21, tax_year=Y, volatility=0.25)
    assert calm.success_probability == 0.0, "underfunded on the mean path"
    assert wild.success_probability > calm.success_probability


def test_a_longer_life_expectancy_lowers_success():
    short = simulate(_retiree(life=80), paths=120, seed=13, tax_year=Y)
    long_ = simulate(_retiree(life=100), paths=120, seed=13, tax_year=Y)
    assert long_.success_probability < short.success_probability


# ── Ordering invariants ──────────────────────────────────────────────────────────────────────────
def test_terminal_percentiles_are_ordered():
    p = simulate(_retiree(balance=3_000_000), paths=150, seed=4, tax_year=Y)\
        .terminal_assets_percentiles
    assert p["p10"] <= p["p25"] <= p["p50"] <= p["p75"] <= p["p90"]


def test_the_yearly_band_is_ordered_in_every_year():
    r = simulate(_retiree(balance=3_000_000), paths=150, seed=4, tax_year=Y)
    assert r.assets_band_by_year
    for row in r.assets_band_by_year:
        assert row["p10"] <= row["p50"] <= row["p90"], row


def test_the_band_covers_the_whole_horizon():
    h = _retiree(life=92)
    r = simulate(h, paths=40, seed=4, tax_year=Y)
    assert len(r.assets_band_by_year) == h.horizon_years


def test_success_is_never_above_the_components_it_requires():
    """`succeeds` needs BOTH no depletion and all goals funded, so it cannot exceed either."""
    h = Household(
        people=[Person("Alex", 60, 65, 90, 150_000)], filing_status="single",
        accounts=[Account("IRA", 500_000, TAX_DEFERRED, "Alex"),
                  Account("Roth", 200_000, ROTH, "Alex")],
        expenses=[Expense("Living", 90_000)],
        goals=[Goal("Second home", 600_000, 8, "wish")])
    r = simulate(h, paths=120, seed=6, tax_year=Y)
    assert r.success_probability <= r.not_depleted_probability
    assert r.success_probability <= r.goals_funded_probability


def test_percentile_helper_interpolates():
    vals = [0.0, 10.0, 20.0, 30.0, 40.0]
    assert _percentile(vals, 0.0) == 0.0
    assert _percentile(vals, 1.0) == 40.0
    assert _percentile(vals, 0.5) == 20.0
    assert _percentile(vals, 0.25) == 10.0
    assert _percentile([], 0.5) == 0.0
    assert _percentile([7.0], 0.9) == 7.0


# ── Sequence-risk attribution: the output a bare probability cannot give ─────────────────────────
def test_failures_in_a_stressed_plan_are_attributed_to_early_returns():
    """THE DIFFERENTIATING OUTPUT. "82%" tells a user where they stand and nothing about what to do.
    If failures cluster in paths with poor first-decade returns, the plan is not underfunded — it is
    exposed to sequence risk, and the remedies are specific and different."""
    r = simulate(_retiree(balance=1_100_000, spend=70_000), paths=300, seed=31, tax_year=Y)
    sr = r.sequence_risk
    assert sr["measurable"] is True
    assert sr["avg_early_return_when_plan_worked"] > sr["avg_early_return_when_plan_failed"]
    assert sr["driven_by_early_returns"] is True
    assert "first decade" in sr["interpretation"]
    assert "cash buffer" in sr["interpretation"]


def test_no_driver_is_claimed_when_every_path_succeeds():
    """With no failures the comparison is undefined, and saying so beats inventing a driver."""
    r = simulate(_retiree(balance=20_000_000, spend=60_000), paths=60, seed=2, tax_year=Y)
    assert r.success_probability == 1.0
    assert r.sequence_risk["measurable"] is False
    assert "every path succeeded" in r.sequence_risk["reason"]


def test_no_driver_is_claimed_when_every_path_fails():
    r = simulate(_retiree(balance=100_000, spend=200_000), paths=60, seed=2, tax_year=Y)
    assert r.success_probability == 0.0
    assert r.sequence_risk["measurable"] is False
    assert "every path failed" in r.sequence_risk["reason"]


# ── Honesty about what the number is ─────────────────────────────────────────────────────────────
def test_the_caveat_states_that_the_probability_is_modelled_not_measured():
    """A bare "82%" reads as empirical and is not — it is a function of the assumed distribution."""
    r = simulate(_retiree(), paths=20, seed=1, tax_year=Y)
    c = r.probability_caveat
    assert "modelled probability, not a measured one" in c
    assert "volatility" in c and "same inputs always give the same answer" in c


def test_the_tax_basis_label_propagates_to_the_simulation():
    """A probability computed on carried-forward law is doubly caveated, and the label must survive
    the wrapper rather than being lost between the ledger and the summary."""
    r = simulate(_retiree(), paths=10, seed=1, tax_year=2026)
    assert r.tax_year == 2024 and r.tax_basis_is_current_year is False
    assert "computed on 2024 law" in r.tax_basis_label


def test_the_result_is_json_serializable():
    import json
    r = simulate(_retiree(), paths=20, seed=1, tax_year=Y)
    d = r.as_dict()
    json.dumps(d)
    assert 0.0 <= d["success_probability"] <= 1.0
    assert d["probability_caveat"] and d["sequence_risk"]


# ── Guards ───────────────────────────────────────────────────────────────────────────────────────
def test_at_least_one_path_is_required():
    with pytest.raises(PlanningError, match="at least 1"):
        simulate(_retiree(), paths=0, tax_year=Y)


def test_an_absurd_path_count_is_refused_with_a_reason():
    """CPU-bound at ~2.7 ms/path; past this it belongs in a background job, and the extra precision
    is far below what the input assumptions support."""
    with pytest.raises(PlanningError, match="background job"):
        simulate(_retiree(), paths=50_000, tax_year=Y)


def test_an_unverified_tax_basis_under_the_strict_policy_fails_fast(monkeypatch):
    monkeypatch.setenv("TAX_BASIS_POLICY", "verified_only")
    with pytest.raises(PlanningError, match="verified tax basis"):
        simulate(_retiree(), paths=10, tax_year=2026)
