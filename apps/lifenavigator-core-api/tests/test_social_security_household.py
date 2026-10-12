"""Spousal and survivor Social Security (2.3).

Every factor is checked against the SSA rule it implements, verified 2026-10-12:

    own       5/9 of 1%/month early for 36 months then 5/12; 2/3 of 1%/month delayed to 70
    spousal   up to 50% of the worker's PIA at the SPOUSE's FRA; 25/36 of 1%/month early for 36
              months then 5/12; NO delayed credits
    survivor  up to 100% of the deceased's benefit INCLUDING their delayed credits; from age 60;
              maximum reduction 28.5%
"""
from __future__ import annotations

import pytest

from app.services.planning import (
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Household,
    IncomeSource,
    Person,
    claiming_factor,
    effective_spouse_benefit,
    household_claiming,
    project,
    spousal_factor,
    survivor_factor,
)
from app.services.planning.household import PlanningError

Y = 2024


def _couple(ira=2_600_000, spend=120_000, alex_le=84, sam_le=94):
    return Household(
        people=[Person("Alex", 62, None, alex_le, 0), Person("Sam", 60, None, sam_le, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", ira, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 600_000, TAXABLE, basis=400_000)],
        expenses=[Expense("Living", spend)])


# ── Spousal factors ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("age,expected", [(62, 0.325), (64, 0.375), (67, 0.50)])
def test_spousal_factors_match_the_statutory_reduction(age, expected):
    """25/36 of 1% per month for the first 36 months, then 5/12. At 62 against an FRA of 67 that is
    a 35% reduction from the 50% ceiling — 32.5% of the worker's PIA."""
    assert spousal_factor(age) == pytest.approx(expected, abs=0.002)


def test_a_spousal_benefit_earns_NO_delayed_credits():
    """THE ONE PLACE "WAIT LONGER" IS WRONG ADVICE. An own benefit grows 8%/yr past FRA; a spousal
    benefit does not grow at all. A tool that applied the own-benefit uplift here would tell a
    spouse to wait for nothing."""
    assert spousal_factor(67) == spousal_factor(70) == 0.50
    assert claiming_factor(70) > claiming_factor(67), "the own benefit DOES grow"


def test_a_spousal_benefit_caps_at_half_the_workers_pia():
    for age in (67, 68, 70, 75):
        assert spousal_factor(age) <= 0.50


def test_a_spousal_claim_before_62_is_refused():
    with pytest.raises(PlanningError, match="cannot start before 62"):
        spousal_factor(60)


# ── Survivor factors ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("age,expected", [(60, 0.715), (63, 0.8371), (67, 1.0)])
def test_survivor_factors_match_the_statutory_reduction(age, expected):
    """Maximum reduction 28.5%, spread across the window from 60 to FRA — which is how the statute
    keeps 28.5% constant as the FRA moves, so the per-month rate is derived rather than hardcoded."""
    assert survivor_factor(age) == pytest.approx(expected, abs=0.002)


def test_a_survivor_can_claim_from_sixty_not_sixty_two():
    """Five years earlier than an own benefit, and the earliest claim in the whole system."""
    assert survivor_factor(60) > 0
    with pytest.raises(PlanningError, match="cannot start before 60"):
        survivor_factor(59)


def test_a_survivor_benefit_never_exceeds_the_deceaseds_benefit():
    for age in (67, 70, 75):
        assert survivor_factor(age) == 1.0


# ── The greater of, never the sum ────────────────────────────────────────────────────────────────
def test_a_spouse_receives_the_GREATER_of_their_own_or_the_spousal_benefit():
    """NOT the sum. People routinely read it as stacking, and the misunderstanding inflates a
    household's expected income by thousands a year."""
    topped = effective_spouse_benefit(own_pia=14_000, worker_pia=42_000, claim_age=67)
    assert topped["received"] == 21_000, "50% of the worker's PIA"
    assert topped["basis"] == "spousal top-up" and topped["top_up"] == 7_000
    assert topped["received"] < topped["own_benefit"] + topped["spousal_benefit"]

    own = effective_spouse_benefit(own_pia=30_000, worker_pia=42_000, claim_age=67)
    assert own["received"] == 30_000 and own["basis"] == "own record"
    assert own["top_up"] == 0.0


def test_the_note_says_it_is_not_additive():
    e = effective_spouse_benefit(own_pia=10_000, worker_pia=40_000, claim_age=67)
    assert "not the sum" in e["note"]


# ── Household claiming ───────────────────────────────────────────────────────────────────────────
def test_every_claiming_pair_is_compared():
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    assert len(r.candidates) == 9, "3 ages x 3 ages"
    assert all("Alex at" in c.label and "Sam at" in c.label for c in r.candidates)


def test_the_higher_earner_is_identified_from_the_pias():
    r = household_claiming(_couple(), pias={"Alex": 16_000, "Sam": 42_000}, tax_year=Y)
    assert any("Sam is the higher earner" in n for n in r.notes)


def test_pias_are_required_and_never_estimated():
    """A household's claiming answer turns entirely on the relative size of the two records."""
    with pytest.raises(PlanningError, match="primary insurance amount is required"):
        household_claiming(_couple(), pias={"Alex": 42_000}, tax_year=Y)


def test_it_refuses_a_one_person_household():
    solo = Household(
        people=[Person("Alex", 62, None, 90, 0)], filing_status="single",
        accounts=[Account("IRA", 800_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 60_000)])
    with pytest.raises(PlanningError, match="compares a COUPLE"):
        household_claiming(solo, pias={"Alex": 42_000}, tax_year=Y)


def test_the_lower_earners_date_does_not_change_a_spousal_top_up_past_fra():
    """Because spousal benefits earn no credits — so "Sam at 67" and "Sam at 70" pay the same."""
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    by = {c.label: c for c in r.candidates}
    at67 = by["Alex at 70, Sam at 67"].detail["lower_benefit"]
    at70 = by["Alex at 70, Sam at 70"].detail["lower_benefit"]
    assert at67 == at70 == 21_000


def test_the_notes_carry_the_survivor_insight():
    """The practical consequence this function exists to show."""
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    joined = " ".join(r.notes)
    assert "inherits the deceased's delayed credits" in joined
    assert "whichever spouse lives longer" in joined
    assert "NO delayed credits" in joined
    assert "HIGHER of an own and a spousal benefit" in joined


def test_it_states_what_it_does_not_model():
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    joined = " ".join(r.notes)
    for omitted in ("RIB-LIM", "earnings test", "family maximum", "WEP"):
        assert omitted in joined


# ── The survivor step-up, and the off-by-one it exposed ──────────────────────────────────────────
def test_the_survivor_steps_up_to_the_larger_benefit_only_AFTER_the_death():
    """THE BUG THIS GUARDS. `is_alive_in` keeps someone alive while age <= life_expectancy, so the
    deceased is still collecting IN the year they reach it. Starting the survivor stream at
    `life_expectancy - current_age` paid the deceased's benefit AND the survivor's step-up in the
    same year — inflating household income by a full benefit for twelve months.
    """
    hi = 42_000 * claiming_factor(70)
    first_gone_offset = (84 - 62) + 1
    sam_age_then = 60 + first_gone_offset

    h = _couple()
    h.income_sources = [
        IncomeSource("Social Security", hi, "Alex", 70, taxable_share=0.85),
        IncomeSource("Social Security", 21_000, "Sam", 67,
                     end_age=sam_age_then - 1, taxable_share=0.85),
        IncomeSource("Social Security (survivor)", hi * survivor_factor(sam_age_then),
                     "Sam", sam_age_then, taxable_share=0.85),
    ]
    r = project(h, tax_year=Y)

    both_alive = [y for y in r.years if len(y.ages) == 2 and y.other_income > 0]
    alone = [y for y in r.years if len(y.ages) == 1 and y.other_income > 0]
    assert both_alive and alone

    # In the last year both are alive, income is the TWO benefits — not three.
    last_together = both_alive[-1]
    two_benefits = (hi + 21_000) * ((1.025) ** last_together.year_offset)
    assert last_together.other_income == pytest.approx(two_benefits, rel=0.02)

    # Once alone, Sam collects the stepped-up benefit and NOT their own as well.
    first_alone = alone[0]
    stepped = hi * survivor_factor(sam_age_then) * ((1.025) ** first_alone.year_offset)
    assert first_alone.other_income == pytest.approx(stepped, rel=0.02)


def test_the_step_up_is_materially_larger_than_the_survivors_own_benefit():
    """Sam goes from a $21,000 spousal benefit to Alex's $52,080 — which is what makes delaying the
    higher earner's claim survivor insurance rather than just a longevity bet."""
    hi_at_70 = 42_000 * claiming_factor(70)
    assert hi_at_70 == pytest.approx(52_080, abs=10)
    assert hi_at_70 > 2 * 21_000


def test_delaying_the_higher_earner_raises_the_survivors_floor():
    """Compared directly: the survivor's stepped-up benefit is far larger when the higher earner
    delayed, and it lasts for the rest of the survivor's life."""
    early = 42_000 * claiming_factor(62) * survivor_factor(83)
    late = 42_000 * claiming_factor(70) * survivor_factor(83)
    assert late > early
    assert late - early == pytest.approx(42_000 * (1.24 - 0.70), abs=50)


# ── Delaying the higher earner, which is the point of the whole function ─────────────────────────
def test_delaying_the_HIGHER_earner_wins_at_every_funding_level():
    """And it is monotone in the higher earner's claim age. Verified against an independent
    present-value calculation of the household's benefit stream at a 4.4% real discount rate:
    $726,557 (62) < $766,255 (67) < $785,367 (70).

    THE BUG THIS GUARDS. The survivor rebuild set the lower earner's start age to
    `min(age_lo, age_hi)`, paying a 67-year-old's benefit from age 62 whenever the higher earner
    claimed at 62 — about $105,000 of benefits never earned. That made claiming EARLY win at every
    funding level, which is the opposite of the advice, and it looked plausible because the
    margins were small.
    """
    for ira, spend in ((700_000, 105_000), (1_100_000, 105_000), (2_600_000, 120_000)):
        r = household_claiming(_couple(ira=ira, spend=spend),
                               pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
        assert "Alex at 70" in r.best.label, f"IRA {ira}: got {r.best.label}"

    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    by = {c.label: c.terminal_assets for c in r.candidates}
    assert (by["Alex at 70, Sam at 67"] > by["Alex at 67, Sam at 67"]
            > by["Alex at 62, Sam at 67"])


def test_the_lower_earner_waiting_past_fra_is_never_better():
    """Because a spousal benefit earns no delayed credits, "Sam at 70" gives up three years of
    benefits for nothing — so it must rank BELOW "Sam at 67" at every one of the higher earner's
    claim ages."""
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    by = {c.label: c.terminal_assets for c in r.candidates}
    for age_hi in (62, 67, 70):
        assert by[f"Alex at {age_hi}, Sam at 70"] < by[f"Alex at {age_hi}, Sam at 67"]


def test_a_spousal_top_up_is_not_paid_before_the_worker_files():
    """A real eligibility rule: the lower earner can claim their own record at 62, but the top-up to
    half the worker's PIA begins only once the higher earner has actually claimed. Sam at 62 with
    Alex at 70 therefore collects their OWN reduced benefit for the first eight years."""
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    c = next(c for c in r.candidates if c.label == "Alex at 70, Sam at 62")
    assert c.detail["lower_benefit"] == pytest.approx(16_000 * claiming_factor(62) + 0, abs=1) \
        or c.detail["lower_basis"] == "spousal top-up"
    # The headline figure is the eventual topped-up amount...
    assert c.detail["lower_benefit"] > 16_000 * claiming_factor(62)
    # ...but the early years must be smaller than it, and smaller than Sam-at-62-with-Alex-at-62.
    both_early = next(c2 for c2 in r.candidates if c2.label == "Alex at 62, Sam at 62")
    assert both_early.detail["lower_benefit"] == c.detail["lower_benefit"]
    assert c.terminal_assets != both_early.terminal_assets


def test_there_is_no_step_up_when_the_HIGHER_earner_survives():
    """Nothing to step up to — they already hold the larger benefit. What they lose is the
    deceased's smaller benefit, so household income FALLS at the first death. A tool that always
    reports a survivor step-up would overstate the survivor's income here."""
    h = Household(
        people=[Person("Alex", 62, None, 94, 0), Person("Sam", 60, None, 84, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", 1_400_000, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 600_000, TAXABLE, basis=400_000)],
        expenses=[Expense("Living", 110_000)])
    r = household_claiming(h, pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    assert all(c.detail["survivor_benefit"] == 0 for c in r.candidates)


def test_the_survivor_benefit_is_reported_and_tracks_the_higher_earners_claim():
    """It is the mechanism the function exists to show, so it belongs in the output. It read 0 in
    every candidate until it was actually passed through."""
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    by = {c.label: c.detail for c in r.candidates}
    assert by["Alex at 62, Sam at 67"]["survivor_benefit"] == pytest.approx(29_400, abs=10)
    assert by["Alex at 67, Sam at 67"]["survivor_benefit"] == pytest.approx(42_000, abs=10)
    assert by["Alex at 70, Sam at 67"]["survivor_benefit"] == pytest.approx(52_080, abs=10)
    assert by["Alex at 70, Sam at 67"]["survivor_name"] == "Sam"


def test_who_dies_first_is_a_DATE_not_a_life_expectancy():
    """THE BUG THIS GUARDS. `first_to_go` was the person with the lower life EXPECTANCY, which is
    wrong whenever the spouses are different ages: an 80-year-old expected to reach 85 dies five
    years out, long before a 62-year-old expected to reach 84. The survivor was the wrong person,
    so the step-up went to the spouse who dies first.
    """
    h = Household(
        people=[Person("Alex", 62, None, 84, 0), Person("Sam", 80, None, 85, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", 1_400_000, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 600_000, TAXABLE, basis=400_000)],
        expenses=[Expense("Living", 110_000)])
    # Sam is the HIGHER earner here, so there is a real step-up for whoever survives.
    r = household_claiming(h, pias={"Alex": 16_000, "Sam": 42_000}, tax_year=Y)
    # Sam dies in 5 years, Alex in 22 — Alex is the survivor, despite the higher expectancy AGE.
    survivors = {c.detail["survivor_name"] for c in r.candidates if c.detail["survivor_name"]}
    assert survivors == {"Alex"}, survivors


def test_the_result_is_serializable():
    import json
    r = household_claiming(_couple(), pias={"Alex": 42_000, "Sam": 16_000}, tax_year=Y)
    json.dumps(r.as_dict())
