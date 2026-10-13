"""Account-wrapper tax treatment — HSA, HDHP, FSA, 401(k), IRA (Phase B2-a).

These rules are what `offer_impact` (J2) needs and could not have. The owner's own example was
"HSA with HDHP and limited FSA": valuing that offer requires the HDHP eligibility test, the
limited-purpose-FSA compatibility rule, and — the part nothing in the platform knew — that an HSA
contribution made THROUGH PAYROLL also escapes FICA, while the same dollars contributed directly do
not. That is ~7.65% on the contribution, and it can flip the ranking between two offers.

RULES ARE STABLE; PARAMETERS ARE ANNUAL. The structure below (eligibility tests, the FICA
distinction, the last-month rule and its testing period, the elective-vs-415(c) split, the pro-rata
rule) is statutory and does not move year to year. Every dollar threshold comes from
`data/tax_parameters/<year>.json` and is reported as unverified until an owner checks it. A
determination is therefore right about the rule while explicit that the amount is pending — see
`treatment.py`.
"""
from __future__ import annotations

from typing import Any, Optional

from . import effective
from . import versioned_data as V
from .base import CalculatorError, require_money
from .treatment import (
    DEDUCTED,
    ELIGIBLE,
    EXCLUDED,
    INELIGIBLE,
    ORDINARY,
    TAXABLE,
    TAX_FREE,
    Test,
    TreatmentError,
    TreatmentResult,
    rule,
)

COVERAGE = ("self_only", "family")


def _params(tax_year: Optional[int] = None) -> V.LoadedData:
    """Statutory thresholds. NOT `require_verified` — deliberately.

    The rule is the answer here; the threshold is a detail of it. Refusing to say "your HELOC
    interest is not deductible because the proceeds paid off credit cards" merely because the
    $750,000 cap has not been re-verified would withhold the useful half over the irrelevant one.
    Every result instead carries `parameters_verified`, and `to_calc_result()` downgrades the
    quantified amount to SCENARIO tier so the validator hedges it.
    """
    return V.load("tax_parameters", tax_year)


def _coverage(value: Any) -> str:
    c = str(value or "").strip().lower()
    if c in ("individual", "self", "single"):
        c = "self_only"
    if c not in COVERAGE:
        raise CalculatorError(f"coverage must be one of {COVERAGE}, got {value!r}")
    return c


# ── HDHP ──────────────────────────────────────────────────────────────────────────────────────────
@rule("wrapper.hdhp_qualifies")
def hdhp_qualifies(*, coverage: str, annual_deductible: float, out_of_pocket_max: float,
                   tax_year: Optional[int] = None) -> TreatmentResult:
    """Does this health plan qualify as an HDHP? Gate on everything HSA.

    BOTH tests must pass: the deductible must be at least the statutory minimum AND the
    out-of-pocket maximum must not exceed the statutory ceiling. The second is the one people miss —
    a plan with a huge deductible can still fail by having an uncapped OOP exposure, and a user who
    assumes HSA eligibility from the deductible alone can over-contribute for a year.
    """
    cov = _coverage(coverage)
    deductible = require_money("annual_deductible", annual_deductible)
    oop = require_money("out_of_pocket_max", out_of_pocket_max)
    p = _params(tax_year)
    cfg = p.data["hdhp"]
    min_ded = float(cfg["min_annual_deductible"][cov])
    max_oop = float(cfg["max_out_of_pocket"][cov])

    ded_ok = deductible >= min_ded
    oop_ok = oop <= max_oop
    tests = (
        Test("minimum_deductible", ded_ok,
             f"deductible ${deductible:,.0f} {'meets' if ded_ok else 'is below'} the "
             f"${min_ded:,.0f} minimum for {cov.replace('_', ' ')} coverage",
             decided_by="annual_deductible"),
        Test("out_of_pocket_ceiling", oop_ok,
             f"out-of-pocket max ${oop:,.0f} {'is within' if oop_ok else 'exceeds'} the "
             f"${max_oop:,.0f} ceiling",
             decided_by="out_of_pocket_max"),
    )
    qualifies = ded_ok and oop_ok
    return TreatmentResult(
        rule="wrapper.hdhp_qualifies",
        determination=ELIGIBLE if qualifies else INELIGIBLE,
        authority="IRC §223(c)(2)",
        summary=("this plan qualifies as an HDHP, so you can fund an HSA"
                 if qualifies else "this plan does not qualify as an HDHP, so an HSA is not available"),
        tests=tests,
        inputs_used={"coverage": cov, "annual_deductible": deductible,
                     "out_of_pocket_max": oop, "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        traps=() if qualifies else (
            "Contributing to an HSA without HDHP coverage is an excess contribution: 6% excise tax "
            "per year until withdrawn.",),
        notes=("A plan can clear the deductible minimum and still fail on out-of-pocket exposure — "
               "check both before assuming HSA eligibility.",),
    )


