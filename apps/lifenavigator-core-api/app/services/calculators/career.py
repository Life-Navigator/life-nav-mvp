"""Career compensation calculators (Phase A consolidation).

Deliberately modest. Phase I/J replace these with `total_comp_npv`, `equity_grant_value`,
`col_adjustment` and `offer_impact`, which model tax, cost of living, 401k match formulas and
benefits. What is here is gross-comp arithmetic on figures the user supplies, so it is STRICT — and
its `limitations` say plainly what it does not account for, because a gross-comp ranking can invert
once tax and COL are applied, and a user comparing two offers has no way to know that from the
number alone.
"""
from __future__ import annotations

from typing import Any, Iterable

from .base import STRICT, CalcResult, CalculatorError, register, require_money, require_rate


@register("career.uncaptured_match")
def uncaptured_match(*, income: float, current_rate: float, employer_match_rate: float) -> CalcResult:
    """Employer money left on the table each year. STRICT — all three inputs are the user's.

    Rates here are PERCENTAGES OF PAY (6 means 6%), not decimal fractions, which is the convention
    every 401(k) interface uses and the one the user will be reading off their own enrolment page.
    They are therefore validated as rates after conversion, not before — passing 6 to
    `require_rate` would be rejected as an unconverted percent (R5) when it is the correct input.
    """
    inc = require_money("income", income, allow_zero=False)
    cur = require_rate("current_rate", current_rate / 100.0)
    match = require_rate("employer_match_rate", employer_match_rate / 100.0)
    uncaptured = inc * max(0.0, match - cur)
    return CalcResult(
        calculator="career.uncaptured_match", label="employer match left unclaimed each year",
        value=round(uncaptured, 2), unit="usd_per_year", tier=STRICT,
        inputs_used={"income": inc, "current_rate_pct": current_rate,
                     "employer_match_rate_pct": employer_match_rate},
        detail={"full_match_annual": round(inc * match, 2),
                "recommended_rate_pct": max(current_rate, employer_match_rate),
                "capturing_full_match": cur >= match,
                # An instant, risk-free 100% return on the contributed amount is the comparison that
                # makes this figure act on, so it is stated rather than left to be inferred.
                "note": "a full match is an immediate 100% return on the matched portion"},
    )


@register("career.offer_total_comp")
def offer_total_comp(*, offers: Iterable[dict[str, Any]]) -> CalcResult:
    """Rank offers by gross total compensation. The cited value is the spread between best and
    worst, because that is the figure a decision turns on; the ranking lives in `detail`."""
    rows = []
    for idx, o in enumerate(offers or []):
        base = require_money(f"offers[{idx}].base", o.get("base"), allow_zero=False)
        bonus = require_money(f"offers[{idx}].bonus", o.get("bonus") or 0.0)
        equity = require_money(f"offers[{idx}].equity_per_year", o.get("equity_per_year") or 0.0)
        benefits = require_money(f"offers[{idx}].benefits_value", o.get("benefits_value") or 0.0)
        rows.append({"name": o.get("name") or f"offer {idx + 1}", "base": base, "bonus": bonus,
                     "equity_per_year": equity, "benefits_value": benefits,
                     "total_comp": round(base + bonus + equity + benefits, 2)})
    if not rows:
        raise CalculatorError("offer_total_comp needs at least one offer")
    rows.sort(key=lambda r: r["total_comp"], reverse=True)
    spread = rows[0]["total_comp"] - rows[-1]["total_comp"]
    return CalcResult(
        calculator="career.offer_total_comp", label="gross total-comp spread between offers",
        value=round(spread, 2), unit="usd_per_year", tier=STRICT,
        inputs_used={"offer_count": len(rows)},
        detail={"ranked": rows, "best": rows[0]["name"], "best_total_comp": rows[0]["total_comp"],
                "excludes": ["federal_tax", "state_tax", "fica", "cost_of_living",
                             "401k_match", "health_plan_cost", "hsa_fsa", "equity_risk",
                             "vesting_schedule", "relocation"]},
    )
