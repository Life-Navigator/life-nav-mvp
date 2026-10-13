"""Itemized deductions, with the caps actually applied.

The reason this calculator exists rather than a sum in the resolver: three of the four big
categories are capped or floored, and adding the raw amounts recommends itemizing to people for
whom the standard deduction wins. Every figure below traces to a cited statute.
"""
from __future__ import annotations

import pytest

from app.services.calculators import versioned_data as V
from app.services.calculators.base import SCENARIO, CalculatorError
from app.services.calculators.tax import itemized_deductions

PARAMS = V.load("tax_parameters", 2026).data["itemized"]
MFJ = "married_jointly"


def _it(**kw):
    kw.setdefault("filing_status", MFJ)
    kw.setdefault("agi", 180_000)
    return itemized_deductions(**kw)


# ── SALT, the cap that changed ───────────────────────────────────────────────────────────────────
def test_salt_under_the_cap_is_fully_deductible():
    r = _it(state_local_taxes=22_000)
    assert r.detail["salt_allowed"] == 22_000
    assert r.detail["salt_disallowed"] == 0


def test_salt_above_the_cap_is_limited_to_it():
    """IRC 164(b)(6). $40,400 for 2026 — not the $10,000 the TCJA set, and not uncapped."""
    r = _it(state_local_taxes=60_000)
    assert r.detail["salt_allowed"] == pytest.approx(40_400)
    assert r.detail["salt_disallowed"] == pytest.approx(19_600)
    assert r.detail["salt_phase_down_applies"] is False


def test_the_cap_phases_DOWN_above_the_magi_threshold():
    """30 cents of cap per dollar of MAGI over $505,000. At $600,000 that is
    $40,400 - 0.30 x $95,000 = $11,900 — so a household that paid $60,000 of SALT deducts $11,900.
    """
    r = _it(agi=600_000, state_local_taxes=60_000)
    assert r.detail["salt_phase_down_applies"] is True
    assert r.detail["salt_cap_after_phase_down"] == pytest.approx(11_900)
    assert r.detail["salt_allowed"] == pytest.approx(11_900)


def test_the_phase_down_stops_at_the_ten_thousand_floor():
    """It never reduces below the original TCJA cap. Verified at the arithmetic break-even the
    sources cite: 505,000 + (40,400 - 10,000)/0.30 = $606,333, above which the cap is flat."""
    cap, floor = 40_400, 10_000
    break_even = 505_000 + (cap - floor) / 0.30
    assert break_even == pytest.approx(606_333, abs=1)
    for agi in (break_even, 800_000, 5_000_000):
        r = _it(agi=agi, state_local_taxes=60_000)
        assert r.detail["salt_cap_after_phase_down"] == pytest.approx(floor), agi


def test_married_filing_separately_gets_half_of_everything():
    """And the MFS threshold is $252,500 — half of $505,000. A secondary source gave $202,500,
    which is inconsistent with its own stated $303,167 phase-out point; the arithmetic settles it.
    """
    assert PARAMS["salt_cap"]["married_separately"] == 20_200
    assert PARAMS["salt_phase_down_threshold"]["married_separately"] == 252_500
    assert PARAMS["salt_floor"]["married_separately"] == 5_000
    break_even = 252_500 + (20_200 - 5_000) / 0.30
    assert break_even == pytest.approx(303_167, abs=1)


def test_the_sunset_is_reported_because_it_changes_the_plan():
    """The raised cap runs 2025-2029 and reverts to $10,000 in 2030, which is the whole basis of
    a bunching decision — whether to accelerate deductions into the window."""
    assert _it(state_local_taxes=20_000).detail["salt_cap_reverts_to_floor_after"] == 2029


# ── The medical floor ────────────────────────────────────────────────────────────────────────────
def test_medical_expenses_below_the_agi_floor_deduct_NOTHING():
    """IRC 213(a): only the excess over 7.5% of AGI counts. At $180,000 AGI the floor is $13,500,
    so $9,000 of bills is entirely non-deductible — and a tool that added it to the itemized total
    would overstate the deduction by the full $9,000."""
    r = _it(agi=180_000, medical_expenses=9_000)
    assert r.detail["medical_floor"] == pytest.approx(13_500)
    assert r.detail["medical_allowed"] == 0.0
    assert r.detail["medical_disallowed"] == pytest.approx(9_000)


def test_only_the_excess_over_the_floor_counts():
    r = _it(agi=100_000, medical_expenses=20_000)
    assert r.detail["medical_floor"] == pytest.approx(7_500)
    assert r.detail["medical_allowed"] == pytest.approx(12_500)


def test_the_floor_scales_with_agi_so_a_raise_can_cost_a_deduction():
    low = _it(agi=80_000, medical_expenses=10_000).detail["medical_allowed"]
    high = _it(agi=200_000, medical_expenses=10_000).detail["medical_allowed"]
    assert low > high == 0.0


# ── The total, and the verdict ───────────────────────────────────────────────────────────────────
def test_the_total_is_the_sum_of_the_ALLOWED_amounts():
    r = _it(agi=180_000, state_local_taxes=60_000, mortgage_interest=18_000,
            charitable_contributions=6_000, medical_expenses=9_000, other_itemized=1_000)
    d = r.detail
    assert r.value == pytest.approx(d["salt_allowed"] + 18_000 + 6_000
                                    + d["medical_allowed"] + 1_000)
    # And strictly less than the raw sum, which is the point.
    assert r.value < 60_000 + 18_000 + 6_000 + 9_000 + 1_000


