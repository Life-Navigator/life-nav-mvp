"""Federal tax engine (Phase B) — brackets, FICA, capital gains, and the marginal rate.

WHY THIS IS THE CRITICAL PATH
-----------------------------
Phases F, H, I and both composites all need it. Roth-vs-Traditional is a marginal-rate comparison.
Withdrawal sequencing is a tax-ordering problem. `offer_impact` cannot rank an HDHP+HSA offer against
a PPO offer without knowing what a dollar of pre-tax contribution is worth. A 529's advantage is a
tax advantage. None of that is computable without this module.

WHAT WAS HERE BEFORE
--------------------
Nothing, in Python. The only tax engine in the repo is `apps/web/src/lib/finance/tax.ts`, which
(a) hardcodes `BRACKETS_2024` as source constants and has shipped into 2026 — two tax years stale,
(b) lives in the web tier where the advisor cannot reach it, and
(c) sets `totalCredits = 0`, models no state tax, no capital gains, and marks above-the-line
    adjustments `// not modeled yet`.
Meanwhile `assumptions.py:marginal_tax_rate` describes itself as a fallback used "only when income
is unknown; otherwise computed from your income bracket" — documenting a capability that did not
exist.

TIERING
-------
Every figure here is STRICT when the user supplies their income and filing status: applying a
published statutory rate schedule to their own numbers is arithmetic on their data, not a
projection. The tax TABLE is not an assumption in the `assumptions.py` sense — it is law, cited by
year through `LoadedData.provenance`. What makes a result SCENARIO is a carried-forward table (last
year's law applied to this year) — which is recorded rather than silently absorbed.

THE DATA IS GATED, THE ENGINE IS NOT
------------------------------------
Calculators here load with `require_verified=True`, so an unverified table cannot produce a
user-facing figure. The engine's correctness is proven against **2024**, which is historically fixed
and cross-checked against the figures `tax.ts` shipped — so a data-verification gap can never be
mistaken for an engine bug, and vice versa.

NOT MODELLED YET, STATED PLAINLY
--------------------------------
AMT, QBI, itemized deductions beyond the standard/itemized choice, the senior deduction, phase-outs
of specific credits, self-employment tax, and state tax (its own calculator, pending its own table).
Each is listed in the relevant result's `limitations` rather than silently omitted.
"""
from __future__ import annotations

import os
from typing import Any, Optional

from . import versioned_data as V
from .base import (
    SCENARIO,
    STRICT,
    Assumption,
    CalcResult,
    CalculatorError,
    register,
    require_money,
    require_rate,
)

FILING_STATUSES = ("single", "married_jointly", "married_separately", "head_of_household")


def _status(value: Any) -> str:
    s = str(value or "").strip().lower()
    if s not in FILING_STATUSES:
        raise CalculatorError(
            f"filing_status must be one of {FILING_STATUSES}, got {value!r}"
        )
    return s


# How the tax basis is resolved when the requested year's table is not verified.
#
#   "latest_verified" (default) — fall back to the most recent year a human checked, and LABEL every
#                     figure. `_carry_forward_note` downgrades the result to SCENARIO and cites
#                     `tax_table_year`, so the hedge reaches the user through the existing
#                     validator path rather than needing a new mechanism.
#   "verified_only" — refuse outright. Correct once the current year IS verified, because then a
#                     fallback would mean something has gone wrong rather than something is pending.
#
# Never "use the unverified table": those figures came from model knowledge, and serving them is the
# fabrication this engine exists to prevent. The fallback walks BACK to real law, not sideways to a
# guess.
_BASIS_POLICY_ENV = "TAX_BASIS_POLICY"


def _basis_policy() -> str:
    raw = (os.environ.get(_BASIS_POLICY_ENV) or "latest_verified").strip().lower()
    return raw if raw in ("latest_verified", "verified_only") else "latest_verified"


def _table(tax_year: Optional[int]) -> V.LoadedData:
    """The statutory table for `tax_year`. Never unverified; see `_basis_policy`."""
    if _basis_policy() == "verified_only":
        return V.load("tax_tables", tax_year, require_verified=True)
    return V.load_latest_verified("tax_tables", tax_year)


def _carry_forward_note(t: V.LoadedData) -> tuple[Assumption, ...]:
    """A carried-forward table means LAST year's law applied to THIS year's income. That is an
    assumption in the strict sense, so it is cited and it downgrades the result to SCENARIO."""
    if not t.is_carried_forward:
        return ()
    return (Assumption(
        key="tax_table_year",
        value=t.year_used,
        rationale=(f"Computed on {t.year_used} tax law, because the {t.year_requested} tables have "
                   f"not yet been verified against the IRS publication. Bracket thresholds and the "
                   f"standard deduction rise with inflation, so applying earlier, narrower brackets "
                   f"OVERSTATES the tax — the figure is conservative, not flattering."),
        source="caller",
    ),)


def _apply_brackets(taxable: float, brackets: list[dict[str, Any]]) -> tuple[float, float, list[dict]]:
    """Walk a marginal rate schedule. Returns (tax, marginal_rate, per-bracket breakdown).

    `upto` is the TOP of each bracket and the last entry carries `upto: null`. Income is taxed in
    slices: the marginal rate is the rate on the LAST dollar, which is a different number from the
    effective rate and the one every tax-planning decision actually turns on.
    """
    tax = 0.0
    lower = 0.0
    marginal = 0.0
    rows: list[dict[str, Any]] = []
    for b in brackets:
        rate = float(b["rate"])
        upper = b["upto"]
        top = taxable if upper is None else min(taxable, float(upper))
        if top > lower:
            slice_amount = top - lower
            slice_tax = slice_amount * rate
            tax += slice_tax
            marginal = rate
            rows.append({"rate": rate, "from": round(lower, 2), "to": round(top, 2),
                         "taxed": round(slice_amount, 2), "tax": round(slice_tax, 2)})
        if upper is not None:
            lower = float(upper)
            if taxable <= lower:
                break
    return tax, marginal, rows


