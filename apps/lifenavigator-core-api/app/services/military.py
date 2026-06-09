"""Military / VA Pack (Sprint 20).

Builds on Document Intelligence (DD214, VA award letters, LES, military retirement statements)
to assess a service member / veteran's readiness across four pillars: Military Readiness (verified
service record), Transition Readiness (separation → civilian), GI Bill Readiness (education
benefit eligibility), and VA Benefits Readiness (disability rating + award). Eligibility guidance
is informational — the VA / an accredited VSO makes the official determination; benefits boundary
on everything. Nothing is invented: a missing document or field is reported, not assumed.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

DOCS = "documents"
FINANCE = "finance"
GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"
_VA = {"boundary_type": "benefits_guidance",
       "disclaimer_text": "Eligibility and amounts are informational — verify with the VA (va.gov) or an accredited Veterans Service Officer (VSO). Not an official benefits determination."}


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _status(score: int) -> str:
    return GREEN if score >= 80 else YELLOW if score >= 60 else ORANGE if score >= 30 else RED


class MilitaryService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

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
        has_career = bool(await self._sb.select("career_profiles", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="career"))

        military = self._military(f)
        transition = self._transition(f, has_career)
        gi_bill = self._gi_bill(f)
        va = self._va_benefits(f)
        pillars = [military, transition, gi_bill, va]
        index = round(sum(p["score"] for p in pillars) / len(pillars))
        weakest = min(pillars, key=lambda p: p["score"])

        return {
            "is_service_connected": bool(f.get("dd214") or f.get("va_award_letter") or f.get("les") or f.get("military_retirement_statement")),
            "military_index": index, "military_status": _status(index), "weakest_pillar": weakest["pillar"],
            "military_readiness": military, "transition_readiness": transition,
            "gi_bill_readiness": gi_bill, "va_benefits_readiness": va,
            "missing_documents": [d for d in ("dd214", "va_award_letter", "les", "military_retirement_statement") if d not in f],
            "boundary": _VA,
            "confidence": {"score": 0.6 if f.get("dd214") else 0.3, "basis": "from your uploaded service documents"},
        }

    @staticmethod
    def _honorable(dd: dict) -> bool:
        return "honor" in str(dd.get("discharge_type", "")).lower()

    def _military(self, f: dict) -> dict[str, Any]:
        dd = f.get("dd214") or {}
        if not dd:
            return {"pillar": "Military Readiness", "status": ORANGE, "score": 25, "missing": "Upload your DD214 to verify service.",
                    "recommendation": "Your DD214 unlocks GI Bill, VA, and transition benefits — upload it first.", "evidence": []}
        honorable = self._honorable(dd)
        score = 90 if honorable else 60
        return {"pillar": "Military Readiness", "status": _status(score), "score": score,
                "branch": dd.get("branch"), "rank": dd.get("rank"), "discharge_type": dd.get("discharge_type"),
                "separation_date": dd.get("separation_date"), "honorable": honorable,
                "recommendation": "Service verified. Keep certified DD214 copies secured." if honorable else "Discharge characterization affects benefits — confirm with a VSO.",
                "evidence": [{"statement": f"DD214: {dd.get('branch')} / {dd.get('discharge_type')}", "source_table": "documents:dd214"}]}

    def _transition(self, f: dict, has_career: bool) -> dict[str, Any]:
        dd = f.get("dd214") or {}
        separated = bool(dd.get("separation_date"))
        checks = {"Service record (DD214)": bool(dd), "Civilian career profile": has_career,
                  "VA benefits filed": bool(f.get("va_award_letter")), "Income/pay on file (LES)": bool(f.get("les") or f.get("military_retirement_statement"))}
        present = [k for k, v in checks.items() if v]
        score = round(100 * len(present) / len(checks))
        return {"pillar": "Transition Readiness", "status": _status(score), "score": score,
                "separated": separated, "in_place": present, "missing": [k for k, v in checks.items() if not v],
                "recommendation": "Translate your MOS to civilian roles, file VA claims, and map your finances before/at separation." if score < 100 else "Transition foundation complete — keep it current.",
                "evidence": [{"statement": f"{len(present)}/{len(checks)} transition elements in place", "source_table": "documents + career"}]}

    def _gi_bill(self, f: dict) -> dict[str, Any]:
        dd = f.get("dd214") or {}
        if not dd:
            return {"pillar": "GI Bill Readiness", "status": ORANGE, "score": 25, "eligible": None,
                    "missing": "Upload your DD214 to check GI Bill eligibility.",
                    "recommendation": "DD214 service dates + discharge determine Post-9/11 GI Bill eligibility.", "evidence": []}
        honorable = self._honorable(dd)
        eligible = honorable  # Post-9/11 generally requires 90+ days active duty + honorable (informational)
        score = 80 if eligible else 40
        return {"pillar": "GI Bill Readiness", "status": _status(score), "score": score, "eligible": eligible,
                "benefit": "Post-9/11 GI Bill (Chapter 33): up to 36 months tuition + housing + books for qualifying service.",
                "recommendation": "Likely eligible — apply at va.gov/education and check Yellow Ribbon schools." if eligible else "Eligibility depends on discharge characterization — confirm with a VSO.",
                "evidence": [{"statement": f"Discharge: {dd.get('discharge_type')} (honorable required)", "source_table": "documents:dd214"}]}

    def _va_benefits(self, f: dict) -> dict[str, Any]:
        va = f.get("va_award_letter") or {}
        if not va:
            dd = f.get("dd214") or {}
            score = 35 if dd else 20
            return {"pillar": "VA Benefits Readiness", "status": ORANGE if dd else RED, "score": score, "disability_rating": None,
                    "missing": "Upload a VA award letter (or file a claim) to track disability compensation.",
                    "recommendation": "If you have any service-connected condition, file a VA claim with a VSO — it's free.", "evidence": []}
        rating = _f(va.get("disability_rating"))
        benefit = _f(va.get("monthly_benefit"))
        score = 90 if (rating is not None) else 60
        return {"pillar": "VA Benefits Readiness", "status": _status(score), "score": score,
                "disability_rating": rating, "monthly_benefit": benefit,
                "recommendation": ("Review whether your rating reflects all current conditions — you can file for an increase." if (rating is not None and rating < 100) else "Award on file — keep it current."),
                "evidence": [{"statement": f"VA rating {rating}% · ${benefit:,.0f}/mo" if benefit else f"VA rating {rating}%", "source_table": "documents:va_award_letter"}]}
