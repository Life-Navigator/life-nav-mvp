"""VA disability compensation and DIC (Phase F).

WHY THIS IS NOT A FORMULA
-------------------------
There is no formula. VA compensation is a published RATE TABLE indexed by combined disability
rating and by dependent status, and the only way to get a veteran's number right is to look it up.
Every tool that "estimates" VA pay by multiplying a rating by something is wrong, and wrong in a way
that looks plausible.

THE THREE FACTS THAT MAKE THIS WORTH HAVING
-------------------------------------------
1. **It is entirely tax-free** — 26 U.S.C. 104(a)(4) excludes it from gross income, and
   38 U.S.C. 5301(a) protects it. So it never appears in AGI, which means it never appears in MAGI
   either. A veteran with $4,000/month of compensation has that income pushing NOTHING: not the
   taxability of their Social Security, not an IRMAA bracket, not an ACA cliff, not a Roth
   conversion into the next bracket. That makes a dollar of VA compensation worth materially more
   than a dollar of pension or a dollar of IRA withdrawal, and it changes the whole withdrawal and
   conversion plan. No general-purpose planning tool models this.

2. **Ratings do not add.** 38 CFR 4.25 combines them against remaining efficiency: a 60% and a 30%
   rating is 72%, rounded to 70% — not 90%. Veterans consistently over-estimate their combined
   rating, and the gap is money.

3. **It stops at death and does NOT pass to a spouse.** The survivor analogue is DIC, a different
   and much smaller schedule with its own eligibility test. The Social Security survivor step-up
   has no equivalent here, and assuming one overstates a surviving spouse's income by thousands a
   month — the exact mistake that leaves a widow short.

TIERING, AND WHY IT SELF-CORRECTS
---------------------------------
Applying a published statutory table to a veteran's own rating and dependents is arithmetic on
their data, so the figure is STRICT — but only once the table is verified. While `_meta.verified`
is false the loader's state is recorded as an Assumption, and `CalcResult`'s own guard then forces
the result to SCENARIO. Flipping the table to verified promotes every figure to STRICT with no code
change.

NOT MODELLED, STATED PLAINLY
----------------------------
Special Monthly Compensation (SMC K-S, 38 CFR 3.350), the bilateral factor (38 CFR 4.26), DIC for
dependent parents, and VA Pension (a separate income-tested program). TDIU needs no special case:
it pays at the 100% rate, so pass `rating=100`.
"""
from __future__ import annotations

from typing import Any, Optional, Sequence

from . import versioned_data as V
from .base import (
    SCENARIO,
    STRICT,
    Assumption,
    CalcResult,
    CalculatorError,
    register,
)

_FAMILY = "va_disability"

# 38 U.S.C. 1115 — additional compensation for dependents requires a rating of at least 30%. A 20%
# veteran with a spouse and three children receives the 20% rate and nothing more.
DEPENDENT_FLOOR_RATING = 30

# 38 CFR 4.25: the schedule assigns individual ratings in 10-percent degrees.
_RATING_STEP = 10


def _table(year: Optional[int] = None) -> V.LoadedData:
    """The rate table for the year the rates are PAYABLE.

    Loaded without `require_verified` on purpose: an unverified table still produces a usable
    figure, it just produces a SCENARIO one. Refusing outright would leave the advisor unable to
    state a veteran's own benefit at all, which is worse than stating it with the hedge attached.
    """
    return V.load(_FAMILY, year)


def _provenance(t: V.LoadedData) -> tuple[Assumption, ...]:
    """Assumptions implied by the DATA rather than by the calculation.

    Two can apply. A carried-forward table means last year's rates quoted for this year — which
    happens every December, because VA rates change on 1 December. An unverified table means nobody
    has yet checked the transcription against va.gov.
    """
    out: list[Assumption] = []
    meta = t.data.get("_meta", {})
    if t.year_used != t.year_requested:
        out.append(Assumption(
            key="va_rate_year",
            value=t.year_used,
            rationale=(f"VA rates for {t.year_requested} are not loaded, so the {t.year_used} table is "
                 f"used. Rates change every 1 December by the Social Security COLA "
                 f"(38 U.S.C. 5312), so this figure is one adjustment behind."),
        ))
    if not meta.get("verified"):
        out.append(Assumption(
            key="va_rates_unverified",
            value=False,
            rationale=(f"The {t.year_used} VA rate table has not yet been verified against va.gov by a "
                 f"human. Figures are sourced and cross-checked arithmetically but remain "
                 f"unconfirmed — check against your own award letter."),
        ))
    return tuple(out)


