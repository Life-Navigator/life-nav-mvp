"""Phase B — federal credits, their phase-outs, and the marginal-rate spikes they cause.

The credit PARAMETERS in the shipped tables are unverified (and, unlike the ordinary brackets, have
no independent cross-check in this repo), so every behavioural test here runs against a SYNTHETIC
VERIFIED fixture built from round, hand-checkable numbers. That keeps engine correctness provable
today and keeps these tests valid once real parameters land.
"""
from __future__ import annotations

import json

import pytest

from app.services.calculators import tax as T, versioned_data as V
from app.services.calculators.base import STRICT, CalculatorError

Y = 2024
_REAL = json.load(open("app/services/calculators/data/tax_tables/2024.json"))

# Round numbers chosen so every expectation below is arithmetic you can do in your head.
FIXTURE_CREDITS = {
    "verified": True,
    "child_tax_credit": {
        "per_child": 2000, "refundable_per_child": 1500, "qualifying_age_under": 17,
        "phase_out_start": {"single": 200000, "married_jointly": 400000,
                            "married_separately": 200000, "head_of_household": 200000},
        "phase_out_per_1000": 50,
    },
    "other_dependent_credit": {"per_dependent": 500, "refundable_per_dependent": 0,
                               "shares_phase_out_with": "child_tax_credit"},
    "american_opportunity_credit": {
        "max_per_student": 2500, "first_tier_expenses": 2000, "first_tier_rate": 1.00,
        "second_tier_expenses": 2000, "second_tier_rate": 0.25, "refundable_share": 0.40,
        "phase_out": {"single": [80000, 90000], "married_jointly": [160000, 180000],
                      "married_separately": [0, 0], "head_of_household": [80000, 90000]},
    },
    "lifetime_learning_credit": {
        "max_per_return": 2000, "qualified_expense_cap": 10000, "rate": 0.20,
        "refundable_share": 0.0,
        "phase_out": {"single": [80000, 90000], "married_jointly": [160000, 180000],
                      "married_separately": [0, 0], "head_of_household": [80000, 90000]},
    },
    "savers_credit": {
        "contribution_cap": 2000,
        "tiers": {s: [[20000, 0.50], [30000, 0.20], [40000, 0.10]]
                  for s in T.FILING_STATUSES},
        "refundable_share": 0.0,
    },
}


@pytest.fixture
def verified(monkeypatch):
    """The real 2024 table with a VERIFIED synthetic credits section spliced in."""
    data = {**_REAL, "credits": FIXTURE_CREDITS}
    monkeypatch.setattr(T, "_table", lambda tax_year=None: V.LoadedData("tax_tables", Y, Y, data))
    return data


# ── Gating ────────────────────────────────────────────────────────────────────────────────────────
def test_shipped_credit_parameters_refuse_to_produce_a_figure():
    """Unverified in BOTH years on purpose: the ordinary brackets were cross-checked against what
    tax.ts shipped, but credits have no such independent check here."""
    with pytest.raises(V.UnverifiedDataError, match="credit parameters are NOT verified"):
        T.tax_credits(agi=150000, filing_status="married_jointly",
                      tax_before_credits=20000, qualifying_children=2, tax_year=Y)


def test_the_gate_names_the_publications_to_check():
    try:
        T.tax_credits(agi=100000, filing_status="single", qualifying_children=1, tax_year=Y)
    except V.UnverifiedDataError as exc:
        assert "Schedule 8812" in str(exc) and "Pub 970" in str(exc)
    else:
        pytest.fail("expected UnverifiedDataError")


# ── Child + dependent credit ──────────────────────────────────────────────────────────────────────
def test_full_child_credit_below_the_phase_out(verified):
    """2 children x $2,000 = $4,000, fully available at $150k joint."""
    r = T.tax_credits(agi=150000, filing_status="married_jointly",
                      tax_before_credits=20000, qualifying_children=2)
    assert r.value == 4000.0
    row = r.detail["credits"][0]
    assert row["lost_to_phase_out"] == 0.0 and row["in_phase_out_band"] is False
    assert r.tier == STRICT


def test_other_dependents_are_500_each_and_nonrefundable(verified):
    r = T.tax_credits(agi=150000, filing_status="married_jointly",
                      tax_before_credits=20000, other_dependents=2)
    assert r.value == 1000.0
    assert r.detail["refundable"] == 0.0


def test_the_child_phase_out_is_a_staircase_not_a_ramp(verified):
    """Statutory: $50 per $1,000 OR FRACTION above the threshold. So $1 over a boundary costs the
    full $50, and treating it as linear understates the loss at every point inside a step."""
    at = T.tax_credits(agi=400000, filing_status="married_jointly",
                       tax_before_credits=50000, qualifying_children=2)
    one_dollar_over = T.tax_credits(agi=400001, filing_status="married_jointly",
                                    tax_before_credits=50000, qualifying_children=2)
    assert at.value == 4000.0
    assert one_dollar_over.value == 3950.0, "one dollar must cost a whole $50 step"

    # Mid-step: $400,999 is still inside the first $1,000, so still exactly one step.
    assert T.tax_credits(agi=400999, filing_status="married_jointly",
                         tax_before_credits=50000, qualifying_children=2).value == 3950.0
    # $401,001 crosses into the second step.
    assert T.tax_credits(agi=401001, filing_status="married_jointly",
                         tax_before_credits=50000, qualifying_children=2).value == 3900.0


