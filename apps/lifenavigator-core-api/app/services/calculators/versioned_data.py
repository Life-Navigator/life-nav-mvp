"""Year-versioned reference data — the loader and its staleness contract (Phase A, rule R6).

THE DEFECT THIS EXISTS TO PREVENT
---------------------------------
`apps/web/src/lib/finance/tax.ts` hardcodes `BRACKETS_2024` and `STANDARD_DEDUCTION_2024` as source
constants. It is 2026. Nothing failed, nothing warned, and every tax figure the platform produced
was computed against two-year-old brackets while presenting itself with full confidence. A constant
cannot go stale loudly; a dated file can.

So: anything that changes on a calendar schedule — tax brackets, standard deductions, FICA wage
bases, contribution limits, cost-of-living indices, lender rate tables, SBA program caps — lives in
`data/<family>/<year>.json`, and a drift gate fails CI when the current year is missing.

THE JANUARY PROBLEM, AND WHY THERE ARE TWO POLICIES
---------------------------------------------------
A naive "raise if the current year is absent" breaks the product every January 1st, because some
publishers genuinely have not released the new year's figures yet. But silently falling back to last
year's table reintroduces the exact defect above.

Each family therefore declares a `fallback` policy:

  STRICT          — raise. For data that is published well in advance (contribution limits are set
                    the preceding autumn), a missing current year is a process failure, not a
                    timing reality.
  CARRY_FORWARD   — serve the most recent year available, and mark the result. The number still
                    reaches the user, but `LoadedData.is_carried_forward` is True and `year_used`
                    says which year it came from, so the calculator can label the figure and the
                    advisor can hedge it honestly.

Both policies keep the CI drift gate failing until the data lands. The gate applies the pressure;
the policy decides whether runtime degrades loudly or stops.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Any, Optional

STRICT = "strict"
CARRY_FORWARD = "carry_forward"

_DATA_ROOT = os.path.join(os.path.dirname(__file__), "data")


class VersionedDataError(RuntimeError):
    """A dataset family is missing, malformed, or unacceptably stale."""


@dataclass(frozen=True)
class DatasetFamily:
    """A calendar-versioned reference dataset.

    `owner` is recorded because the drift gates fail every January by design, and a failing gate with
    no named owner is a gate that gets skipped. See the build plan's open question 5.
    """

    name: str
    label: str
    fallback: str = STRICT
    owner: str = "unassigned"
    phase: str = ""

    def __post_init__(self) -> None:
        if self.fallback not in (STRICT, CARRY_FORWARD):
            raise VersionedDataError(
                f"{self.name}: fallback must be {STRICT!r} or {CARRY_FORWARD!r}, got {self.fallback!r}"
            )


# Declared up front so the plan is visible in code, and so a typo'd family name fails loudly instead
# of reading an empty directory. A family listed here with NO data on disk is not an error — the
# phase that owns it has not shipped yet, and the drift gate skips it (see `stale_families`).
FAMILIES: dict[str, DatasetFamily] = {
    f.name: f
    for f in (
        # Phase B. Brackets are inflation-indexed and released the preceding autumn, but a late
        # year-start is survivable if the figure is labelled — a wrong-year bracket is far worse
        # than a labelled prior-year one.
        DatasetFamily("tax_tables", "Federal tax brackets & deductions", CARRY_FORWARD, phase="B"),
        DatasetFamily("state_tax", "State income tax tables", CARRY_FORWARD, phase="B"),
        # Phase F. Published in the autumn for the following year; a gap here is a process miss.
        DatasetFamily("contribution_limits", "401k/IRA/HSA/FSA limits", STRICT, phase="F"),
        # Phase I. Annual index refresh; carrying forward a year barely moves a COL ratio.
        DatasetFamily("col_index", "Cost-of-living index by metro", CARRY_FORWARD, phase="I"),
        # Phase L. Rates move constantly, so a stale table is a materially wrong quote. Strict.
        DatasetFamily("rate_tables", "Lender rates by product & credit tier", STRICT, phase="L"),
        DatasetFamily("loan_product_rules", "DTI/LTV/reserve minimums by product", CARRY_FORWARD, phase="L"),
        DatasetFamily("sba_program_rules", "SBA 7(a)/504 program rules", CARRY_FORWARD, phase="L"),
        DatasetFamily("depreciation_curves", "Asset depreciation curves", CARRY_FORWARD, phase="L"),
        DatasetFamily("cap_rate_benchmarks", "Commercial cap-rate benchmarks", CARRY_FORWARD, phase="L"),
    )
}


@dataclass(frozen=True)
class LoadedData:
    """A dataset plus the provenance needed to cite or hedge it."""

    family: str
    year_requested: int
    year_used: int
    data: dict[str, Any]

    @property
    def is_carried_forward(self) -> bool:
        return self.year_used != self.year_requested

    @property
    def provenance(self) -> str:
        """User-facing source note. The carried-forward wording is deliberately explicit — an
        unlabelled prior-year figure is the defect this module exists to prevent."""
        fam = FAMILIES[self.family].label
        if self.is_carried_forward:
            return (f"{fam}, {self.year_used} tables (the {self.year_requested} tables are not yet "
                    f"loaded, so this uses {self.year_used})")
        return f"{fam}, {self.year_used} tables"


def _root(root: Optional[str] = None) -> str:
    return root or _DATA_ROOT


def _family(name: str) -> DatasetFamily:
    fam = FAMILIES.get(name)
    if fam is None:
        raise VersionedDataError(
            f"unknown dataset family {name!r}; declared families are {sorted(FAMILIES)}"
        )
    return fam


def available_years(family: str, *, root: Optional[str] = None) -> list[int]:
    """Years present on disk for `family`, ascending. Empty when the phase has not shipped."""
    _family(family)
    d = os.path.join(_root(root), family)
    if not os.path.isdir(d):
        return []
    years: list[int] = []
    for entry in os.listdir(d):
        stem, ext = os.path.splitext(entry)
        if ext == ".json" and stem.isdigit():
            years.append(int(stem))
    return sorted(years)


def load(family: str, year: Optional[int] = None, *, root: Optional[str] = None) -> LoadedData:
    """Load `family` for `year` (default: the current calendar year).

    Raises `VersionedDataError` when the family has no data at all, when the exact year is missing
    under a STRICT policy, or when only LATER years exist (carrying *backwards* would apply next
    year's brackets to this year's income — wrong in a way that looks right).
    """
    fam = _family(family)
    want = int(year) if year is not None else date.today().year
    years = available_years(family, root=root)
    if not years:
        raise VersionedDataError(
            f"{family}: no data files found — phase {fam.phase or '?'} has not shipped this dataset"
        )
    if want in years:
        return LoadedData(family, want, want, _read(family, want, root=root))

    earlier = [y for y in years if y < want]
    if not earlier:
        raise VersionedDataError(
            f"{family}: no table at or before {want} (have {years}); refusing to apply a later "
            f"year's figures to an earlier year"
        )
    if fam.fallback == STRICT:
        raise VersionedDataError(
            f"{family}: no {want} table (have {years}) and policy is {STRICT!r} — this dataset is "
            f"published in advance, so a missing year is a process failure, not a timing gap"
        )
    return LoadedData(family, want, earlier[-1], _read(family, earlier[-1], root=root))


@lru_cache(maxsize=64)
def _read_cached(path: str) -> dict[str, Any]:
    with open(path) as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise VersionedDataError(f"{path}: expected a JSON object at the top level")
    return data


def _read(family: str, year: int, *, root: Optional[str] = None) -> dict[str, Any]:
    path = os.path.join(_root(root), family, f"{year}.json")
    try:
        # Only the package's own data directory is cached. A test-supplied root must not be, or one
        # test's fixture leaks into the next.
        return _read_cached(path) if root is None else _read_uncached(path)
    except json.JSONDecodeError as exc:
        raise VersionedDataError(f"{path}: invalid JSON — {exc}") from exc
    except OSError as exc:
        raise VersionedDataError(f"{path}: cannot read — {exc}") from exc


def _read_uncached(path: str) -> dict[str, Any]:
    with open(path) as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise VersionedDataError(f"{path}: expected a JSON object at the top level")
    return data


# ── Drift gate support ────────────────────────────────────────────────────────────────────────────
def stale_families(*, year: Optional[int] = None, root: Optional[str] = None) -> list[dict[str, Any]]:
    """Families that HAVE data but are missing the given year (default: current). Drives the gate.

    Families with no data at all are EXCLUDED, deliberately. Phases B/F/I/L have not shipped their
    datasets yet, and a gate that fails for "Phase L has not been built" would be noise that trains
    the team to ignore it. The gate must fire for exactly one thing: data that exists and has gone
    stale.
    """
    want = int(year) if year is not None else date.today().year
    out: list[dict[str, Any]] = []
    for name, fam in sorted(FAMILIES.items()):
        years = available_years(name, root=root)
        if not years or want in years:
            continue
        out.append({"family": name, "label": fam.label, "wanted": want, "have": years,
                    "fallback": fam.fallback, "owner": fam.owner, "phase": fam.phase})
    return out