def _tier(assumptions: Sequence[Assumption]) -> str:
    return SCENARIO if assumptions else STRICT


def _rates(t: V.LoadedData, rating: int) -> dict[str, float]:
    table = t.data["compensation_monthly"]
    key = str(rating)
    if key not in table:
        raise CalculatorError(
            f"no VA rate published for a {rating}% rating; ratings run 10-100 in steps of 10")
    return table[key]


# ── Combined rating (38 CFR 4.25) ─────────────────────────────────────────────────────────────────
def _round_to_nearest_ten(value: int) -> int:
    """38 CFR 4.25: 'combined values ending in 5 will be adjusted upward.'

    Python's `round` is NOT usable here — it rounds half to EVEN, so round(65, -1) is 60 and the
    regulation says 70. That single call would under-rate a veteran by a full 10 percent and by
    hundreds of dollars a month.
    """
    tens, remainder = divmod(value, 10)
    return (tens + 1) * 10 if remainder >= 5 else tens * 10


@register("va.combined_rating")
def combined_rating(ratings: Sequence[float], *, year: Optional[int] = None) -> CalcResult:
    """Combine individual disability ratings the way the VA does — which is not by adding them.

    38 CFR 4.25 treats each rating as a share of REMAINING efficiency: a veteran rated 60% is
    "considered 40 percent efficient", so a further 30% rating takes 30% of that remaining 40,
    giving 72 — rounded once, at the end, to 70%.

    Ratings are combined in descending order of severity, each intermediate value rounded to a whole
    number as the regulation's table is, and the conversion to a multiple of ten happens ONCE after
    all of them are combined.
    """
    if not ratings:
        raise CalculatorError("combined_rating needs at least one individual rating")
    vals: list[int] = []
    for r in ratings:
        iv = int(round(float(r)))
        if abs(float(r) - iv) > 1e-9:
            raise CalculatorError(f"individual rating {r!r} is not a whole percentage")
        if not 0 <= iv <= 100:
            raise CalculatorError(f"individual rating {iv}% is outside 0-100")
        if iv % _RATING_STEP:
            raise CalculatorError(
                f"individual rating {iv}% is not a multiple of {_RATING_STEP} — the VA rating "
                f"schedule assigns ratings in 10-percent degrees")
        vals.append(iv)

    ordered = sorted(vals, reverse=True)
    combined = 0
    steps: list[dict[str, Any]] = []
    for r in ordered:
        remaining = 100 - combined
        contribution = r * remaining / 100.0
        nxt = int(round(combined + contribution))
        steps.append({"rating": r, "efficiency_before": remaining,
                      "contribution": round(contribution, 2), "running": nxt})
        combined = min(100, nxt)

    rounded = min(100, _round_to_nearest_ten(combined))
    # The combining math is pure regulation — no rate table is read, so there is nothing to hedge.
    naive = min(100, sum(ordered))
    return CalcResult(
        calculator="va.combined_rating",
        label=f"Combined VA disability rating from {len(ordered)} conditions",
        value=float(rounded),
        unit="pct",
        tier=STRICT,
        inputs_used={"individual_ratings": ordered},
        detail={
            "exact_combined_value": combined,
            "rounded_to": rounded,
            "steps": steps,
            "sum_if_added": naive,
            "overstatement_if_added": naive - rounded,
            "authority": "38 CFR 4.25",
            "note": (f"Adding the ratings would give {naive}%. The VA's combined value is "
                     f"{combined}%, which rounds to {rounded}%."),
            "not_modelled": ["the bilateral factor (38 CFR 4.26), which adds 10% of the combined "
                             "value of paired-limb disabilities before combining with the rest"],
        },
    )


