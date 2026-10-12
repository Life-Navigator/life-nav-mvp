"""Provision effective-dating, and prior-year tax questions.

Three kinds of change need three mechanisms, and conflating them is how a tax engine goes stale
without failing:

  an AMOUNT changes          -> data/<family>/<year>.json          (already solved)
  a rule's VALUE changes     -> also a parameter (RMD age 73 -> 75) (already solved)
  a provision STARTS or ENDS -> calculators/effective.py           (this)
"""
from __future__ import annotations

import pytest

from app.services.calculators import effective as E
from app.services.advisor_context import parse_tax_year


# ── Provisions ───────────────────────────────────────────────────────────────────────────────────
def test_a_provision_that_has_not_started_is_not_in_effect():
    """The 60-63 super catch-up did not exist before 2025. Applying it earlier would invent a
    contribution the participant could not legally have made."""
    assert E.in_effect("retirement.super_catch_up_60_63", 2024) is False
    assert E.in_effect("retirement.super_catch_up_60_63", 2025) is True
    assert E.in_effect("retirement.super_catch_up_60_63", 2026) is True


def test_a_provision_that_sunsets_stops_being_in_effect():
    """THE CASE A FIRST-YEAR NUMBER CANNOT EXPRESS. The senior deduction runs 2025-2028 and then
    stops. A rule still applying it in 2029 hands the user a deduction they no longer have, and
    nothing fails when the date passes."""
    p = E.get("deduction.senior_additional")
    assert p.sunsets is True and p.last_year == 2028
    assert E.in_effect("deduction.senior_additional", 2028) is True
    assert E.in_effect("deduction.senior_additional", 2029) is False


def test_require_in_effect_explains_which_year_governs():
    with pytest.raises(E.ProvisionError, match="expired after 2028"):
        E.require_in_effect("deduction.senior_additional", 2029)
    with pytest.raises(E.ProvisionError, match="did not exist in 2024"):
        E.require_in_effect("retirement.super_catch_up_60_63", 2024)


def test_the_error_names_the_authority_so_the_advisor_can_cite_it():
    try:
        E.require_in_effect("debt_interest.heloc_tracing_required", 2017)
    except E.ProvisionError as exc:
        assert "IRC 163(h)(3)(F)" in str(exc) and "2018" in str(exc)
    else:
        pytest.fail("expected ProvisionError")


def test_pre_2018_heloc_questions_must_not_get_the_tracing_answer():
    """Before TCJA, home-equity interest was broadly deductible REGARDLESS of use. A prior-year
    question about 2017 would otherwise get today's tracing rule — and a lot of advice still
    circulating predates the change."""
    assert E.in_effect("debt_interest.heloc_tracing_required", 2017) is False
    assert E.in_effect("debt_interest.heloc_tracing_required", 2018) is True


def test_an_unknown_provision_names_the_declared_ones():
    with pytest.raises(E.ProvisionError, match="unknown provision"):
        E.in_effect("made.up.provision", 2026)


def test_every_provision_cites_an_authority():
    for name, p in E.PROVISIONS.items():
        assert p.authority.strip(), name
        assert p.note.strip(), f"{name}: a provision needs a note explaining why it is dated"


def test_a_provision_cannot_end_before_it_starts():
    with pytest.raises(E.ProvisionError, match="precedes first_year"):
        E.Provision(name="x", authority="IRC 1", first_year=2026, last_year=2020)


def test_a_provision_without_an_authority_is_refused():
    """A dated provision with no citation is an opinion about the law."""
    with pytest.raises(E.ProvisionError, match="must cite its authority"):
        E.Provision(name="x", authority="  ", first_year=2026)


# ── Early warning ────────────────────────────────────────────────────────────────────────────────
def test_expiring_within_surfaces_sunsets_before_they_bite():
    """A sunset is the one tax change that arrives on a known date and still surprises people,
    because nothing fails when it happens — the rule just keeps applying expired law."""
    soon = {p.name for p in E.expiring_within(3, as_of=2026)}
    assert "deduction.senior_additional" in soon
    assert "retirement.super_catch_up_60_63" not in soon, "no scheduled end"


def test_expired_lists_provisions_that_need_a_successor_or_removal():
    gone = {p.name for p in E.expired(as_of=2030)}
    assert "deduction.senior_additional" in gone
    assert E.expired(as_of=2026) == [] or all(
        p.last_year < 2026 for p in E.expired(as_of=2026))


