"""Pilot feedback capture + pilot analytics (Pilot Readiness sprint).

FeedbackService: validates and persists per-turn user feedback to analytics.pilot_feedback (owner-scoped via
RLS; the service uses the service-role client and stamps user_id from the verified JWT — never the body).
PilotAnalyticsService: admin rollup over analytics.advisor_turns + analytics.pilot_feedback_summary. Counts/
rates only — no PII. Both degrade gracefully if the tables aren't present yet (pre-migration).
"""
from __future__ import annotations

from typing import Any, Optional

_THUMBS = {"up", "down"}

# Pilot Intelligence instruments: named 0-10 scores accepted in the `metrics` map. Anything else is dropped.
_METRIC_KEYS = frozenset({
    "narrative_accuracy", "understanding", "personalization", "trust", "usefulness", "actionability",
    "recommendation_quality", "return_intent",
    # executive value
    "would_pay", "recommend_to_clients", "solves_problem",
})


def _rating(v: Any, lo: int, hi: int) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def _bool(v: Any) -> Optional[bool]:
    if isinstance(v, bool):
        return v
    if v in ("yes", "true", "1", 1):
        return True
    if v in ("no", "false", "0", 0):
        return False
    return None


def _metrics(raw: Any) -> dict[str, int]:
    """Keep only known instrument keys with valid 0-10 integer scores."""
    out: dict[str, int] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k in _METRIC_KEYS:
                r = _rating(v, 0, 10)
                if r is not None:
                    out[k] = r
    return out


class FeedbackService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    async def submit(self, user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Validate + persist. Returns {ok, id?}. Ratings out of range are dropped (not errored) so partial
        feedback (e.g. just a thumb) still saves."""
        thumbs = payload.get("thumbs")
        metrics = _metrics(payload.get("metrics"))
        insight = _bool(payload.get("insight_detected"))
        surprised = _bool(payload.get("surprised"))
        context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
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
            # Pilot Intelligence instruments (stored in the metrics JSONB + flags; gated migration adds the cols).
            "kind": (str(payload.get("kind"))[:40] if payload.get("kind") else None),
            "metrics": metrics or {},
            "context": {k: v for k, v in context.items() if isinstance(k, str)} if context else {},
            "insight_detected": insight,
            "surprised": surprised,
        }
        # Require at least one real signal so we don't store empty rows.
        if not any([row["thumbs"], row["trust_rating"], row["usefulness_rating"], row["recommendation_quality"],
                    row["nps"] is not None, row["comment"], metrics, insight is not None, surprised is not None]):
            return {"ok": False, "error": "no_feedback_provided"}
        if self._sb is None:
            return {"ok": True, "stored": False}  # accepted; persistence unavailable
        _NEW_COLS = ("kind", "metrics", "context", "insight_detected", "surprised")
        try:
            res = await self._sb.insert("pilot_feedback", row, schema="analytics")
            if res:
                return {"ok": True, "stored": True, "id": res[0].get("id")}
            # Insert returned nothing — likely the gated metrics migration isn't applied yet. Retry with the
            # legacy column subset so thumb/trust/usefulness/nps/comment feedback still persists pre-migration.
            legacy = {k: v for k, v in row.items() if k not in _NEW_COLS}
            res = await self._sb.insert("pilot_feedback", legacy, schema="analytics")
            return {"ok": True, "stored": bool(res), "id": (res[0].get("id") if res else None),
                    "degraded": bool(res)}
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
        # Pilot Intelligence instruments — average the metrics JSONB + insight/holy-shit rates across all
        # feedback rows. Counts/rates only (no PII); degrades to {} pre-migration.
        try:
            out["instruments"] = self._aggregate_instruments(
                await self._sb.select("pilot_feedback", schema="analytics", limit=5000))
        except Exception:  # noqa: BLE001
            out["instruments"] = {}
        return out

    @staticmethod
    def _aggregate_instruments(rows: list[dict[str, Any]]) -> dict[str, Any]:
        if not rows:
            return {}
        sums: dict[str, float] = {}
        counts: dict[str, int] = {}
        insight_yes = insight_n = surprise_yes = surprise_n = 0
        for r in rows:
            for k, v in (r.get("metrics") or {}).items():
                if isinstance(v, (int, float)):
                    sums[k] = sums.get(k, 0) + v
                    counts[k] = counts.get(k, 0) + 1
            if r.get("insight_detected") is not None:
                insight_n += 1
                insight_yes += 1 if r["insight_detected"] else 0
            if r.get("surprised") is not None:
                surprise_n += 1
                surprise_yes += 1 if r["surprised"] else 0
        averages = {k: round(sums[k] / counts[k], 2) for k in sums if counts[k]}
        return {
            "averages": averages, "response_counts": counts,
            "insight_rate": round(insight_yes / insight_n, 3) if insight_n else None,
            "insight_responses": insight_n,
            "holy_shit_rate": round(surprise_yes / surprise_n, 3) if surprise_n else None,
            "holy_shit_responses": surprise_n,
            "total_feedback_rows": len(rows),
        }
