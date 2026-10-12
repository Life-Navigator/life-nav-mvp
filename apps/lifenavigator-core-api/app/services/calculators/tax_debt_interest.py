"""Debt-interest deductibility (Phase B2-b) — tracing rules, limits, and after-tax cost.

THE TRACING PRINCIPLE, WHICH IS THE WHOLE SUBJECT
-------------------------------------------------
Deductibility follows WHAT THE MONEY BOUGHT, not what secured the loan. The same HELOC against the
same house is deductible if the proceeds renovated the kitchen and not deductible if they paid off a
credit card. The same margin loan is deductible against investment income if it bought securities
and never deductible if it funded a holiday. Instrument-based intuition ("it's secured by my home,
so it's deductible") is wrong, and it is wrong in the expensive direction.

WHY PHASE L CANNOT BE CORRECT WITHOUT THIS
------------------------------------------
`financing_optimizer` ranks cash vs HELOC vs securities-based lending vs 7(a) by cost of capital. A
pre-tax ranking is simply wrong: **a HELOC at 8% deductible beats a margin loan at 7%
non-deductible** for a filer at a 32% marginal rate (5.44% vs 7.00% after tax). Nothing in the plan
could see that until this module existed, so `after_tax_cost_of_debt` is the bridge and it is why
B2-b was moved ahead of L.
"""
from __future__ import annotations

from typing import Any, Optional

from .base import CalculatorError, require_money, require_rate
from .treatment import (
    DEDUCTIBLE,
    NOT_DEDUCTIBLE,
    ORDINARY,
    PARTIALLY_DEDUCTIBLE,
    Test,
    TreatmentError,
    TreatmentResult,
    rule,
)
from .tax_wrappers import _params

# What the borrowed money was used for. Tracing turns on exactly this.
USES = ("buy_build_improve_residence", "buy_investments", "business_operations",
        "personal_consumption", "debt_payoff", "education")


def _use(value: Any) -> str:
    u = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {"renovation": "buy_build_improve_residence", "improve": "buy_build_improve_residence",
               "home_improvement": "buy_build_improve_residence",
               "purchase_home": "buy_build_improve_residence",
               "investing": "buy_investments", "securities": "buy_investments",
               "business": "business_operations", "personal": "personal_consumption",
               "consumption": "personal_consumption", "credit_cards": "debt_payoff",
               "refinance_other_debt": "debt_payoff", "tuition": "education"}
    u = aliases.get(u, u)
    if u not in USES:
        raise TreatmentError(
            f"proceeds_used_for must be one of {USES} (or an alias); got {value!r}. "
            f"Deductibility traces to the USE of the money, so this cannot be defaulted — "
            f"assuming deductible overstates the deduction and assuming not understates it."
        )
    return u