# ── HSA ───────────────────────────────────────────────────────────────────────────────────────────
@rule("wrapper.hsa_contribution")
def hsa_contribution(*, coverage: str, amount: float, age: int,
                     through_payroll: bool = True,
                     employer_contribution: float = 0.0,
                     months_hdhp_covered: int = 12,
                     marginal_rate: float = 0.0, fica_rate: float = 0.0765,
                     tax_year: Optional[int] = None) -> TreatmentResult:
    """HSA contribution treatment — limit, catch-up, and the FICA distinction.

    THE FICA POINT, WHICH NOTHING IN THE PLATFORM KNEW. A contribution made through an employer's
    cafeteria plan is EXCLUDED from wages, so it escapes income tax *and* Social Security and
    Medicare. The identical dollars contributed directly from a bank account are an above-the-line
    DEDUCTION — income tax only, no FICA relief. That is ~7.65% of the contribution, every year,
    and it is the difference between the two most common ways people fund the same account.

    THE EMPLOYER CONTRIBUTION COUNTS AGAINST THE LIMIT. A generous employer seed reduces what the
    user may add, and over-contributing carries a 6% excise tax for every year the excess remains.
    `offer_impact` must net this, or a rich HSA offer looks better than it is.
    """
    cov = _coverage(coverage)
    contributed = require_money("amount", amount)
    employer = require_money("employer_contribution", employer_contribution)
    yrs = int(age)
    months = int(months_hdhp_covered)
    if not 0 <= months <= 12:
        raise CalculatorError(f"months_hdhp_covered must be 0-12, got {months}")
    p = _params(tax_year)
    cfg = p.data["hsa"]

    base_limit = float(cfg["contribution_limit"][cov])
    catch_up = float(cfg["catch_up_amount"]) if yrs >= int(cfg["catch_up_age"]) else 0.0
    full_limit = base_limit + catch_up
    # Pro-rated by months of HDHP coverage unless the last-month rule is used.
    prorated = full_limit * months / 12.0
    limit = full_limit if months == 12 else prorated
    total = contributed + employer
    over = max(0.0, total - limit)
    allowed = max(0.0, min(contributed, limit - employer))

    medicare_age = int(cfg["medicare_age_blocks_contributions"])
    tests = [
        Test("within_limit", over == 0,
             f"${total:,.0f} total (you ${contributed:,.0f} + employer ${employer:,.0f}) "
             f"{'is within' if over == 0 else 'EXCEEDS'} the ${limit:,.0f} limit",
             decided_by="amount"),
        Test("catch_up_eligible", catch_up > 0,
             f"age {yrs} {'qualifies for' if catch_up else 'is below'} the "
             f"{int(cfg['catch_up_age'])}+ catch-up of ${float(cfg['catch_up_amount']):,.0f}",
             decided_by="age"),
        Test("funded_through_payroll", bool(through_payroll),
             "payroll contributions are excluded from wages, so they escape FICA as well as income "
             "tax" if through_payroll else
             "a direct contribution is an above-the-line DEDUCTION — income tax relief only, no "
             "FICA relief (~7.65% left on the table)",
             decided_by="through_payroll"),
    ]
    if months < 12:
        tests.append(Test("full_year_coverage", False,
                          f"HDHP coverage for {months} of 12 months pro-rates the limit to "
                          f"${prorated:,.0f}, unless the last-month rule is used",
                          decided_by="months_hdhp_covered"))
    if yrs >= medicare_age:
        tests.append(Test("medicare_enrolment", False,
                          f"at {yrs}, Medicare enrolment ends HSA contribution eligibility — "
                          f"withdrawals remain available",
                          decided_by="age"))

    rate = require_money("marginal_rate", marginal_rate) if marginal_rate else 0.0
    f_rate = float(fica_rate) if through_payroll else 0.0
    tax_saved = allowed * (rate + f_rate)

    traps = [
        "Over-contributing carries a 6% excise tax for every year the excess stays in the account.",
        "Non-qualified withdrawals before 65 are taxable AND carry a "
        f"{float(cfg['non_qualified_withdrawal_penalty']):.0%} penalty; after "
        f"{int(cfg['penalty_waived_age'])} the penalty drops but the tax remains.",
    ]
    if months < 12:
        traps.append(
            f"The last-month rule lets you contribute the FULL annual limit if you are HDHP-covered "
            f"on 1 December — but it imposes a {int(cfg['testing_period_months'])}-month testing "
            f"period. Lose HDHP coverage inside it and the extra contribution becomes taxable "
            f"income plus a 10% penalty.")
    if not through_payroll:
        traps.append("Switching this contribution to payroll would also exempt it from FICA — the "
                     "same dollars, ~7.65% cheaper.")

    return TreatmentResult(
        rule="wrapper.hsa_contribution",
        determination=EXCLUDED if through_payroll else DEDUCTED,
        authority="IRC §223; §106(d) (employer/cafeteria-plan exclusion)",
        summary=(f"${allowed:,.0f} is {'excluded from wages (no income tax and no FICA)' if through_payroll else 'deductible above the line (income tax only, no FICA relief)'}"),
        amount=round(allowed, 2),
        character=ORDINARY,
        tests=tuple(tests),
        binding_limit=(f"${limit:,.0f} annual limit for {cov.replace('_', ' ')} coverage"
                       if over > 0 or allowed < contributed else None),
        traps=tuple(traps),
        inputs_used={"coverage": cov, "amount": contributed, "age": yrs,
                     "through_payroll": bool(through_payroll),
                     "employer_contribution": employer,
                     "months_hdhp_covered": months, "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        notes=(f"limit ${limit:,.0f} = base ${base_limit:,.0f}"
               + (f" + catch-up ${catch_up:,.0f}" if catch_up else "")
               + (f", pro-rated for {months}/12 months" if months < 12 else "")
               + f"; employer ${employer:,.0f} counts against it",
               f"estimated tax saved ${tax_saved:,.0f} at a {rate:.1%} marginal rate"
               + (f" plus {f_rate:.2%} FICA" if f_rate else " (no FICA relief)")
               if rate else "pass marginal_rate to quantify the tax saved",
               "Qualified medical withdrawals are tax-free at any age — the third leg of the "
               "triple advantage, and the reason an HSA beats a 401(k) for money you will spend on "
               "healthcare.",
               ),
    )


