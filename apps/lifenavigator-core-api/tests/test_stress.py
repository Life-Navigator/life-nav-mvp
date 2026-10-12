"""Stress tests — the named scenarios behind the probability (Milestone 1.2).

Each scenario is one ledger re-run with one input changed, so the assertions are about DIRECTION and
SEVERITY: an adverse scenario must never improve the plan, a sharper version must hurt at least as
much as a milder one, and the reported cost must be expressed in whatever terms are actually
meaningful for that plan.
"""
from __future__ import annotations

import pytest

from app.services.planning import (
    ROTH,
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Household,
    IncomeSource,
    Person,
    crash_at_retirement,
    early_death_of_spouse,
    inflation_shock,
    long_term_care,
    longevity,
    lost_decade,
    project,
    run_all,
)
from app.services.planning.household import PlanningError

Y = 2024


def _couple(ira=1_800_000, spend=140_000):
    return Household(
        people=[Person("Alex", 65, None, 92, 0), Person("Sam", 63, None, 95, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", ira, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 500_000, TAXABLE, basis=300_000),
                  Account("Roth", 300_000, ROTH, "Sam")],
        income_sources=[IncomeSource("Social Security", 48_000, "Alex", 67, taxable_share=0.85)],
        expenses=[Expense("Living", spend)])


def _single(**kw):
    return Household(
        people=[Person("Alex", 66, None, 92, 0)], filing_status="single",
        accounts=[Account("IRA", kw.pop("ira", 1_500_000), TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", kw.pop("spend", 80_000))])


# ── Every scenario must be adverse ───────────────────────────────────────────────────────────────
@pytest.mark.parametrize("fn,kwargs", [
    (crash_at_retirement, {}),
    (lost_decade, {}),
    (longevity, {}),
    (inflation_shock, {}),
])
def test_an_adverse_scenario_never_improves_the_plan(fn, kwargs):
    h = _single()
    base = project(h, tax_year=Y)
    stressed = fn(h, tax_year=Y, **kwargs)
    assert stressed.terminal_assets <= base.terminal_assets + 1.0
    if base.depleted_year is not None and stressed.depleted_year is not None:
        assert stressed.depleted_year <= base.depleted_year


def test_a_deeper_crash_hurts_at_least_as_much():
    h = _single()
    mild = crash_at_retirement(h, depth=-0.10, tax_year=Y)
    severe = crash_at_retirement(h, depth=-0.50, tax_year=Y)
    assert severe.terminal_assets <= mild.terminal_assets


def test_a_longer_lost_decade_hurts_at_least_as_much():
    h = _single()
    short = lost_decade(h, years=3, tax_year=Y)
    long_ = lost_decade(h, years=15, tax_year=Y)
    assert long_.terminal_assets <= short.terminal_assets


def test_higher_inflation_hurts_at_least_as_much():
    h = _single()
    mild = inflation_shock(h, rate=0.03, tax_year=Y)
    severe = inflation_shock(h, rate=0.10, tax_year=Y)
    assert severe.terminal_assets <= mild.terminal_assets


def test_more_extra_years_hurts_at_least_as_much():
    h = _single()
    five = longevity(h, extra_years=5, tax_year=Y)
    fifteen = longevity(h, extra_years=15, tax_year=Y)
    assert fifteen.terminal_assets <= five.terminal_assets


# ── Sequence risk: the crash's timing is the whole point ─────────────────────────────────────────
def test_a_crash_in_year_one_is_worse_than_the_same_crash_later():
    """SEQUENCE RISK AT ITS SHARPEST, and the reason this scenario exists separately from a
    probability. The same crash ten years in is survivable; in the first year it is realised against
    a full balance, that year's withdrawal sells into it, and the compounding never comes back."""
    from app.services.calculators.base import from_registry
    h = _single()
    normal, _ = from_registry("investment_return")
    horizon = h.horizon_years

    early = project(h, tax_year=Y,
                    return_path=[-0.37] + [normal] * (horizon - 1))
    late = project(h, tax_year=Y,
                   return_path=[normal] * 10 + [-0.37] + [normal] * (horizon - 11))

    # Compared on DEPLETION YEAR, not terminal assets: this fixture runs out either way, so terminal
    # value is $0 in both cases and says nothing. How many years sooner is the whole finding — and
    # it is the third time in this engine that terminal assets failed to discriminate between two
    # failing plans.
    assert early.depleted_year is not None and late.depleted_year is not None
    assert early.depleted_year < late.depleted_year

    # And on a plan that survives both, the terminal gap shows the same thing.
    rich = _single(ira=4_000_000, spend=80_000)
    rich_h = rich.horizon_years
    rich_early = project(rich, tax_year=Y, return_path=[-0.37] + [normal] * (rich_h - 1))
    rich_late = project(rich, tax_year=Y,
                        return_path=[normal] * 10 + [-0.37] + [normal] * (rich_h - 11))
    assert rich_early.depleted_year is None and rich_late.depleted_year is None
    assert rich_early.terminal_assets < rich_late.terminal_assets


# ── Spousal death models the widow's penalty, not just lost income ───────────────────────────────
def test_spousal_death_switches_the_survivor_to_single_filing():
    """The real consequence is not only the lost income — the survivor files single, roughly half
    the bracket widths on similar income, for every remaining year."""
    r = early_death_of_spouse(_couple(), who="Alex", tax_year=Y)
    later = [y for y in r.years if y.year_offset > 1]
    assert all(len(y.ages) == 1 for y in later)
    assert all(y.filing_status == "single" for y in later)
    assert any("widow's penalty" in e for y in r.years for e in y.events)


def test_spousal_death_is_refused_for_a_one_person_household():
    """For one person the scenario is the end of the plan, not a stress on it."""
    with pytest.raises(PlanningError, match="two-person household"):
        early_death_of_spouse(_single(), tax_year=Y)


def test_either_spouse_can_be_the_one_who_dies():
    for who in ("Alex", "Sam"):
        r = early_death_of_spouse(_couple(), who=who, tax_year=Y)
        survivors = {n for y in r.years if y.year_offset > 1 for n in y.ages}
        assert who not in survivors


# ── Long-term care refuses to invent its own cost ────────────────────────────────────────────────
def test_long_term_care_requires_a_cost():
    """Care costs vary by an order of magnitude between in-home help and skilled nursing, and by
    region. A default would be a fabricated figure driving the most alarming number in the report."""
    with pytest.raises(PlanningError, match="cannot be assumed"):
        long_term_care(_single(), annual_cost=0, tax_year=Y)


def test_long_term_care_adds_the_cost_for_the_stated_years_only():
    h = _single()
    r = long_term_care(h, annual_cost=120_000, years=3, start_year=5, tax_year=Y)
    base = project(h, tax_year=Y)
    for t in (5, 6, 7):
        assert r.years[t].expenses > base.years[t].expenses
    assert r.years[8].expenses == pytest.approx(base.years[8].expenses, rel=1e-9)


def test_a_more_expensive_care_event_hurts_more():
    h = _single()
    cheap = long_term_care(h, annual_cost=60_000, tax_year=Y)
    dear = long_term_care(h, annual_cost=250_000, tax_year=Y)
    assert dear.terminal_assets <= cheap.terminal_assets


# ── Isolation: scenarios must not contaminate each other ─────────────────────────────────────────
def test_the_baseline_household_is_never_mutated():
    """The ledger MUTATES balances, so a scenario sharing accounts would start from the previous
    run's ENDING position and every result would be wrong in the same invisible way."""
    h = _couple()
    before = [a.balance for a in h.accounts]
    run_all(h, tax_year=Y, ltc_annual_cost=100_000)
    assert [a.balance for a in h.accounts] == before


def test_running_the_same_scenario_twice_gives_the_same_answer():
    h = _single()
    assert crash_at_retirement(h, tax_year=Y).terminal_assets == \
        crash_at_retirement(h, tax_year=Y).terminal_assets


# ── run_all ──────────────────────────────────────────────────────────────────────────────────────
def test_run_all_covers_the_standard_scenarios_plus_the_applicable_extras():
    r = run_all(_couple(), tax_year=Y, ltc_annual_cost=110_000)
    labels = {c.label for c in r.scenarios}
    assert "market crash in year one" in labels
    assert "a lost decade of flat returns" in labels
    assert "living 5 years longer than planned" in labels
    assert "sustained 8% inflation" in labels
    assert any("dies early" in s for s in labels)
    assert any("long-term care" in s for s in labels)


def test_scenarios_needing_an_unsupplied_input_are_SKIPPED_not_defaulted():
    """A fabricated input would produce the most alarming figure in the report from a number nobody
    chose."""
    r = run_all(_single(), tax_year=Y)          # one person, no LTC cost
    labels = {c.label for c in r.scenarios}
    assert not any("long-term care" in s for s in labels)
    assert not any("dies early" in s for s in labels)


def test_the_worst_scenario_is_identified():
    r = run_all(_couple(), tax_year=Y)
    assert r.worst.label in {c.label for c in r.scenarios}
    assert r.worst.sort_key == min(c.sort_key for c in r.scenarios)


def test_survives_all_is_false_when_any_scenario_breaks_the_plan():
    r = run_all(_couple(), tax_year=Y)
    broke = [c for c in r.scenarios if c.depleted_year is not None]
    assert (r.survives_all is False) == bool(broke)


# ── The reported cost must be meaningful for THIS plan ───────────────────────────────────────────
def test_breaking_a_surviving_plan_is_reported_as_breaking_it():
    """"$1.49M of terminal assets lost" is technically true and useless for a scenario that ENDS the
    plan — the terminal value is zero because the money ran out, which is the actual finding."""
    r = run_all(_couple(), tax_year=Y)
    assert r.baseline.depleted_year is None, "fixture must survive the baseline"
    broke = [r.cost_of(c.label) for c in r.scenarios if c.depleted_year is not None]
    assert broke, "at least one scenario must break this plan"
    for cost in broke:
        assert cost["broke_the_plan"] is True
        assert "breaks the plan" in cost["summary"]
        assert "runs out in year" in cost["summary"]


def test_a_survivable_scenario_is_reported_as_survivable():
    r = run_all(_couple(), tax_year=Y, ltc_annual_cost=110_000)
    fine = [r.cost_of(c.label) for c in r.scenarios if c.depleted_year is None]
    assert fine
    for cost in fine:
        assert cost["survivable"] is True
        assert "survivable" in cost["summary"] or "no material effect" in cost["summary"]


def test_years_of_solvency_lost_is_used_when_both_plans_fail():
    """For a plan that already runs out, terminal wealth is $0 either way and says nothing — the
    useful number is how many years sooner."""
    h = _single(ira=700_000, spend=90_000)
    base = project(h, tax_year=Y)
    assert base.depleted_year is not None, "fixture must already fail"
    r = run_all(h, tax_year=Y)
    costs = [r.cost_of(c.label) for c in r.scenarios
             if c.depleted_year is not None and c.depleted_year < base.depleted_year]
    assert costs
    for cost in costs:
        assert cost["years_of_solvency_lost"] >= 1
        assert "year(s) of solvency" in cost["summary"]


def test_the_result_is_json_serializable():
    import json
    r = run_all(_couple(), tax_year=Y, ltc_annual_cost=100_000)
    d = r.as_dict()
    json.dumps(d)
    assert d["baseline"] and d["scenarios"] and d["costs"]
    assert all("summary" in c for c in d["costs"])


def test_the_tax_basis_propagates():
    r = run_all(_couple(), tax_year=2026)
    assert r.tax_year == 2024 and r.tax_basis_is_current_year is False
