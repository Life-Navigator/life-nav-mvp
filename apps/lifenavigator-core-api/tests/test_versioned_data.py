"""Phase A — year-versioned reference data and its staleness contract (rule R6)."""
from __future__ import annotations

import json
import os
from datetime import date

import pytest

from app.services.calculators import versioned_data as V


def _write(root: str, family: str, year: int, payload: dict) -> None:
    d = os.path.join(root, family)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, f"{year}.json"), "w") as fh:
        json.dump(payload, fh)


# ── Loading ───────────────────────────────────────────────────────────────────────────────────────
def test_loads_the_exact_year_when_present(tmp_path):
    _write(str(tmp_path), "tax_tables", 2026, {"standard_deduction": {"single": 15000}})
    got = V.load("tax_tables", 2026, root=str(tmp_path))
    assert got.year_used == 2026 and got.year_requested == 2026
    assert got.is_carried_forward is False
    assert got.data["standard_deduction"]["single"] == 15000
    assert "2026 tables" in got.provenance


def test_defaults_to_the_current_calendar_year(tmp_path):
    this_year = date.today().year
    _write(str(tmp_path), "tax_tables", this_year, {"ok": True})
    assert V.load("tax_tables", root=str(tmp_path)).year_used == this_year


def test_unknown_family_names_the_declared_ones(tmp_path):
    with pytest.raises(V.VersionedDataError, match="unknown dataset family"):
        V.load("tax_brackets", 2026, root=str(tmp_path))


def test_missing_family_says_which_phase_owns_it(tmp_path):
    with pytest.raises(V.VersionedDataError, match="phase B has not shipped"):
        V.load("tax_tables", 2026, root=str(tmp_path))


def test_malformed_json_raises_rather_than_returning_empty(tmp_path):
    d = tmp_path / "tax_tables"
    d.mkdir()
    (d / "2026.json").write_text("{not json")
    with pytest.raises(V.VersionedDataError, match="invalid JSON"):
        V.load("tax_tables", 2026, root=str(tmp_path))


def test_a_json_list_is_rejected(tmp_path):
    d = tmp_path / "tax_tables"
    d.mkdir()
    (d / "2026.json").write_text("[1, 2, 3]")
    with pytest.raises(V.VersionedDataError, match="JSON object"):
        V.load("tax_tables", 2026, root=str(tmp_path))


# ── Fallback policy ───────────────────────────────────────────────────────────────────────────────
def test_carry_forward_serves_the_prior_year_and_marks_it(tmp_path):
    """The January case: the new year's tables are not loaded yet. The figure still reaches the
    user, but labelled — which is the whole difference from the `BRACKETS_2024` defect."""
    _write(str(tmp_path), "tax_tables", 2025, {"year": 2025})
    got = V.load("tax_tables", 2026, root=str(tmp_path))
    assert got.year_used == 2025 and got.year_requested == 2026
    assert got.is_carried_forward is True
    assert "computed on 2025 law" in got.provenance and "not yet verified" in got.provenance


def test_carry_forward_picks_the_most_recent_prior_year(tmp_path):
    for y in (2022, 2023, 2025):
        _write(str(tmp_path), "tax_tables", y, {"year": y})
    assert V.load("tax_tables", 2026, root=str(tmp_path)).year_used == 2025


def test_strict_policy_refuses_to_carry_forward(tmp_path):
    """Contribution limits are published the preceding autumn, so a gap is a process failure."""
    assert V.FAMILIES["contribution_limits"].fallback == V.STRICT
    _write(str(tmp_path), "contribution_limits", 2025, {"k401_elective": 23500})
    with pytest.raises(V.VersionedDataError, match="process failure"):
        V.load("contribution_limits", 2026, root=str(tmp_path))


def test_never_carries_backwards_even_under_carry_forward(tmp_path):
    """Applying next year's brackets to this year's income is wrong in a way that looks right."""
    _write(str(tmp_path), "tax_tables", 2027, {"year": 2027})
    with pytest.raises(V.VersionedDataError, match="refusing to apply a later year"):
        V.load("tax_tables", 2026, root=str(tmp_path))


def test_rate_tables_are_strict_because_a_stale_quote_is_a_wrong_quote(tmp_path):
    assert V.FAMILIES["rate_tables"].fallback == V.STRICT


# ── Drift gate ────────────────────────────────────────────────────────────────────────────────────
def test_stale_gate_ignores_families_with_no_data_yet(tmp_path):
    """Phases B/F/I/L have not shipped their datasets. A gate that failed for 'not built yet' would
    be noise, and noise trains people to skip the gate."""
    assert V.stale_families(year=2026, root=str(tmp_path)) == []