# ── Federal ordinary income ───────────────────────────────────────────────────────────────────────
@register("tax.federal_income_tax")
def federal_income_tax(*, gross_income: float, filing_status: str,
                       above_the_line_deductions: float = 0.0,
                       itemized_deductions: float = 0.0,
                       tax_year: Optional[int] = None) -> CalcResult:
    """Federal ordinary-income tax, with the marginal and effective rates in `detail`.

    Takes the LARGER of the standard and itemized deductions, which is what a filer does, rather
    than assuming the standard one — `tax.ts` only ever applied the standard deduction.

    `detail` returns both rates on purpose. The effective rate is what was paid; the marginal rate
    is what the next dollar costs. Users conflate them constantly, and every decision this engine
    feeds — Roth conversion, pre-tax contribution, a raise, a Roth-vs-Traditional split — depends on
    the marginal one.
    """
    status = _status(filing_status)
    gross = require_money("gross_income", gross_income)
    atl = require_money("above_the_line_deductions", above_the_line_deductions)
    itemized = require_money("itemized_deductions", itemized_deductions)
    t = _table(tax_year)

    agi = max(0.0, gross - atl)
    standard = float(t.data["standard_deduction"][status])
    deduction = max(standard, itemized)
    taxable = max(0.0, agi - deduction)

    tax, marginal, rows = _apply_brackets(taxable, t.data["ordinary_brackets"][status])
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.federal_income_tax", label="federal income tax",
        value=round(tax, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"gross_income": gross, "filing_status": status,
                     "above_the_line_deductions": atl, "itemized_deductions": itemized,
                     "tax_year": t.year_used},
        assumptions=carried,
        detail={"agi": round(agi, 2), "taxable_income": round(taxable, 2),
                "deduction_taken": round(deduction, 2),
                "deduction_type": "itemized" if itemized > standard else "standard",
                "standard_deduction": standard,
                "marginal_rate": marginal,
                # Effective rate on GROSS, which is the one a user recognises as "my tax rate".
                "effective_rate_on_gross": round(tax / gross, 4) if gross else 0.0,
                "effective_rate_on_taxable": round(tax / taxable, 4) if taxable else 0.0,
                "brackets": rows,
                "table_provenance": t.provenance},
    )


# ── FICA ──────────────────────────────────────────────────────────────────────────────────────────
@register("tax.fica")
def fica(*, wages: float, filing_status: str, tax_year: Optional[int] = None) -> CalcResult:
    """Employee-side Social Security + Medicare, including the Additional Medicare surtax.

    THE WAGE BASE IS WHY THIS NEEDS A CALCULATOR. Social Security stops at a cap, so FICA is
    regressive above it: a $400k earner pays a far smaller SHARE in FICA than a $150k earner, and
    the marginal FICA rate drops from 7.65% to 1.45% the moment wages cross the base. A flat 7.65%
    — the usual shortcut — overstates high-earner payroll tax substantially and gets every
    high-income take-home calculation wrong.

    EMPLOYEE SIDE ONLY. The employer match is not the user's cost. Self-employment tax (both halves
    plus the deductible portion) is a separate calculator and is NOT this one.
    """
    status = _status(filing_status)
    w = require_money("wages", wages)
    t = _table(tax_year)
    f = t.data["fica"]

    base = float(f["social_security_wage_base"])
    ss_rate = float(f["social_security_rate_employee"])
    med_rate = float(f["medicare_rate_employee"])
    addl_rate = float(f["additional_medicare_rate"])
    addl_threshold = float(f["additional_medicare_threshold"][status])

    ss = min(w, base) * ss_rate
    medicare = w * med_rate
    addl = max(0.0, w - addl_threshold) * addl_rate
    total = ss + medicare + addl

    # The marginal FICA rate on the NEXT dollar of wages — the figure the cap makes non-obvious.
    marginal = (ss_rate if w < base else 0.0) + med_rate + (addl_rate if w >= addl_threshold else 0.0)
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.fica", label="FICA (Social Security + Medicare)",
        value=round(total, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"wages": w, "filing_status": status, "tax_year": t.year_used},
        assumptions=carried,
        detail={"social_security": round(ss, 2), "medicare": round(medicare, 2),
                "additional_medicare": round(addl, 2),
                "social_security_wage_base": base,
                "wages_above_wage_base": round(max(0.0, w - base), 2),
                "social_security_capped": w > base,
                "effective_rate": round(total / w, 4) if w else 0.0,
                "marginal_rate": round(marginal, 4),
                "table_provenance": t.provenance},
    )


# ── Capital gains ─────────────────────────────────────────────────────────────────────────────────
@register("tax.capital_gains_tax")
def capital_gains_tax(*, gain: float, filing_status: str, ordinary_taxable_income: float = 0.0,
                      long_term: bool = True, tax_year: Optional[int] = None) -> CalcResult:
    """Tax on a capital gain, long-term or short-term, including NIIT.

    LONG-TERM GAINS STACK ON TOP OF ORDINARY INCOME. The 0/15/20 brackets are measured against
    ordinary taxable income PLUS the gain, not against the gain alone — so the same $50,000 gain can
    be taxed at 0% or 20% depending on the rest of the return. Computing it against the gain in
    isolation is the single most common way this calculation goes wrong, and it goes wrong in the
    user's favour, which makes it worse.

    SHORT-TERM gains are ordinary income, taxed at the marginal ordinary rate — so this delegates to
    the bracket walk rather than applying a separate schedule.
    """
    status = _status(filing_status)
    g = require_money("gain", gain)
    ordinary = require_money("ordinary_taxable_income", ordinary_taxable_income)
    t = _table(tax_year)

    if long_term:
        brackets = t.data["long_term_capital_gains"][status]
        # Tax the stack (ordinary + gain), then subtract the tax the ordinary portion alone would
        # attract at these rates. What remains is the tax attributable to the gain.
        with_gain, _, rows = _apply_brackets(ordinary + g, brackets)
        without_gain, _, _ = _apply_brackets(ordinary, brackets)
        base_tax = with_gain - without_gain
        _, marginal, _ = _apply_brackets(ordinary + g, brackets)
        kind = "long_term"
    else:
        ord_brackets = t.data["ordinary_brackets"][status]
        with_gain, marginal, rows = _apply_brackets(ordinary + g, ord_brackets)
        without_gain, _, _ = _apply_brackets(ordinary, ord_brackets)
        base_tax = with_gain - without_gain
        kind = "short_term"

    niit_cfg = t.data["niit"]
    niit_threshold = float(niit_cfg["threshold"][status])
    niit_rate = float(niit_cfg["rate"])
    # NIIT applies to the lesser of net investment income and MAGI above the threshold.
    magi_over = max(0.0, (ordinary + g) - niit_threshold)
    niit = min(g, magi_over) * niit_rate

    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.capital_gains_tax", label=f"tax on a {kind.replace('_', '-')} capital gain",
        value=round(base_tax + niit, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"gain": g, "filing_status": status,
                     "ordinary_taxable_income": ordinary, "long_term": long_term,
                     "tax_year": t.year_used},
        assumptions=carried,
        detail={"capital_gains_tax": round(base_tax, 2), "niit": round(niit, 2),
                "kind": kind, "marginal_rate": marginal,
                "effective_rate_on_gain": round((base_tax + niit) / g, 4) if g else 0.0,
                "niit_applies": niit > 0, "niit_threshold": niit_threshold,
                "stacked_on_ordinary_income": ordinary,
                "brackets": rows, "table_provenance": t.provenance},
    )


