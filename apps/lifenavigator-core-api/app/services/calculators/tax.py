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
)

FILING_STATUSES = ("single", "married_jointly", "married_separately", "head_of_household")


def _status(value: Any) -> str:
    s = str(value or "").strip().lower()
    if s not in FILING_STATUSES:
        raise CalculatorError(
            f"filing_status must be one of {FILING_STATUSES}, got {value!r}"
        )
    return s


def _table(tax_year: Optional[int]) -> V.LoadedData:
    """The statutory table for `tax_year`, refusing anything unverified."""
    return V.load("tax_tables", tax_year, require_verified=True)


def _carry_forward_note(t: V.LoadedData) -> tuple[Assumption, ...]:
    """A carried-forward table means LAST year's law applied to THIS year's income. That is an
    assumption in the strict sense, so it is cited and it downgrades the result to SCENARIO."""
    if not t.is_carried_forward:
        return ()
    return (Assumption(
        key="tax_table_year",
        value=t.year_used,
        rationale=(f"The {t.year_requested} tables are not loaded, so {t.year_used} figures are "
                   f"applied. Bracket thresholds move with inflation each year, so this understates "
                   f"the bracket boundaries and slightly overstates the tax."),
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
        return {"federal": fed.value, "fica": pay.value, "total": fed.value + pay.value,
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
                # The gap between the statutory bracket and the real marginal rate is the whole
                # point of measuring: it is what a lookup table cannot tell you.
                "exceeds_statutory_by": round(rate - now["statutory_marginal"], 4),
                "current_total_tax": round(now["total"], 2),
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
