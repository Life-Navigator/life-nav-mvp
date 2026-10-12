"""Effective-dating for tax PROVISIONS — the mechanism versioned data cannot provide.

THE GAP THIS CLOSES
-------------------
Three things change over time, and they need three different mechanisms:

  1. An AMOUNT changes            -> `data/<family>/<year>.json`. Solved: drop in a file, no code.
  2. A rule's VALUE changes       -> also a parameter (the RMD age moving 73 -> 75 in 2033).
  3. A provision STARTS or ENDS   -> neither of the above. This module.

Case 3 is not hypothetical and it is not rare:

  * the 60-63 "super catch-up" did not exist before 2025;
  * the OBBBA senior deduction exists only for 2025-2028 and then stops;
  * the TCJA individual provisions were scheduled to sunset after 2025 before OBBBA made them
    permanent — so code written in 2024 encoded an end date that no longer applies;
  * the AMT $1,000,000 phase-out threshold is unindexed only "for taxable years beginning before
    January 1, 2027" (OBBBA s.70107), which is an effective-date boundary inside a parameter.

Before this module there was exactly ONE piece of year-aware rule logic in the engine —
`tax_wrappers.k401_deferral` comparing against a `super_catch_up_first_year` parameter — and it was
an amount standing in for an effective date. That works once and does not generalise: a provision
that SUNSETS cannot be expressed as a first-year number at all, and nothing would have flagged a
rule still applying law that expired.

WHAT THIS DELIBERATELY DOES NOT DO
----------------------------------
It does not version the rule's LOGIC. If Congress changes how a credit phases out — not the
numbers, the mechanics — that is a new function, and the old one stays, registered for the years it
governed. `superseded_by` records the link so a prior-year question still reaches the rule that was
actually in force. Branching one function across two legal regimes is how a tax engine becomes
unauditable.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Optional


class ProvisionError(ValueError):
    """A provision was applied to a year it does not govern.

    Raised rather than silently returning zero, because both failure directions are confident and
    wrong: applying a provision that had not started invents a benefit, and applying one that has
    expired keeps a benefit the user no longer has.
    """


@dataclass(frozen=True)
class Provision:
    """A statutory provision and the years it governs.

    `last_year` is INCLUSIVE and `None` means "no scheduled end" — which is different from
    "permanent". A provision with no end date can still be repealed; what `None` asserts is only
    that no sunset is currently on the books.
    """

    name: str
    authority: str
    first_year: int
    last_year: Optional[int] = None
    note: str = ""
    superseded_by: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.authority.strip():
            raise ProvisionError(f"{self.name}: a provision must cite its authority")
        if self.last_year is not None and self.last_year < self.first_year:
            raise ProvisionError(
                f"{self.name}: last_year {self.last_year} precedes first_year {self.first_year}")

    def in_effect(self, year: int) -> bool:
        if year < self.first_year:
            return False
        return self.last_year is None or year <= self.last_year

    @property
    def sunsets(self) -> bool:
        return self.last_year is not None

    def why_not(self, year: int) -> str:
        if year < self.first_year:
            return (f"{self.name} did not exist in {year} — it first applies to tax year "
                    f"{self.first_year} ({self.authority})")
        return (f"{self.name} expired after {self.last_year} and does not apply in {year} "
                f"({self.authority})"
                + (f"; superseded by {self.superseded_by}" if self.superseded_by else ""))

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "authority": self.authority, "first_year": self.first_year,
                "last_year": self.last_year, "sunsets": self.sunsets,
                "superseded_by": self.superseded_by, "note": self.note}


# Every provision whose APPLICABILITY (not just its amount) depends on the year.
#
# A provision belongs here only if it starts or ends. A provision whose dollar figure moves lives in
# `tax_parameters/<year>.json` and needs no entry — the year-versioned file already handles it.
PROVISIONS: dict[str, Provision] = {p.name: p for p in (
    Provision(
        name="retirement.super_catch_up_60_63",
        authority="SECURE 2.0 Act s.109; IRC 414(v)(2)(E)",
        first_year=2025,
        note="The higher catch-up for ages 60-63. Did not exist before 2025, so applying it to an "
             "earlier year would invent a contribution the participant could not have made.",
    ),
    Provision(
        name="deduction.senior_additional",
        authority="OBBBA s.70103; IRC 63(f)(5)",
        first_year=2025,
        last_year=2028,
        note="The additional deduction for taxpayers 65+. SUNSETS after 2028 — the clearest case "
             "for this module, because no first-year number can express an end date, and a rule "
             "that keeps applying it in 2029 hands the user a deduction they no longer have.",
    ),
    Provision(
        name="amt.phase_out_threshold_unindexed",
        authority="OBBBA s.70107; IRC 55(d)(4)(B)",
        first_year=2018,
        last_year=2026,
        note="The $1,000,000 AMT exemption phase-out threshold is NOT inflation-indexed for years "
             "beginning before 2027. From 2027 it indexes, so a hardcoded $1,000,000 silently goes "
             "stale rather than erroring.",
    ),
    Provision(
        name="debt_interest.heloc_tracing_required",
        authority="TCJA s.11043 (IRC 163(h)(3)(F)), made permanent by OBBBA s.70108",
        first_year=2018,
        note="Before 2018 home-equity interest was broadly deductible REGARDLESS of use. A "
             "prior-year question about 2017 or earlier must not get the tracing answer — and a "
             "great deal of advice still circulating predates this change.",
    ),
    Provision(
        name="deduction.mortgage_cap_750k",
        authority="TCJA s.11043; made permanent by OBBBA s.70108",
        first_year=2018,
        note="Loans originated before 2017-12-15 keep the $1,000,000 cap, which is grandfathering "
             "handled inside the rule rather than by an effective date.",
    ),
)}


def get(name: str) -> Provision:
    p = PROVISIONS.get(name)
    if p is None:
        raise ProvisionError(
            f"unknown provision {name!r}; declared provisions are {sorted(PROVISIONS)}")
    return p


def in_effect(name: str, year: Optional[int] = None) -> bool:
    return get(name).in_effect(int(year) if year is not None else date.today().year)


def require_in_effect(name: str, year: Optional[int] = None) -> Provision:
    """The provision, or `ProvisionError` explaining which year it governs."""
    y = int(year) if year is not None else date.today().year
    p = get(name)
    if not p.in_effect(y):
        raise ProvisionError(p.why_not(y))
    return p


def expiring_within(years: int = 2, *, as_of: Optional[int] = None) -> list[Provision]:
    """Provisions whose sunset falls within `years`. Drives an early-warning drift gate.

    A sunset is the one kind of tax change that arrives on a known date and still surprises people,
    because nothing fails when it happens — the rule simply keeps applying expired law. Surfacing
    them before they bite is cheap; discovering them afterwards means reissuing advice.
    """
    y = int(as_of) if as_of is not None else date.today().year
    return sorted((p for p in PROVISIONS.values()
                   if p.last_year is not None and y <= p.last_year <= y + years),
                  key=lambda p: (p.last_year or 0, p.name))


def expired(*, as_of: Optional[int] = None) -> list[Provision]:
    """Provisions already past their sunset. Each needs either a successor or removal."""
    y = int(as_of) if as_of is not None else date.today().year
    return sorted((p for p in PROVISIONS.values()
                   if p.last_year is not None and p.last_year < y),
                  key=lambda p: (p.last_year or 0, p.name))