# ── The rate decisions actually need ──────────────────────────────────────────────────────────────
@register("tax.effective_marginal_rate")
def effective_marginal_rate(*, gross_income: float, filing_status: str,
                            wages: Optional[float] = None,
                            above_the_line_deductions: float = 0.0,
                            increment: float = 1000.0,
                            qualifying_children: int = 0, other_dependents: int = 0,
                            include_credits: bool = False,
                            tax_year: Optional[int] = None) -> CalcResult:
    """The TRUE cost of the next dollar: federal + FICA, measured rather than read off a table.

    WHY MEASURED AND NOT LOOKED UP. The statutory bracket rate is not what the next dollar costs. It
    misses the FICA wage-base cliff, the Additional Medicare threshold, and (once credits and
    phase-outs are modelled) every phase-out range — some of which produce a marginal rate well
    above the top statutory rate. So this adds `increment` to income, recomputes the whole return,
    and divides. That is the number Roth-vs-Traditional, a pre-tax contribution and a raise all
    turn on, and it is the one `assumptions.py:marginal_tax_rate` has been standing in for.

    `increment` defaults to $1,000 rather than $1 because the result is used for decisions at that
    scale, and a $1 probe straddling a threshold reports a rate that applies to almost nothing.

    CREDIT PHASE-OUTS (`include_credits=True`) are where the measured approach earns its keep. A
    phase-out is an implicit marginal tax: the child credit sheds $50 per $1,000 above the
    threshold, a 5% implicit surtax inside the band — applied to the AGGREGATE credit, so more
    children lengthen the band rather than steepening the rate. Overlapping phase-outs (child plus
    AOTC) do compound, and a filer sitting inside two of them can face a true marginal rate above
    the top statutory bracket while every bracket table still says 24%. Default OFF because it
    needs verified credit parameters, which the table does not yet have.
    """
    status = _status(filing_status)
    gross = require_money("gross_income", gross_income, allow_zero=False)
    w = gross if wages is None else require_money("wages", wages)
    step = require_money("increment", increment, allow_zero=False)

    def total_at(g: float, wg: float) -> dict[str, float]:
        fed = federal_income_tax(gross_income=g, filing_status=status,
                                 above_the_line_deductions=above_the_line_deductions,
                                 tax_year=tax_year)
        pay = fica(wages=wg, filing_status=status, tax_year=tax_year)
        credits = 0.0
        if include_credits and (qualifying_children or other_dependents):
            credits = tax_credits(
                agi=fed.detail["agi"], filing_status=status,
                tax_before_credits=fed.value, qualifying_children=qualifying_children,
                other_dependents=other_dependents, tax_year=tax_year).value
        # Credits REDUCE tax, so losing them to a phase-out INCREASES the marginal rate.
        return {"federal": fed.value, "fica": pay.value, "credits": credits,
                "total": fed.value + pay.value - credits,
                "statutory_marginal": fed.detail["marginal_rate"]}

    now = total_at(gross, w)
    nxt = total_at(gross + step, w + step)
    rate = (nxt["total"] - now["total"]) / step

    t = _table(tax_year)
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.effective_marginal_rate",
        label="combined marginal rate on your next dollar",
        value=round(rate, 4), unit="pct", tier=SCENARIO if carried else STRICT,
        inputs_used={"gross_income": gross, "wages": w, "filing_status": status,
                     "increment": step, "tax_year": t.year_used},
        assumptions=carried,
        detail={"statutory_bracket_rate": now["statutory_marginal"],
                "federal_component": round((nxt["federal"] - now["federal"]) / step, 4),
                "fica_component": round((nxt["fica"] - now["fica"]) / step, 4),
                # Positive when a phase-out is clawing credits back — an invisible surtax.
                "credit_phase_out_component": round((now["credits"] - nxt["credits"]) / step, 4),
                "credits_included": include_credits,
                # The gap between the statutory bracket and the real marginal rate is the whole
                # point of measuring: it is what a lookup table cannot tell you.
                "exceeds_statutory_by": round(rate - now["statutory_marginal"], 4),
                "current_total_tax": round(now["total"], 2),
                "table_provenance": t.provenance},
    )


@register("tax.bracket_headroom")
def bracket_headroom(*, ordinary_income: float, filing_status: str,
                     ceiling_rate: float = 0.24,
                     above_the_line_deductions: float = 0.0,
                     tax_year: Optional[int] = None) -> CalcResult:
    """How much MORE ordinary income fits before the marginal rate exceeds `ceiling_rate`.

    This is the number a Roth conversion ladder is built from: "fill the 24% bracket" is only
    actionable if you know how much room is left in it this year. It is also what answers "how big
    a bonus can I take before it costs 32%?" and "how much can I realise as a gain this year?".

    Returns ZERO when income already exceeds the ceiling — not a negative number, which would read
    as room. `detail.exceeded_by` carries how far over, because that is the useful follow-up.
    """
    status = _status(filing_status)
    income = require_money("ordinary_income", ordinary_income)
    ceiling = require_rate("ceiling_rate", ceiling_rate)
    atl = require_money("above_the_line_deductions", above_the_line_deductions)
    t = _table(tax_year)

    standard = float(t.data["standard_deduction"][status])
    taxable = max(0.0, income - atl - standard)
    brackets = t.data["ordinary_brackets"][status]

    # Top of the last bracket at or below the ceiling rate.
    top: Optional[float] = None
    for b in brackets:
        if float(b["rate"]) <= ceiling and b["upto"] is not None:
            top = float(b["upto"])
    if top is None:
        raise CalculatorError(
            f"no bracket at or below {ceiling:.0%} for {status}; the lowest rate is "
            f"{float(brackets[0]['rate']):.0%}")

    room = max(0.0, top - taxable)
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.bracket_headroom",
        label=f"room remaining in the {ceiling:.0%} bracket",
        value=round(room, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"ordinary_income": income, "filing_status": status,
                     "ceiling_rate": ceiling, "tax_year": t.year_used},
        assumptions=carried,
        detail={"taxable_income": round(taxable, 2), "bracket_top": top,
                "standard_deduction": standard,
                "exceeded_by": round(max(0.0, taxable - top), 2),
                "already_above_ceiling": taxable > top,
                "table_provenance": t.provenance},
    )