# ── FSA compatibility ─────────────────────────────────────────────────────────────────────────────
@rule("wrapper.fsa_hsa_compatibility")
def fsa_hsa_compatibility(*, fsa_type: str, tax_year: Optional[int] = None) -> TreatmentResult:
    """Can this FSA coexist with an HSA? Only the limited-purpose one can.

    A general-purpose health FSA is "other coverage" and DISQUALIFIES HSA contributions entirely —
    for the whole year, because the FSA's coverage period is treated as covering it. Enrolling in
    both is a common and expensive benefits-election mistake, and it is irreversible until the next
    open enrolment.

    This is the rule the owner's "HSA with HDHP and limited FSA" example turns on: that combination
    works precisely BECAUSE the FSA is limited-purpose.
    """
    kind = str(fsa_type or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {"limited": "limited_purpose", "lpfsa": "limited_purpose",
               "general": "general_purpose_health", "health": "general_purpose_health",
               "healthcare": "general_purpose_health", "medical": "general_purpose_health",
               "dcfsa": "dependent_care", "dependent": "dependent_care",
               # `general_purpose` is the plain spelling and the one the schema stores
               # (user_financial_profile.fsa_type). Its absence made the rule refuse for every
               # user whose FSA type came out of the database — the only path that supplies it.
               "general_purpose": "general_purpose_health",
               "limited_purpose_health": "limited_purpose"}
    kind = aliases.get(kind, kind)
    known = ("limited_purpose", "general_purpose_health", "dependent_care")
    if kind not in known:
        raise TreatmentError(
            f"fsa_type must be one of {known} (or an alias); got {fsa_type!r}. The distinction "
            f"decides HSA eligibility, so it cannot be guessed.")

    p = _params(tax_year)
    compatible = kind in ("limited_purpose", "dependent_care")
    why = {
        "limited_purpose": "a limited-purpose FSA covers only dental and vision, so it is not "
                           "'other coverage' and does not disqualify an HSA",
        "dependent_care": "a dependent-care FSA is not health coverage at all, so it has no effect "
                          "on HSA eligibility",
        "general_purpose_health": "a general-purpose health FSA IS other coverage and disqualifies "
                                  "HSA contributions for the entire year",
    }[kind]
    return TreatmentResult(
        rule="wrapper.fsa_hsa_compatibility",
        determination=ELIGIBLE if compatible else INELIGIBLE,
        authority="IRC §223(c)(1)(A); Rev. Rul. 2004-45",
        summary=("this FSA can be paired with an HSA" if compatible
                 else "this FSA blocks HSA contributions for the whole year"),
        tests=(Test("not_other_coverage", compatible, why, decided_by="fsa_type"),),
        inputs_used={"fsa_type": kind, "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        traps=(("Enrolling in a general-purpose health FSA and an HSA in the same year makes every "
                "HSA contribution an excess contribution — 6% excise tax, and the election is "
                "usually irreversible until open enrolment.",) if not compatible else
               ("FSA funds are use-it-or-lose-it beyond the carryover; HSA funds never expire.",)),
        notes=(f"health FSA limit ${float(p.data['fsa']['health_fsa_limit']):,.0f}, carryover "
               f"${float(p.data['fsa']['health_fsa_carryover']):,.0f}",),
    )


