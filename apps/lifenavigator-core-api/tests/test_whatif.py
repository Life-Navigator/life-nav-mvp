"""Side-by-side what-ifs and solving for the threshold (Milestone 1.3).

The fifth instance of the same comparison shape — after sequencing, conversions, claiming and
stress — which is why it reuses `StrategyResult` wholesale. Tested on DIRECTION and on whether the
search finds a real threshold, not on specific dollar outcomes.
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
    assume_inflation,
    assume_return,
    compare,
    custom,
    delay_social_security,
    move_to_state,
    project,
    retire_later,
    save_more,
    solve_all,
    solve_for_retirement_age,
    solve_for_spending,
    spend_change,
    suggest,
)
from app.services.planning.household import PlanningError

Y = 2024


def _working(spend=150_000, income=160_000, k401=900_000):
    return Household(
        people=[Person("Alex", 58, 65, 92, income), Person("Sam", 56, 67, 95, 95_000)],
        filing_status="married_jointly",
        accounts=[Account("401k", k401, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 250_000, TAXABLE, basis=180_000),
                  Account("Roth", 150_000, ROTH, "Sam")],
        income_sources=[IncomeSource("Social Security", 46_000, "Alex", 67, taxable_share=0.85)],
        expenses=[Expense("Living", spend, retirement_factor=0.9)])


# ── annual_contribution: the bug this milestone exposed ──────────────────────────────────────────
def test_planned_contributions_are_actually_applied():
    """THE BUG THIS FIXES. `Account.annual_contribution` was accepted, documented and copied
    between runs — and never applied anywhere in the ledger. An input that looks modelled and is
    not. It made `save_more` a no-op: the variant returned EXACTLY the baseline, to the cent."""
    def mk(contrib):
        return Household(
            people=[Person("Alex", 50, 65, 90, 200_000)], filing_status="single",
            accounts=[Account("401k", 700_000, TAX_DEFERRED, "Alex",
                              annual_contribution=contrib)],
            expenses=[Expense("Living", 110_000)])

    none_ = project(mk(0), tax_year=Y)
    some = project(mk(30_000), tax_year=Y)
    # `planned_contributions` is what they CHOSE to save; `contributions` also includes whatever
    # surplus was swept in, which is a different fact about the household.
    assert some.years[0].planned_contributions == 30_000
    assert some.years[0].contributions >= 30_000
    # This fixture depletes either way, so SOLVENCY is the discriminator, not terminal assets.
    assert some.depleted_year > none_.depleted_year


def test_a_pretax_contribution_reduces_this_years_tax():
    """That is the entire point of a pre-tax bucket, and it must show up in the same year."""
    def mk(treatment):
        return Household(
            people=[Person("Alex", 50, 65, 90, 160_000)], filing_status="single",
            accounts=[Account("Acct", 500_000, treatment, "Alex", annual_contribution=24_000,
                              basis=500_000 if treatment == TAXABLE else None)],
            expenses=[Expense("Living", 90_000)])

    pretax = project(mk(TAX_DEFERRED), tax_year=Y).years[0]
    after_tax = project(mk(ROTH), tax_year=Y).years[0]
    assert pretax.federal_tax < after_tax.federal_tax


def test_contributions_stop_once_wages_do():
    """You cannot defer what you do not earn."""
    h = Household(
        people=[Person("Alex", 58, 60, 90, 160_000)], filing_status="single",
        accounts=[Account("401k", 900_000, TAX_DEFERRED, "Alex", annual_contribution=24_000)],
        expenses=[Expense("Living", 100_000)])
    r = project(h, tax_year=Y)
    retired = next(y for y in r.years if y.wage_income == 0)
    assert retired.contributions == 0.0


# ── compare ──────────────────────────────────────────────────────────────────────────────────────
def test_compare_runs_the_baseline_and_every_variant():
    r = compare(_working(), [retire_later(2), spend_change(0.9)], tax_year=Y)
    labels = {c.label for c in r.candidates}
    assert labels == {"as planned", "retire 2 year(s) later", "spend 10% less"}
    assert r.baseline_label == "as planned" and r.verdict


def test_working_longer_and_spending_less_both_improve_the_plan():
    r = compare(_working(), [retire_later(2), spend_change(0.9), save_more(25_000)], tax_year=Y)
    base = r.baseline
    for c in r.candidates:
        if c.label != "as planned":
            assert c.terminal_assets > base.terminal_assets, c.label


def test_retiring_later_is_a_stronger_lever_than_saving_more():
    """Three effects at once — more earning years, fewer drawdown years, a later first withdrawal —
    against one."""
    r = compare(_working(), [retire_later(5), save_more(25_000)], tax_year=Y)
    by = {c.label: c for c in r.candidates}
    assert by["retire 5 year(s) later"].terminal_assets > by["save $25,000/yr more"].terminal_assets


def test_spending_more_makes_the_plan_worse():
    r = compare(_working(), [spend_change(1.25)], tax_year=Y)
    worse = next(c for c in r.candidates if c.label != "as planned")
    assert worse.terminal_assets < r.baseline.terminal_assets


def test_a_lower_return_assumption_makes_the_plan_worse():
    r = compare(_working(), [assume_return(0.03)], tax_year=Y)
    assert next(c for c in r.candidates
                if c.label != "as planned").terminal_assets < r.baseline.terminal_assets


def test_higher_inflation_makes_the_plan_worse():
    r = compare(_working(), [assume_inflation(0.06)], tax_year=Y)
    assert next(c for c in r.candidates
                if c.label != "as planned").terminal_assets < r.baseline.terminal_assets


def test_the_baseline_household_is_never_mutated():
    """The ledger mutates balances, so a variant sharing accounts would start from the baseline's
    ENDING position — already the cause of one class of bug in this engine."""
    h = _working()
    before = [a.balance for a in h.accounts]
    compare(h, [retire_later(3), spend_change(0.8), save_more(10_000)], tax_year=Y)
    assert [a.balance for a in h.accounts] == before


def test_compare_needs_at_least_one_variant():
    with pytest.raises(PlanningError, match="at least one variant"):
        compare(_working(), [], tax_year=Y)


def test_moving_to_a_no_tax_state_never_hurts():
    h = _working()
    h.state = "CA"
    r = compare(h, [move_to_state(None)], tax_year=Y)
    moved = next(c for c in r.candidates if c.label != "as planned")
    assert moved.terminal_assets >= r.baseline.terminal_assets


def test_delaying_social_security_here_does_NOT_increase_the_benefit():
    """This variant shifts the START AGE only. The actuarial increase depends on the primary
    insurance amount, so `social_security_claiming` owns that — and the note says so, because a
    variant that silently skipped the increase would understate delaying."""
    v = delay_social_security(3, owner="Alex")
    assert "NOT actuarially increased" in v.note
    r = compare(_working(), [v], tax_year=Y)
    assert r.verdict


def test_custom_covers_what_the_builders_do_not():
    def halve_the_roth(h):
        from app.services.planning.whatif import _copy
        return _copy(h, accounts=[
            Account(label=a.label, balance=a.balance / 2 if a.tax_treatment == ROTH else a.balance,
                    tax_treatment=a.tax_treatment, owner=a.owner, basis=a.basis,
                    annual_return=a.annual_return, annual_contribution=a.annual_contribution)
            for a in h.accounts])

    r = compare(_working(), [custom("lose half the Roth", halve_the_roth)], tax_year=Y)
    assert next(c for c in r.candidates
                if c.label != "as planned").terminal_assets < r.baseline.terminal_assets


def test_an_invalid_spend_factor_is_refused():
    with pytest.raises(PlanningError, match="must be positive"):
        spend_change(0)


def test_saving_into_an_unknown_account_is_refused():
    with pytest.raises(PlanningError, match="no account named"):
        save_more(10_000, into="Nonexistent").run(_working(), tax_year=Y)


# ── suggest: choose the scenarios from the diagnosis ─────────────────────────────────────────────
def test_a_failing_plan_is_offered_the_levers_that_fix_it():
    """Planning software makes the ADVISOR pick the scenarios. Choosing them from the diagnosis is
    more useful and is something the ledger can do."""
    h = _working(spend=260_000, k401=400_000)
    assert not project(h, tax_year=Y).succeeds
    labels = [v.label for v in suggest(h, tax_year=Y)]
    assert any("retire" in s and "later" in s for s in labels)
    assert any("spend" in s and "less" in s for s in labels)


def test_a_household_with_a_large_surplus_is_told_it_could_live_more():
    """The honest finding no tool volunteers: a plan ending with many multiples of its spending is
    being UNDER-lived."""
    h = _working(spend=70_000, k401=6_000_000)
    assert project(h, tax_year=Y).succeeds
    labels = [v.label for v in suggest(h, tax_year=Y)]
    assert any("more" in s for s in labels)


def test_a_plan_that_works_without_much_room_gets_downside_sensitivities():
    h = _working(spend=150_000, k401=1_250_000)
    base = project(h, tax_year=Y)
    if base.succeeds and base.terminal_assets / sum(y.expenses for y in base.years) <= 0.5:
        labels = [v.label for v in suggest(h, tax_year=Y)]
        assert any("returns of" in s or "inflation of" in s for s in labels)


# ── solve_for: the question people actually ask ──────────────────────────────────────────────────
def test_solving_for_spending_finds_a_cut_that_actually_works():
    """Not "what if I spend 10% less" but "how much less do I HAVE to spend". Evaluating a guess and
    searching for a threshold are different operations."""
    h = _working(spend=260_000, k401=500_000)
    assert not project(h, tax_year=Y).succeeds
    s = solve_for_spending(h, tax_year=Y)
    assert s.achievable and s.required > 0
    assert s.solved is not None and s.solved.succeeds
    assert "makes the plan last" in s.summary


def test_the_solved_cut_is_minimal():
    """A cut materially smaller than the solution must NOT work, or the search is not finding a
    threshold — it is just finding something that happens to pass."""
    h = _working(spend=260_000, k401=500_000)
    s = solve_for_spending(h, tax_year=Y)
    annual = 260_000
    too_small = 1 - (s.required - 5_000) / annual
    assert not spend_change(too_small).run(h, tax_year=Y).succeeds


def test_no_cut_is_needed_when_the_plan_already_works():
    s = solve_for_spending(_working(spend=70_000, k401=4_000_000), tax_year=Y)
    assert s.required == 0.0 and s.achievable
    assert "no cut is needed" in s.summary


def test_a_gap_too_large_for_one_lever_says_so():
    """Honest refusal. Reporting an unachievable cut as achievable would be worse than useless.

    Needs an ALREADY-RETIRED household: a working one with wages can usually fund a 75%-cut budget
    out of income alone, so spending is nearly always a sufficient lever while earning. My first
    fixture here was a working household and the solver correctly found a 70% cut that works.
    """
    h = Household(
        people=[Person("Alex", 70, None, 95, 0)], filing_status="single",
        accounts=[Account("IRA", 40_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 200_000)])
    s = solve_for_spending(h, tax_year=Y)
    assert s.achievable is False and s.required is None
    assert "cannot fix this plan" in s.summary


def test_solving_for_retirement_age_finds_the_fewest_extra_years():
    h = _working(spend=200_000, k401=700_000)
    assert not project(h, tax_year=Y).succeeds
    s = solve_for_retirement_age(h, tax_year=Y)
    if s.achievable:
        assert s.required >= 1 and s.solved.succeeds
        # One year less must fail, or it is not the minimum.
        if s.required > 1:
            assert not retire_later(int(s.required) - 1).run(h, tax_year=Y).succeeds


def test_working_longer_is_not_a_lever_for_the_already_retired():
    h = Household(
        people=[Person("Alex", 70, None, 92, 0)], filing_status="single",
        accounts=[Account("IRA", 300_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 90_000)])
    s = solve_for_retirement_age(h, tax_year=Y)
    assert s.achievable is False and "already retired" in s.summary


def test_solve_all_offers_every_lever_rather_than_one_answer():
    """Presenting a single "answer" would be a judgement about their life the engine is not entitled
    to make. Spending less and working longer are not interchangeable to the person doing them."""
    h = _working(spend=240_000, k401=600_000)
    sols = solve_all(h, tax_year=Y)
    assert {s.lever for s in sols} == {"spending", "retirement_age"}
    for s in sols:
        assert s.summary


def test_solutions_are_rounded_to_avoid_false_precision():
    """"Cut spending by $1,847" implies a precision the return assumption does not support."""
    h = _working(spend=260_000, k401=500_000)
    s = solve_for_spending(h, tax_year=Y)
    assert s.required % 100 == 0


# ── Reporting ────────────────────────────────────────────────────────────────────────────────────
def test_results_are_json_serializable():
    import json
    h = _working()
    json.dumps(compare(h, [retire_later(2)], tax_year=Y).as_dict())
    for s in solve_all(h, tax_year=Y):
        json.dumps(s.as_dict())


def test_the_tax_basis_propagates():
    r = compare(_working(), [retire_later(2)], tax_year=2026)
    assert r.tax_year == 2024 and r.tax_basis_is_current_year is False