@register("tax.standard_vs_itemized")
def standard_vs_itemized(*, filing_status: str, itemized_deductions: float,
                         tax_year: Optional[int] = None) -> CalcResult:
    """How much itemizing is worth, in deduction dollars. Zero when the standard deduction wins.

    Post-TCJA the standard deduction is high enough that itemizing rarely helps, and a user who
    tracked receipts all year deserves to be told that directly rather than left to infer it.
    """
    status = _status(filing_status)
    itemized = require_money("itemized_deductions", itemized_deductions)
    t = _table(tax_year)
    standard = float(t.data["standard_deduction"][status])
    benefit = max(0.0, itemized - standard)
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.standard_vs_itemized", label="extra deduction from itemizing",
        value=round(benefit, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"filing_status": status, "itemized_deductions": itemized,
                     "tax_year": t.year_used},
        assumptions=carried,
        detail={"standard_deduction": standard, "itemized_deductions": itemized,
                "should_itemize": benefit > 0,
                "shortfall_to_itemize": round(max(0.0, standard - itemized), 2),
                "table_provenance": t.provenance},
    )




# ── State table structural validation ─────────────────────────────────────────────────────────────
# WHY THIS EXISTS, WHEN THE DATA IS UNVERIFIED ANYWAY
# ---------------------------------------------------
# Verification answers "is 4.95% the right rate for Illinois?" — a question only a primary source
# can settle. Validation answers "is this schedule even well-formed?" — and that question is
# answerable here, exhaustively, and it is where the errors actually happen. Transcribing 29 states
# x 4 filing statuses x up to 9 brackets by hand is thousands of numbers; a threshold typed out of
# order, a rate entered as 4.95 instead of 0.0495, a missing top bracket or a filing status left out
# are all silent in a rate table and loud here.
#
# A malformed schedule does not merely error — it quietly computes the WRONG tax. A descending
# threshold truncates the bracket walk early and undercharges; a rate entered as a percent charges
# 100x. So `state_income_tax` validates the specific state it is about to use on every call, and a
# drift gate validates all of them.

_MAX_PLAUSIBLE_STATE_RATE = 0.20   # no US state income tax rate approaches this


def _validate_schedule(where: str, brackets: Any) -> list[str]:
    problems: list[str] = []
    if not isinstance(brackets, list) or not brackets:
        return [f"{where}: schedule must be a non-empty list"]

    prev_top: Optional[float] = None
    prev_rate: Optional[float] = None
    for idx, b in enumerate(brackets):
        if not isinstance(b, dict) or "rate" not in b or "upto" not in b:
            problems.append(f"{where}[{idx}]: each bracket needs 'rate' and 'upto'")
            continue
        try:
            rate = float(b["rate"])
        except (TypeError, ValueError):
            problems.append(f"{where}[{idx}]: rate {b['rate']!r} is not a number")
            continue

        if rate < 0:
            problems.append(f"{where}[{idx}]: negative rate {rate}")
        elif rate > _MAX_PLAUSIBLE_STATE_RATE:
            # The classic transcription error: 4.95 meaning 4.95%, which would charge 495%.
            problems.append(
                f"{where}[{idx}]: rate {rate} exceeds {_MAX_PLAUSIBLE_STATE_RATE} — looks like a "
                f"percent, not a decimal fraction (pass {rate / 100:g} for {rate:g}%)")
        if prev_rate is not None and rate < prev_rate:
            # A progressive schedule never steps down. This one is worth catching because the
            # bracket walk would still "work" and simply charge the wrong amount.
            problems.append(
                f"{where}[{idx}]: rate {rate} is BELOW the previous bracket's {prev_rate} — a "
                f"progressive schedule never steps down")
        prev_rate = rate

        upto = b["upto"]
        is_last = idx == len(brackets) - 1
        if upto is None:
            if not is_last:
                problems.append(f"{where}[{idx}]: only the LAST bracket may have upto: null")
        else:
            try:
                top = float(upto)
            except (TypeError, ValueError):
                problems.append(f"{where}[{idx}]: upto {upto!r} is not a number")
                continue
            if top <= 0:
                problems.append(f"{where}[{idx}]: upto must be positive, got {top}")
            if prev_top is not None and top <= prev_top:
                # Descending or duplicate thresholds truncate the walk early and UNDERCHARGE.
                problems.append(
                    f"{where}[{idx}]: upto {top} is not above the previous {prev_top} — "
                    f"thresholds must strictly ascend or the bracket walk stops early")
            prev_top = top
            if is_last:
                problems.append(
                    f"{where}[{idx}]: the last bracket must have upto: null (an open top bracket), "
                    f"got {top} — income above it would be untaxed")
    return problems


def validate_state_table(data: dict[str, Any], *, state: Optional[str] = None) -> list[str]:
    """Structural problems in a state tax table. Empty list means well-formed.

    `state` limits the check to one state, which is what the calculator uses per call.
    """
    problems: list[str] = []
    no_tax = set((data.get("no_income_tax") or {}).get("states") or [])
    flat = data.get("flat") or {}
    bracketed = data.get("bracketed") or {}

    # A state in two sections is a contradiction, and which one wins would be arbitrary.
    for a_name, a, b_name, b in (("no_income_tax", no_tax, "flat", set(flat)),
                                 ("no_income_tax", no_tax, "bracketed", set(bracketed)),
                                 ("flat", set(flat), "bracketed", set(bracketed))):
        both = a & b
        if both and (state is None or state in both):
            problems.append(
                f"{sorted(both)} appear in BOTH {a_name} and {b_name} — a state cannot be two "
                f"regimes at once")

    for code, entry in sorted(flat.items()):
        if state is not None and code != state:
            continue
        if "verified" not in entry:
            problems.append(f"flat.{code}: missing a 'verified' flag")
        try:
            rate = float(entry.get("rate"))
        except (TypeError, ValueError):
            problems.append(f"flat.{code}: rate {entry.get('rate')!r} is not a number")
            continue
        if rate < 0 or rate > _MAX_PLAUSIBLE_STATE_RATE:
            problems.append(
                f"flat.{code}: rate {rate} is outside 0-{_MAX_PLAUSIBLE_STATE_RATE} — likely a "
                f"percent rather than a decimal fraction")

    for code, entry in sorted(bracketed.items()):
        if state is not None and code != state:
            continue
        if "verified" not in entry:
            problems.append(f"bracketed.{code}: missing a 'verified' flag")
        schedules = entry.get("brackets") or {}
        missing = [s for s in FILING_STATUSES if s not in schedules]
        if missing:
            problems.append(
                f"bracketed.{code}: missing schedules for {missing} — a filer with that status "
                f"would get a KeyError mid-request")
        for status in FILING_STATUSES:
            if status in schedules:
                problems.extend(_validate_schedule(f"bracketed.{code}.{status}", schedules[status]))
    return problems


