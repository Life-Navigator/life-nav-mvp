"""VA disability compensation, combined ratings, and DIC.

Every figure here traces to va.gov, retrieved 2026-10-12, and the first two tests are the ones that
matter most: they verify the TRANSCRIPTION of the rate table mechanically, two independent ways. A
rate table is only as good as the typing, and no amount of correct code recovers from a wrong cent.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.calculators import versioned_data as V
from app.services.calculators.base import SCENARIO, STRICT, CalculatorError
from app.services.calculators.va_disability import (
    DEPENDENT_FLOOR_RATING,
    combined_rating,
    dic,
    disability_compensation,
)

_DATA = (Path(__file__).resolve().parents[1] / "app" / "services" / "calculators" / "data"
         / "va_disability" / "2026.json")
TABLE = json.loads(_DATA.read_text())
RATES = TABLE["compensation_monthly"]
RATINGS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
WITH_DEPENDENTS = [r for r in RATINGS if r >= DEPENDENT_FLOOR_RATING]


# ── Gate A: the COLA reproduces every base rate ───────────────────────────────────────────────────
def test_every_base_rate_is_the_prior_year_rate_times_the_cola():
    """VERIFICATION, not a property test. The 2026 and 2025 figures were read from two different
    VA pages; if either transcription were wrong, this relation would break. It holds to the cent
    for all ten ratings, which is strong evidence both are right — and it independently confirms
    the 2.8% COLA, since nothing in the file asserts it except this relation.
    """
    cola = TABLE["_meta"]["cola"]
    prior = TABLE["prior_year_alone"]
    for rating in RATINGS:
        expected = round(prior[str(rating)] * (1 + cola), 2)
        assert RATES[str(rating)]["alone"] == pytest.approx(expected, abs=0.005), (
            f"{rating}%: {RATES[str(rating)]['alone']} != {prior[str(rating)]} x {1 + cola}")


def test_the_dic_base_also_reproduces_from_the_cola():
    """A second, independent confirmation of the same 2.8%, from a different VA page entirely."""
    d = TABLE["dic_monthly"]
    assert d["surviving_spouse_base"] == pytest.approx(
        round(d["prior_year_base"] * (1 + TABLE["_meta"]["cola"]), 2), abs=0.005)


# ── Gate B: all 54 published rows reproduce from the stored increments ────────────────────────────
def test_every_published_composite_row_reproduces_from_the_increments():
    """THE REASON THE FILE STORES INCREMENTS AND ROWS SEPARATELY.

    The VA publishes six dependent columns per rating, twice over (with and without children) — 54
    composite figures below 100% plus their 100% row. The loader computes from increments; this
    gate reproduces each PUBLISHED figure from them and fails on any disagreement. It caught
    nothing on the first run, which is the point: it proves the additive structure holds rather
    than assuming it.
    """
    for rating in WITH_DEPENDENTS:
        r = RATES[str(rating)]
        pub = TABLE["published_rows"][str(rating)]
        alone, spouse, parent = r["alone"], r["spouse"], r["parent"]
        first, first_sp = r["first_child"], r["first_child_with_spouse"]
        expected = {
            "alone": alone,
            "spouse": alone + spouse,
            "1parent": alone + parent,
            "2parents": alone + 2 * parent,
            "spouse_1parent": alone + spouse + parent,
            "spouse_2parents": alone + spouse + 2 * parent,
            "child": alone + first,
            "child_1parent": alone + first + parent,
            "child_2parents": alone + first + 2 * parent,
            "spouse_child": alone + spouse + first_sp,
            "spouse_child_1parent": alone + spouse + first_sp + parent,
            "spouse_child_2parents": alone + spouse + first_sp + 2 * parent,
        }
        for key, want in expected.items():
            assert pub[key] == pytest.approx(round(want, 2), abs=0.005), (
                f"{rating}% {key}: published {pub[key]} != computed {round(want, 2)}")


def test_the_calculator_reproduces_the_published_rows_too():
    """The gate above checks the DATA against itself; this checks the CODE against the data."""
    for rating in WITH_DEPENDENTS:
        pub = TABLE["published_rows"][str(rating)]
        assert disability_compensation(rating).value == pytest.approx(pub["alone"], abs=0.005)
        assert disability_compensation(rating, spouse=True).value == pytest.approx(
            pub["spouse"], abs=0.005)
        assert disability_compensation(rating, dependent_parents=2).value == pytest.approx(
            pub["2parents"], abs=0.005)
        assert disability_compensation(
            rating, spouse=True, children_under_18=1, dependent_parents=1).value == pytest.approx(
            pub["spouse_child_1parent"], abs=0.005)


def test_rates_increase_with_the_rating_and_with_dependents():
    for a, b in zip(RATINGS, RATINGS[1:]):
        assert RATES[str(b)]["alone"] > RATES[str(a)]["alone"]
    for rating in WITH_DEPENDENTS:
        assert (disability_compensation(rating, spouse=True).value
                > disability_compensation(rating).value)


# ── Combined ratings, 38 CFR 4.25 ────────────────────────────────────────────────────────────────
def test_ratings_combine_against_remaining_efficiency_not_by_adding():
    """The regulation's own example: 'a person having a 60 percent disability is considered 40
    percent efficient', so a further 30% takes 30% of that remaining 40 — giving 72, not 90."""
    r = combined_rating([60, 30])
    assert r.value == 70.0
    assert r.detail["exact_combined_value"] == 72
    assert r.detail["sum_if_added"] == 90
    assert r.detail["overstatement_if_added"] == 20