def test_the_child_credit_phases_out_completely(verified):
    """$4,000 of credit at $50 per $1,000 is exhausted $80,000 above the threshold."""
    r = T.tax_credits(agi=480000, filing_status="married_jointly",
                      tax_before_credits=90000, qualifying_children=2)
    assert r.value == 0.0


def test_the_refundable_portion_is_capped_per_child(verified):
    """A family with no liability still receives the refundable part — 2 x $1,500 — and not the
    full $4,000. `tax.ts` returned zero credits entirely, so this family was shown $4,000 more tax
    than they owe."""
    r = T.tax_credits(agi=40000, filing_status="married_jointly",
                      tax_before_credits=0, qualifying_children=2)
    assert r.detail["refundable"] == 3000.0
    assert r.value == 3000.0
    # The nonrefundable remainder was earned but unusable, and that is reported rather than hidden.
    assert r.detail["nonrefundable_wasted"] == 1000.0


def test_nonrefundable_credits_cannot_take_liability_below_zero(verified):
    r = T.tax_credits(agi=150000, filing_status="married_jointly",
                      tax_before_credits=300, other_dependents=2)
    assert r.value == 300.0
    assert r.detail["nonrefundable_earned"] == 1000.0
    assert r.detail["nonrefundable_wasted"] == 700.0


# ── Education credits ─────────────────────────────────────────────────────────────────────────────
def test_aotc_tiered_formula(verified):
    """100% of the first $2,000 + 25% of the next $2,000 = $2,500 at $4,000 of expenses."""
    full = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                         aotc_students=1, aotc_expenses_per_student=4000)
    assert full.value == 2500.0

    partial = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                            aotc_students=1, aotc_expenses_per_student=2000)
    assert partial.value == 2000.0

    capped = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                           aotc_students=1, aotc_expenses_per_student=20000)
    assert capped.value == 2500.0, "capped at the statutory maximum per student"


def test_aotc_is_per_student(verified):
    r = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                      aotc_students=2, aotc_expenses_per_student=4000)
    assert r.value == 5000.0


def test_aotc_is_40_percent_refundable(verified):
    r = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=0,
                      aotc_students=1, aotc_expenses_per_student=4000)
    assert r.detail["refundable"] == 1000.0
    assert r.value == 1000.0


def test_aotc_phases_out_ratably_not_as_a_staircase(verified):
    """Linear across $80k-$90k single: halfway through the band is half the credit."""
    mid = T.tax_credits(agi=85000, filing_status="single", tax_before_credits=20000,
                        aotc_students=1, aotc_expenses_per_student=4000)
    assert mid.value == pytest.approx(1250.0, abs=0.01)
    gone = T.tax_credits(agi=90000, filing_status="single", tax_before_credits=20000,
                         aotc_students=1, aotc_expenses_per_student=4000)
    assert gone.value == 0.0


def test_aotc_is_unavailable_to_married_filing_separately(verified):
    """Expressed in the table as a [0, 0] range rather than special-cased in code."""
    r = T.tax_credits(agi=50000, filing_status="married_separately", tax_before_credits=10000,
                      aotc_students=1, aotc_expenses_per_student=4000)
    assert r.value == 0.0
    assert r.detail["credits"][0]["unavailable_for_status"] is True


def test_llc_is_20_percent_capped_per_return(verified):
    """20% of up to $10,000 = $2,000 max, and PER RETURN — unlike AOTC, more students do not help."""
    r = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                      llc_expenses=10000)
    assert r.value == 2000.0
    assert T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                         llc_expenses=40000).value == 2000.0
    assert T.tax_credits(agi=50000, filing_status="single", tax_before_credits=10000,
                         llc_expenses=5000).value == 1000.0


def test_llc_is_not_refundable(verified):
    r = T.tax_credits(agi=50000, filing_status="single", tax_before_credits=0,
                      llc_expenses=10000)
    assert r.value == 0.0 and r.detail["nonrefundable_wasted"] == 2000.0


# ── Saver's credit: a cliff ───────────────────────────────────────────────────────────────────────
def test_savers_credit_rate_steps_down_by_agi_tier(verified):
    """50% / 20% / 10% / nothing, on up to $2,000 of contributions."""
    for agi, expected in ((20000, 1000.0), (30000, 400.0), (40000, 200.0), (40001, 0.0)):
        r = T.tax_credits(agi=agi, filing_status="single", tax_before_credits=5000,
                          retirement_contributions=2000)
        assert r.value == expected, f"AGI {agi}"