# ── State income tax ──────────────────────────────────────────────────────────────────────────────
class UnmodelledStateError(CalculatorError):
    """This state's tax law is not in the table.

    A DISTINCT error type because the honest response differs from every other failure here: the
    advisor should say "I don't model <state> yet, so this figure is federal only", which is useful,
    rather than "something went wrong". The alternative — treating an unmodelled state as zero —
    would understate a Californian's total tax by five figures while looking like a complete answer.
    """


@register("tax.state_income_tax")
def state_income_tax(*, taxable_income: float, state: str, filing_status: str = "single",
                     tax_year: Optional[int] = None) -> CalcResult:
    """State income tax on wage income. Raises rather than guessing.

    PER-STATE VERIFICATION. Confidence genuinely differs across this table: "Texas has no income
    tax" is statutory and stable, while "Illinois is 4.95%" is a number a legislature changes. So
    the no-income-tax list is verified and usable now, and each rate-bearing state carries its own
    `verified` flag — unverified ones raise instead of quoting.

    WHAT THIS DOES NOT MODEL, and says so: local and city taxes (Detroit, Philadelphia's EIT,
    Indiana's county add-ons), state-specific deductions, credits and exemptions, and the separate
    capital-gains regimes in WA and NH. A flat-rate result here is the state's headline rate applied
    to federal taxable income, which is an approximation for any state whose taxable base differs
    from the federal one — stated in `limitations` rather than implied away.
    """
    code = str(state or "").strip().upper()
    if not code:
        raise CalculatorError("state is required")
    income = require_money("taxable_income", taxable_income)
    status = _status(filing_status)
    t = V.load("state_tax", tax_year, require_verified=True)
    data = t.data
    carried = _carry_forward_note(t)

    # Validate the ONE state about to be used, on every call. A malformed schedule does not error
    # on its own — it quietly computes the wrong tax — so this must gate the figure, not just CI.
    structural = validate_state_table(data, state=code)
    if structural:
        raise CalculatorError(
            f"{code}'s {t.year_used} schedule is malformed and would compute the wrong tax: "
            + "; ".join(structural[:4])
        )

    no_tax = data.get("no_income_tax") or {}
    if code in (no_tax.get("states") or []):
        if not no_tax.get("verified"):
            raise V.UnverifiedDataError(
                f"the no-income-tax list for {t.year_used} is not verified; check it before "
                f"reporting {code} as zero"
            )
        return CalcResult(
            calculator="tax.state_income_tax", label=f"{code} state income tax",
            value=0.0, unit="usd", tier=SCENARIO if carried else STRICT,
            inputs_used={"taxable_income": income, "state": code, "filing_status": status,
                         "tax_year": t.year_used},
            assumptions=carried,
            detail={"regime": "no_income_tax", "rate": 0.0,
                    "caveat": (no_tax.get("caveats") or {}).get(code),
                    "excludes": ["local_city_taxes"],
                    "table_provenance": t.provenance},
        )

    flat = (data.get("flat") or {}).get(code)
    if flat is not None:
        if not flat.get("verified"):
            raise V.UnverifiedDataError(
                f"{code}'s rate ({flat.get('rate')}) is in the table but NOT verified — "
                f"{flat.get('note') or 'check it against the state revenue department'}. "
                f"Refusing to quote a state tax figure from an unverified rate."
            )
        rate = float(flat["rate"])
        return CalcResult(
            calculator="tax.state_income_tax", label=f"{code} state income tax",
            value=round(income * rate, 2), unit="usd", tier=SCENARIO if carried else STRICT,
            inputs_used={"taxable_income": income, "state": code, "filing_status": status,
                         "tax_year": t.year_used},
            assumptions=carried,
            detail={"regime": "flat", "rate": rate,
                    "excludes": ["local_city_taxes", "state_specific_deductions",
                                 "state_credits", "state_exemptions"],
                    "note": "headline rate applied to FEDERAL taxable income; states whose taxable "
                            "base differs from the federal one will diverge",
                    "table_provenance": t.provenance},
        )

    bracketed = (data.get("bracketed") or {}).get(code)
    if bracketed is not None:
        if not bracketed.get("verified"):
            raise V.UnverifiedDataError(
                f"{code}'s bracket schedule is in the table but NOT verified — refusing to quote it"
            )
        brackets = bracketed["brackets"][status]
        tax, marginal, rows = _apply_brackets(income, brackets)
        return CalcResult(
            calculator="tax.state_income_tax", label=f"{code} state income tax",
            value=round(tax, 2), unit="usd", tier=SCENARIO if carried else STRICT,
            inputs_used={"taxable_income": income, "state": code, "filing_status": status,
                         "tax_year": t.year_used},
            assumptions=carried,
            detail={"regime": "bracketed", "marginal_rate": marginal, "brackets": rows,
                    "effective_rate": round(tax / income, 4) if income else 0.0,
                    "excludes": ["local_city_taxes", "state_specific_deductions",
                                 "state_credits", "state_exemptions"],
                    "table_provenance": t.provenance},
        )

    modelled = sorted(set(no_tax.get("states") or []) | set(data.get("flat") or {})
                      | set(data.get("bracketed") or {}))
    raise UnmodelledStateError(
        f"{code} is not modelled for {t.year_used}. Modelled: {', '.join(modelled)}. "
        f"Report the federal figure and say the state portion is not included — do NOT treat "
        f"{code} as having no income tax."
    )


