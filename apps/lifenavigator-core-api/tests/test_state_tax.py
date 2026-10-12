"""Phase B — state tax schedules and the structural validator that guards them.

TWO DIFFERENT QUESTIONS, DELIBERATELY SEPARATED
-----------------------------------------------
*Verification* asks "is 4.95% the right rate for Illinois?" — only a primary source settles that,
and every rate-bearing state in the table is currently unverified and refuses to quote.

*Validation* asks "is this schedule even well-formed?" — and that is answerable here, exhaustively.
It is also where the errors actually are: transcribing 29 states x 4 statuses x up to 9 brackets is
thousands of numbers, and a threshold out of order, a rate typed as `4.95` instead of `0.0495`, a
missing filing status or a closed top bracket are all silent in a rate table.

The engine is therefore tested against SYNTHETIC verified fixtures, so these tests pass today and
keep passing once real verified data lands.
"""
from __future__ import annotations

import pytest

from app.services.calculators import tax as T, versioned_data as V
from app.services.calculators.base import STRICT, CalculatorError

Y = 2024


def _verified_table(**sections):
    base = {"_meta": {"tax_year": Y, "verified": True},
            "no_income_tax": {"verified": True, "states": ["TX"]},
            "flat": {}, "bracketed": {}}
    base.update(sections)
    return base


# A well-formed, progressive, verified schedule: 2% to 10k, 4% to 50k, 6% above.
GOOD = {
    "verified": True,
    "brackets": {
        s: [{"rate": 0.02, "upto": 10000}, {"rate": 0.04, "upto": 50000},
            {"rate": 0.06, "upto": None}]
        for s in T.FILING_STATUSES
    },
}


# ── The engine path, on verified synthetic data ───────────────────────────────────────────────────
def test_bracketed_state_tax_matches_a_hand_calculation(monkeypatch):
    """$80,000 against 2% / 4% / 6%:

        2% ×  10,000          =   200
        4% × (50,000−10,000)  = 1,600
        6% × (80,000−50,000)  = 1,800
                                -----
                                3,600
    """
    monkeypatch.setattr(
        V, "load",
        lambda family, year=None, *, root=None, require_verified=False:
            V.LoadedData("state_tax", Y, Y, _verified_table(bracketed={"ZZ": GOOD})))
    r = T.state_income_tax(taxable_income=80000, state="ZZ", tax_year=Y)
    assert r.value == pytest.approx(3600.0, abs=0.01)
    assert r.detail["regime"] == "bracketed"
    assert r.detail["marginal_rate"] == 0.06
    assert r.detail["effective_rate"] == pytest.approx(0.045, abs=0.0005)
    assert r.tier == STRICT


def test_bracket_breakdown_sums_to_the_state_tax(monkeypatch):
    monkeypatch.setattr(
        V, "load",
        lambda family, year=None, *, root=None, require_verified=False:
            V.LoadedData("state_tax", Y, Y, _verified_table(bracketed={"ZZ": GOOD})))
    r = T.state_income_tax(taxable_income=80000, state="ZZ", tax_year=Y)
    assert sum(b["tax"] for b in r.detail["brackets"]) == pytest.approx(r.value, abs=0.02)


def test_a_verified_flat_state_is_rate_times_income(monkeypatch):
    monkeypatch.setattr(
        V, "load",
        lambda family, year=None, *, root=None, require_verified=False:
            V.LoadedData("state_tax", Y, Y,
                         _verified_table(flat={"ZZ": {"rate": 0.05, "verified": True}})))
    r = T.state_income_tax(taxable_income=100000, state="ZZ", tax_year=Y)
    assert r.value == 5000.0 and r.detail["regime"] == "flat" and r.detail["rate"] == 0.05


# ── The real table: structure, not values ─────────────────────────────────────────────────────────
def test_the_shipped_state_table_is_structurally_valid():
    """The shipped data must be WELL-FORMED even though it is unverified. Malformedness is caught
    here; correctness is the owner's verification step."""
    problems = T.validate_state_table(V.load("state_tax", Y).data)
    assert problems == [], "\n".join(problems)


def test_the_expected_states_are_modelled():
    data = V.load("state_tax", Y).data
    assert set(data["bracketed"]) == {"CA", "NY", "NJ", "MA", "VA", "MD", "OH", "WI", "MN", "OR"}
    assert {"IL", "PA", "NC", "CO", "IN", "MI", "UT", "KY", "GA", "AZ"} <= set(data["flat"])
    assert len(data["no_income_tax"]["states"]) == 9


def test_every_bracketed_state_covers_all_four_filing_statuses():
    """A missing status would KeyError mid-request, for one class of user only."""
    for code, entry in V.load("state_tax", Y).data["bracketed"].items():
        assert set(entry["brackets"]) == set(T.FILING_STATUSES), code


def test_every_rate_bearing_state_is_marked_unverified():
    """None of these numbers came from a primary source, so none may quote. If this test starts
    failing it is because real verified data landed — update it then, deliberately."""
    data = V.load("state_tax", Y).data
    for code, entry in {**data["flat"], **data["bracketed"]}.items():
        assert entry["verified"] is False, f"{code} claims verification"


def test_states_with_material_local_taxes_say_so():
    """NYC is ~3.1-3.9% on top, every Maryland county levies 2.25-3.20%, and many Ohio
    municipalities 1-3%. A state figure without that note reads as the whole burden."""
    data = V.load("state_tax", Y).data
    for code in ("NY", "MD", "OH"):
        assert data["bracketed"][code]["local_tax_not_modelled"]