def test_a_value_ending_in_five_rounds_UP():
    """38 CFR 4.25: 'combined values ending in 5 will be adjusted upward.'

    THE TRAP THIS GUARDS. 50% and 30% combine to exactly 65. Python's built-in `round` rounds half
    to EVEN, so `round(65, -1)` is 60 — one full rating step and hundreds of dollars a month BELOW
    what the regulation requires. A single careless `round` call here under-pays the veteran for
    life.
    """
    r = combined_rating([50, 30])
    assert r.detail["exact_combined_value"] == 65
    assert r.value == 70.0
    assert round(65, -1) == 60, "the stdlib behaviour this test exists to avoid"


@pytest.mark.parametrize("ratings,expected", [
    ([10], 10.0),
    ([100], 100.0),
    ([60, 30], 70.0),
    ([50, 30], 70.0),
    ([30, 20, 10], 50.0),
    ([70, 50, 30], 90.0),
    ([10, 10], 20.0),
    ([100, 50], 100.0),
])
def test_combined_rating_cases(ratings, expected):
    assert combined_rating(ratings).value == expected


def test_combining_is_order_independent_because_it_sorts_by_severity():
    """The regulation requires descending order; the function sorts rather than trusting the
    caller, so a veteran listing conditions in any order gets the same answer."""
    assert combined_rating([30, 70, 50]).value == combined_rating([70, 50, 30]).value


def test_the_combined_rating_never_exceeds_one_hundred():
    assert combined_rating([100, 100, 60]).value == 100.0
    assert combined_rating([90, 90, 90, 90]).value == 100.0


def test_an_individual_rating_must_be_a_multiple_of_ten():
    """The rating schedule assigns ratings in 10-percent degrees, so 45% is not a rating a veteran
    can hold — accepting it would quietly produce a plausible, impossible answer."""
    with pytest.raises(CalculatorError, match="multiple of 10"):
        combined_rating([45])


def test_a_rating_outside_the_range_is_refused():
    with pytest.raises(CalculatorError, match="outside 0-100"):
        combined_rating([110])
    with pytest.raises(CalculatorError, match="outside 0-100"):
        combined_rating([-10])


def test_no_ratings_at_all_is_refused():
    with pytest.raises(CalculatorError, match="at least one"):
        combined_rating([])


def test_the_combined_rating_is_strict_because_it_reads_no_table():
    """Pure regulation applied to the veteran's own ratings — nothing assumed, nothing to hedge."""
    assert combined_rating([60, 30]).tier == STRICT
    assert combined_rating([60, 30]).assumptions == ()


# ── The dependent floor ──────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("rating", [10, 20])
def test_dependents_add_nothing_below_a_thirty_percent_rating(rating):
    """38 U.S.C. 1115. A 20%-rated veteran with a spouse and two children receives the bare 20%
    rate — and silently adding dependent amounts would overstate their income every month for the
    rest of their life."""
    bare = disability_compensation(rating)
    loaded = disability_compensation(rating, spouse=True, children_under_18=2,
                                     dependent_parents=2, spouse_aid_attendance=True)
    assert loaded.value == bare.value == RATES[str(rating)]["alone"]
    assert any("not payable below" in note for note in loaded.detail["ignored"])


