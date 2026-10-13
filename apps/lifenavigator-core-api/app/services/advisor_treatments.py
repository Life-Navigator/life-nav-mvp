"""The B2 treatment rules, reaching the advisor (Milestone 3.1).

WHY THIS NEEDED ITS OWN SECTION IN THE PACKET
---------------------------------------------
Everything else the planner produces is a NUMBER, and the packet is built around that: compute a
figure, tier it, register it with the number gate so the model may echo it. A determination does
not fit. "Is my HELOC interest deductible?" has no figure as its answer — the answer is a verdict,
reached by a statutory test, bounded by a limit, and usually trailing a trap. Forcing it through
`CalcResult` would discard the three fields that carry the value:

  * the AUTHORITY, which is what separates this engine from a model guessing at tax law;
  * the TEST that decided it, which is the only actionable part of an unfavourable answer — "not
    deductible because the proceeds paid off credit cards rather than improving the residence
    securing the loan" tells the user the lever, where "not deductible" is a dead end;
  * the TRAP, which is where the money is actually lost and is invisible at the moment of the
    decision.

So determinations travel as prose plus provenance in their own `treatments` list, and only the
QUANTIFIED half (a deductible amount, a tax saved) is additionally routed through
`to_calc_result()` into the number gate. A determination the gate has not been told about is
indistinguishable from a fabricated one, so registering the amount IS the wiring — but the verdict
itself must not be reduced to its dollar figure.

WHAT IS DELIBERATELY A TURN INPUT
---------------------------------
Four of these rules turn on a fact only the user can state, and storing it would be wrong rather
than merely unnecessary. `proceeds_used_for` is the crux of the §163(h)(3) tracing rule: the same
HELOC is deductible or not depending on what the money bought, that can differ per draw, and it is
not a standing attribute of the person. Same for margin interest, business interest and an IRA
contribution the user is considering. These arrive per turn and are never persisted as facts.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .calculators import tax_debt_interest as DI
from .calculators import tax_wrappers as W
from .calculators.treatment import TreatmentError, TreatmentResult

log = logging.getLogger(__name__)

# A determination needs the user's filing status and AGI far more often than it needs their
# balances, which is why so little of this was reachable before the tax inputs were wired.
_PROCEEDS_USES = ("home_improvement", "home_purchase", "debt_payoff", "investment", "business",
                  "personal")


def _gap(rule: str, needs: list[str], ask: str) -> dict[str, Any]:
    """A determination that cannot be made, phrased as the question that would settle it.

    Never a default. The defaults here are not neutral — assuming interest is deductible overstates
    a deduction and assuming it is not understates one, and both are confident wrong answers.
    """
    return {"rule": rule, "needs": needs, "ask": ask}


class TreatmentPlanner:
    """Runs the treatment rules the user's facts support, for one turn."""

    def run(self, inputs: dict[str, Any], *, turn: Optional[dict[str, Any]] = None,
            age: Optional[int] = None, marginal_rate: Optional[float] = None,
            itemizing: Optional[bool] = None, tax_year: Optional[int] = None,
            loans: Optional[list[dict[str, Any]]] = None) -> dict[str, Any]:
        """Determinations plus named gaps.

        `marginal_rate` and `itemizing` are passed in rather than recomputed: both are already
        produced by the calculator pass, and a determination that disagreed with the figure in the
        same packet would be worse than either alone.
        """
        t = turn or {}
        results: list[TreatmentResult] = []
        gaps: list[dict[str, Any]] = []

        def present(key: str) -> Optional[Any]:
            f = (inputs or {}).get(key) or {}
            return f.get("value") if f.get("present") else None

        def tv(key: str) -> Optional[Any]:
            v = t.get(key)
            return v if v not in (None, "") else None

        def run(fn: Any, **kw: Any) -> Optional[TreatmentResult]:
            try:
                r = fn(**kw)
                results.append(r)
                return r
            except TreatmentError as exc:
                # A refusal is INFORMATION — "this cannot be determined without knowing what the
                # money bought" — so it becomes something the advisor can say.
                gaps.append({"rule": getattr(fn, "rule_id", "?"), "refused": str(exc)})
            except Exception as exc:  # noqa: BLE001 — grounding never breaks the turn
                log.warning("treatment rule %s failed: %s", getattr(fn, "rule_id", fn), exc)
            return None

        income = present("income")
        filing_status = present("filing_status")
        agi = present("adjusted_gross_income")
        loans = loans or []

        # ── 401(k) deferral ──────────────────────────────────────────────────────────────────────
        # Fully reachable from stored data, and it answers the question people get wrong most
        # often: whether they are on track to capture the whole match before hitting the §402(g)
        # limit. Everything it needs has been canonical since Phase 3.
        rate = present("retirement_contribution_rate")
        if income and rate is not None and age is not None:
            pct = float(rate) / 100.0 if float(rate) > 1 else float(rate)
            match = present("employer_match_rate")
            match_pct = (float(match) / 100.0 if match and float(match) > 1
                         else float(match) if match else None)
            run(W.k401_deferral, employee_deferral=float(income) * pct, age=int(age),
                compensation=float(income),
                employer_contribution=(float(income) * min(pct, match_pct)
                                       if match_pct is not None else 0.0),
                tax_year=tax_year)
        elif income and rate is not None:
            gaps.append(_gap("wrapper.k401_deferral", ["current_age"],
                             "How old are you? The catch-up contribution changes the limit at 50."))

        # ── Traditional IRA deductibility ────────────────────────────────────────────────────────
        ira = tv("ira_contribution")
        if ira and agi is not None and filing_status and age is not None:
            covered = present("covered_by_workplace_plan")
            if covered is None:
                # NOT defaulted to False. "Not covered" makes a traditional IRA fully deductible at
                # any income, so guessing it would hand a high earner a deduction they cannot take.
                gaps.append(_gap(
                    "wrapper.ira_deduction", ["covered_by_workplace_plan"],
                    "Are you covered by a retirement plan at work? It decides whether your "
                    "traditional IRA contribution is deductible at your income."))
            else:
                run(W.ira_deduction, contribution=float(ira), agi=float(agi),
                    filing_status=str(filing_status), age=int(age),
                    covered_by_workplace_plan=bool(covered), tax_year=tax_year)

        # ── Mortgage interest ────────────────────────────────────────────────────────────────────
        # `annual_interest` is the amount actually PAID (Form 1098), never balance x rate: the
        # approximation is wrong by the whole amortization schedule, and it is wrong in the
        # direction of overstating the deduction early in a loan's life.
        # Read out of the itemized components the resolver already carries, rather than adding a
        # second field for the same Form 1098 figure — two sources for one number is how they
        # diverge.
        mortgage_interest = (present("itemized_components") or {}).get("mortgage_interest")
        mortgages = [ln for ln in loans if str(ln.get("loan_type", "")).lower() == "mortgage"]
        if mortgage_interest and mortgages:
            balance = sum(float(ln.get("balance") or 0.0) for ln in mortgages)
            if balance > 0:
                run(DI.mortgage_interest, balance=balance,
                    annual_interest=float(mortgage_interest),
                    itemizing=itemizing if itemizing is not None else False,
                    tax_year=tax_year)
        elif mortgages and not mortgage_interest:
            gaps.append(_gap("debt_interest.mortgage", ["mortgage_interest_paid"],
                             "What mortgage interest did you pay last year? It is box 1 on your "
                             "Form 1098 — the balance and rate cannot stand in for it."))

        # ── HELOC: the tracing rule ──────────────────────────────────────────────────────────────
        helocs = [ln for ln in loans if str(ln.get("loan_type", "")).lower() == "heloc"]
        used_for = tv("heloc_proceeds_used_for")
        heloc_interest = tv("heloc_annual_interest")
        if helocs or heloc_interest:
            if used_for and heloc_interest:
                run(DI.heloc_interest, annual_interest=float(heloc_interest),
                    proceeds_used_for=str(used_for),
                    itemizing=itemizing if itemizing is not None else False,
                    combined_balance=(sum(float(ln.get("balance") or 0.0) for ln in helocs)
                                      or None),
                    tax_year=tax_year)
            else:
                # THE MOST CONSEQUENTIAL QUESTION IN THIS LAYER. The identical HELOC is deductible
                # or not purely on what the money bought (§163(h)(3) tracing), it can differ per
                # draw, and no stored field can answer it.
                needs = ([] if used_for else ["heloc_proceeds_used_for"]) + \
                        ([] if heloc_interest else ["heloc_annual_interest"])
                gaps.append(_gap(
                    "debt_interest.heloc", needs,
                    "What did you use the HELOC money for — improving the home that secures it, or "
                    "something else? Deductibility traces to the use, not to the loan."))

        # ── Investment (margin) interest ─────────────────────────────────────────────────────────
        margin, nii = tv("margin_annual_interest"), tv("net_investment_income")
        if margin:
            if nii is not None:
                run(DI.investment_interest, annual_interest=float(margin),
                    net_investment_income=float(nii),
                    itemizing=itemizing if itemizing is not None else False, tax_year=tax_year)
            else:
                gaps.append(_gap("debt_interest.investment", ["net_investment_income"],
                                 "What was your net investment income? §163(d) caps the margin-"
                                 "interest deduction at that figure and carries the rest forward."))

        # ── Business interest ────────────────────────────────────────────────────────────────────
        biz, ati, receipts = (tv("business_annual_interest"), tv("adjusted_taxable_income"),
                              tv("gross_receipts"))
        if biz:
            if ati is not None and receipts is not None:
                run(DI.business_interest, annual_interest=float(biz),
                    adjusted_taxable_income=float(ati), gross_receipts=float(receipts),
                    tax_year=tax_year)
            else:
                gaps.append(_gap(
                    "debt_interest.business",
                    [k for k, v in (("adjusted_taxable_income", ati), ("gross_receipts", receipts))
                     if v is None],
                    "What were the business's gross receipts and adjusted taxable income? The "
                    "§163(j) limit only applies above the gross-receipts test."))

        # ── Student loan interest ────────────────────────────────────────────────────────────────
        student_interest = present("student_loan_interest")
        if student_interest and agi is not None and filing_status:
            run(DI.student_loan_interest, annual_interest=float(student_interest),
                agi=float(agi), filing_status=str(filing_status), tax_year=tax_year)

        # ── HDHP qualification, which gates everything HSA ───────────────────────────────────────
        tier = present("health_coverage_tier")
        deductible = present("hdhp_annual_deductible")
        oop = present("hdhp_out_of_pocket_max")
        hdhp_ok: Optional[bool] = None
        if tier and deductible is not None and oop is not None:
            r = run(W.hdhp_qualifies, coverage=str(tier), annual_deductible=float(deductible),
                    out_of_pocket_max=float(oop), tax_year=tax_year)
            if r is not None:
                hdhp_ok = r.is_favourable
        elif present("hsa_eligible") or present("hsa_annual_contribution") is not None:
            # Someone is funding an HSA and we cannot confirm the plan qualifies. That is the
            # expensive case: contributions to an HSA without qualifying coverage are excess
            # contributions, taxable and penalised at 6% a year until withdrawn.
            gaps.append(_gap(
                "wrapper.hdhp_qualifies",
                [k for k, v in (("health_coverage_tier", tier),
                                ("hdhp_annual_deductible", deductible),
                                ("hdhp_out_of_pocket_max", oop)) if v in (None, "")],
                "What are your health plan's deductible and out-of-pocket maximum, and is it "
                "self-only or family coverage? HSA contributions made without qualifying coverage "
                "are excess contributions and carry a 6% annual penalty."))

        # ── HSA contribution ─────────────────────────────────────────────────────────────────────
        hsa_amount = present("hsa_annual_contribution")
        if hsa_amount is not None and tier and age is not None:
            run(W.hsa_contribution, coverage=str(tier), amount=float(hsa_amount), age=int(age),
                through_payroll=bool(present("hsa_through_payroll")),
                employer_contribution=float(present("hsa_employer_contribution") or 0.0),
                marginal_rate=marginal_rate, tax_year=tax_year)
        elif hsa_amount is not None and not tier:
            gaps.append(_gap("wrapper.hsa_contribution", ["health_coverage_tier"],
                             "Is your coverage self-only or family? The HSA limit is roughly "
                             "double for family coverage."))

        # ── FSA / HSA compatibility ──────────────────────────────────────────────────────────────
        # Run whenever an FSA is on file, because the unfavourable answer is the valuable one: a
        # general-purpose FSA disqualifies an HSA for the ENTIRE plan year, which people discover
        # after they have already contributed.
        fsa_type = present("fsa_type")
        if fsa_type and str(fsa_type).lower() == "none":
            fsa_type = None          # "no FSA" is an answer, not a type to run the rule against
        if fsa_type:
            run(W.fsa_hsa_compatibility, fsa_type=str(fsa_type), tax_year=tax_year)
        elif present("fsa_election") is not None:
            gaps.append(_gap("wrapper.fsa_hsa_compatibility", ["fsa_type"],
                             "Is your FSA general-purpose or limited-purpose? A general-purpose "
                             "FSA disqualifies an HSA for the whole plan year."))

        # ── After-tax cost of debt ───────────────────────────────────────────────────────────────
        # Chained off the determinations above rather than assumed: the deductible share IS the
        # output of the tracing rules, and the whole point of this figure is that a 7% deductible
        # mortgage can cost less than a 5% non-deductible car loan.
        apr = present("debt_apr")
        if apr is not None and marginal_rate is not None:
            deductible_share = self._deductible_share(results)
            run(DI.after_tax_cost_of_debt, apr=float(apr),
                deductible_share=deductible_share, marginal_rate=float(marginal_rate),
                label="blended debt")

        return {
            "available": bool(results),
            "treatments": [r.as_dict() for r in results],
            # The quantified halves, so the number gate admits them. An amount the gate has not
            # been told about is indistinguishable from a fabricated one.
            "amounts": [r.to_calc_result().as_dict() for r in results if r.amount is not None],
            "gaps": gaps,
            "unfavourable_with_levers": [
                {"rule": r.rule, "summary": r.summary,
                 "what_would_change_it": list(r.what_would_change_it)}
                for r in results if not r.is_favourable and r.what_would_change_it
            ],
            "traps": sorted({trap for r in results for trap in r.traps}),
            "hdhp_qualifies": hdhp_ok,
            "constraints": [
                "A determination is a verdict with an authority. Cite the authority as given; "
                "never paraphrase or generalise the rule.",
                "An UNFAVOURABLE determination must be delivered with its "
                "`what_would_change_it` levers — the failed test is the actionable part, and a "
                "bare 'not deductible' is a dead end.",
                "`traps` are delayed costs the user cannot see at the moment of the decision. "
                "Surface every one that applies; omitting them is the specific failure this layer "
                "exists to prevent.",
                "`parameters_verified: false` means the RULE holds and the dollar threshold is "
                "unverified. State the determination plainly and hedge the amount — not the "
                "reverse.",
                "A gap is a question to ASK. Never assume a determination: assuming interest is "
                "deductible overstates a deduction and assuming it is not understates one.",
            ],
        }

    @staticmethod
    def _deductible_share(results: list[TreatmentResult]) -> float:
        """Share of interest the determinations above actually found deductible.

        Weighted by amount where the rules quantified one, so a large non-deductible balance is not
        offset by a small deductible one. Falls back to 0.0 — the conservative direction, because
        overstating deductibility understates the true cost of the debt and makes borrowing look
        cheaper than it is.
        """
        interest_rules = [r for r in results if r.rule.startswith("debt_interest.")
                          and r.rule != "debt_interest.after_tax_cost" and r.amount is not None]
        if not interest_rules:
            return 0.0
        claimed = sum(float(r.inputs_used.get("annual_interest") or 0.0) for r in interest_rules)
        if claimed <= 0:
            return 0.0
        allowed = sum(float(r.amount or 0.0) for r in interest_rules)
        return max(0.0, min(1.0, allowed / claimed))
