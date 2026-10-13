"""VA benefits inside the household ledger.

The calculator tests prove the rate table is right. These prove the two CONSEQUENCES that justify
wiring it into the ledger at all: the income is genuinely untaxed all the way through the tax
calculation, and it vanishes at the veteran's death instead of passing to the spouse.
"""
from __future__ import annotations

import json

import pytest

from app.services.planning import (
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Household,
    IncomeSource,
    Person,
    project,
    survivor_income_cliff,
    va_streams,
)
from app.services.planning.household import PlanningError

Y = 2024
VET_LE, SPOUSE_LE = 84, 94


def _couple(ira=900_000, spend=90_000):
    return Household(
        people=[Person("Alex", 62, None, VET_LE, 0), Person("Sam", 60, None, SPOUSE_LE, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", ira, TAX_DEFERRED, "Alex"),
                  Account("Brokerage", 300_000, TAXABLE, basis=200_000)],
        expenses=[Expense("Living", spend)])


def _solo():
    return Household(
        people=[Person("Alex", 62, None, VET_LE, 0)], filing_status="single",
        accounts=[Account("IRA", 600_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 60_000)])


# ── The tax-free claim, verified through the actual tax calculation ──────────────────────────────
def test_va_compensation_produces_no_federal_tax_at_all():
    """THE CLAIM THAT JUSTIFIES THE WHOLE MODULE, checked end to end rather than asserted in a
    docstring. A household living entirely on VA compensation pays zero federal tax on it — not a
    reduced amount, zero — because it never enters gross income (26 U.S.C. 104(a)(4))."""
    h = _couple(ira=0, spend=45_000)
    h.accounts = [Account("Cash", 50_000, TAXABLE, basis=50_000)]
    h.income_sources = list(va_streams(h, veteran="Alex", rating=100).sources)
    r = project(h, tax_year=Y, horizon_years=5)
    first = r.years[0]
    assert first.other_income > 45_000
    assert first.taxable_other_income == 0.0
    assert first.federal_tax == 0.0
    assert first.fica == 0.0


def test_the_same_income_as_a_pension_WOULD_be_taxed():
    """The control. Identical dollars, identical household — the only difference is the source, and
    it costs real money. This is the comparison that makes VA compensation worth more per dollar
    than any other retirement income, and it is why a veteran usually has MORE Roth-conversion room
    than their gross income suggests, not less."""
    amount = va_streams(_couple(), veteran="Alex", rating=100).compensation_annual

    va_h = _couple(ira=0, spend=45_000)
    va_h.accounts = [Account("Cash", 50_000, TAXABLE, basis=50_000)]
    va_h.income_sources = [IncomeSource("VA disability compensation", amount, "Alex",
                                        start_age=62, taxable_share=0.0)]

    pension_h = _couple(ira=0, spend=45_000)
    pension_h.accounts = [Account("Cash", 50_000, TAXABLE, basis=50_000)]
    pension_h.income_sources = [IncomeSource("Pension", amount, "Alex", start_age=62,
                                             taxable_share=1.0)]

    va_tax = project(va_h, tax_year=Y, horizon_years=5).years[0].federal_tax
    pension_tax = project(pension_h, tax_year=Y, horizon_years=5).years[0].federal_tax
    assert va_tax == 0.0
    # Hand-derived rather than a threshold: $49,898 of pension less the 2024 married-filing-jointly
    # standard deduction of $29,200 leaves $20,698, which sits entirely inside the 10% bracket
    # (first $23,200) — so $2,069.80. The same dollars as VA compensation cost nothing.
    assert pension_tax == pytest.approx(round((amount - 29_200) * 0.10, 2), abs=1.0), pension_tax
    assert pension_tax > 2_000


def test_the_streams_are_marked_untaxed_and_cola_linked():
    """Inflation-adjusted because both compensation and DIC move with the Social Security COLA
    (38 U.S.C. 5312) — unlike a fixed pension, which a flat stream would wrongly imply."""
    s = va_streams(_couple(), veteran="Alex", rating=100, dic_eligible=True)
    assert len(s.sources) == 2
    for src in s.sources:
        assert src.taxable_share == 0.0
        assert src.inflation_adjusted is True


# ── Compensation stops at death; DIC is the (smaller, separate) survivor benefit ─────────────────
def test_compensation_ends_at_the_veterans_death():
    s = va_streams(_couple(), veteran="Alex", rating=100)
    comp = next(x for x in s.sources if "compensation" in x.label)
    assert comp.owner == "Alex"
    assert comp.end_age == VET_LE, "collected through the year they reach life expectancy"


def test_dic_begins_the_year_AFTER_the_death_and_never_overlaps():
    """THE OFF-BY-ONE THIS GUARDS, the same one found in the Social Security survivor model.
    `Person.is_alive_in` keeps someone alive while age <= life_expectancy, so the veteran is still
    collecting IN the year they reach it. Starting DIC at `life_expectancy - current_age` paid
    compensation AND DIC in the same year.
    """
    s = va_streams(_couple(), veteran="Alex", rating=100, dic_eligible=True)
    comp = next(x for x in s.sources if "compensation" in x.label)
    dic_src = next(x for x in s.sources if "DIC" in x.label)

    # Alex's last year is offset (84 - 62) = 22; Sam is 60 + 22 = 82 then, so DIC starts at 83.
    assert dic_src.start_age == 83
    assert comp.end_age == 84

    h = _couple()
    h.income_sources = list(s.sources)
    r = project(h, tax_year=Y)
    paying = [y for y in r.years if y.other_income > 0]
    for y in paying:
        # No year may pay both streams: the total must match one or the other, never the sum.
        both = (s.compensation_annual + s.dic_annual) * (1.025 ** y.year_offset)
        assert y.other_income < both * 0.95, (
            f"year {y.year_offset} pays ${y.other_income:,.0f}, close to both streams at "
            f"${both:,.0f}")


def test_no_dic_is_modelled_unless_eligibility_is_asserted():
    """Eligibility is a real test — the death must be service-connected, or the veteran rated
    totally disabling for 8 continuous years before it. Quietly granting DIC to every surviving
    spouse overstates a widow's income by about $20,000 a year for life, in the household least
    able to absorb being wrong."""
    s = va_streams(_couple(), veteran="Alex", rating=100)
    assert len(s.sources) == 1
    assert s.dic_annual == 0.0
    assert any("never assumed" in n for n in s.notes)
    # And it says what it would be worth, so the omission is actionable rather than silent.
    assert any("worth about $" in n for n in s.notes)


def test_no_dic_stream_when_the_spouse_is_not_expected_to_survive():
    h = Household(
        people=[Person("Alex", 62, None, 94, 0), Person("Sam", 60, None, 80, 0)],
        filing_status="married_jointly",
        accounts=[Account("IRA", 900_000, TAX_DEFERRED, "Alex")],
        expenses=[Expense("Living", 90_000)])
    s = va_streams(h, veteran="Alex", rating=100, dic_eligible=True)
    assert len(s.sources) == 1
    assert any("not expected to outlive" in n for n in s.notes)


def test_a_single_veteran_gets_the_no_spouse_rate_and_no_dic():
    s = va_streams(_solo(), veteran="Alex", rating=100)
    assert len(s.sources) == 1
    assert s.compensation_monthly == pytest.approx(3938.58, abs=0.01), "the veteran-alone rate"


def test_the_spouse_flag_comes_from_the_household_not_the_caller():
    """So the rate lookup and the ledger's filing status cannot disagree — a household filing
    jointly with a spouse the lookup did not know about would understate the benefit every month."""
    assert (va_streams(_couple(), veteran="Alex", rating=100).compensation_monthly
            > va_streams(_solo(), veteran="Alex", rating=100).compensation_monthly)


def test_the_notes_state_the_rule_is_the_OPPOSITE_of_social_security():
    s = va_streams(_couple(), veteran="Alex", rating=100)
    joined = " ".join(s.notes)
    assert "does not pass to a spouse" in joined
    assert "opposite of the Social Security survivor rule" in joined
    assert "steps UP" in joined


# ── The income cliff ─────────────────────────────────────────────────────────────────────────────
def test_the_cliff_quantifies_the_fall_in_income_at_the_death():
    c = survivor_income_cliff(_couple(), veteran="Alex", rating=100, dic_eligible=True, tax_year=Y)
    assert c.survivor == "Sam"
    assert c.before_total > c.after_total
    # DIC replaces compensation at roughly 40%, so the fall is around 60%.
    assert 0.50 < c.drop_share < 0.65, c.drop_share
    assert c.before_tax_free > 0 and c.after_tax_free > 0


def test_without_dic_the_survivor_loses_ALL_of_it():
    """The honest default, and the number a veteran's spouse most needs before the death rather
    than after."""
    c = survivor_income_cliff(_couple(), veteran="Alex", rating=100, tax_year=Y)
    assert c.after_total == 0.0
    assert c.drop_share == 1.0


def test_the_cliff_notes_the_widows_penalty_lands_in_the_same_year():
    """Three things arrive together: compensation stops, DIC (if any) replaces it at a fraction,
    and the survivor starts filing single on narrower brackets."""
    c = survivor_income_cliff(_couple(), veteran="Alex", rating=100, dic_eligible=True, tax_year=Y)
    joined = " ".join(c.notes)
    assert "married-filing-jointly to single" in joined
    assert "widow's penalty" in joined


def test_a_higher_rating_makes_the_cliff_WORSE_not_better():
    """Counter-intuitive and worth stating: the more the veteran receives, the further the survivor
    falls, because DIC does not scale with the rating. A 100%-rated household is MORE exposed to
    this event than a 50%-rated one, which is the opposite of how a rating is usually read."""
    low = survivor_income_cliff(_couple(), veteran="Alex", rating=50, dic_eligible=True,
                                tax_year=Y)
    high = survivor_income_cliff(_couple(), veteran="Alex", rating=100, dic_eligible=True,
                                 tax_year=Y)
    assert high.drop > low.drop
    assert high.drop_share > low.drop_share


def test_the_cliff_needs_a_spouse_to_survive():
    with pytest.raises(PlanningError, match="needs a spouse to survive"):
        survivor_income_cliff(_solo(), veteran="Alex", rating=100, tax_year=Y)


def test_an_unknown_veteran_name_is_refused_with_the_household_listed():
    with pytest.raises(PlanningError, match="not in this household"):
        va_streams(_couple(), veteran="Jordan", rating=100)


def test_a_three_person_household_is_refused_rather_than_guessed():
    h = _couple()
    h.people = list(h.people) + [Person("Kid", 20, None, 90, 0)]
    with pytest.raises(PlanningError, match="at most one spouse"):
        va_streams(h, veteran="Alex", rating=100)


def test_results_are_serializable():
    json.dumps(va_streams(_couple(), veteran="Alex", rating=100, dic_eligible=True).as_dict())
    json.dumps(survivor_income_cliff(_couple(), veteran="Alex", rating=100,
                                     dic_eligible=True, tax_year=Y).as_dict())
