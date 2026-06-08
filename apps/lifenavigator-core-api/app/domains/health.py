"""Health & Wellness domain service.

Wellness/lifestyle guidance only — NEVER medical care (HEALTH_GOVERNANCE_STANDARD).
Reads the `health` schema, returns a Health DomainViewModel (with `safety_boundaries`
+ `governance_verdict` in `data`), and persists evidence-backed wellness recommendations.
No fake data; absent values are `null` and surface as missing-data prompts.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import (
    ActionStep,
    Confidence,
    DomainChatContext,
    DomainViewModel,
    Evidence,
    Freshness,
    GovernanceVerdict,
    Recommendation,
    SourceRef,
    UserContext,
    WriteResult,
)
from ..services.medical_safety import medical_boundary
from .base import DomainService

HEALTH = "health"
_TARGET_SLEEP_HOURS = 7.5
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000002")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _src(table: str) -> SourceRef:
    return SourceRef(system="supabase", table=f"health.{table}", as_of=_now())


def _rec_id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_REC_NS, f"{user_id}:{slug}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


class HealthService(DomainService):
    domain = HEALTH

    def __init__(self, supabase: SupabaseClient) -> None:
        self._supabase = supabase

    async def _rows(self, table: str, ctx: UserContext, *, limit: int = 200, order: Optional[str] = None) -> list[dict]:
        return await self._supabase.select(
            table,
            columns="*",
            filters={"user_id": f"eq.{ctx.user_id}"},
            limit=limit,
            order=order,
            schema=HEALTH,
        )

    # ----------------------------------------------------------------- reads
    async def summary(self, ctx: UserContext) -> DomainViewModel:
        sleep = await self._rows("sleep_logs", ctx, limit=30, order="night_of.desc")
        activity = await self._rows("activity_logs", ctx, limit=30, order="logged_at.desc")
        vitals = await self._rows("vitals", ctx, limit=10, order="observed_at.desc")

        sleep_hours = [h for s in sleep if (h := _num(s.get("total_hours"))) is not None]
        avg_sleep = round(sum(sleep_hours) / len(sleep_hours), 1) if sleep_hours else None
        steps = [int(st) for a in activity if (st := a.get("steps")) is not None]
        avg_steps = round(sum(steps) / len(steps)) if steps else None

        missing: list[str] = []
        if not sleep:
            missing.append("sleep_logs")
        if not activity:
            missing.append("activity_logs")
        has_any = bool(sleep or activity or vitals)
        basis = "partial" if has_any else "missing"

        # Wellness-only safety posture surfaced on every Health view.
        boundary = medical_boundary(requires_review=False)
        data: dict[str, Any] = {
            "avg_sleep_hours": avg_sleep,            # null when no data (never fake 0)
            "target_sleep_hours": _TARGET_SLEEP_HOURS,
            "avg_daily_steps": avg_steps,
            "nights_logged": len(sleep),
            "latest_vital": vitals[0] if vitals else None,
            # mission view-model fields (nested; DomainViewModel is the shared model)
            "safety_boundaries": [boundary],
            "governance_verdict": {"passed": True, **boundary},
        }
        recs = await self.recommendations(ctx)
        return self._vm(
            ctx, data,
            sources=[_src("sleep_logs"), _src("activity_logs"), _src("vitals")],
            missing=missing, basis=basis, recommendations=recs,
        )

    async def list_view(self, ctx: UserContext, table: str, key: str) -> DomainViewModel:
        """Generic owner-scoped list as a DomainViewModel. Empty -> missing prompt, never fake."""
        rows = await self._rows(table, ctx, limit=200)
        missing = [] if rows else [table]
        return self._vm(
            ctx, {key: rows}, sources=[_src(table)], missing=missing,
            basis="partial" if rows else "missing",
        )

    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        sleep = await self._rows("sleep_logs", ctx, limit=30, order="night_of.desc")
        hours = [h for s in sleep if (h := _num(s.get("total_hours"))) is not None]
        facts: list[dict] = []
        if hours:
            facts.append({"fact": "average sleep (recent)", "value": f"{round(sum(hours)/len(hours),1)} hours"})
        missing = [] if hours else ["sleep_logs"]
        return DomainChatContext(
            domain=HEALTH,
            authoritative_facts=facts,
            missing_facts=missing,
            freshness=Freshness(as_of=_now(), sources=[_src("sleep_logs")]),
        )

    async def recommendations(self, ctx: UserContext) -> list[Recommendation]:
        sleep = await self._rows("sleep_logs", ctx, limit=30, order="night_of.desc")
        hours = [h for s in sleep if (h := _num(s.get("total_hours"))) is not None]
        if not hours:
            return []  # no data -> no fabricated advice (the view shows a prompt)
        avg = sum(hours) / len(hours)
        if avg >= _TARGET_SLEEP_HOURS:
            return []
        revisit = _now()
        return [
            Recommendation(
                id="improve-sleep-consistency",
                title="Improve your sleep consistency",
                why_it_matters=(
                    f"Your recent average sleep is ~{avg:.1f} hours; the general wellness baseline "
                    f"is {_TARGET_SLEEP_HOURS:.1f} hours. This is wellness coaching, not medical advice."
                ),
                evidence=[
                    Evidence(statement=f"Average sleep ≈ {avg:.1f} h over {len(hours)} nights", source=_src("sleep_logs")),
                ],
                source_tables=["health.sleep_logs"],
                assumptions=["wearable/user-entered sleep data is accurate", "no medical sleep disorder is inferred"],
                confidence=Confidence(score=0.7, basis="partial", missing_fields=["sleep_timing_consistency"]),
                priority="medium",
                affected_domains=["health"],
                action_steps=[ActionStep(step="Aim for a consistent wind-down and wake time", effort="low", impact="medium")],
                risks=["Persistent severe symptoms warrant a clinician"],
                revisit_date=revisit,
                generated_by="health.agent",
                governance_verdict=GovernanceVerdict(passed=True),
            )
        ]

    # -------------------------------------------------- persisted recommendations
    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Sleep-consistency family. Wellness only; never persisted without evidence;
        every recommendation carries a medical AdviceBoundary. Idempotent."""
        sleep = await self._rows("sleep_logs", ctx, limit=30, order="night_of.desc")
        hours = [h for s in sleep if (h := _num(s.get("total_hours"))) is not None]
        if not hours:
            return []  # missing inputs -> nothing (the view returns a prompt)
        avg = sum(hours) / len(hours)
        if avg >= _TARGET_SLEEP_HOURS:
            return []
        observed = _now()
        gap = round(_TARGET_SLEEP_HOURS - avg, 1)
        row = {
            "id": _rec_id(ctx.user_id, "improve-sleep-consistency"),
            "user_id": ctx.user_id,
            "tenant_id": ctx.user_id,
            "title": "Improve your sleep consistency",
            "description": (
                f"Your recent average sleep is ~{avg:.1f} hours vs a {_TARGET_SLEEP_HOURS:.1f}-hour "
                f"wellness baseline (gap ≈ {gap} h). Wellness coaching, not medical advice."
            ),
            "recommendation_type": "improve_sleep",
            "priority": "medium",
            "confidence": 0.7,
            "governance_verdict": {"passed": True, **medical_boundary(requires_review=False)},
            "status": "active",
            "evidence_json": [
                {"metric_name": "avg_sleep_hours", "metric_value": round(avg, 1), "source_table": "health.sleep_logs", "observed_at": observed, "confidence": 0.8, "explanation": f"{len(hours)}-night average"},
                {"metric_name": "target_sleep_hours", "metric_value": _TARGET_SLEEP_HOURS, "source_table": "policy", "observed_at": observed, "confidence": 1.0, "explanation": "general wellness baseline"},
                {"metric_name": "nights_logged", "metric_value": len(hours), "source_table": "health.sleep_logs", "observed_at": observed, "confidence": 1.0, "explanation": "nights with sleep data"},
            ],
            "assumptions_json": [
                {"assumption_text": "wearable/user-entered sleep data is accurate", "confidence": 0.7, "expires_at": None, "user_confirmed": False, "source": "model"},
                {"assumption_text": "no medical sleep disorder is inferred", "confidence": 0.9, "expires_at": None, "user_confirmed": False, "source": "model"},
                {"assumption_text": "consult a clinician for persistent or severe symptoms", "confidence": 1.0, "expires_at": None, "user_confirmed": False, "source": "policy"},
            ],
            "tradeoffs_json": [
                {"option_a": "earlier consistent wind-down", "option_b": "keep evening screen time", "benefit": "more total/deep sleep", "cost": "less evening leisure", "affected_domains": ["health", "career"]},
            ],
            "source_tables": ["health.sleep_logs"],
            "source_graph_nodes": [],
            "derived_by": "health-recommendation-engine",
        }
        if not row["evidence_json"]:
            return []
        res = await self._supabase.upsert("health_recommendations", row, schema=HEALTH)
        return res or []

    # ------------------------------------------------------------------ writes
    async def write(self, ctx: UserContext, table: str, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k != "user_id"}
        row["user_id"] = ctx.user_id  # identity from JWT, never the body
        inserted = await self._supabase.insert(table, row, schema=HEALTH)
        if not inserted:
            return WriteResult(ok=False, detail="write failed or not configured")
        return WriteResult(ok=True, entity_id=str(inserted[0].get("id")) if inserted else None)

    def _vm(self, ctx: UserContext, data: dict[str, Any], *, sources: list[SourceRef], missing: list[str], basis: str, recommendations: Optional[list[Recommendation]] = None) -> DomainViewModel:
        return DomainViewModel(
            domain=HEALTH,
            user_id=ctx.user_id,
            generated_at=_now(),
            freshness=Freshness(as_of=_now(), stale=(basis == "missing"), sources=sources),
            confidence=Confidence(
                score={"complete": 0.9, "partial": 0.6, "sparse": 0.3, "missing": 0.0}[basis],
                basis=basis,  # type: ignore[arg-type]
                missing_fields=missing,
            ),
            data=data,
            recommendations=recommendations or [],
            missing=missing,
        )