def test_stale_gate_fires_for_data_that_exists_and_has_gone_stale(tmp_path):
    _write(str(tmp_path), "tax_tables", 2024, {"year": 2024})
    stale = V.stale_families(year=2026, root=str(tmp_path))
    assert [s["family"] for s in stale] == ["tax_tables"]
    assert stale[0]["have"] == [2024] and stale[0]["wanted"] == 2026
    assert stale[0]["phase"] == "B"


def test_stale_gate_is_quiet_when_the_current_year_is_present(tmp_path):
    _write(str(tmp_path), "tax_tables", 2026, {"year": 2026})
    _write(str(tmp_path), "col_index", 2026, {"metros": {}})
    assert V.stale_families(year=2026, root=str(tmp_path)) == []


def test_stale_gate_reports_every_stale_family_not_just_the_first(tmp_path):
    _write(str(tmp_path), "tax_tables", 2024, {})
    _write(str(tmp_path), "col_index", 2023, {})
    _write(str(tmp_path), "rate_tables", 2026, {})
    stale = {s["family"] for s in V.stale_families(year=2026, root=str(tmp_path))}
    assert stale == {"tax_tables", "col_index"}


# ── Declaration hygiene ───────────────────────────────────────────────────────────────────────────
def test_every_declared_family_has_a_label_and_a_known_policy():
    for name, fam in V.FAMILIES.items():
        assert fam.label.strip(), name
        assert fam.fallback in (V.STRICT, V.CARRY_FORWARD), name
        assert fam.name == name


def test_an_unknown_fallback_policy_is_rejected_at_declaration():
    with pytest.raises(V.VersionedDataError, match="fallback must be"):
        V.DatasetFamily("x", "X", "whatever")


def test_available_years_is_sorted_and_ignores_non_year_files(tmp_path):
    _write(str(tmp_path), "tax_tables", 2026, {})
    _write(str(tmp_path), "tax_tables", 2024, {})
    d = tmp_path / "tax_tables"
    (d / "README.md").write_text("notes")
    (d / "draft.json").write_text("{}")
    assert V.available_years("tax_tables", root=str(tmp_path)) == [2024, 2026]


def test_test_supplied_roots_are_not_cached_across_calls(tmp_path):
    """The package data dir is cached for speed; a test fixture must never leak into the next test."""
    _write(str(tmp_path), "tax_tables", 2026, {"v": 1})
    assert V.load("tax_tables", 2026, root=str(tmp_path)).data["v"] == 1
    _write(str(tmp_path), "tax_tables", 2026, {"v": 2})
    assert V.load("tax_tables", 2026, root=str(tmp_path)).data["v"] == 2


# ── load_latest_verified: Option B's primitive ───────────────────────────────────────────────────
def test_latest_verified_walks_back_past_an_unverified_year(tmp_path):
    """THE WHOLE POINT. An unverified table must never be served — it is model knowledge, not law.
    The loader walks BACK to the most recent year a human checked rather than sideways to a guess.
    """
    _write(str(tmp_path), "tax_tables", 2024, {"_meta": {"verified": True}, "year": 2024})
    _write(str(tmp_path), "tax_tables", 2026, {"_meta": {"verified": False}, "year": 2026})

    got = V.load_latest_verified("tax_tables", 2026, root=str(tmp_path))
    assert got.year_used == 2024 and got.is_verified is True
    assert got.data["year"] == 2024, "never the unverified file's contents"
    assert got.is_carried_forward is True


def test_latest_verified_prefers_the_exact_year_when_it_is_verified(tmp_path):
    _write(str(tmp_path), "tax_tables", 2024, {"_meta": {"verified": True}, "year": 2024})
    _write(str(tmp_path), "tax_tables", 2026, {"_meta": {"verified": True}, "year": 2026})
    got = V.load_latest_verified("tax_tables", 2026, root=str(tmp_path))
    assert got.year_used == 2026 and got.is_carried_forward is False


def test_latest_verified_raises_when_nothing_has_ever_been_verified(tmp_path):
    """No silent fallback to a guess: if nobody has checked anything, there is no basis to compute
    on and saying so is the only honest option."""
    _write(str(tmp_path), "tax_tables", 2024, {"_meta": {"verified": False}})
    with pytest.raises(V.UnverifiedDataError, match="no VERIFIED table"):
        V.load_latest_verified("tax_tables", 2026, root=str(tmp_path))


def test_latest_verified_never_reaches_forward(tmp_path):
    """A later verified year must not be applied to an earlier one — next year's brackets on this
    year's income is wrong in a way that looks right."""
    _write(str(tmp_path), "tax_tables", 2027, {"_meta": {"verified": True}})
    with pytest.raises(V.UnverifiedDataError):
        V.load_latest_verified("tax_tables", 2026, root=str(tmp_path))
