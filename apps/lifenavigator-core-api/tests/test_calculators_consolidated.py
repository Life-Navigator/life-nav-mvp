"""Phase A consolidation — the calculators that absorbed `tools.py`'s arithmetic.

Verified independently per R8: simulation, hand-derivation, or an inverse round-trip. Nowhere does a
test restate the implementation's own expression.
"""
from __future__ import annotations

import pytest

from app.services import assumptions as A
from app.services.calculators import base, career, cash, debt, education, housing, primitives
from app.services.calculators.base import SCENARIO, STRICT, CalculatorError


# ── cash: per-figure tiering is the point ─────────────────────────────────────────────────────────
def test_months_covered_is_strict_but_the_target_is_scenario():
    """The reason one tool became several calculators. Both figures come out of the same request;
    only one of them is the user's own arithmetic."""
    covered = cash.months_covered(monthly_expenses=4000, current_cash=12000)
    target = cash.emergency_fund_target(monthly_expenses=4000)
    assert covered.value == 3.0 and covered.tier == STRICT and covered.assumptions == ()
    assert target.value == 24000.0 and target.tier == SCENARIO
    assert [a.key for a in target.assumptions] == ["emergency_fund_months"]


def test_an_explicit_target_months_makes_the_target_strict():
    """If the user states their own target, nothing was assumed and nothing should be hedged."""
    r = cash.emergency_fund_target(monthly_expenses=4000, target_months=3)
    assert r.value == 12000.0 and r.tier == STRICT and r.assumptions == ()


def test_emergency_fund_gap_never_goes_negative():
    """A funded user is '$0 short', not '-$8,000 short' — a sign slip there reads as a shortfall."""
    funded = cash.emergency_fund_gap(monthly_expenses=4000, current_cash=32000)
    assert funded.value == 0.0
    assert funded.detail["funded"] is True and funded.detail["surplus"] == 8000.0


def test_emergency_fund_target_of_zero_months_is_refused():
    with pytest.raises(CalculatorError, match="greater than zero"):
        cash.emergency_fund_target(monthly_expenses=4000, target_months=0)


def test_zero_expenses_refused_because_it_is_the_divisor():
    with pytest.raises(CalculatorError, match="greater than zero"):
        cash.months_covered(monthly_expenses=0, current_cash=5000)


def test_net_worth_can_be_negative_and_says_so():
    r = cash.net_worth(assets=300000, liabilities=420000)
    assert r.value == -120000.0 and r.detail["negative"] is True and r.tier == STRICT


def test_savings_rate_keeps_the_guidance_out_of_the_cited_value():
    r = cash.savings_rate(annual_income=120000, annual_savings=18000)
    assert r.value == 0.15 and r.unit == "ratio" and r.tier == STRICT
    assert r.detail["pct"] == 15.0 and r.detail["common_target_pct"] == 20


# ── housing: the inverse round-trip ───────────────────────────────────────────────────────────────
def test_max_home_price_round_trips_through_amortized_payment():
    """The independent check: the loan this solves for must imply exactly the payment ceiling it
    started from. A wrong inversion cannot survive a round trip through the forward calculator."""
    r = housing.max_home_price(annual_income=150000, monthly_debts=500, down_payment=60000)
    implied = debt.amortized_payment(principal=r.detail["max_loan"], apr=r.inputs_used["apr"],
                                     term_months=r.inputs_used["term_months"])
    assert implied.value == pytest.approx(r.detail["max_monthly_payment"], abs=0.5)


def test_payment_ceiling_is_the_lower_of_the_two_dti_rules():
    """Hand-derived: $150k gross is $12,500/mo. Front-end 28% = $3,500. Back-end 36% = $4,500 less
    $500 of existing debt = $4,000. The binding limit is $3,500."""
    r = housing.max_monthly_payment(annual_income=150000, monthly_debts=500)
    assert r.value == 3500.0
    assert r.detail["front_end_limit"] == 3500.0 and r.detail["back_end_limit"] == 4000.0
    assert r.detail["binding_constraint"] == "front_end_income"