# ── Compensation ──────────────────────────────────────────────────────────────────────────────────
@register("va.disability_compensation")
def disability_compensation(rating: int, *, spouse: bool = False,
                            children_under_18: int = 0,
                            children_over_18_in_school: int = 0,
                            dependent_parents: int = 0,
                            spouse_aid_attendance: bool = False,
                            year: Optional[int] = None) -> CalcResult:
    """Monthly VA disability compensation, looked up in the published table.

    The dependent structure follows the VA's own tables rather than a flat per-dependent amount: the
    FIRST child is worth more than each additional one, and is worth more again when there is also a
    spouse. Reducing it to "x per child" misstates every family with more than one.
    """
    rating = int(rating)
    for name, n in (("children_under_18", children_under_18),
                    ("children_over_18_in_school", children_over_18_in_school),
                    ("dependent_parents", dependent_parents)):
        if int(n) < 0:
            raise CalculatorError(f"{name} must not be negative")
    if int(dependent_parents) > 2:
        raise CalculatorError("the VA schedule publishes rates for at most 2 dependent parents")

    t = _table(year)
    r = _rates(t, rating)
    assumptions = _provenance(t)

    base = float(r["alone"])
    monthly = base
    lines: list[dict[str, Any]] = [{"item": f"{rating}% rating, veteran alone", "amount": base}]
    ignored: list[str] = []

    total_children = int(children_under_18) + int(children_over_18_in_school)
    has_dependents = (spouse or total_children or int(dependent_parents)
                      or spouse_aid_attendance)

    if rating < DEPENDENT_FLOOR_RATING and has_dependents:
        # Not a rounding detail: a 20%-rated veteran with a spouse and two children receives the
        # bare 20% rate. Silently adding dependent amounts here would overstate their income every
        # month for the rest of their life.
        ignored.append(
            f"Dependent amounts are not payable below a {DEPENDENT_FLOOR_RATING}% combined rating "
            f"(38 U.S.C. 1115), so the spouse, children and parents listed add nothing at "
            f"{rating}%.")
    else:
        if spouse:
            monthly += float(r["spouse"])
            lines.append({"item": "spouse", "amount": float(r["spouse"])})
            if spouse_aid_attendance:
                aa = float(r["spouse_aid_attendance"])
                monthly += aa
                lines.append({"item": "spouse aid & attendance", "amount": aa})
        elif spouse_aid_attendance:
            ignored.append("Spouse aid & attendance requires a spouse; ignored.")

        if total_children:
            first_key = "first_child_with_spouse" if spouse else "first_child"
            first = float(r[first_key])
            monthly += first
            lines.append({"item": f"first child ({'with' if spouse else 'no'} spouse)",
                          "amount": first})
            # The first child is already counted above. Which category it came from matters,
            # because a child over 18 in a qualifying school programme is worth several times an
            # additional child under 18 — so spend the first-child slot on the cheaper category and
            # pay the remaining children at their own published rates.
            remaining_under = int(children_under_18)
            remaining_school = int(children_over_18_in_school)
            if remaining_under:
                remaining_under -= 1
            else:
                remaining_school -= 1
            if remaining_under:
                add = float(r["additional_child_under_18"]) * remaining_under
                monthly += add
                lines.append({"item": f"{remaining_under} additional child(ren) under 18",
                              "amount": add})
            if remaining_school:
                add = float(r["child_over_18_in_school"]) * remaining_school
                monthly += add
                lines.append({"item": f"{remaining_school} child(ren) over 18 in school",
                              "amount": add})

        if int(dependent_parents):
            add = float(r["parent"]) * int(dependent_parents)
            monthly += add
            lines.append({"item": f"{int(dependent_parents)} dependent parent(s)", "amount": add})

    monthly = round(monthly, 2)
    return CalcResult(
        calculator="va.disability_compensation",
        label=f"VA disability compensation at a {rating}% combined rating",
        value=monthly,
        unit="usd_per_month",
        tier=_tier(assumptions),
        inputs_used={"rating": rating, "spouse": bool(spouse),
                     "children_under_18": int(children_under_18),
                     "children_over_18_in_school": int(children_over_18_in_school),
                     "dependent_parents": int(dependent_parents),
                     "spouse_aid_attendance": bool(spouse_aid_attendance)},
        assumptions=assumptions,
        detail={
            "annual": round(monthly * 12, 2),
            "breakdown": lines,
            "rate_year": t.year_used,
            "effective_date": t.data["_meta"]["effective_date"],
            "taxable": False,
            "tax_note": ("Entirely tax-free (26 U.S.C. 104(a)(4)) and excluded from gross income, "
                         "so it is absent from AGI and therefore from MAGI. It does not make "
                         "Social Security taxable, does not count toward an IRMAA bracket, and "
                         "does not consume room for a Roth conversion."),
            "stops_at_death": True,
            "survivor_note": ("Compensation ends at the veteran's death and does NOT pass to a "
                              "spouse. The survivor's benefit is DIC, a separate and smaller "
                              "schedule with its own eligibility test — see va.dic."),
            "ignored": ignored,
            "not_modelled": ["Special Monthly Compensation (SMC K-S, 38 CFR 3.350)"],
        },
    )


