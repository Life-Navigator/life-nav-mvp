"""Health Intelligence Foundation (Sprint 19).

Uses the document engine to organize the user's health documents — lab reports, supplement +
medication lists, fitness plans, nutrition logs — into a readable, tracked picture. Lab values
are compared against GENERAL reference ranges as a factual flag ("within / outside reference
range — discuss with your clinician"); this NEVER diagnoses, dose-adjusts, or treats. Medical
boundary on everything. Nothing is invented: a marker not on a lab report is simply absent.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext

DOCS = "documents"
GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"
_MEDICAL = {"boundary_type": "medical",
            "disclaimer_text": "Health information only — not medical advice, diagnosis, or treatment. Reference ranges are general; review your results, supplements, and medications with a licensed clinician."}

# General adult reference ranges (factual lab-report norms). Used only to flag in/out of range.
REF: dict[str, dict[str, Any]] = {
    "total_cholesterol": {"low": None, "high": 200, "unit": "mg/dL", "ideal": "< 200"},
    "hdl": {"low": 40, "high": None, "unit": "mg/dL", "ideal": "≥ 40"},
    "ldl": {"low": None, "high": 130, "unit": "mg/dL", "ideal": "< 130"},
    "triglycerides": {"low": None, "high": 150, "unit": "mg/dL", "ideal": "< 150"},
    "glucose": {"low": 70, "high": 99, "unit": "mg/dL", "ideal": "70–99 (fasting)"},
    "a1c": {"low": None, "high": 5.7, "unit": "%", "ideal": "< 5.7"},
    "vitamin_d": {"low": 30, "high": 100, "unit": "ng/mL", "ideal": "30–100"},
    "tsh": {"low": 0.4, "high": 4.0, "unit": "mIU/L", "ideal": "0.4–4.0"},
}
LABEL = {"total_cholesterol": "Total Cholesterol", "hdl": "HDL", "ldl": "LDL", "triglycerides": "Triglycerides",
         "glucose": "Glucose (fasting)", "a1c": "A1C", "vitamin_d": "Vitamin D", "tsh": "TSH"}


def _f(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _split(v: Any) -> list[str]:
    if not v:
        return []
    return [x.strip() for x in str(v).replace(";", ",").replace("\n", ",").split(",") if x.strip()]


def _status(score: int) -> str:
    return GREEN if score >= 80 else YELLOW if score >= 60 else ORANGE if score >= 30 else RED


class HealthIntelligenceService:
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
        labs = self._labs(f.get("lab_report") or {})
        supplements = _split((f.get("supplement_list") or {}).get("supplements"))
        medications = _split((f.get("medication_list") or {}).get("medications"))
        fitness = self._fitness(f.get("fitness_plan") or {})
        nutrition = self._nutrition(f.get("nutrition_log") or {})

        # Health document readiness — which clinical inputs are on file.
        present = {"Labs": "lab_report" in f, "Supplements": bool(supplements), "Medications": "medication_list" in f,
                   "Fitness plan": "fitness_plan" in f, "Nutrition": "nutrition_log" in f}
        have = [k for k, v in present.items() if v]
        readiness_score = round(100 * len(have) / len(present))

        flagged = [m for m in labs["markers"] if m["flag"] == "outside_range"]
        return {
            "readiness": {"status": _status(readiness_score), "score": readiness_score,
                          "in_place": have, "missing": [k for k, v in present.items() if not v]},
            "labs": labs,
            "supplements": {"count": len(supplements), "items": supplements,
                            "note": "List for your reference — review interactions with your pharmacist or clinician." if supplements else "Upload a supplement list to track what you take."},
            "medications": {"count": len(medications), "items": medications,
                            "note": "Adherence + interaction review is your clinician's call — this is a record only." if medications else "Upload a medication list to keep an accurate record."},
            "fitness": fitness,
            "nutrition": nutrition,
            "action_items": ([f"{LABEL[m['marker']]} is outside the general reference range ({m['ideal']}) — discuss with your clinician." for m in flagged]
                             + ([f"Upload your {k.lower()}" for k, v in present.items() if not v][:2])),
            "missing_documents": [d for d in ("lab_report", "supplement_list", "medication_list", "fitness_plan", "nutrition_log") if d not in f],
            "boundary": _MEDICAL,
            "confidence": {"score": 0.6 if f else 0.2, "basis": "from your uploaded health documents"},
        }

    @staticmethod
    def _labs(lab: dict) -> dict[str, Any]:
        markers = []
        for key, ref in REF.items():
            val = _f(lab.get(key))
            if val is None:
                continue
            low, high = ref["low"], ref["high"]
            out_of_range = (low is not None and val < low) or (high is not None and val > high)
            markers.append({"marker": key, "label": LABEL[key], "value": val, "unit": ref["unit"],
                            "ideal": ref["ideal"], "flag": "outside_range" if out_of_range else "within_range",
                            "source": "documents:lab_report (vs general reference range)"})
        in_range = sum(1 for m in markers if m["flag"] == "within_range")
        score = round(100 * in_range / len(markers)) if markers else 0
        return {"markers": markers, "tracked": len(markers), "within_range": in_range,
                "status": _status(score) if markers else ORANGE,
                "note": "Values vs general reference ranges — not a diagnosis. Discuss anything flagged with your clinician." if markers else "Upload a recent lab report to track your markers."}

    @staticmethod
    def _fitness(fp: dict) -> dict[str, Any]:
        weekly = _f(fp.get("weekly_workouts"))
        return {"has_plan": bool(fp), "weekly_workouts": weekly, "goal": fp.get("goal"),
                "target_weight": _f(fp.get("target_weight")),
                "status": GREEN if (weekly and weekly >= 3) else YELLOW if fp else ORANGE,
                "note": "Aim for the activity your clinician recommends." if fp else "Add a fitness plan to track your goals."}

    @staticmethod
    def _nutrition(nl: dict) -> dict[str, Any]:
        cals = _f(nl.get("daily_calories"))
        return {"has_log": bool(nl), "daily_calories": cals, "protein_g": _f(nl.get("protein_g")),
                "carbs_g": _f(nl.get("carbs_g")), "fat_g": _f(nl.get("fat_g")),
                "note": "Macros are a record for your reference." if nl else "Add a nutrition log to track intake."}