# ── 401(k) ────────────────────────────────────────────────────────────────────────────────────────
@rule("wrapper.k401_deferral")
def k401_deferral(*, employee_deferral: float, age: int, compensation: float,
                  employer_contribution: float = 0.0, roth: bool = False,
                  tax_year: Optional[int] = None) -> TreatmentResult:
    """401(k) deferral treatment, and the two limits people conflate.

    THE ELECTIVE LIMIT AND THE §415(c) LIMIT ARE DIFFERENT LIMITS. Employer contributions do NOT
    consume the elective deferral limit, but they DO consume the much larger §415(c) total. Treating
    them as one cap is the most common 401(k) misunderstanding, and it cuts both ways: people think
    a generous match blocks their own deferrals (it does not), and people planning a mega-backdoor
    Roth miss that the match eats the after-tax headroom (it does).

    The gap between total contributions and the §415(c) limit IS the mega-backdoor capacity, so it
    is reported explicitly rather than left to be derived.
    """
    deferral = require_money("employee_deferral", employee_deferral)
    employer = require_money("employer_contribution", employer_contribution)
    comp = require_money("compensation", compensation, allow_zero=False)
    yrs = int(age)
    p = _params(tax_year)
    cfg = p.data["retirement"]

    elective = float(cfg["elective_deferral_limit"])
    catch_up = 0.0
    catch_up_kind = None
    # Effective-dated rather than compared against a first-year NUMBER in the parameters file.
    # The number worked for a provision that starts; it cannot express one that ends, and nothing
    # would flag a rule still applying expired law. See calculators/effective.py.
    if 60 <= yrs <= 63 and effective.in_effect("retirement.super_catch_up_60_63", p.year_used):
        catch_up = float(cfg["super_catch_up_60_63"])
        catch_up_kind = "super catch-up (ages 60-63)"
    elif yrs >= 50:
        catch_up = float(cfg["catch_up_50"])
        catch_up_kind = "catch-up (50+)"
    elective_limit = elective + catch_up

    total_limit = float(cfg["total_415c_limit"]) + catch_up
    comp_limit = float(cfg["compensation_limit"])
    total = deferral + employer
    allowed_deferral = min(deferral, elective_limit)
    headroom_415c = max(0.0, total_limit - total)

    tests = [
        Test("within_elective_limit", deferral <= elective_limit,
             f"your ${deferral:,.0f} deferral {'is within' if deferral <= elective_limit else 'EXCEEDS'} "
             f"the ${elective_limit:,.0f} elective limit"
             + (f" (includes {catch_up_kind} of ${catch_up:,.0f})" if catch_up else ""),
             decided_by="employee_deferral"),
        Test("within_415c_total", total <= total_limit,
             f"${total:,.0f} of total contributions (yours + employer's ${employer:,.0f}) "
             f"{'is within' if total <= total_limit else 'EXCEEDS'} the ${total_limit:,.0f} §415(c) "
             f"limit — the employer portion does NOT count against your elective limit, only this one",
             decided_by="employer_contribution"),
        Test("compensation_limit", comp <= comp_limit,
             f"compensation ${comp:,.0f} {'is within' if comp <= comp_limit else 'exceeds'} the "
             f"${comp_limit:,.0f} limit that caps the pay a match can be computed on",
             decided_by="compensation"),
    ]
    traps = [
        f"Withdrawals before {cfg['early_withdrawal_age']} generally carry a "
        f"{float(cfg['early_withdrawal_penalty']):.0%} penalty on top of income tax.",
        f"Required minimum distributions begin at {int(cfg['rmd_age'])}"
        + (" — Roth 401(k) amounts are no longer subject to RMDs during the owner's life."
           if roth else ", and a large pre-tax balance can push you into a higher bracket then."),
    ]
    if headroom_415c > 0:
        traps.append(
            f"${headroom_415c:,.0f} of §415(c) headroom remains. If the plan allows after-tax "
            f"contributions and in-plan conversions, that is mega-backdoor Roth capacity — but the "
            f"employer contribution consumes the same limit, so the headroom shrinks as the match grows.")

    return TreatmentResult(
        rule="wrapper.k401_deferral",
        determination=TAX_FREE if roth else DEDUCTED,
        authority="IRC §402(g) (elective limit); §415(c) (total); §401(a)(17) (compensation)",
        summary=(f"${allowed_deferral:,.0f} "
                 + ("goes in after tax and grows tax-free (Roth)" if roth
                    else "reduces taxable income now and is taxed on withdrawal")),
        amount=round(allowed_deferral, 2),
        character=ORDINARY,
        tests=tuple(tests),
        binding_limit=(f"${elective_limit:,.0f} elective deferral limit"
                       if deferral > elective_limit else
                       (f"${total_limit:,.0f} §415(c) total" if total > total_limit else None)),
        traps=tuple(traps),
        inputs_used={"employee_deferral": deferral, "employer_contribution": employer,
                     "compensation": comp, "age": yrs, "roth": bool(roth),
                     "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        notes=(f"elective limit ${elective_limit:,.0f}; §415(c) total ${total_limit:,.0f}; "
               f"remaining §415(c) headroom ${headroom_415c:,.0f}",
               "A Roth deferral forgoes today's deduction for tax-free growth — which wins depends "
               "on your marginal rate now versus in retirement, not on the account type.",),
    )