def test_heavy_existing_debt_flips_the_binding_constraint():
    """The actionable half: when debt binds, paying it down raises the ceiling; when income binds,
    only more income does. Reporting a price without saying which is advice withheld."""
    r = housing.max_monthly_payment(annual_income=150000, monthly_debts=2000)
    assert r.detail["binding_constraint"] == "back_end_debt"
    assert r.value == 2500.0           # 36% of 12,500 = 4,500, minus 2,000


def test_debt_so_large_the_ceiling_is_zero_rather_than_negative():
    r = housing.max_monthly_payment(annual_income=60000, monthly_debts=3000)
    assert r.value == 0.0


def test_rent_vs_buy_cites_every_assumption_it_rests_on():
    """Six registry values drive this number. `tools.py` cited three and hardcoded the rest."""
    r = housing.rent_vs_buy(home_price=500000, monthly_rent=2800)
    keys = {a.key for a in r.assumptions}
    assert keys == {"down_payment_pct", "rent_vs_buy_horizon", "mortgage_rate",
                    "mortgage_term_months", "home_appreciation", "inflation"}
    assert r.tier == SCENARIO


def test_rent_vs_buy_remaining_loan_matches_an_independent_amortization():
    """Simulate the loan month by month for the horizon and compare the outstanding balance."""
    r = housing.rent_vs_buy(home_price=500000, monthly_rent=2800)
    apr = r.inputs_used["apr"]
    loan = 500000 - r.inputs_used["down_payment"]
    pmt = r.detail["monthly_payment"]
    bal = loan
    for _ in range(r.inputs_used["years"] * 12):
        bal += bal * (apr / 12.0)
        bal -= pmt
    assert bal == pytest.approx(r.detail["loan_remaining_at_horizon"], rel=1e-4)


def test_a_very_high_rent_flips_the_verdict_to_buy_by_a_larger_margin():
    """Monotonicity: the cited value is buy-minus-rent, so raising rent must push it more negative."""
    low = housing.rent_vs_buy(home_price=500000, monthly_rent=1500).value
    high = housing.rent_vs_buy(home_price=500000, monthly_rent=4500).value
    assert high < low


# ── debt.payoff_plan ──────────────────────────────────────────────────────────────────────────────
def _simulate_plan(rows, extra, order_labels):
    """Independent simulator: accrue on the opening balance, pay minimums, roll the extra."""
    bal = {r["label"]: r["balance"] for r in rows}
    mins = {r["label"]: r["min_payment"] for r in rows}
    aprs = {r["label"]: r["apr"] for r in rows}
    interest = 0.0
    month = 0
    while any(v > 0.005 for v in bal.values()) and month < 600:
        month += 1
        pool = extra
        for lbl in bal:
            if bal[lbl] <= 0:
                continue
            i = bal[lbl] * (aprs[lbl] / 12.0)
            interest += i
            bal[lbl] += i
            pay = min(bal[lbl], mins[lbl])
            bal[lbl] -= pay
        pool += sum(mins[k] for k in bal if bal[k] <= 0)
        for lbl in order_labels:
            if pool <= 0:
                break
            if bal[lbl] > 0:
                pay = min(bal[lbl], pool)
                bal[lbl] -= pay
                pool -= pay
    return month, interest


DEBTS = [
    {"label": "card", "balance": 8000, "apr": 0.22, "min_payment": 200},
    {"label": "auto", "balance": 14000, "apr": 0.049, "min_payment": 320},
    {"label": "student", "balance": 22000, "apr": 0.07, "min_payment": 250},
]


def test_payoff_plan_matches_an_independent_simulation():
    r = debt.payoff_plan(debts=DEBTS, extra_payment=300)
    months, interest = _simulate_plan(DEBTS, 300, r.detail["order"])
    assert r.value == months
    # abs=0.01: the stored figure is rounded to cents, which is the right precision for money.
    assert r.detail["total_interest_paid"] == pytest.approx(interest, abs=0.01)