def test_it_says_when_itemizing_is_not_worth_it():
    """A user who tracked receipts all year deserves to be told directly."""
    r = _it(state_local_taxes=5_000, charitable_contributions=1_000)
    assert r.detail["should_itemize"] is False
    assert r.detail["shortfall_to_itemize"] > 0
    assert r.detail["benefit_over_standard"] == 0.0


def test_zero_deductions_is_computable_not_an_error():
    r = _it()
    assert r.value == 0.0
    assert r.detail["should_itemize"] is False


# ── Cross-year mixing, made visible ──────────────────────────────────────────────────────────────
def test_the_parameter_year_and_standard_deduction_year_are_both_reported():
    """THE BUG THIS GUARDS. `tax_tables` is verification-gated and falls back to the newest VERIFIED
    year while `tax_parameters` is not, so this one comparison can put a 2026 SALT cap against a
    2024 standard deduction. Observed live: $40,400 against $29,200 instead of $32,200 — and in
    that direction the standard deduction is too LOW, biasing the verdict toward itemizing.
    """
    d = _it(state_local_taxes=20_000).detail
    assert d["parameter_year"] == 2026
    assert d["years_mixed"] is (d["standard_deduction_year"] != 2026)


def test_a_verdict_that_FLIPS_between_the_years_is_not_reported_as_a_decision():
    """A total between the two years' standard deductions ($29,200 and $32,200) gives opposite
    answers depending which year is used. Saying "itemize" there would be false confidence."""
    d = _it(agi=200_000, state_local_taxes=20_000, mortgage_interest=10_000).detail
    if d["years_mixed"]:
        assert d["verdict_robust_across_years"] is False
        assert any("NOT ROBUST" in lim for lim in d["limitations"])


def test_a_clear_verdict_says_the_conclusion_holds_either_way():
    d = _it(agi=200_000, state_local_taxes=25_000, mortgage_interest=25_000).detail
    assert d["verdict_robust_across_years"] is True
    if d["years_mixed"]:
        assert any("same either way" in lim for lim in d["limitations"])


# ── IRC 68: detected, not modelled ───────────────────────────────────────────────────────────────
def test_the_section_68_limitation_is_flagged_above_the_top_bracket():
    """New for 2026 and NOT modelled. It reduces itemized deductions for taxpayers in the 37%
    bracket — exactly the households most likely to itemize — so exposure is said out loud rather
    than quietly overstating their deduction."""
    r = _it(agi=2_000_000, state_local_taxes=60_000, mortgage_interest=40_000)
    assert r.detail["section_68_applies"] is True
    flagged = [lim for lim in r.detail["limitations"] if "IRC 68" in lim]
    assert flagged and "OVERSTATES" in flagged[0]
    assert "CPA" in flagged[0]


def test_below_the_top_bracket_section_68_is_not_claimed():
    r = _it(agi=180_000, state_local_taxes=20_000)
    assert r.detail["section_68_applies"] is False
    assert not any("IRC 68" in lim for lim in r.detail["limitations"])


def test_the_section_68_threshold_is_the_start_of_the_top_bracket():
    """Derived from the table, where each row stores its CEILING — so the 37% bracket BEGINS at
    the 35% row's ceiling. Reading a `threshold` field that does not exist returned None and
    silently disabled the check."""
    r = _it(agi=180_000)
    assert r.detail["section_68_threshold"] is not None
    assert r.detail["section_68_threshold"] > 500_000


# ── MAGI and refusals ────────────────────────────────────────────────────────────────────────────
def test_magi_defaults_to_agi_and_says_so_only_when_it_MATTERS():
    """Below the phase-down threshold the substitution changes nothing, so hedging it would be
    noise; above it, it is load-bearing and recorded."""
    low = _it(agi=180_000, state_local_taxes=20_000)
    assert not any(a.key == "magi_equals_agi" for a in low.assumptions)
    high = _it(agi=600_000, state_local_taxes=60_000)
    assert any(a.key == "magi_equals_agi" for a in high.assumptions)


def test_an_explicit_magi_drives_the_phase_down_not_agi():
    r = itemized_deductions(filing_status=MFJ, agi=200_000, magi=600_000,
                            state_local_taxes=60_000)
    assert r.detail["salt_phase_down_applies"] is True
    assert r.detail["salt_cap_after_phase_down"] == pytest.approx(11_900)
    assert not any(a.key == "magi_equals_agi" for a in r.assumptions)


def test_negative_amounts_are_refused():
    for kw in ("state_local_taxes", "mortgage_interest", "charitable_contributions",
               "medical_expenses", "other_itemized"):
        with pytest.raises(CalculatorError):
            _it(**{kw: -1})


def test_an_unknown_filing_status_is_refused():
    with pytest.raises(CalculatorError):
        itemized_deductions(filing_status="its_complicated", agi=100_000)


def test_unverified_parameters_make_the_result_a_scenario():
    assert _it(state_local_taxes=20_000).tier == SCENARIO


def test_the_passed_through_limits_are_named_rather_than_implied():
    """Mortgage interest and charitable gifts are NOT capped here, and saying so is the difference
    between a known boundary and a silent omission."""
    lims = " ".join(_it(mortgage_interest=50_000, charitable_contributions=200_000)
                    .detail["limitations"])
    assert "750,000" in lims or "$750,000" in lims
    assert "60%/30%/20%" in lims