# ── Credits ───────────────────────────────────────────────────────────────────────────────────────
# WHY CREDITS BELONG IN THE *MARGINAL RATE*, NOT JUST THE TAX TOTAL
# -----------------------------------------------------------------
# A credit phase-out is an implicit marginal tax. The child credit sheds $50 per $1,000 of income
# above the threshold — a 5% implicit surtax inside the band. Note that the statutory reduction
# applies to the AGGREGATE credit, not per child, so a third child does NOT make the phase-out
# steeper; it makes it LONGER. Two children at $2,000 each exhaust over an $80,000 band, three over
# $120,000. The rate is 5% either way, and getting that backwards overstates the surtax for large
# families by a multiple.
#
# The AOTC phases out ratably over its own $10,000 band, which can stack on top. Add a 24% bracket
# plus 7.65% FICA and the true cost of the next dollar runs well above what any bracket table shows.
#
# That is the whole reason `effective_marginal_rate` MEASURES by re-running the return instead of
# reading a bracket. Credits are the largest source of the gap between the two, and they are also
# where the gap is least intuitive: the band is invisible, it moves with family size, and crossing
# it can make a raise worth less than nothing.
#
# The saver's credit is worse still — a CLIFF, not a phase-out. One dollar of AGI over a tier
# ceiling drops the rate from 50% to 20%, so a $1 raise can cost $600 of credit. That is a marginal
# rate of 60,000%, and it is real.

_CREDIT_SECTION = "credits"


def _credits_cfg(t: V.LoadedData) -> dict[str, Any]:
    cfg = t.data.get(_CREDIT_SECTION)
    if not cfg:
        raise CalculatorError(
            f"the {t.year_used} tax table has no `credits` section — credits cannot be computed"
        )
    if not cfg.get("verified"):
        raise V.UnverifiedDataError(
            f"the {t.year_used} credit parameters are NOT verified — "
            f"{cfg.get('verify_against') or 'check against the IRS publications'}. "
            f"Unlike the ordinary brackets, credits have no independent cross-check in this repo, "
            f"so nothing here may produce a user-facing figure yet."
        )
    return cfg


def _staircase_phase_out(amount: float, agi: float, start: float, per_1000: float) -> float:
    """CTC-style reduction: `per_1000` lost per $1,000 OR FRACTION above `start`.

    The fraction rounding is statutory, and it makes the reduction a STAIRCASE rather than a ramp —
    $1 over a $1,000 boundary costs the full $50. Treating it as linear understates the credit lost
    at every point inside a step, and hides the small cliffs entirely.
    """
    if agi <= start:
        return amount
    import math
    steps = math.ceil((agi - start) / 1000.0)
    return max(0.0, amount - steps * per_1000)


def _ratable_phase_out(amount: float, agi: float, lo: float, hi: float) -> float:
    """AOTC/LLC-style: reduced linearly across [lo, hi], zero at or above `hi`.

    `hi <= lo` means the credit is unavailable for this filing status (MFS cannot claim AOTC), which
    is expressed in the table as a [0, 0] range rather than a special case here.
    """
    if hi <= lo:
        return 0.0
    if agi <= lo:
        return amount
    if agi >= hi:
        return 0.0
    return amount * (1.0 - (agi - lo) / (hi - lo))


@register("tax.tax_credits")
def tax_credits(*, agi: float, filing_status: str, tax_before_credits: float = 0.0,
                qualifying_children: int = 0, other_dependents: int = 0,
                aotc_students: int = 0, aotc_expenses_per_student: float = 0.0,
                llc_expenses: float = 0.0, retirement_contributions: float = 0.0,
                tax_year: Optional[int] = None) -> CalcResult:
    """Federal credits: child, other-dependent, AOTC, LLC, saver's.

    REFUNDABLE VS NONREFUNDABLE ORDERING MATTERS. Nonrefundable credits can only reduce liability to
    zero; refundable ones pay out beyond it. `tax.ts` set `totalCredits = 0`, so a family with two
    children was shown $4,000 more tax than they owe — the single largest error in that engine for
    anyone with dependents.

    EITC is deliberately NOT included: its phase-in/phase-out parameters are the least reliable
    figures in the table, it is fully refundable, and it targets filers least able to absorb an
    error. It is gated behind `credits.earned_income_credit.enabled` and stays off until sourced.
    """
    status = _status(filing_status)
    income = require_money("agi", agi)
    liability = require_money("tax_before_credits", tax_before_credits)
    t = _table(tax_year)
    cfg = _credits_cfg(t)

    children = int(qualifying_children)
    others = int(other_dependents)
    students = int(aotc_students)
    if min(children, others, students) < 0:
        raise CalculatorError("dependent and student counts must not be negative")

    rows: list[dict[str, Any]] = []
    nonrefundable = 0.0
    refundable = 0.0

    # ── Child + other-dependent credit (shared phase-out) ──
    ctc_cfg = cfg["child_tax_credit"]
    odc_cfg = cfg["other_dependent_credit"]
    start = float(ctc_cfg["phase_out_start"][status])
    per_1000 = float(ctc_cfg["phase_out_per_1000"])
    gross_family = children * float(ctc_cfg["per_child"]) + others * float(odc_cfg["per_dependent"])
    if gross_family > 0:
        after = _staircase_phase_out(gross_family, income, start, per_1000)
        # The refundable ceiling applies per child, and only to the child portion.
        refundable_cap = children * float(ctc_cfg["refundable_per_child"])
        ref = min(after, refundable_cap)
        nonref = after - ref
        nonrefundable += nonref
        refundable += ref
        rows.append({"credit": "child_and_dependent", "gross": round(gross_family, 2),
                     "after_phase_out": round(after, 2),
                     "lost_to_phase_out": round(gross_family - after, 2),
                     "refundable": round(ref, 2), "nonrefundable": round(nonref, 2),
                     "in_phase_out_band": start < income and after > 0,
                     "phase_out_start": start})

    # ── AOTC (per student) ──
    if students > 0:
        a = cfg["american_opportunity_credit"]
        lo, hi = (float(x) for x in a["phase_out"][status])
        exp = require_money("aotc_expenses_per_student", aotc_expenses_per_student)
        per = min(
            float(a["max_per_student"]),
            min(exp, float(a["first_tier_expenses"])) * float(a["first_tier_rate"])
            + max(0.0, min(exp - float(a["first_tier_expenses"]),
                           float(a["second_tier_expenses"]))) * float(a["second_tier_rate"]),
        )
        gross = per * students
        after = _ratable_phase_out(gross, income, lo, hi)
        ref = after * float(a["refundable_share"])
        nonrefundable += after - ref
        refundable += ref
        rows.append({"credit": "american_opportunity", "gross": round(gross, 2),
                     "after_phase_out": round(after, 2),
                     "lost_to_phase_out": round(gross - after, 2),
                     "refundable": round(ref, 2), "nonrefundable": round(after - ref, 2),
                     "in_phase_out_band": lo < income < hi, "phase_out_range": [lo, hi],
                     "unavailable_for_status": hi <= lo})

    # ── LLC (per return) ──
    if llc_expenses:
        l_cfg = cfg["lifetime_learning_credit"]
        lo, hi = (float(x) for x in l_cfg["phase_out"][status])
        exp = require_money("llc_expenses", llc_expenses)
        gross = min(float(l_cfg["max_per_return"]),
                    min(exp, float(l_cfg["qualified_expense_cap"])) * float(l_cfg["rate"]))
        after = _ratable_phase_out(gross, income, lo, hi)
        nonrefundable += after
        rows.append({"credit": "lifetime_learning", "gross": round(gross, 2),
                     "after_phase_out": round(after, 2),
                     "lost_to_phase_out": round(gross - after, 2),
                     "refundable": 0.0, "nonrefundable": round(after, 2),
                     "in_phase_out_band": lo < income < hi, "phase_out_range": [lo, hi],
                     "unavailable_for_status": hi <= lo})

    # ── Saver's credit (a CLIFF) ──
    if retirement_contributions:
        s_cfg = cfg["savers_credit"]
        contrib = min(require_money("retirement_contributions", retirement_contributions),
                      float(s_cfg["contribution_cap"]))
        rate = 0.0
        next_ceiling: Optional[float] = None
        for ceiling, tier_rate in s_cfg["tiers"][status]:
            if income <= float(ceiling):
                rate = float(tier_rate)
                break
            next_ceiling = float(ceiling)
        amount = contrib * rate
        nonrefundable += amount
        rows.append({"credit": "savers", "gross": round(amount, 2),
                     "after_phase_out": round(amount, 2), "lost_to_phase_out": 0.0,
                     "refundable": 0.0, "nonrefundable": round(amount, 2),
                     "rate": rate, "is_cliff": True,
                     "last_ceiling_passed": next_ceiling,
                     "note": "a cliff, not a phase-out — one dollar of AGI can cost the whole credit"})

    # Nonrefundable credits cannot take liability below zero.
    nonref_applied = min(nonrefundable, liability)
    total = nonref_applied + refundable
    carried = _carry_forward_note(t)
    return CalcResult(
        calculator="tax.tax_credits", label="federal tax credits",
        value=round(total, 2), unit="usd", tier=SCENARIO if carried else STRICT,
        inputs_used={"agi": income, "filing_status": status,
                     "tax_before_credits": liability,
                     "qualifying_children": children, "other_dependents": others,
                     "aotc_students": students, "llc_expenses": llc_expenses,
                     "retirement_contributions": retirement_contributions,
                     "tax_year": t.year_used},
        assumptions=carried,
        detail={"credits": rows,
                "nonrefundable_earned": round(nonrefundable, 2),
                "nonrefundable_applied": round(nonref_applied, 2),
                # The part users are never told: a nonrefundable credit they "qualified" for and
                # could not use, because their liability ran out first.
                "nonrefundable_wasted": round(nonrefundable - nonref_applied, 2),
                "refundable": round(refundable, 2),
                "total_lost_to_phase_outs": round(sum(r["lost_to_phase_out"] for r in rows), 2),
                "in_any_phase_out_band": any(r.get("in_phase_out_band") for r in rows),
                "eitc_excluded": "EITC is gated off — its parameters are unverified and it is fully "
                                 "refundable, so an error lands on the filers least able to absorb it",
                "table_provenance": t.provenance},
    )