def test_the_floor_does_not_silently_swallow_dependents_at_thirty_percent():
    assert (disability_compensation(30, spouse=True).value
            > disability_compensation(30).value)
    assert disability_compensation(30, spouse=True).detail["ignored"] == []


# ── Dependent structure ──────────────────────────────────────────────────────────────────────────
def test_the_first_child_is_worth_more_than_each_additional_one():
    """The VA's table builds a larger amount for the first child, so reducing the schedule to
    "x per child" misstates every family with more than one."""
    r = RATES["70"]
    assert r["first_child"] > r["additional_child_under_18"]
    one = disability_compensation(70, children_under_18=1).value
    two = disability_compensation(70, children_under_18=2).value
    assert two - one == pytest.approx(r["additional_child_under_18"], abs=0.005)


def test_the_first_child_is_worth_more_again_when_there_is_a_spouse():
    r = RATES["70"]
    assert r["first_child_with_spouse"] > r["first_child"]
    with_spouse = disability_compensation(70, spouse=True, children_under_18=1).value
    assert with_spouse == pytest.approx(
        r["alone"] + r["spouse"] + r["first_child_with_spouse"], abs=0.005)


def test_a_child_over_18_in_school_is_worth_several_times_a_child_under_18():
    r = RATES["70"]
    assert r["child_over_18_in_school"] > 3 * r["additional_child_under_18"]


def test_the_first_child_slot_goes_to_the_CHEAPER_category():
    """With one child under 18 and one over 18 in school, the built-in first-child amount should be
    spent on the under-18 child so the expensive school rate is paid at its own full value. Doing
    it the other way round would quietly short the veteran."""
    mixed = disability_compensation(70, children_under_18=1, children_over_18_in_school=1).value
    r = RATES["70"]
    assert mixed == pytest.approx(
        r["alone"] + r["first_child"] + r["child_over_18_in_school"], abs=0.005)
    # Which is strictly better for the veteran than the other assignment.
    worse = r["alone"] + r["first_child"] + r["additional_child_under_18"]
    assert mixed > worse


def test_spouse_aid_and_attendance_requires_a_spouse():
    r = disability_compensation(70, spouse=False, spouse_aid_attendance=True)
    assert r.value == RATES["70"]["alone"]
    assert any("requires a spouse" in n for n in r.detail["ignored"])


def test_more_than_two_dependent_parents_is_refused_not_extrapolated():
    """The schedule publishes rates for at most two, so a third would be invented."""
    with pytest.raises(CalculatorError, match="at most 2"):
        disability_compensation(70, dependent_parents=3)


def test_negative_dependent_counts_are_refused():
    for kw in ("children_under_18", "children_over_18_in_school", "dependent_parents"):
        with pytest.raises(CalculatorError, match="must not be negative"):
            disability_compensation(70, **{kw: -1})


def test_an_unpublished_rating_is_refused():
    with pytest.raises(CalculatorError, match="no VA rate published"):
        disability_compensation(45)
    with pytest.raises(CalculatorError, match="no VA rate published"):
        disability_compensation(0)


# ── Tax treatment, the fact that changes the plan ────────────────────────────────────────────────
def test_compensation_is_reported_as_entirely_tax_free():
    """Not "taxed less" — excluded from gross income, so absent from AGI and therefore MAGI. That
    is why it cannot push Social Security into taxability or into an IRMAA bracket, and why it
    leaves the whole Roth-conversion runway free."""
    d = disability_compensation(100, spouse=True).detail
    assert d["taxable"] is False
    assert "104(a)(4)" in d["tax_note"]
    for consequence in ("Social Security", "IRMAA", "Roth conversion"):
        assert consequence in d["tax_note"]


def test_compensation_states_that_it_stops_at_death():
    """The opposite of the Social Security survivor rule, and the expensive mistake to get
    backwards."""
    d = disability_compensation(100, spouse=True).detail
    assert d["stops_at_death"] is True
    assert "does NOT pass to a spouse" in d["survivor_note"]
    assert "DIC" in d["survivor_note"]


