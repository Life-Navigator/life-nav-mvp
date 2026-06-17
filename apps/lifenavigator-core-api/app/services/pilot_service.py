"""Pilot feedback capture + pilot analytics (Pilot Readiness sprint).

FeedbackService: validates and persists per-turn user feedback to analytics.pilot_feedback (owner-scoped via
RLS; the service uses the service-role client and stamps user_id from the verified JWT — never the body).
PilotAnalyticsService: admin rollup over analytics.advisor_turns + analytics.pilot_feedback_summary. Counts/
rates only — no PII. Both degrade gracefully if the tables aren't present yet (pre-migration).
"""
from __future__ import annotations

from typing import Any, Optional

_THUMBS = {"up", "down"}


def _rating(v: Any, lo: int, hi: int) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


class FeedbackService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    async def submit(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Validate + persist. Returns {ok, id?}. Ratings out of range are dropped (not errored) so partial
        feedback (e.g. just a thumb) still saves."""
        thumbs = payload.get("thumbs")
        row = {
            "user_id": user_id,
            "tenant_id": payload.get("tenant_id") or None,
            "turn_id": payload.get("turn_id") or None,
            "conversation_id": payload.get("conversation_id") or None,
            "thumbs": thumbs if thumbs in _THUMBS else None,
            "trust_rating": _rating(payload.get("trust_rating"), 1, 5),
            "usefulness_rating": _rating(payload.get("usefulness_rating"), 1, 5),
            "recommendation_quality": _rating(payload.get("recommendation_quality"), 1, 5),
            "advisor_comparison": (str(payload.get("advisor_comparison"))[:120] if payload.get("advisor_comparison") else None),
            "nps": _rating(payload.get("nps"), 0, 10),
            "comment": (str(payload.get("comment"))[:2000] if payload.get("comment") else None),
        }
        # Require at least one signal so we don't store empty rows.
        if not any(row[k] is not None for k in ("thumbs", "trust_rating", "usefulness_rating",
                                                "recommendation_quality", "nps", "comment")):
            return {"ok": False, "error": "no_feedback_provided"}
        if self._sb is None:
            return {"ok": True, "stored": False}  # accepted; persistence unavailable
        try:
            res = await self._sb.insert("pilot_feedback", row, schema="analytics")
            return {"ok": True, "stored": bool(res), "id": (res[0].get("id") if res else None)}
        except Exception:  # noqa: BLE001 — never fail the user's feedback action
            return {"ok": True, "stored": False}


class PilotAnalyticsService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    async def summary(self) -> dict[str, Any]:
        """Admin pilot rollup (counts/rates only). Combines advisor-turn telemetry + feedback summary."""
        out: dict[str, Any] = {"advisor": {}, "feedback": {}, "safety": {}}
        if self._sb is None:
            return out
        try:
            total = await self._sb.count("advisor_turns", schema="analytics")
            enhanced = await self._sb.count("advisor_turns", filters={"llm_status": "eq.enhanced"}, schema="analytics")
            safety = await self._sb.count("advisor_turns", filters={"llm_status": "eq.safety_fallback"}, schema="analytics")
            out["advisor"] = {
                "total_turns": total, "enhanced_turns": enhanced,
                "enhanced_rate": round(enhanced / total, 3) if total else None,
            }
            out["safety"] = {"safety_fallback_turns": safety}
        except Exception:  # noqa: BLE001
            pass
        try:
            rows = await self._sb.select("pilot_feedback_summary", schema="analytics")
            out["feedback"] = (rows[0] if rows else {})
            fb = out["feedback"]
            if fb.get("nps_responses"):
                promoters, detractors, n = fb.get("nps_promoters", 0), fb.get("nps_detractors", 0), fb["nps_responses"]
                out["feedback"]["nps_score"] = round(100 * (promoters - detractors) / n, 1)
        except Exception:  # noqa: BLE001
            pass
        return out