# ── Itemized deductions, with the caps actually applied ───────────────────────────────────────────
#
# WHY THIS EXISTS RATHER THAN A SUM IN THE RESOLVER
# ------------------------------------------------
# `standard_vs_itemized` takes ONE figure, so something has to turn a user's receipts into it. The
# obvious move — add up mortgage interest, state and local taxes, charity and medical — is wrong by
# thousands of dollars, because three of those four are capped or floored:
#
#   * STATE AND LOCAL TAXES are capped (IRC 164(b)(6)). For 2026 the cap is $40,400, but it phases
#     DOWN by 30 cents per dollar of MAGI above $505,000 and never below $10,000. A high earner in
#     a high-tax state who paid $60,000 of SALT may deduct $10,000 of it.
#   * MEDICAL EXPENSES only count above 7.5% of AGI (IRC 213(a)). A household with $100,000 of AGI
#     and $6,000 of medical bills deducts nothing.
#   * MORTGAGE INTEREST is limited to interest on $750,000 of acquisition debt, which
#     `tax_debt_interest` already models.
#
# Summing the raw components would overstate the itemized total and tell someone to itemize — and
# to spend money chasing deductions — when the standard deduction actually wins. That is advice
# that costs the user real money, which is why the caps live in the engine and not in a comment.
_SALT_PHASE_DOWN_SUNSET_YEAR = 2029


