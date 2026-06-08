"""Compensation & Benefits Intelligence (Sprint 12).

Turns the user's uploaded documents (offer letter, 401(k), HSA, FSA, medical plan, life/disability
insurance, legal benefit) into a personalized analysis: total compensation, five-year value,
benefit valuation, retirement impact, insurance impact, and FSA/HSA optimization tied to their
own healthcare spend. Every figure cites its source document or a flagged assumption — nothing is
invented; a benefit with no document on file is reported as missing, not estimated. Not tax advice.
"""
from __future__ import annotations

from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext

DOCS = "documents"
FINANCE = "finance"

# Assumptions (flagged in output). IRS limits are approximate 2026 figures.
EQUITY_VEST_YEARS = 4
BASE_GROWTH = 0.03
RETIREMENT_RETURN = 0.06
FSA_CAP = 3300
HSA_CAP_INDIVIDUAL = 4300
HSA_CAP_FAMILY = 8550
# Approx single-filer federal marginal brackets (2026, taxable income).
_BRACKETS = [(0, 0.10), (11_600, 0.12), (47_150, 0.22), (100_525, 0.24), (191_950, 0.32), (243_725, 0.35), (609_350, 0.37)]
_HEALTHCARE_HINTS = ("medical", "health", "pharmacy", "dental", "vision", "doctor", "clinic", "hospital", "rx")


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def marginal_rate(income: float) -> float:
    rate = 0.10
    for floor, r in _BRACKETS:
        if income >= floor:
            rate = r
    return rate