def test_savers_credit_is_a_cliff_and_says_so(verified):
    """ONE DOLLAR of AGI drops the rate from 50% to 20% — a $600 loss on a $1 raise. The cliff is
    real, it is invisible in any bracket table, and the result flags it."""
    at = T.tax_credits(agi=20000, filing_status="single", tax_before_credits=5000,
                       retirement_contributions=2000)
    over = T.tax_credits(agi=20001, filing_status="single", tax_before_credits=5000,
                         retirement_contributions=2000)
    assert at.value - over.value == 600.0
    assert at.detail["credits"][0]["is_cliff"] is True
    assert "one dollar of AGI" in at.detail["credits"][0]["note"]


def test_savers_credit_respects_the_contribution_cap(verified):
    r = T.tax_credits(agi=20000, filing_status="single", tax_before_credits=5000,
                      retirement_contributions=15000)
    assert r.value == 1000.0, "credit is on the capped $2,000, not the full contribution"


# ── Phase-outs as marginal rate ───────────────────────────────────────────────────────────────────
def test_credit_phase_out_raises_the_measured_marginal_rate(verified):
    """WHY THE MARGINAL RATE IS MEASURED. Inside the child-credit phase-out the filer sheds $50 per
    $1,000 — a 5% implicit surtax stacked on the bracket and FICA, which no bracket table shows."""
    without = T.effective_marginal_rate(gross_income=410000, filing_status="married_jointly",
                                        qualifying_children=2, include_credits=False)
    with_credits = T.effective_marginal_rate(gross_income=410000, filing_status="married_jointly",
                                             qualifying_children=2, include_credits=True)
    assert with_credits.value > without.value
    assert with_credits.detail["credit_phase_out_component"] == pytest.approx(0.05, abs=0.005)
    assert with_credits.detail["credits_included"] is True
    assert with_credits.value - without.value == pytest.approx(0.05, abs=0.005)


def test_more_children_lengthen_the_phase_out_band_rather_than_steepening_it(verified):
    """The statutory reduction applies to the AGGREGATE credit, not per child. So the implicit
    surtax is 5% whatever the family size — but it persists over a longer stretch of income. Reading
    it as 5% PER CHILD would overstate the marginal rate for a large family by a multiple."""
    two = T.effective_marginal_rate(gross_income=410000, filing_status="married_jointly",
                                    qualifying_children=2, include_credits=True)
    four = T.effective_marginal_rate(gross_income=410000, filing_status="married_jointly",
                                     qualifying_children=4, include_credits=True)
    assert two.detail["credit_phase_out_component"] == pytest.approx(
        four.detail["credit_phase_out_component"], abs=0.002)

    # The band is what changes: 2 children ($4,000) exhaust $80k above the threshold; 4 children
    # ($8,000) are still phasing out there.
    assert T.tax_credits(agi=485000, filing_status="married_jointly",
                         tax_before_credits=120000, qualifying_children=2).value == 0.0
    assert T.tax_credits(agi=485000, filing_status="married_jointly",
                         tax_before_credits=120000, qualifying_children=4).value > 0.0


def test_no_phase_out_component_outside_the_band(verified):
    r = T.effective_marginal_rate(gross_income=150000, filing_status="married_jointly",
                                  qualifying_children=2, include_credits=True)
    assert r.detail["credit_phase_out_component"] == 0.0


def test_credits_are_off_by_default_in_the_marginal_rate(verified):
    """Default OFF because it needs verified credit parameters, which the shipped table lacks."""
    r = T.effective_marginal_rate(gross_income=410000, filing_status="married_jointly",
                                  qualifying_children=2)
    assert r.detail["credits_included"] is False
    assert r.detail["credit_phase_out_component"] == 0.0


# ── Contract ──────────────────────────────────────────────────────────────────────────────────────
def test_negative_dependent_counts_are_refused(verified):
    with pytest.raises(CalculatorError, match="must not be negative"):
        T.tax_credits(agi=100000, filing_status="single", qualifying_children=-1)


def test_no_dependents_and_no_expenses_yields_nothing_and_no_rows(verified):
    r = T.tax_credits(agi=100000, filing_status="single", tax_before_credits=15000)
    assert r.value == 0.0 and r.detail["credits"] == []


def test_eitc_is_excluded_and_the_result_says_why(verified):
    r = T.tax_credits(agi=30000, filing_status="single", tax_before_credits=1000,
                      qualifying_children=2)
    assert "least able to absorb" in r.detail["eitc_excluded"]
    assert all(row["credit"] != "earned_income" for row in r.detail["credits"])


def test_eitc_is_disabled_in_the_shipped_table():
    """Fully refundable, lowest-confidence parameters, and it lands on the filers least able to
    absorb an error. Off until sourced from Pub 596."""
    cfg = V.load("tax_tables", Y).data["credits"]["earned_income_credit"]
    assert cfg["enabled"] is False
    assert "LOW" in cfg["confidence"]


def test_tax_credits_is_registered():
    from app.services.calculators import base
    assert "tax.tax_credits" in base.available()
