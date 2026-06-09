"""Family Office Foundation (Sprint 18).

Estate / Trust / Beneficiary / Survivor / Legacy readiness, composed from the Family domain +
the user's uploaded family-office documents (will, trust, estate plan) + their insurance picture.
Each pillar is scored GREEN/YELLOW/ORANGE/RED with what's in place, what's missing, and the next
step. Estate, trust, guardianship, and beneficiary work require an attorney — this surfaces the
legal boundary on every pillar and is explicitly NOT legal advice. Nothing is invented: a
missing document or flag is reported, not assumed complete.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

DOCS = "documents"
GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"
_LEGAL = {"boundary_type": "legal", "disclaimer_text": "Estate, trust, guardianship, and beneficiary planning require a licensed attorney. This is planning readiness, not legal advice."}


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _status(score: int) -> str:
    return GREEN if score >= 80 else YELLOW if score >= 60 else ORANGE if score >= 30 else RED


class FamilyOfficeService:
    def __init__(self, supabase: Any, family_service: Any, comp_benefits: Any) -> None:
        self._sb = supabase
        self._family = family_service
        self._comp = comp_benefits

    async def _facts(self, ctx: UserContext) -> dict[str, dict[str, Any]]:
        rows = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, order="uploaded_at.desc", schema=DOCS)
        out: dict[str, dict[str, Any]] = {}
        for r in rows:
            dt = r.get("doc_type")
            if dt and dt not in out:
                out[dt] = r.get("extracted_json") or {}
        return out

    async def assess(self, ctx: UserContext) -> dict[str, Any]:
        f = await self._facts(ctx)
        try:
            vm = await self._family.summary(ctx)
            fam = vm.data or {}
        except Exception:  # noqa: BLE001
            fam = {}
        estate = (fam.get("readiness") or {}).get("estate") or {}
        protection = fam.get("protection") or {}
        dependents = (fam.get("readiness") or {}).get("dependents") or 0

        estate_r = self._estate(estate, f)
        trust_r = self._trust(f, protection, dependents)
        bene_r = self._beneficiary(estate, f)
        survivor_r = self._survivor(protection, dependents)
        legacy_r = self._legacy([estate_r, trust_r, bene_r, survivor_r])

        return {
            "legacy_index": legacy_r["score"], "legacy_status": legacy_r["status"],
            "estate_readiness": estate_r, "trust_readiness": trust_r,
            "beneficiary_readiness": bene_r, "survivor_planning": survivor_r, "legacy_readiness": legacy_r,
            "dependents": dependents,
            "missing_documents": [d for d in ("will", "trust", "estate_plan") if d not in f],
            "boundary": _LEGAL,
            "confidence": {"score": 0.6 if (estate or f) else 0.3, "basis": "from your family data + uploaded estate documents"},
        }

    @staticmethod
    def _estate(estate: dict, f: dict) -> dict[str, Any]:
        ep = f.get("estate_plan") or {}
        will = bool(estate.get("has_will")) or "will" in f or str(ep.get("has_will", "")).lower() in ("yes", "true")
        poa = bool(estate.get("has_poa")) or str(ep.get("has_poa", "")).lower() in ("yes", "true")
        directive = str(ep.get("has_healthcare_directive", "")).lower() in ("yes", "true")
        beneficiaries = bool(estate.get("has_beneficiaries"))
        checklist = {"Will": will, "Power of attorney": poa, "Healthcare directive": directive, "Beneficiaries designated": beneficiaries}
        present = [k for k, v in checklist.items() if v]
        score = round(100 * len(present) / len(checklist))
        return {"pillar": "Estate Readiness", "status": _status(score), "score": score,
                "in_place": present, "missing": [k for k, v in checklist.items() if not v],
                "recommendation": "Work with an attorney to complete the missing documents." if len(present) < len(checklist) else "Estate basics in place — review every 3 years.",
                "evidence": [{"statement": f"{k}: {'yes' if v else 'no'}", "source_table": "family.estate_plans / documents"} for k, v in checklist.items()]}

    @staticmethod
    def _trust(f: dict, protection: dict, dependents: int) -> dict[str, Any]:
        trust = f.get("trust") or {}
        has_trust = bool(trust)
        est_value = _f(trust.get("estimated_value"))
        # trust is warranted when there are dependents or meaningful protection in play
        warranted = dependents > 0 or (_f(protection.get("life_insurance_need")) or 0) > 500000
        if has_trust:
            score = 90
            rec = "Confirm the trust is funded and the trustee/successor are current."
        elif warranted:
            score = 25
            rec = "With dependents/assets at stake, ask an attorney whether a revocable living trust fits."
        else:
            score = 60
            rec = "A trust may not be necessary yet — revisit as assets/dependents grow."
        return {"pillar": "Trust Readiness", "status": _status(score), "score": score,
                "has_trust": has_trust, "trust_type": trust.get("trust_type"), "trustee": trust.get("trustee"),
                "estimated_value": est_value, "warranted": warranted, "recommendation": rec,
                "evidence": [{"statement": f"Trust on file: {'yes' if has_trust else 'no'}", "source_table": "documents:trust"}]}

    @staticmethod
    def _beneficiary(estate: dict, f: dict) -> dict[str, Any]:
        life = f.get("life_insurance_policy") or {}
        life_bene = bool(life.get("beneficiary")) or bool(estate.get("has_beneficiaries"))
        retire_bene = bool(estate.get("has_beneficiaries"))  # proxy until per-account beneficiary capture
        checks = {"Life insurance beneficiary": life_bene, "Retirement account beneficiary": retire_bene}
        present = [k for k, v in checks.items() if v]
        score = round(100 * len(present) / len(checks))
        return {"pillar": "Beneficiary Readiness", "status": _status(score), "score": score,
                "in_place": present, "missing": [k for k, v in checks.items() if not v],
                "recommendation": "Name/refresh beneficiaries on every policy and retirement account (they override your will)." if len(present) < len(checks) else "Beneficiaries set — re-check after any major life event.",
                "evidence": [{"statement": ("Life policy beneficiary: " + str(life.get("beneficiary") or "—")), "source_table": "documents:life_insurance_policy"}]}

    @staticmethod
    def _survivor(protection: dict, dependents: int) -> dict[str, Any]:
        coverage = _f(protection.get("life_coverage"))
        need = _f(protection.get("life_insurance_need"))
        gap = _f(protection.get("coverage_gap")) or 0
        if coverage is None or need is None:
            return {"pillar": "Survivor Planning", "status": ORANGE, "score": 30,
                    "missing": "Add income + a life policy to assess survivor protection.",
                    "recommendation": "Upload a life insurance policy and confirm your income basis.",
                    "evidence": []}
        ratio = coverage / need if need else 1.0
        score = round(max(0, min(100, ratio * 100)))
        covered = gap <= 0
        return {"pillar": "Survivor Planning", "status": _status(score), "score": score,
                "life_coverage": coverage, "life_insurance_need": need, "coverage_gap": gap,
                "dependents_protected": dependents if covered else 0, "covered": covered,
                "recommendation": (f"Close a ${gap:,.0f} coverage gap so survivors keep their standard of living." if not covered else "Survivor coverage is adequate — revisit when income or dependents change."),
                "evidence": [{"statement": f"Coverage ${coverage:,.0f} vs need ${need:,.0f}", "source_table": "family.insurance_profiles"}]}

    @staticmethod
    def _legacy(pillars: list[dict]) -> dict[str, Any]:
        score = round(sum(p["score"] for p in pillars) / len(pillars)) if pillars else 0
        weakest = min(pillars, key=lambda p: p["score"]) if pillars else None
        return {"pillar": "Legacy Readiness", "status": _status(score), "score": score,
                "weakest_pillar": weakest["pillar"] if weakest else None,
                "recommendation": "Your legacy plan is only as strong as its weakest pillar — start there with an attorney." if score < 80 else "A solid legacy foundation — keep documents current.",
                "evidence": [{"statement": f"Average of {len(pillars)} family-office pillars", "source_table": "computed"}]}