def test_states_whose_joint_schedule_is_not_a_doubling_are_flagged():
    """NJ and MD publish SEPARATE joint schedules rather than doubling the single one. Assuming all
    states double is a real and common error, so the copied schedules are marked wrong rather than
    presented as data."""
    data = V.load("state_tax", Y).data
    for code in ("NJ", "MD"):
        warning = data["bracketed"][code]["married_jointly_warning"]
        assert "WRONG" in warning and "replace them" in warning


def test_ca_and_ma_surtaxes_are_documented():
    data = V.load("state_tax", Y).data
    assert "Mental Health Services" in data["bracketed"]["CA"]["surtax_note"]
    # MA's millionaire surtax IS in the schedule — 5% then 9%.
    ma = data["bracketed"]["MA"]["brackets"]["single"]
    assert [b["rate"] for b in ma] == [0.05, 0.09]
    assert ma[0]["upto"] == 1000000


def test_ohio_first_bracket_is_zero_percent():
    """A 0% first bracket is legitimate and must survive validation — the validator rejects
    NEGATIVE rates, not zero ones."""
    oh = V.load("state_tax", Y).data["bracketed"]["OH"]["brackets"]["single"]
    assert oh[0]["rate"] == 0.0


# ── The validator: one test per error class it must catch ─────────────────────────────────────────
def test_catches_a_rate_entered_as_a_percent():
    """The classic transcription error: 4.95 meaning 4.95%, which would charge 495%."""
    bad = {"verified": True, "brackets": {s: [{"rate": 4.95, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("looks like a percent" in p for p in problems)


def test_catches_descending_thresholds():
    """These UNDERCHARGE silently — the bracket walk stops early rather than erroring."""
    bad = {"verified": True, "brackets": {s: [{"rate": 0.02, "upto": 50000},
                                              {"rate": 0.04, "upto": 10000},
                                              {"rate": 0.06, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("strictly ascend" in p for p in problems)


def test_catches_duplicate_thresholds():
    bad = {"verified": True, "brackets": {s: [{"rate": 0.02, "upto": 10000},
                                              {"rate": 0.04, "upto": 10000},
                                              {"rate": 0.06, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("not above the previous" in p for p in problems)


def test_catches_a_regressive_rate_step():
    """A progressive schedule never steps down. The walk would still 'work' and charge wrongly."""
    bad = {"verified": True, "brackets": {s: [{"rate": 0.06, "upto": 10000},
                                              {"rate": 0.04, "upto": 50000},
                                              {"rate": 0.08, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("never steps down" in p for p in problems)


def test_catches_a_closed_top_bracket():
    """Income above the last threshold would simply be UNTAXED — invisible in a rate table."""
    bad = {"verified": True, "brackets": {s: [{"rate": 0.02, "upto": 10000},
                                              {"rate": 0.06, "upto": 500000}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("open top bracket" in p for p in problems)


def test_catches_an_upto_null_that_is_not_last():
    bad = {"verified": True, "brackets": {s: [{"rate": 0.02, "upto": None},
                                              {"rate": 0.06, "upto": 50000}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("only the LAST bracket" in p for p in problems)


def test_catches_a_missing_filing_status():
    bad = {"verified": True, "brackets": {"single": [{"rate": 0.05, "upto": None}]}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("missing schedules for" in p for p in problems)


def test_catches_a_state_declared_in_two_regimes():
    problems = T.validate_state_table(_verified_table(
        flat={"TX": {"rate": 0.05, "verified": True}}))
    assert any("BOTH no_income_tax and flat" in p for p in problems)


def test_catches_a_missing_verified_flag():
    problems = T.validate_state_table(_verified_table(flat={"ZZ": {"rate": 0.05}}))
    assert any("missing a 'verified' flag" in p for p in problems)


def test_catches_a_negative_rate():
    bad = {"verified": True, "brackets": {s: [{"rate": -0.02, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    problems = T.validate_state_table(_verified_table(bracketed={"ZZ": bad}))
    assert any("negative rate" in p for p in problems)


def test_a_malformed_state_refuses_to_compute_not_just_fails_ci(monkeypatch):
    """The important half. A malformed schedule computes the WRONG tax rather than erroring, so the
    check has to gate the figure on every call — CI alone would let a bad edit ship a number."""
    bad = {"verified": True, "brackets": {s: [{"rate": 0.02, "upto": 50000},
                                              {"rate": 0.04, "upto": 10000},
                                              {"rate": 0.06, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    monkeypatch.setattr(
        V, "load",
        lambda family, year=None, *, root=None, require_verified=False:
            V.LoadedData("state_tax", Y, Y, _verified_table(bracketed={"ZZ": bad})))
    with pytest.raises(CalculatorError, match="malformed and would compute the wrong tax"):
        T.state_income_tax(taxable_income=80000, state="ZZ", tax_year=Y)


def test_validation_can_be_scoped_to_one_state():
    """What the calculator uses per call — one bad state must not block every other state."""
    bad = {"verified": True, "brackets": {s: [{"rate": 9.0, "upto": None}]
                                          for s in T.FILING_STATUSES}}
    table = _verified_table(bracketed={"ZZ": bad, "YY": GOOD})
    assert T.validate_state_table(table, state="YY") == []
    assert T.validate_state_table(table, state="ZZ") != []