@register("tax.itemized_deductions")
def itemized_deductions(*, filing_status: str, agi: float,
                        state_local_taxes: float = 0.0,
                        mortgage_interest: float = 0.0,
                        charitable_contributions: float = 0.0,
                        medical_expenses: float = 0.0,
                        other_itemized: float = 0.0,
                        magi: Optional[float] = None,
                        tax_year: Optional[int] = None) -> CalcResult:
    """The deductible itemized total, after the SALT cap and the medical AGI floor.

    `magi` defaults to `agi` for the SALT phase-down, which is correct for the great majority of
    filers — the modifications only matter with foreign or possession income.
    """
    status = _status(filing_status)
    agi_v = require_money("agi", agi)
    magi_v = require_money("magi", magi) if magi is not None else agi_v
    salt_paid = require_money("state_local_taxes", state_local_taxes)
    interest = require_money("mortgage_interest", mortgage_interest)
    charity = require_money("charitable_contributions", charitable_contributions)
    medical_paid = require_money("medical_expenses", medical_expenses)
    other = require_money("other_itemized", other_itemized)

    p = V.load("tax_parameters", tax_year)
    it = p.data["itemized"]

    # SALT: cap, then phase the cap down, then floor it.
    cap = float(it["salt_cap"][status])
    threshold = float(it["salt_phase_down_threshold"][status])
    floor = float(it["salt_floor"][status])
    rate = float(it["salt_phase_down_rate"])
    reduced_cap = cap
    if magi_v > threshold:
        reduced_cap = max(floor, cap - rate * (magi_v - threshold))
    salt_allowed = min(salt_paid, reduced_cap)

    # Medical: only the excess over the AGI floor counts.
    med_floor_rate = float(it["medical_agi_floor"])
    med_floor = agi_v * med_floor_rate
    medical_allowed = max(0.0, medical_paid - med_floor)

    total = salt_allowed + interest + charity + medical_allowed + other

    t = _table(tax_year)
    standard = float(t.data["standard_deduction"][status])

    # CROSS-YEAR MIXING, MADE VISIBLE RATHER THAN ABSORBED.
    #
    # `tax_tables` is verification-gated and falls back to the newest VERIFIED year; `tax_parameters`
    # is not, by deliberate design (the rule matters more than the threshold). The consequence is
    # that this one comparison can put a 2026 SALT cap against a 2024 standard deduction — and in
    # that direction the standard deduction is too LOW, so `should_itemize` is biased toward
    # itemizing. Observed live: a $40,400 cap compared against $29,200 instead of $32,200.
    #
    # So when the years diverge, the verdict is recomputed against the parameter year's own
    # standard deduction and reported as ROBUST only if both years agree. A verdict that flips is
    # not a verdict, and saying so is the only honest option.
    years_mixed = p.year_used != t.year_used
    standard_param_year: Optional[float] = None
    verdict_robust = True
    if years_mixed:
        try:
            alt = V.load("tax_tables", p.year_used)
            standard_param_year = float(alt.data["standard_deduction"][status])
        except Exception:  # noqa: BLE001 — the parameter year may have no table at all
            standard_param_year = None

    # IRC 68, new for 2026: itemized deductions are reduced for taxpayers in the top bracket. NOT
    # modelled — so rather than quietly overstating the benefit for exactly the households most
    # likely to itemize, exposure is DETECTED and said out loud.
    top_rate = float(it["section_68_bracket"])
    # The table stores each bracket's CEILING (`upto`, null for the top one), so the 37% bracket
    # BEGINS where the 35% bracket ends — the previous row's ceiling, not a `threshold` field.
    rows = t.data["ordinary_brackets"][status]
    top_threshold = None
    for i, b in enumerate(rows):
        if abs(float(b["rate"]) - top_rate) < 1e-9 and i > 0:
            top_threshold = float(rows[i - 1]["upto"])
            break
    section_68_applies = top_threshold is not None and agi_v > top_threshold

    if standard_param_year is not None:
        verdict_robust = (total > standard) == (total > standard_param_year)

    limitations = [
        "Mortgage interest is passed through as given; the $750,000 acquisition-debt limit is "
        "applied by tax_debt_interest.mortgage_interest_deductible, not here.",
        "Charitable contributions are passed through as given; the AGI percentage limits "
        "(60%/30%/20% by gift and donee type) are not modelled.",
    ]
    if years_mixed and standard_param_year is not None and not verdict_robust:
        limitations.append(
            f"THE ITEMIZE/STANDARD VERDICT IS NOT ROBUST. The caps come from {p.year_used} but the "
            f"verified standard deduction is {t.year_used}'s (${standard:,.0f} vs "
            f"${standard_param_year:,.0f} for {p.year_used}). The answer FLIPS between them, so "
            f"this is not yet a decision — it needs the {p.year_used} table verified.")
    elif years_mixed and standard_param_year is not None:
        limitations.append(
            f"The caps are {p.year_used} figures and the verified standard deduction is "
            f"{t.year_used}'s (${standard:,.0f} vs ${standard_param_year:,.0f}), but the verdict "
            f"is the same either way, so the conclusion holds.")
    if section_68_applies:
        limitations.append(
            f"IRC 68 APPLIES AND IS NOT MODELLED. From 2026 itemized deductions are reduced by "
            f"2/37 of the lesser of the itemized total or the excess of taxable income over the "
            f"{top_rate:.0%} bracket threshold (${top_threshold:,.0f}). This AGI is above that "
            f"threshold, so the figure here OVERSTATES the deduction. Have a CPA confirm it.")

    assumptions = list(_carry_forward_note(t))
    if not p.data.get("_meta", {}).get("verified"):
        assumptions.append(Assumption(
            key="itemized_parameters_unverified", value=p.year_used,
            rationale=(f"The {p.year_used} SALT cap, phase-down threshold and medical floor are "
                       f"sourced but not yet verified by a human.")))
    if magi is None and magi_v > threshold:
        assumptions.append(Assumption(
            key="magi_equals_agi", value=round(agi_v, 2),
            rationale=("MAGI was not supplied, so AGI stands in for it in the SALT phase-down. "
                       "They differ only with foreign or US-possession income.")))

    return CalcResult(
        calculator="tax.itemized_deductions",
        label="deductible itemized total",
        value=round(total, 2), unit="usd",
        tier=SCENARIO if assumptions else STRICT,
        inputs_used={"filing_status": status, "agi": agi_v, "magi": magi_v,
                     "state_local_taxes": salt_paid, "mortgage_interest": interest,
                     "charitable_contributions": charity, "medical_expenses": medical_paid,
                     "other_itemized": other, "tax_year": t.year_used},
        assumptions=tuple(assumptions),
        detail={
            "salt_paid": round(salt_paid, 2),
            "salt_allowed": round(salt_allowed, 2),
            "salt_cap": round(cap, 2),
            "salt_cap_after_phase_down": round(reduced_cap, 2),
            "salt_disallowed": round(salt_paid - salt_allowed, 2),
            "salt_phase_down_applies": magi_v > threshold,
            "salt_cap_reverts_to_floor_after": _SALT_PHASE_DOWN_SUNSET_YEAR,
            "medical_paid": round(medical_paid, 2),
            "medical_floor": round(med_floor, 2),
            "medical_allowed": round(medical_allowed, 2),
            "medical_disallowed": round(medical_paid - medical_allowed, 2),
            "mortgage_interest": round(interest, 2),
            "charitable_contributions": round(charity, 2),
            "other_itemized": round(other, 2),
            "standard_deduction": standard,
            "should_itemize": total > standard,
            "benefit_over_standard": round(max(0.0, total - standard), 2),
            "shortfall_to_itemize": round(max(0.0, standard - total), 2),
            "parameter_year": p.year_used,
            "standard_deduction_year": t.year_used,
            "years_mixed": years_mixed,
            "standard_deduction_parameter_year": standard_param_year,
            "verdict_robust_across_years": verdict_robust,
            "section_68_applies": section_68_applies,
            "section_68_threshold": top_threshold,
            "limitations": limitations,
            "parameters_provenance": p.provenance,
            "table_provenance": t.provenance,
        },
    )