def test_the_annual_figure_is_twelve_times_the_monthly_one():
    r = disability_compensation(100, spouse=True)
    assert r.detail["annual"] == pytest.approx(r.value * 12, abs=0.01)


# ── Tiering, and why it self-corrects ────────────────────────────────────────────────────────────
def test_an_unverified_table_makes_the_figure_a_scenario():
    """And flipping `_meta.verified` promotes it to STRICT with no code change — the assumption
    disappears, and `CalcResult`'s own guard does the rest."""
    r = disability_compensation(100, spouse=True)
    assert TABLE["_meta"]["verified"] is False, "when this flips, the assertion below should too"
    assert r.tier == SCENARIO
    assert any(a.key == "va_rates_unverified" for a in r.assumptions)


def test_the_unverified_assumption_says_to_check_the_award_letter():
    r = disability_compensation(100)
    note = next(a.rationale for a in r.assumptions if a.key == "va_rates_unverified")
    assert "award letter" in note


def test_the_family_is_registered_as_carry_forward():
    """Rates move on a KNOWN date — 1 December — so a labelled prior-year rate beats refusing to
    state a veteran's own benefit for a month every year."""
    fam = V.FAMILIES["va_disability"]
    assert fam.fallback == V.CARRY_FORWARD


def test_the_rate_year_and_effective_date_are_reported_for_citation():
    d = disability_compensation(70).detail
    assert d["rate_year"] == 2026
    assert d["effective_date"] == "2025-12-01"


# ── DIC ──────────────────────────────────────────────────────────────────────────────────────────
def test_the_dic_base_rate_matches_the_published_figure():
    assert dic().value == pytest.approx(1699.36, abs=0.005)
    assert dic().detail["taxable"] is False


def test_dic_add_ons_are_additive_and_match_the_published_amounts():
    d = TABLE["dic_monthly"]
    base = d["surviving_spouse_base"]
    assert dic(eight_year_provision=True).value == pytest.approx(
        base + d["eight_year_provision"], abs=0.005)
    assert dic(aid_and_attendance=True).value == pytest.approx(
        base + d["aid_and_attendance"], abs=0.005)
    assert dic(housebound=True).value == pytest.approx(base + d["housebound"], abs=0.005)
    assert dic(children_under_18=3).value == pytest.approx(
        base + 3 * d["additional_child_under_18"], abs=0.005)


def test_the_transitional_benefit_requires_a_child_under_eighteen():
    """It exists specifically to support a survivor raising children, so granting it to a childless
    survivor would be inventing eligibility."""
    with pytest.raises(CalculatorError, match="requires at least one child"):
        dic(transitional_benefit=True)
    assert dic(children_under_18=1, transitional_benefit=True).value > dic(
        children_under_18=1).value


def test_dic_reports_its_eligibility_test_rather_than_implying_entitlement():
    d = dic().detail
    joined = " ".join(d["eligibility"])
    assert "service-connected" in joined
    assert "8 continuous years" in joined


def test_dic_is_far_smaller_than_the_compensation_it_replaces():
    """THE PLANNING EVENT. A 100%-rated veteran with a spouse receives about $4,158/month; the
    survivor's DIC base is about $1,699 — a fall of roughly 59% in tax-free income, arriving in the
    same year the survivor starts filing single on narrower brackets."""
    comp = disability_compensation(100, spouse=True).value
    base = dic().value
    assert base < comp / 2
    assert (comp - base) / comp == pytest.approx(0.59, abs=0.02)


def test_dic_does_not_depend_on_the_veterans_rating():
    """Unlike the compensation amount — the base is flat, so a higher rating does not raise the
    survivor's benefit. The one rating-linked piece is the 8-year provision."""
    assert dic().value == dic().value   # flat by construction; no rating parameter exists
    import inspect
    assert "rating" not in inspect.signature(dic).parameters


def test_negative_dic_children_are_refused():
    with pytest.raises(CalculatorError, match="must not be negative"):
        dic(children_under_18=-1)


def test_results_are_serializable():
    for r in (combined_rating([60, 30]), disability_compensation(100, spouse=True), dic()):
        json.dumps(r.as_dict())