def test_avalanche_orders_by_apr_and_snowball_by_balance():
    av = debt.payoff_plan(debts=DEBTS, extra_payment=300, method="avalanche")
    sn = debt.payoff_plan(debts=DEBTS, extra_payment=300, method="snowball")
    assert av.detail["order"] == ["card", "student", "auto"]
    assert sn.detail["order"] == ["card", "auto", "student"]


def test_avalanche_always_pays_less_interest_than_snowball():
    """The defining property of the method, and the reason to recommend one over the other."""
    av = debt.payoff_plan(debts=DEBTS, extra_payment=300, method="avalanche")
    sn = debt.payoff_plan(debts=DEBTS, extra_payment=300, method="snowball")
    assert av.detail["total_interest_paid"] < sn.detail["total_interest_paid"]


def test_total_interest_is_returned_at_all():
    """`tools.py:debt_payoff` accumulated `total_interest` and never returned it — and accumulated
    it AFTER each payment, so it was wrong even as a local. It is the figure that makes the case for
    paying extra, and it was computed, mangled and discarded."""
    r = debt.payoff_plan(debts=DEBTS, extra_payment=300)
    assert r.detail["total_interest_paid"] > 0
    assert r.detail["total_paid"] == pytest.approx(44000 + r.detail["total_interest_paid"], abs=0.01)


def test_extra_payment_reduces_both_time_and_interest():
    none_ = debt.payoff_plan(debts=DEBTS, extra_payment=0)
    some = debt.payoff_plan(debts=DEBTS, extra_payment=500)
    assert some.value < none_.value
    assert some.detail["total_interest_paid"] < none_.detail["total_interest_paid"]


def test_payments_that_do_not_cover_interest_are_refused_not_reported_as_600_months():
    """The old loop ran to a 600-month ceiling and reported whatever month it stopped at, so a
    balance that GROWS came back as a confident 50-year payoff."""
    with pytest.raises(CalculatorError, match="do not reduce the balance"):
        debt.payoff_plan(debts=[{"label": "card", "balance": 5000, "apr": 0.22, "min_payment": 80}])


def test_an_unknown_method_is_rejected_rather_than_silently_running_snowball():
    """`method != "avalanche"` used to mean snowball, so `method="highest_apr"` ran the opposite of
    what it says and echoed the bad string back as if it had been honoured."""
    with pytest.raises(CalculatorError, match="must be 'avalanche' or 'snowball'"):
        debt.payoff_plan(debts=DEBTS, method="highest_apr")


def test_payoff_plan_records_when_each_debt_cleared():
    r = debt.payoff_plan(debts=DEBTS, extra_payment=300)
    cleared = r.detail["cleared_month"]
    assert set(cleared) == {"card", "auto", "student"}
    assert cleared["card"] < cleared["student"]       # the avalanche target goes first
    assert max(cleared.values()) == int(r.value)


# ── career ────────────────────────────────────────────────────────────────────────────────────────
def test_uncaptured_match_is_hand_checkable_and_strict():
    """$120k at 3% contributed against a 6% match: 3% of $120k = $3,600 left on the table."""
    r = career.uncaptured_match(income=120000, current_rate=3, employer_match_rate=6)
    assert r.value == 3600.0 and r.tier == STRICT and r.assumptions == ()
    assert r.detail["full_match_annual"] == 7200.0
    assert r.detail["recommended_rate_pct"] == 6
    assert r.detail["capturing_full_match"] is False


def test_already_capturing_the_full_match_reports_zero_not_a_negative():
    r = career.uncaptured_match(income=120000, current_rate=8, employer_match_rate=6)
    assert r.value == 0.0 and r.detail["capturing_full_match"] is True