# ── DIC, the survivor analogue ────────────────────────────────────────────────────────────────────
@register("va.dic")
def dic(*, children_under_18: int = 0, eight_year_provision: bool = False,
        aid_and_attendance: bool = False, housebound: bool = False,
        transitional_benefit: bool = False, year: Optional[int] = None) -> CalcResult:
    """Dependency and Indemnity Compensation for a surviving spouse — monthly.

    THE POINT OF COMPARING IT TO THE COMPENSATION IT REPLACES. A veteran rated 100% with a spouse
    receives over $4,100 a month. On their death that stops, and the survivor's DIC base is about
    $1,700 — a fall of roughly 60% in the household's tax-free income, and it arrives at the same
    moment the survivor starts filing single on narrower brackets. That is the planning event, and
    it is invisible to any tool that treats VA pay as a pension that continues.

    DIC is also tax-free, and it is NOT contingent on the veteran's rating the way the compensation
    amount is — the base rate is flat, so delaying or increasing a rating does not raise it. The one
    rating-linked piece is the 8-year provision.
    """
    if int(children_under_18) < 0:
        raise CalculatorError("children_under_18 must not be negative")
    t = _table(year)
    d = t.data["dic_monthly"]
    assumptions = _provenance(t)

    monthly = float(d["surviving_spouse_base"])
    lines = [{"item": "surviving spouse base", "amount": monthly}]
    for flag, key, label in (
        (eight_year_provision, "eight_year_provision", "8-year provision"),
        (aid_and_attendance, "aid_and_attendance", "aid & attendance"),
        (housebound, "housebound", "housebound allowance"),
    ):
        if flag:
            amt = float(d[key])
            monthly += amt
            lines.append({"item": label, "amount": amt})
    if int(children_under_18):
        amt = float(d["additional_child_under_18"]) * int(children_under_18)
        monthly += amt
        lines.append({"item": f"{int(children_under_18)} child(ren) under 18", "amount": amt})
    if transitional_benefit:
        if not int(children_under_18):
            raise CalculatorError(
                "the transitional benefit requires at least one child under 18")
        amt = float(d["transitional_benefit"])
        monthly += amt
        lines.append({"item": f"transitional benefit (first "
                              f"{int(d['transitional_benefit_years'])} years)", "amount": amt})

    monthly = round(monthly, 2)
    return CalcResult(
        calculator="va.dic",
        label="DIC for a surviving spouse",
        value=monthly,
        unit="usd_per_month",
        tier=_tier(assumptions),
        inputs_used={"children_under_18": int(children_under_18),
                     "eight_year_provision": bool(eight_year_provision),
                     "aid_and_attendance": bool(aid_and_attendance),
                     "housebound": bool(housebound),
                     "transitional_benefit": bool(transitional_benefit)},
        assumptions=assumptions,
        detail={
            "annual": round(monthly * 12, 2),
            "breakdown": lines,
            "rate_year": t.year_used,
            "effective_date": t.data["_meta"]["effective_date"],
            "taxable": False,
            "tax_note": "Tax-free on the same authority as compensation (26 U.S.C. 104(a)(4)).",
            "transitional_benefit_years": int(d["transitional_benefit_years"]),
            "eligibility": list(d["eligibility"]),
            "not_modelled": ["DIC for dependent parents, which is income-tested on its own "
                             "schedule"],
        },
    )