def test_a_provision_with_no_scheduled_end_is_not_the_same_as_permanent():
    """`last_year=None` asserts only that no sunset is on the books — a provision can still be
    repealed. The docstring says so and the model must not imply more."""
    p = E.get("deduction.mortgage_cap_750k")
    assert p.last_year is None and p.sunsets is False
    assert p.in_effect(2050) is True


# ── The existing ad-hoc case now uses the mechanism ──────────────────────────────────────────────
def test_the_super_catch_up_rule_consults_the_provision_registry():
    """`k401_deferral` compared against a `super_catch_up_first_year` PARAMETER — an amount standing
    in for an effective date. It worked once and does not generalise."""
    import inspect
    from app.services.calculators import tax_wrappers
    src = inspect.getsource(tax_wrappers.k401_deferral)
    assert 'effective.in_effect("retirement.super_catch_up_60_63"' in src
    assert "super_catch_up_first_year" not in src


# ── Prior-year questions reach the right law ─────────────────────────────────────────────────────
@pytest.mark.parametrize("message,expected", [
    ("How much tax did I pay in 2024?", 2024),
    ("my 2024 tax return", 2024),
    ("what bracket was I in for 2022 and 2024", 2024),      # most recent named year wins
    ("What will I owe in 2027?", 2027),                      # forward-looking is legitimate
    ("filed my 2017 return", None),                          # before the earliest modelled year
    ("my 2026 tax bill", None),                              # the current year is the default path
    ("how much tax do I owe", None),
])
def test_a_named_tax_year_is_extracted(message, expected):
    assert parse_tax_year(message, current_year=2026) == expected


@pytest.mark.parametrize("message", [
    "We bought the house in 2019",
    "I started that job in 2021",
    "the car is a 2018",
])
def test_a_bare_year_without_a_tax_cue_is_ignored(message):
    """A bare year is far more often something else. Pulling a tax year out of "we bought the house
    in 2019" would silently recompute their tax against the wrong law."""
    assert parse_tax_year(message, current_year=2026) is None


@pytest.mark.parametrize("message", [
    "I paid $2024 in fees",
    "tax of $12,024 owed",
    "owed 2024.50 in tax",
])
def test_money_is_never_mistaken_for_a_tax_year(message):
    """`\\b` matches after `$`, so a naive pattern read "$2024 in fees" as tax year 2024 and then
    recomputed the user's tax against the wrong law off a fee amount."""
    assert parse_tax_year(message, current_year=2026) is None


def test_the_planner_accepts_a_tax_year():
    """Prior-year questions are answerable because every table is KEPT rather than replaced — but
    only if the year reaches the calculators."""
    import inspect
    from app.services.advisor_calculations import AdvisorCalculationPlanner
    sig = inspect.signature(AdvisorCalculationPlanner.compute)
    assert "tax_year" in sig.parameters


@pytest.mark.asyncio
async def test_a_prior_year_question_is_computed_on_that_years_law():
    """The end-to-end property. 2024 is verified, so a 2024 question returns STRICT-tier figures on
    2024 law — not the current year's, and not a hedged fallback."""
    from tests.test_advisor_calculations import _Ctx, _resolver
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    p = await AdvisorCalculationPlanner(
        _resolver(income=150000, filing_status="single")
    ).compute(_Ctx(), tax_year=2024)

    fed = next(r for r in p["results"] if r["calculator"] == "tax.federal_income_tax")
    assert fed["inputs_used"]["tax_year"] == 2024
    assert fed["tier"] == "strict", "2024 is verified law, not an estimate"
    assert fed["value"] == pytest.approx(25538.50, abs=0.01)
    assert p["tax_year_requested"] == 2024


@pytest.mark.asyncio
async def test_without_a_named_year_the_current_year_is_used_and_hedged():
    from tests.test_advisor_calculations import _Ctx, _resolver
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    p = await AdvisorCalculationPlanner(
        _resolver(income=150000, filing_status="single")
    ).compute(_Ctx())
    assert p["tax_year_requested"] is None
    fed = next(r for r in p["results"] if r["calculator"] == "tax.federal_income_tax")
    assert fed["tier"] == "scenario", "the current year falls back to verified law, so it is hedged"