def test_match_rates_are_percentages_of_pay_not_decimals():
    """The 401(k) interface convention. Passing 6 must mean 6%, not be rejected as an unconverted
    percent — the conversion happens before `require_rate`, deliberately."""
    r = career.uncaptured_match(income=100000, current_rate=0, employer_match_rate=5)
    assert r.value == 5000.0


def test_offer_spread_is_the_cited_value_and_the_ranking_is_detail():
    r = career.offer_total_comp(offers=[
        {"name": "A", "base": 180000, "bonus": 20000},
        {"name": "B", "base": 165000, "equity_per_year": 40000},
    ])
    assert r.detail["best"] == "B" and r.detail["ranked"][0]["total_comp"] == 205000.0
    assert r.value == 5000.0        # 205,000 − 200,000
    assert "federal_tax" in r.detail["excludes"] and "cost_of_living" in r.detail["excludes"]


def test_offer_comparison_needs_at_least_one_offer():
    with pytest.raises(CalculatorError, match="at least one offer"):
        career.offer_total_comp(offers=[])


# ── education ─────────────────────────────────────────────────────────────────────────────────────
def test_degree_cost_includes_foregone_earnings():
    """$80k tuition over two years out of a $90k job costs $260k, not $80k — and the foregone half
    is the larger one, which is the point of surfacing the share."""
    r = education.degree_total_cost(tuition_total=80000, years_in_school=2, salary_before=90000)
    assert r.value == 260000.0 and r.tier == STRICT
    assert r.detail["foregone_earnings"] == 180000.0
    assert r.detail["foregone_share"] == pytest.approx(180000 / 260000, abs=1e-3)


def test_degree_payback_is_cost_over_uplift_and_interpolated():
    """$260,000 ÷ $50,000/yr = 5.2 years. Interpolated, not rounded up to 6."""
    r = education.degree_payback_years(tuition_total=80000, years_in_school=2,
                                       salary_before=90000, salary_after=140000)
    assert r.value == pytest.approx(5.2, abs=0.05) and r.tier == STRICT


def test_degree_with_no_uplift_refuses_to_quote_a_payback_period():
    with pytest.raises(CalculatorError, match="not above the current one"):
        education.degree_payback_years(tuition_total=80000, years_in_school=2,
                                        salary_before=90000, salary_after=85000)


def test_lifetime_value_is_discounted_and_far_below_the_undiscounted_figure():
    """The defect being corrected: `annual_gain * 25 - cost` overstated this degree's value by
    $610,000, because a dollar earned in year 25 is worth ~23 cents today at a 6% rate."""
    r = education.degree_lifetime_value(tuition_total=80000, years_in_school=2,
                                         salary_before=90000, salary_after=140000)
    assert r.tier == SCENARIO
    assert r.detail["undiscounted_net_gain"] == 990000.0
    assert r.value < r.detail["undiscounted_net_gain"]
    assert r.detail["discounting_reduces_by"] > 500000

    # Independently: NPV of the same flows through the shared primitive.
    manual = primitives.npv(A.value("investment_return"), [-260000.0] + [50000.0] * 25)
    assert r.value == pytest.approx(manual, abs=0.01)


def test_lifetime_value_cites_both_the_horizon_and_the_discount_rate():
    r = education.degree_lifetime_value(tuition_total=80000, years_in_school=2,
                                         salary_before=90000, salary_after=140000)
    assert {a.key for a in r.assumptions} == {"working_years_horizon", "investment_return"}


# ── registry ──────────────────────────────────────────────────────────────────────────────────────
def test_all_consolidated_calculators_are_registered():
    expected = {
        "cash.months_covered", "cash.emergency_fund_target", "cash.emergency_fund_gap",
        "cash.savings_rate", "cash.net_worth",
        "housing.max_monthly_payment", "housing.max_home_price", "housing.rent_vs_buy",
        "career.uncaptured_match", "career.offer_total_comp",
        "education.degree_total_cost", "education.degree_payback_years",
        "education.degree_lifetime_value",
        "debt.payoff_plan",
    }
    assert expected <= set(base.available())