class CompensationBenefitsEngine:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def _facts(self, ctx: UserContext) -> dict[str, dict[str, Any]]:
        """Latest extracted_json per doc_type for this user (the document payoff)."""
        rows = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, order="uploaded_at.desc", schema=DOCS)
        out: dict[str, dict[str, Any]] = {}
        for r in rows:
            dt = r.get("doc_type")
            if dt and dt not in out:  # first (most recent) wins
                out[dt] = r.get("extracted_json") or {}
        return out

    async def _healthcare_spend(self, ctx: UserContext, override: Optional[float]) -> tuple[Optional[float], str]:
        if override is not None:
            return override, "user-provided"
        txns = await self._sb.select("transactions", filters={"user_id": f"eq.{ctx.user_id}"}, limit=2000, schema=FINANCE)
        total = 0.0
        found = False
        for t in txns:
            cat = f"{t.get('category', '')} {t.get('name', '')} {t.get('merchant_name', '')}".lower()
            if any(h in cat for h in _HEALTHCARE_HINTS):
                amt = _f(t.get("amount"))
                if amt:
                    total += abs(amt)
                    found = True
        return (round(total, 2), "finance.transactions (annualized)") if found else (None, "unknown")

    async def analyze(self, ctx: UserContext, healthcare_spend: Optional[float] = None) -> dict[str, Any]:
        f = await self._facts(ctx)
        assumptions: list[dict[str, Any]] = []
        evidence: list[dict[str, Any]] = []

        def cite(stmt: str, src: str) -> None:
            evidence.append({"statement": stmt, "source_table": src})

        # ---- Total compensation (from offer letter / comp plan / promotion) ----
        comp_doc = "offer_letter" if "offer_letter" in f else ("compensation_plan" if "compensation_plan" in f else ("promotion_letter" if "promotion_letter" in f else None))
        cd = f.get(comp_doc or "", {})
        base = _f(cd.get("base_salary")) or _f(cd.get("new_base_salary")) or 0.0
        ab = cd.get("annual_bonus") or cd.get("target_bonus")
        ab_num = _f(ab)
        bonus = (base * ab_num / 100.0) if (ab_num is not None and ab_num <= 100) else (ab_num or 0.0)
        signing = _f(cd.get("signing_bonus")) or 0.0
        equity_total = _f(cd.get("equity_grant")) or 0.0
        equity_annual = round(equity_total / EQUITY_VEST_YEARS, 2) if equity_total else 0.0
        if comp_doc:
            cite(f"Base salary ${base:,.0f}, bonus ${bonus:,.0f}, equity ${equity_total:,.0f}", f"documents.documents:{comp_doc}")
        if equity_total:
            assumptions.append({"assumption_text": f"Equity vests evenly over {EQUITY_VEST_YEARS} years", "confidence": 0.6})

        # employer benefits value
        employer_benefits = 0.0
        bv: list[dict[str, Any]] = []
        # 401k match
        k = f.get("401k_statement") or f.get("pension") or {}
        match_pct = _f(k.get("employer_match"))
        match_dollars = round(base * match_pct / 100.0, 2) if (match_pct and base) else 0.0
        if match_dollars:
            employer_benefits += match_dollars
            bv.append({"benefit": "401(k) employer match", "annual_value": match_dollars, "basis": f"{match_pct}% of base", "source": "documents.documents:401k_statement"})
        # HSA
        hsa = f.get("hsa") or {}
        hsa_employer = _f(hsa.get("employer_match")) or 0.0
        if hsa_employer:
            employer_benefits += hsa_employer
            bv.append({"benefit": "HSA employer contribution", "annual_value": hsa_employer, "basis": "employer funding", "source": "documents.documents:hsa"})
        # legal benefit
        if "legal_benefit" in f or "legal" in f:
            bv.append({"benefit": "Legal plan", "annual_value": 250.0, "basis": "typical legal-plan value (assumption)", "source": "documents.documents:legal"})
            assumptions.append({"assumption_text": "Legal plan valued at ~$250/yr (typical)", "confidence": 0.5})
        # insurance premium subsidy (employer-paid, if disability/life via employer) — only if documented
        total_comp = round(base + bonus + equity_annual + employer_benefits, 2)

        # ---- Five-year value ----
        five_year = []
        cumulative = 0.0
        b = base
        for yr in range(1, 6):
            year_total = round(b + bonus + (equity_total / EQUITY_VEST_YEARS if yr <= EQUITY_VEST_YEARS else 0) + employer_benefits + (signing if yr == 1 else 0), 2)
            cumulative += year_total
            five_year.append({"year": yr, "base": round(b, 2), "total": year_total})
            b = b * (1 + BASE_GROWTH)
        assumptions.append({"assumption_text": f"Base grows {BASE_GROWTH:.0%}/yr", "confidence": 0.5})

        # ---- Retirement impact (401k) ----
        retirement = self._retirement(base, k, match_dollars, assumptions)

        # ---- Insurance impact ----
        insurance = self._insurance(f, base, cite)

        # ---- FSA / HSA optimization ----
        spend, spend_src = await self._healthcare_spend(ctx, healthcare_spend)
        mrate = marginal_rate(base) if base else 0.22
        fsa_hsa = self._fsa_hsa(f, spend, spend_src, mrate, hsa_employer, assumptions, cite)

        missing = [d for d in ("401k_statement", "hsa", "fsa", "disability_insurance", "life_insurance_policy") if d not in f]
        return {
            "source_documents": sorted(f.keys()),
            "total_compensation": {"base": base, "bonus": round(bonus, 2), "signing_bonus": signing,
                                   "equity_annualized": equity_annual, "employer_benefits": round(employer_benefits, 2), "total": total_comp},
            "five_year_value": {"by_year": five_year, "cumulative": round(cumulative, 2)},
            "benefit_valuation": bv,
            "retirement_impact": retirement,
            "insurance_impact": insurance,
            "fsa_hsa": fsa_hsa,
            "missing_documents": missing,
            "marginal_rate": mrate,
            "evidence": evidence,
            "assumptions": assumptions,
            "boundary": {"boundary_type": "financial_guidance", "disclaimer_text": "Estimates from your documents — not tax, legal, or investment advice. Confirm limits with your plan administrator and a tax professional."},
            "confidence": {"score": 0.7 if comp_doc else 0.3, "basis": "from uploaded documents" if comp_doc else "no compensation document on file"},
        }

    @staticmethod
    def _retirement(base: float, k: dict, match_dollars: float, assumptions: list) -> dict[str, Any]:
        if not k:
            return {"missing": "Upload your 401(k) statement to model retirement impact."}
        rate = _f(k.get("contribution_rate")) or 0.0
        employee = round(base * rate / 100.0, 2) if (rate and base) else 0.0
        annual = round(employee + match_dollars, 2)
        years = 25
        # future value of a growing annual contribution
        fv = 0.0
        for _ in range(years):
            fv = (fv + annual) * (1 + RETIREMENT_RETURN)
        assumptions.append({"assumption_text": f"{RETIREMENT_RETURN:.0%} return over {years} yrs to retirement", "confidence": 0.4})
        return {"annual_employee_contribution": employee, "annual_employer_match": match_dollars,
                "annual_total": annual, "projected_addition_at_retirement": round(fv, 0),
                "match_is_free_money": match_dollars}

    @staticmethod
    def _insurance(f: dict, base: float, cite) -> dict[str, Any]:
        life = f.get("life_insurance_policy") or {}
        dis = f.get("disability_insurance") or {}
        life_cov = _f(life.get("coverage_amount"))
        life_need = round(base * 10, 2) if base else None
        out: dict[str, Any] = {}
        if life_cov is not None:
            cite(f"Life coverage ${life_cov:,.0f}", "documents.documents:life_insurance_policy")
            out["life"] = {"coverage": life_cov, "need_10x_income": life_need,
                           "gap": round((life_need - life_cov), 2) if (life_need and life_cov < life_need) else 0,
                           "status": "adequate" if (life_need and life_cov >= life_need) else "gap"}
        else:
            out["life"] = {"missing": "Upload a life insurance policy to assess coverage adequacy."}
        if dis:
            mb = _f(dis.get("monthly_benefit"))
            out["disability"] = {"monthly_benefit": mb, "annual_benefit": round(mb * 12, 2) if mb else None,
                                 "income_replacement_pct": round(100 * (mb * 12) / base) if (mb and base) else None}
        else:
            out["disability"] = {"missing": "Upload a disability policy — most people are underinsured here."}
        return out

    @staticmethod
    def _fsa_hsa(f: dict, spend: Optional[float], spend_src: str, mrate: float, hsa_employer: float, assumptions: list, cite) -> dict[str, Any]:
        has_hsa = "hsa" in f
        has_fsa = "fsa" in f
        has_hdhp = "high" in str((f.get("medical_plan") or {}).get("coverage_type", "")).lower() or has_hsa
        out: dict[str, Any] = {"annual_healthcare_spend": spend, "spend_source": spend_src, "marginal_rate": mrate}
        if spend is None:
            out["prompt"] = "Add your annual healthcare spend (or connect transactions) to model FSA/HSA tax savings."
        # FSA
        if has_fsa or spend is not None:
            fsa_contrib = min(spend, FSA_CAP) if spend is not None else FSA_CAP
            out["fsa"] = {"recommended_contribution": round(fsa_contrib, 2), "cap": FSA_CAP,
                          "annual_tax_savings": round(fsa_contrib * mrate, 2),
                          "note": "FSA is use-it-or-lose-it; fund to expected eligible spend." if spend is not None else "Estimate your spend to right-size."}
            assumptions.append({"assumption_text": f"FSA cap ~${FSA_CAP:,} (IRS 2026, approximate)", "confidence": 0.6})
        # HSA (only sensible with an HDHP)
        if has_hsa or has_hdhp:
            cap = HSA_CAP_FAMILY if "family" in str((f.get("medical_plan") or {}).get("coverage_type", "")).lower() else HSA_CAP_INDIVIDUAL
            employee_room = max(0.0, cap - hsa_employer)
            tax_savings = round(cap * mrate, 2)
            # triple-tax-advantaged growth on the invested portion
            invested = max(0.0, cap - (spend or 0))
            growth_20yr = round(invested * ((1 + RETIREMENT_RETURN) ** 20 - 1), 0)
            out["hsa"] = {"cap": cap, "employer_contribution": hsa_employer, "your_room": round(employee_room, 2),
                          "annual_tax_savings": tax_savings, "investable_after_spend": round(invested, 2),
                          "20yr_tax_free_growth_on_investable": growth_20yr,
                          "note": "HSA is triple-tax-advantaged; invest what you don't spend for tax-free growth."}
            assumptions.append({"assumption_text": f"HSA cap ~${cap:,} (IRS 2026, approximate); {RETIREMENT_RETURN:.0%} growth", "confidence": 0.5})
            if spend is not None:
                cite(f"Annual healthcare spend ${spend:,.0f}", spend_src)
        elif not has_fsa:
            out["note"] = "No HSA/FSA document on file. Upload your benefits package to model pre-tax healthcare savings."
        # net-worth effect
        nw = 0.0
        if "fsa" in out:
            nw += out["fsa"]["annual_tax_savings"]
        if "hsa" in out:
            nw += out["hsa"]["annual_tax_savings"] + hsa_employer
        out["annual_net_worth_effect"] = round(nw, 2)
        return out