# ── Mortgage ──────────────────────────────────────────────────────────────────────────────────────
@rule("debt_interest.mortgage")
def mortgage_interest(*, balance: float, annual_interest: float,
                      originated_before_cutoff: bool = False,
                      itemizing: bool = True,
                      tax_year: Optional[int] = None) -> TreatmentResult:
    """Acquisition-debt interest, subject to the post-TCJA cap.

    THE CAP IS ON THE DEBT, NOT THE INTEREST, so a balance above it makes the interest only
    PARTIALLY deductible in the ratio cap/balance. Pre-cutoff loans keep the older, higher cap —
    grandfathering that matters a great deal to anyone who bought before December 2017.

    AND IT ONLY HELPS IF YOU ITEMIZE. Post-TCJA the standard deduction is high enough that most
    filers do not, which makes a widely-assumed deduction worth exactly nothing to them. That is
    checked first because it is the test most often skipped.
    """
    bal = require_money("balance", balance, allow_zero=False)
    interest = require_money("annual_interest", annual_interest)
    p = _params(tax_year)
    cfg = p.data["debt_interest"]
    cap = float(cfg["mortgage_acquisition_cap_grandfathered"] if originated_before_cutoff
                else cfg["mortgage_acquisition_cap"])

    share = min(1.0, cap / bal)
    deductible = interest * share if itemizing else 0.0

    tests = (
        Test("itemizing", bool(itemizing),
             "you itemize, so mortgage interest reduces taxable income" if itemizing else
             "you take the standard deduction, so mortgage interest is worth nothing to you — the "
             "deduction exists but you are not using it",
             decided_by="itemizing"),
        Test("within_acquisition_cap", share == 1.0,
             f"balance ${bal:,.0f} {'is within' if share == 1.0 else 'exceeds'} the ${cap:,.0f} "
             f"acquisition-debt cap"
             + (f", so only {share:.0%} of the interest is deductible" if share < 1.0 else "")
             + (" (grandfathered: originated before the 2017 cutoff)" if originated_before_cutoff else ""),
             decided_by="balance"),
    )
    if not itemizing:
        determination = NOT_DEDUCTIBLE
    elif share == 1.0:
        determination = DEDUCTIBLE
    else:
        determination = PARTIALLY_DEDUCTIBLE
    return TreatmentResult(
        rule="debt_interest.mortgage", determination=determination,
        authority="IRC §163(h)(3)",
        summary=(f"${deductible:,.0f} of ${interest:,.0f} mortgage interest is deductible"
                 if itemizing else
                 "mortgage interest is not reducing your tax, because you take the standard deduction"),
        amount=round(deductible, 2), character=ORDINARY, tests=tests,
        binding_limit=(f"${cap:,.0f} acquisition-debt cap" if share < 1.0 else
                       ("standard deduction" if not itemizing else None)),
        traps=("Only ACQUISITION debt counts — cash taken out in a refinance and used for anything "
               "other than the home does not qualify, even though the whole loan is one mortgage.",
               "Points may need to be amortized over the loan term rather than deducted at once, "
               "depending on the transaction."),
        inputs_used={"balance": bal, "annual_interest": interest,
                     "originated_before_cutoff": bool(originated_before_cutoff),
                     "itemizing": bool(itemizing), "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
    )


# ── HELOC ─────────────────────────────────────────────────────────────────────────────────────────
@rule("debt_interest.heloc")
def heloc_interest(*, annual_interest: float, proceeds_used_for: str,
                   itemizing: bool = True, combined_balance: Optional[float] = None,
                   tax_year: Optional[int] = None) -> TreatmentResult:
    """HELOC interest — deductible ONLY if the proceeds bought, built or substantially improved the
    residence securing the loan.

    This is the clearest case of tracing beating intuition. Pre-TCJA, home-equity interest was
    broadly deductible regardless of use, which is where the folk wisdom comes from. Since TCJA it
    is not, and a HELOC used to consolidate credit-card debt — the single most common use — produces
    no deduction at all while feeling like it should.

    The unfavourable answer is also the most useful one here, because the lever is visible: the same
    borrowing, spent on the renovation instead, would have qualified.
    """
    interest = require_money("annual_interest", annual_interest)
    use = _use(proceeds_used_for)
    p = _params(tax_year)
    cfg = p.data["debt_interest"]
    cap = float(cfg["mortgage_acquisition_cap"])

    use_ok = use == "buy_build_improve_residence"
    share = 1.0
    if use_ok and combined_balance:
        bal = require_money("combined_balance", combined_balance, allow_zero=False)
        share = min(1.0, cap / bal)

    deductible = interest * share if (use_ok and itemizing) else 0.0
    tests = [
        Test("proceeds_traced_to_residence", use_ok,
             "the proceeds bought, built or substantially improved the residence securing the loan"
             if use_ok else
             f"the proceeds went to {use.replace('_', ' ')}, not to buying, building or "
             f"substantially improving the residence — so the interest is not deductible even "
             f"though the loan is secured by your home",
             decided_by="proceeds_used_for"),
        Test("itemizing", bool(itemizing),
             "you itemize" if itemizing else
             "you take the standard deduction, so the deduction is unusable",
             decided_by="itemizing"),
    ]
    if use_ok and combined_balance:
        tests.append(Test("within_combined_cap", share == 1.0,
                          f"combined mortgage + HELOC balance ${float(combined_balance):,.0f} "
                          f"{'is within' if share == 1.0 else 'exceeds'} the shared ${cap:,.0f} cap",
                          decided_by="combined_balance"))

    if not use_ok:
        determination = NOT_DEDUCTIBLE
    elif not itemizing:
        determination = NOT_DEDUCTIBLE
    elif share < 1.0:
        determination = PARTIALLY_DEDUCTIBLE
    else:
        determination = DEDUCTIBLE

    return TreatmentResult(
        rule="debt_interest.heloc", determination=determination,
        authority="IRC §163(h)(3) as amended by TCJA §11043",
        summary=(f"${deductible:,.0f} of ${interest:,.0f} HELOC interest is deductible"
                 if deductible else
                 "this HELOC interest is not deductible"),
        amount=round(deductible, 2), character=ORDINARY, tests=tuple(tests),
        binding_limit=(f"shared ${cap:,.0f} acquisition-debt cap" if share < 1.0 else None),
        traps=("The HELOC shares the acquisition-debt cap with your first mortgage — it is not a "
               "separate allowance.",
               "Tracing is by USE, so mixing purposes in one draw splits the interest into "
               "deductible and non-deductible portions and you must substantiate the split.",
               "Pre-TCJA rules allowed this deduction regardless of use. Advice written before 2018 "
               "— and a lot of it is still circulating — is wrong on exactly this point."),
        inputs_used={"annual_interest": interest, "proceeds_used_for": use,
                     "itemizing": bool(itemizing), "combined_balance": combined_balance,
                     "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
    )


# ── Investment interest: margin / securities-based lending ────────────────────────────────────────
@rule("debt_interest.investment")
def investment_interest(*, annual_interest: float, net_investment_income: float,
                        proceeds_used_for: str = "buy_investments",
                        itemizing: bool = True,
                        tax_year: Optional[int] = None) -> TreatmentResult:
    """Margin / securities-based-lending interest — §163(d).

    TWO LIMITS, BOTH EASY TO MISS. Investment interest is deductible only up to NET INVESTMENT
    INCOME, with the excess carried forward indefinitely; and it requires itemizing. A borrower
    whose portfolio produces mostly unrealized appreciation — which is the typical
    securities-based-lending borrower — has little or no net investment income, so most of the
    interest is NOT currently deductible at all.

    AND THE REASON SBL EXISTS IS NOT THE DEDUCTION. Borrowing against appreciated stock is not a
    realization event, so it defers capital gains indefinitely — potentially forever, if the
    position is held to death and receives a stepped-up basis. That is the actual benefit, it is
    far larger than the interest deduction, and it is recorded in `notes` because a user comparing
    financing options needs it to be visible.
    """
    interest = require_money("annual_interest", annual_interest)
    nii = require_money("net_investment_income", net_investment_income)
    use = _use(proceeds_used_for)
    p = _params(tax_year)

    traced = use == "buy_investments"
    currently = min(interest, nii) if (traced and itemizing) else 0.0
    carryforward = (interest - currently) if traced else 0.0

    tests = (
        Test("proceeds_traced_to_investments", traced,
             "the proceeds bought investments, so the interest is investment interest" if traced else
             f"the proceeds went to {use.replace('_', ' ')} — interest on borrowing used for "
             f"personal purposes is never deductible, whatever the collateral",
             decided_by="proceeds_used_for"),
        Test("itemizing", bool(itemizing),
             "you itemize" if itemizing else
             "you take the standard deduction, so investment interest is unusable this year",
             decided_by="itemizing"),
        Test("within_net_investment_income", traced and interest <= nii,
             f"${interest:,.0f} of interest against ${nii:,.0f} of net investment income — "
             + ("fully deductible" if interest <= nii else
                f"only ${currently:,.0f} is deductible now; ${carryforward:,.0f} carries forward"),
             decided_by="net_investment_income"),
    )
    if not traced:
        determination = NOT_DEDUCTIBLE
    elif currently == 0:
        determination = NOT_DEDUCTIBLE
    elif currently < interest:
        determination = PARTIALLY_DEDUCTIBLE
    else:
        determination = DEDUCTIBLE

    traps = [
        "Qualified dividends and long-term gains are excluded from net investment income unless you "
        "ELECT to treat them as ordinary — and that election costs you the preferential rate. It is "
        "a trade, not a free unlock.",
        "A margin call forces a sale at the worst possible moment, realizing exactly the gains the "
        "loan was taken to defer. The tax benefit and the liquidation risk are the same position.",
    ]
    if carryforward > 0:
        traps.append(
            f"${carryforward:,.0f} carries forward indefinitely, but it is only usable in a year "
            f"with net investment income — for a buy-and-hold portfolio that year may never arrive.")

    return TreatmentResult(
        rule="debt_interest.investment", determination=determination,
        authority="IRC §163(d)",
        summary=(f"${currently:,.0f} of ${interest:,.0f} is deductible this year"
                 + (f", ${carryforward:,.0f} carried forward" if carryforward > 0 else "")
                 if traced else "this interest is not deductible — the proceeds were not used for investments"),
        amount=round(currently, 2), character=ORDINARY, tests=tests,
        binding_limit=(f"net investment income of ${nii:,.0f}" if traced and currently < interest
                       else None),
        traps=tuple(traps),
        inputs_used={"annual_interest": interest, "net_investment_income": nii,
                     "proceeds_used_for": use, "itemizing": bool(itemizing),
                     "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
        notes=("The primary benefit of securities-based lending is NOT this deduction. Borrowing "
               "against appreciated stock is not a realization event, so it defers capital gains — "
               "indefinitely, and permanently if the position is held to death and receives a "
               "stepped-up basis. That deferral is usually worth far more than the interest "
               "deduction and should dominate the comparison.",
               f"carryforward available: ${carryforward:,.0f}",),
    )


# ── Business interest: SBA 7(a) / 504 ─────────────────────────────────────────────────────────────
@rule("debt_interest.business")
def business_interest(*, annual_interest: float, adjusted_taxable_income: float,
                      gross_receipts: float,
                      tax_year: Optional[int] = None) -> TreatmentResult:
    """Business interest — deductible, subject to the §163(j) limitation.

    THE SMALL-BUSINESS EXCEPTION IS THE ANSWER FOR ALMOST EVERY 7(a) BORROWER. Below the gross-
    receipts threshold the §163(j) limitation does not apply at all, so the interest is fully
    deductible. Above it, the deduction is capped at a percentage of adjusted taxable income with
    the excess carried forward — which bites hardest in a loss year, exactly when the business can
    least afford it.

    Business interest is also better than the alternatives in a way worth stating: it is an
    above-the-line business expense, so unlike mortgage, HELOC or investment interest it does NOT
    require itemizing.
    """
    interest = require_money("annual_interest", annual_interest)
    ati = require_money("adjusted_taxable_income", adjusted_taxable_income)
    receipts = require_money("gross_receipts", gross_receipts)
    p = _params(tax_year)
    cfg = p.data["debt_interest"]
    threshold = float(cfg["business_interest_small_business_gross_receipts"])
    pct = float(cfg["business_interest_163j_pct_of_ati"])

    exempt = receipts <= threshold
    cap = ati * pct
    deductible = interest if exempt else min(interest, cap)
    carryforward = max(0.0, interest - deductible)

    tests = (
        Test("small_business_exception", exempt,
             f"gross receipts ${receipts:,.0f} are {'at or below' if exempt else 'above'} the "
             f"${threshold:,.0f} threshold, so §163(j) {'does not apply' if exempt else 'applies'}",
             decided_by="gross_receipts"),
        Test("within_163j_limit", exempt or interest <= cap,
             "not applicable — exempt under the small-business exception" if exempt else
             f"${interest:,.0f} of interest against a cap of {pct:.0%} × ${ati:,.0f} = "
             f"${cap:,.0f}"
             + ("" if interest <= cap else f"; ${carryforward:,.0f} carries forward"),
             decided_by="adjusted_taxable_income"),
        Test("no_itemizing_required", True,
             "business interest is an above-the-line business expense, so it does not require "
             "itemizing — unlike mortgage, HELOC or investment interest",
             decided_by=None),
    )
    return TreatmentResult(
        rule="debt_interest.business",
        determination=DEDUCTIBLE if deductible >= interest else PARTIALLY_DEDUCTIBLE,
        authority="IRC §163(j); §163(j)(3) small-business exception",
        summary=f"${deductible:,.0f} of ${interest:,.0f} business interest is deductible",
        amount=round(deductible, 2), character=ORDINARY, tests=tests,
        binding_limit=(None if exempt or interest <= cap
                       else f"§163(j): {pct:.0%} of adjusted taxable income (${cap:,.0f})"),
        traps=("The §163(j) cap is a share of adjusted taxable income, so it SHRINKS in a bad year — "
               "the deduction is smallest exactly when the business needs it most.",
               "An SBA guarantee fee is generally capitalized and amortized rather than deducted "
               "in the year paid.",
               "For owner-occupied commercial real estate the interest must be allocated between "
               "business and investment use, and the two halves follow different rules."),
        inputs_used={"annual_interest": interest, "adjusted_taxable_income": ati,
                     "gross_receipts": receipts, "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
    )


# ── Student loan ──────────────────────────────────────────────────────────────────────────────────
@rule("debt_interest.student_loan")
def student_loan_interest(*, annual_interest: float, agi: float, filing_status: str,
                          tax_year: Optional[int] = None) -> TreatmentResult:
    """Student-loan interest — an above-the-line deduction, capped, with its own phase-out.

    NO ITEMIZING REQUIRED, which makes it one of the few interest deductions most filers can
    actually use. But MARRIED FILING SEPARATELY IS INELIGIBLE ENTIRELY — a filing-status choice made
    for other reasons silently destroys it.
    """
    interest = require_money("annual_interest", annual_interest)
    income = require_money("agi", agi)
    status = str(filing_status or "").strip().lower()
    p = _params(tax_year)
    cfg = p.data["debt_interest"]
    cap = float(cfg["student_loan_interest_cap"])
    ranges = cfg["student_loan_phase_out"]

    if status == "married_separately":
        return TreatmentResult(
            rule="debt_interest.student_loan", determination=NOT_DEDUCTIBLE,
            authority="IRC §221(e)(2)",
            summary="married filing separately cannot deduct student-loan interest at all",
            amount=0.0, character=ORDINARY,
            tests=(Test("filing_status_eligible", False,
                        "married filing separately is statutorily ineligible, regardless of income "
                        "or amount paid",
                        decided_by="filing_status"),),
            traps=("If you filed separately for another reason — income-driven repayment, say — "
                   "that choice also costs you this deduction. Worth pricing both together.",),
            inputs_used={"annual_interest": interest, "agi": income,
                         "filing_status": status, "tax_year": p.year_used},
            parameters_verified=p.is_verified, parameter_year=p.year_used,
        )
    if status not in ranges:
        raise TreatmentError(
            f"no student-loan phase-out range for filing status {status!r}; have {sorted(ranges)}")

    lo, hi = (float(x) for x in ranges[status])
    share = 1.0 if income <= lo else (0.0 if income >= hi else 1.0 - (income - lo) / (hi - lo))
    capped = min(interest, cap)
    deductible = capped * share

    tests = (
        Test("filing_status_eligible", True,
             f"{status.replace('_', ' ')} is eligible", decided_by="filing_status"),
        Test("within_cap", interest <= cap,
             f"${interest:,.0f} paid {'is within' if interest <= cap else 'exceeds'} the "
             f"${cap:,.0f} annual cap", decided_by="annual_interest"),
        Test("within_phase_out", share > 0,
             f"AGI ${income:,.0f} against ${lo:,.0f}-${hi:,.0f} leaves {share:.0%} of the deduction",
             decided_by="agi"),
        Test("no_itemizing_required", True,
             "this is an above-the-line deduction, so you get it whether or not you itemize",
             decided_by=None),
    )
    return TreatmentResult(
        rule="debt_interest.student_loan",
        determination=DEDUCTIBLE if share == 1.0 and interest <= cap else (
            NOT_DEDUCTIBLE if share == 0 else PARTIALLY_DEDUCTIBLE),
        authority="IRC §221",
        summary=f"${deductible:,.0f} of ${interest:,.0f} student-loan interest is deductible",
        amount=round(deductible, 2), character=ORDINARY, tests=tests,
        binding_limit=(f"${cap:,.0f} annual cap" if interest > cap and share == 1.0 else
                       (f"AGI phase-out ${lo:,.0f}-${hi:,.0f}" if share < 1.0 else None)),
        traps=("The cap is per RETURN, not per borrower — a couple with two loans still deducts up "
               f"to ${cap:,.0f} between them.",),
        inputs_used={"annual_interest": interest, "agi": income, "filing_status": status,
                     "tax_year": p.year_used},
        parameters_verified=p.is_verified, parameter_year=p.year_used,
    )


# ── The bridge into Phase L ───────────────────────────────────────────────────────────────────────
@rule("debt_interest.after_tax_cost")
def after_tax_cost_of_debt(*, apr: float, deductible_share: float, marginal_rate: float,
                           label: str = "this financing") -> TreatmentResult:
    """Effective cost of borrowing after the deduction. The bridge `financing_optimizer` needs.

        after_tax_apr = apr × (1 − deductible_share × marginal_rate)

    WHY A PRE-TAX RANKING IS WRONG. At a 32% marginal rate, a fully deductible HELOC at 8% costs
    5.44% after tax, while a non-deductible margin loan at 7% costs 7.00%. The cheaper-looking loan
    is the more expensive one, and no amount of rate comparison reveals it.

    `deductible_share` comes from the determinations above — 1.0 when fully deductible, 0.0 when not,
    and the ratio when partial (an over-cap mortgage, or investment interest limited by net
    investment income). Taking it as an input rather than re-deriving it keeps one tracing
    implementation rather than two.
    """
    rate = require_rate("apr", apr)
    share = require_rate("deductible_share", deductible_share)
    marginal = require_rate("marginal_rate", marginal_rate)
    if share > 1.0:
        raise CalculatorError(f"deductible_share must be 0-1, got {share}")

    after_tax = rate * (1.0 - share * marginal)
    saving = rate - after_tax
    return TreatmentResult(
        rule="debt_interest.after_tax_cost",
        determination=DEDUCTIBLE if share > 0 else NOT_DEDUCTIBLE,
        authority="derived — IRC §163 deductibility applied to the stated rate",
        summary=(f"{label} costs {after_tax:.2%} after tax, not {rate:.2%}"
                 if share > 0 else
                 f"{label} costs the full {rate:.2%} — the interest is not deductible"),
        amount=round(after_tax, 6), unit="pct", character=ORDINARY,
        tests=(Test("deduction_applies", share > 0,
                    f"{share:.0%} of the interest is deductible at a {marginal:.1%} marginal rate, "
                    f"cutting the effective rate by {saving:.2%}" if share > 0 else
                    "none of the interest is deductible, so the stated rate IS the cost",
                    decided_by="deductible_share"),),
        traps=("A deduction is only worth the marginal rate it offsets. If you take the standard "
               "deduction, or your marginal rate falls, the after-tax cost rises toward the stated "
               "rate — so this figure is not fixed for the life of the loan.",),
        inputs_used={"apr": rate, "deductible_share": share, "marginal_rate": marginal},
        parameters_verified=True,   # pure arithmetic on supplied inputs; no statutory threshold
        notes=(f"pre-tax {rate:.2%} → after-tax {after_tax:.2%} (saving {saving:.2%})",),
    )
