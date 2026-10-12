"""Spending guardrails (2.5) and composable planned spending.

Both are about the ledger expressing what households ACTUALLY do: adjust spending when the market
falls, and plan outlays as a set of line items rather than one number. Neither moves money — the
app is read-only and these produce rules and breakdowns the user acts on themselves.
"""
from __future__ import annotations

import pytest

from app.services.planning import (
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Goal,
    Guardrail,
    Household,
    Person,
    SpendItem,
    project,
    spending_guardrails,
)
from app.services.planning.household import PlanningError

Y = 2024
CRASH = [-0.37] + [0.06] * 40


def _retiree(ira=1_300_000, spend=78_000, life=92):
    return Household(
        people=[Person("Alex", 66, None, life, 0)], filing_status="single",
        accounts=[Account("IRA", ira, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", spend)])


# ── Composable planned spending ──────────────────────────────────────────────────────────────────
def test_a_goal_can_be_built_from_line_items():
    """The breakdown is how people hold the number in their heads, so discarding it at the door
    makes the advice worse for no gain."""
    trip = Goal("Japan trip", year=1, month=3, items=(
        SpendItem("flights", 4_800), SpendItem("hotel", 5_200),
        SpendItem("meals", 2_400), SpendItem("upgrade", 3_600, optional=True)))
    assert trip.amount == 16_000
    assert trip.essential_amount == 12_400 and trip.optional_amount == 3_600
    assert trip.largest_item.label == "hotel"
    assert trip.when == "year 1, month 3"


def test_a_breakdown_that_does_not_add_up_is_refused():
    """A breakdown shown to the user that disagrees with the figure the plan was built on is
    exactly the quiet inconsistency that destroys trust in a plan document."""
    with pytest.raises(PlanningError, match="does not match its items"):
        Goal("Wedding", amount=50_000, year=1, items=(SpendItem("venue", 10_000),))


def test_a_goal_still_works_as_a_single_amount():
    assert Goal("House", amount=120_000, year=5).amount == 120_000


def test_an_invalid_month_is_refused():
    with pytest.raises(PlanningError, match="month must be 1-12"):
        Goal("x", amount=100, year=1, month=13)


def test_a_spend_item_needs_a_label():
    with pytest.raises(PlanningError, match="needs a label"):
        SpendItem("  ", 100)


def test_goals_in_the_same_year_are_funded_in_calendar_order_within_priority():
    """A January wedding is paid for before a November trip, which is how the money would actually
    leave the account. Undated outlays sort last, since those are the flexible ones."""
    h = Household(
        people=[Person("Alex", 34, 65, 92, 95_000)], filing_status="single",
        accounts=[Account("Savings", 20_000, TAXABLE, basis=20_000)],
        expenses=[Expense("Living", 72_000)],
        goals=[Goal("November trip", amount=16_000, year=1, month=11, priority="need"),
               Goal("March wedding", amount=20_000, year=1, month=3, priority="need")])
    r = project(h, tax_year=Y)
    unfunded = [g["label"] for g in r.unfunded_goals]
    assert "November trip" in unfunded, "the later outlay is the one that misses out"
    assert "March wedding" not in unfunded


def test_an_unfundable_goal_names_the_line_to_question_first():
    h = Household(
        people=[Person("Alex", 34, 65, 92, 95_000)], filing_status="single",
        accounts=[Account("Savings", 20_000, TAXABLE, basis=20_000)],
        expenses=[Expense("Living", 85_000)],
        goals=[Goal("Japan trip", year=1, items=(
            SpendItem("flights", 4_800), SpendItem("hotel", 5_200),
            SpendItem("meals", 2_400), SpendItem("upgrade", 3_600, optional=True)))])
    r = project(h, tax_year=Y)
    g = next(g for g in r.unfunded_goals if g["label"] == "Japan trip")
    assert g["largest_item"] == "hotel" and g["largest_item_amount"] > 0
    assert g["short_by"] > 0 and g["essential_only"] is not None


def test_a_goal_that_does_not_fit_in_full_is_funded_without_its_optional_lines():
    """PARTIAL FUNDING. "It fits without the upgrade" beats "no" — the same computation, and the
    difference between a plan that refuses and a plan that advises."""
    h = Household(
        people=[Person("Alex", 34, 65, 92, 95_000)], filing_status="single",
        # Calibrated: the band where the essential lines fit and the full outlay does not is
        # narrow, so the fixture is pinned empirically rather than guessed.
        accounts=[Account("Savings", 34_000, TAXABLE, basis=34_000)],
        expenses=[Expense("Living", 85_000)],
        goals=[Goal("Japan trip", year=1, items=(
            SpendItem("flights", 4_800), SpendItem("hotel", 5_200),
            SpendItem("meals", 2_400), SpendItem("upgrade", 3_600, optional=True)))])
    r = project(h, tax_year=Y)
    assert not r.unfunded_goals
    part = r.partially_funded_goals[0]
    assert part["dropped"] == ["upgrade"]
    assert part["funded"] < part["wanted"]
    assert any("fits at" in e for y in r.years for e in y.events)


def test_a_goal_with_no_optional_lines_cannot_be_partially_funded():
    """There is nothing to drop, so the honest answer is still that it does not fit."""
    h = Household(
        people=[Person("Alex", 34, 65, 92, 95_000)], filing_status="single",
        accounts=[Account("Savings", 20_000, TAXABLE, basis=20_000)],
        expenses=[Expense("Living", 85_000)],
        goals=[Goal("Roof", year=1, items=(SpendItem("materials", 12_000),
                                            SpendItem("labour", 14_000)))])
    r = project(h, tax_year=Y)
    assert r.unfunded_goals and not r.partially_funded_goals


# ── Guardrails: the rule, not an action ──────────────────────────────────────────────────────────
def test_guardrails_extend_solvency_after_a_crash():
    """A fixed-spending projection assumes the household keeps spending the same amount through a
    2008. Nobody does that, so the fixed model reports a failure they would have avoided."""
    h = _retiree()
    fixed = project(h, tax_year=Y, return_path=CRASH)
    flex = project(h, tax_year=Y, return_path=CRASH, guardrail=Guardrail())
    assert fixed.depleted_year is not None
    assert flex.depleted_year > fixed.depleted_year


def test_spending_is_cut_when_the_withdrawal_rate_breaches_the_upper_rail():
    r = project(_retiree(), tax_year=Y, return_path=CRASH, guardrail=Guardrail())
    assert any(y.spending_factor < 1.0 for y in r.years)
    assert any("cut: withdrawal rate above the upper rail" in e
               for y in r.years for e in y.events)


def test_spending_can_rise_when_the_portfolio_runs_far_ahead():
    """The rule is symmetric — a household well under its rails is being under-lived."""
    h = _retiree(ira=6_000_000, spend=80_000)
    r = project(h, tax_year=Y, guardrail=Guardrail())
    assert any(y.spending_factor > 1.0 for y in r.years)
    assert any("raise: withdrawal rate below the lower rail" in e
               for y in r.years for e in y.events)


def test_the_cut_is_clamped_so_the_model_cannot_pretend_a_60_percent_cut_is_a_plan():
    """An unbounded rule happily models a household living on 40% of plan for a decade. That is not
    flexibility, it is a different life, and calling it a plan that "works" would be dishonest."""
    rail = Guardrail(max_cut=0.25)
    r = project(_retiree(), tax_year=Y, return_path=CRASH, guardrail=rail)
    assert min(y.spending_factor for y in r.years) >= 0.75 - 1e-9
    assert any("at the spending floor" in e for y in r.years for e in y.events)


def test_the_raise_is_clamped_too():
    rail = Guardrail(max_raise=0.05)
    r = project(_retiree(ira=8_000_000, spend=60_000), tax_year=Y, guardrail=rail)
    assert max(y.spending_factor for y in r.years) <= 1.05 + 1e-9


def test_guardrails_only_apply_once_retired():
    """A working household funds spending from wages, so a withdrawal-rate rail is meaningless."""
    h = Household(
        people=[Person("Alex", 50, 65, 90, 180_000)], filing_status="single",
        accounts=[Account("IRA", 400_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 120_000)])
    r = project(h, tax_year=Y, guardrail=Guardrail())
    working = [y for y in r.years if y.wage_income > 0]
    assert working and all(y.spending_factor == 1.0 for y in working)


def test_a_guardrail_with_inverted_rails_is_refused():
    with pytest.raises(PlanningError, match="0 < lower"):
        Guardrail(upper_rate=0.03, lower_rate=0.05)


def test_an_absurd_adjustment_is_refused():
    with pytest.raises(PlanningError, match="adjustment must be between"):
        Guardrail(adjustment=1.5)


def test_without_a_guardrail_spending_never_moves():
    r = project(_retiree(), tax_year=Y, return_path=CRASH)
    assert all(y.spending_factor == 1.0 for y in r.years)
    assert all(y.withdrawal_rate_before_adjustment is None for y in r.years)


# ── The strategy: what flexibility is worth, and what it costs ───────────────────────────────────
def test_flexibility_raises_the_success_probability():
    """MEASURED UNDER MONTE CARLO, because that is the only place flexibility shows up — on a single
    path a rail either fires or it does not, and the answer is an artefact of one sequence."""
    g = spending_guardrails(_retiree(ira=1_500_000, spend=80_000), tax_year=Y, paths=120)
    assert g.flexible_success > g.fixed_success
    assert g.improvement > 0


def test_the_thresholds_are_reported_in_dollars():
    """"Cut spending when the withdrawal rate exceeds 5.5%" is not actionable. "If the portfolio
    drops below $1.45M, cut about 10%" is."""
    g = spending_guardrails(_retiree(spend=80_000), tax_year=Y, paths=60)
    assert g.lower_threshold == pytest.approx(80_000 / g.rule["upper_rate"], rel=1e-6)
    assert g.upper_threshold == pytest.approx(80_000 / g.rule["lower_rate"], rel=1e-6)
    assert g.lower_threshold < g.upper_threshold
    assert "$" in g.summary and "cut spending" in g.summary


def test_the_cost_of_the_flexibility_is_stated_not_hidden():
    """WHAT THE SUCCESS NUMBER HIDES. Reporting "68% instead of 24%" without saying the worst paths
    ask for a 30% cut sustained for decades would oversell it badly."""
    g = spending_guardrails(_retiree(ira=1_300_000, spend=85_000), tax_year=Y, paths=120)
    assert g.worst_cut_modelled > 0
    assert "not free" in g.honest_cost
    assert f"{g.worst_cut_modelled:.0%}" in g.honest_cost
    assert "would actually accept" in g.honest_cost


def test_a_plan_that_never_needs_the_rule_says_so():
    g = spending_guardrails(_retiree(ira=20_000_000, spend=60_000), tax_year=Y, paths=40,
                            guardrail=Guardrail(lower_rate=0.0001, upper_rate=0.9))
    assert g.worst_cut_modelled == pytest.approx(0.0, abs=1e-9)
    assert "never called on" in g.honest_cost


def test_it_needs_something_to_adjust():
    h = Household(people=[Person("Alex", 66, None, 92, 0)], filing_status="single",
                  accounts=[Account("IRA", 500_000, TAX_DEFERRED, "Alex")], expenses=[])
    with pytest.raises(PlanningError, match="at least one expense"):
        spending_guardrails(h, tax_year=Y, paths=10)


def test_the_result_is_reproducible_and_serializable():
    import json
    a = spending_guardrails(_retiree(), tax_year=Y, paths=40, seed=5)
    b = spending_guardrails(_retiree(), tax_year=Y, paths=40, seed=5)
    assert a.flexible_success == b.flexible_success
    json.dumps(a.as_dict())