# ── IRA deductibility ─────────────────────────────────────────────────────────────────────────────
@rule("wrapper.ira_deduction")
def ira_deduction(*, contribution: float, agi: float, filing_status: str, age: int,
                  covered_by_workplace_plan: bool,
                  tax_year: Optional[int] = None) -> TreatmentResult:
    """Is a traditional IRA contribution deductible?

    THE PHASE-OUT ONLY EXISTS IF YOU ARE COVERED BY A WORKPLACE PLAN. Uncovered filers may deduct
    the full contribution at ANY income — the single most common misconception about IRAs, and it
    costs uncovered high earners a deduction they assume they cannot take.

    When the deduction IS phased out the contribution is still ALLOWED, just non-deductible — which
    is the entry point for a backdoor Roth, and where the pro-rata trap lives.
    """
    amount = require_money("contribution", contribution, allow_zero=False)
    income = require_money("agi", agi)
    yrs = int(age)
    status = str(filing_status or "").strip().lower()
    p = _params(tax_year)
    cfg = p.data["retirement"]

    limit = float(cfg["ira_contribution_limit"]) + (
        float(cfg["ira_catch_up_50"]) if yrs >= 50 else 0.0)
    within_limit = amount <= limit

    if not covered_by_workplace_plan:
        deductible = min(amount, limit)
        tests = (
            Test("workplace_plan_coverage", True,
                 "you are not covered by a workplace retirement plan, so the income phase-out does "
                 "not apply at all — the contribution is fully deductible at any AGI",
                 decided_by="covered_by_workplace_plan"),
            Test("within_contribution_limit", within_limit,
                 f"${amount:,.0f} {'is within' if within_limit else 'exceeds'} the ${limit:,.0f} limit",
                 decided_by="contribution"),
        )
        return TreatmentResult(
            rule="wrapper.ira_deduction", determination=DEDUCTED,
            authority="IRC §219(g)",
            summary=f"${deductible:,.0f} is fully deductible — no phase-out applies",
            amount=round(deductible, 2), character=ORDINARY, tests=tests,
            inputs_used={"contribution": amount, "agi": income, "filing_status": status,
                         "age": yrs, "covered_by_workplace_plan": False,
                         "tax_year": p.year_used},
            parameters_verified=p.is_verified, parameter_year=p.year_used,
            traps=(f"Withdrawals before {cfg['early_withdrawal_age']} generally carry a "
                   f"{float(cfg['early_withdrawal_penalty']):.0%} penalty.",),
        )

    ranges = cfg["ira_deduction_phase_out_covered"]
    if status not in ranges:
        raise TreatmentError(
            f"no IRA deduction phase-out range for filing status {status!r}; "
            f"have {sorted(ranges)}")
    lo, hi = (float(x) for x in ranges[status])
    if income <= lo:
        share = 1.0
    elif income >= hi:
        share = 0.0
    else:
        share = 1.0 - (income - lo) / (hi - lo)
    deductible = min(amount, limit) * share
    non_deductible = min(amount, limit) - deductible

    tests = (
        Test("workplace_plan_coverage", False,
             "you are covered by a workplace plan, so the AGI phase-out applies",
             decided_by="covered_by_workplace_plan"),
        Test("within_phase_out_range", share > 0,
             f"AGI ${income:,.0f} against the ${lo:,.0f}-${hi:,.0f} range leaves "
             f"{share:.0%} of the deduction",
             decided_by="agi"),
        Test("within_contribution_limit", within_limit,
             f"${amount:,.0f} {'is within' if within_limit else 'exceeds'} the ${limit:,.0f} limit",
             decided_by="contribution"),
    )
    traps = [
        f"Withdrawals before {cfg['early_withdrawal_age']} generally carry a "
        f"{float(cfg['early_withdrawal_penalty']):.0%} penalty.",
    ]
    if non_deductible > 0:
        traps.append(
            "A non-deductible contribution is the entry point for a backdoor Roth — but the "
            "PRO-RATA RULE aggregates ALL your traditional, SEP and SIMPLE IRA balances when you "
            "convert. If you hold pre-tax IRA money, most of the conversion is taxable even though "
            "the contribution was not deducted. This is the most commonly botched manoeuvre in "
            "personal finance; it needs Form 8606 and it needs checking before you convert.")
    return TreatmentResult(
        rule="wrapper.ira_deduction",
        determination=DEDUCTED if share == 1.0 else (TAXABLE if share == 0 else DEDUCTED),
        authority="IRC §219(g)",
        summary=(f"${deductible:,.0f} of ${min(amount, limit):,.0f} is deductible"
                 + (f"; ${non_deductible:,.0f} is a non-deductible contribution"
                    if non_deductible > 0 else "")),
        amount=round(deductible, 2), character=ORDINARY, tests=tests,
        binding_limit=(f"AGI phase-out ${lo:,.0f}-${hi:,.0f}" if share < 1.0 else None),
        traps=tuple(traps),
        inputs_used={"contribution": amount, "agi": income, "filing_status": status,
                     "age": yrs, "covered_by_workplace_plan": True, "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        notes=(f"contribution limit ${limit:,.0f}"
               + (f" (includes a ${float(cfg['ira_catch_up_50']):,.0f} catch-up)" if yrs >= 50 else ""),
               "The contribution is still ALLOWED when the deduction is phased out — it simply "
               "becomes non-deductible basis.",),
    )
