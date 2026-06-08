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
_TARGET_ACTIVE_SESSIONS = 8   # activity/workout sessions in the recent window (~4/week)
_TARGET_NUTRITION_DAYS = 14   # distinct days logged in the window
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
        """H-contract view of the fired wellness families (sleep/activity/nutrition)."""
        rows = await self._compute_rows(ctx)
        out: list[Recommendation] = []
        for r in rows:
            out.append(
                Recommendation(
                    id=r["id"],
                    title=r["title"],
                    why_it_matters=r["description"],
                    evidence=[
                        Evidence(
                            statement=f"{e['metric_name']}: {e['metric_value']}",
                            source=SourceRef(system="supabase", table=e["source_table"], as_of=e.get("observed_at") or _now()),
                        )
                        for e in r["evidence_json"]
                        if str(e.get("source_table", "")).startswith("health.")
                    ],
                    source_tables=r["source_tables"],
                    assumptions=[a["assumption_text"] for a in r["assumptions_json"]],
                    confidence=Confidence(score=r["confidence"], basis="partial", missing_fields=[]),
                    priority=r["priority"],
                    affected_domains=["health"],
                    action_steps=[ActionStep(step="Wellness coaching — see details", effort="low", impact="medium")],
                    risks=["Consult a clinician for medical concerns or persistent symptoms"],
                    revisit_date=_now(),
                    generated_by="health.agent",
                    governance_verdict=GovernanceVerdict(passed=True),
                )
            )
        return out

    # -------------------------------------------------- persisted recommendations
    def _hrow(self, ctx: UserContext, *, slug: str, rtype: str, title: str, description: str, evidence: list[dict], assumptions: list[dict], tradeoffs: list[dict], priority: str = "medium", confidence: float = 0.7) -> dict[str, Any]:
        return {
            "id": _rec_id(ctx.user_id, slug),
            "user_id": ctx.user_id,
            "tenant_id": ctx.user_id,
            "title": title,
            "description": description,
            "recommendation_type": rtype,
            "priority": priority,
            "confidence": confidence,
            # Every health recommendation carries a medical AdviceBoundary.
            "governance_verdict": {"passed": True, **medical_boundary(requires_review=False)},
            "status": "active",
            "evidence_json": evidence,
            "assumptions_json": assumptions,
            "tradeoffs_json": tradeoffs,
            "source_tables": sorted({str(e["source_table"]) for e in evidence if str(e.get("source_table", "")).startswith("health.")}),
            "source_graph_nodes": [],
            "derived_by": "health-recommendation-engine",
        }

    async def _compute_rows(self, ctx: UserContext) -> list[dict[str, Any]]:
        """All fired wellness families. No row without evidence; wellness coaching only."""
        sleep = await self._rows("sleep_logs", ctx, limit=30, order="night_of.desc")
        activity = await self._rows("activity_logs", ctx, limit=60, order="logged_at.desc")
        workouts = await self._rows("workout_logs", ctx, limit=60, order="logged_at.desc")
        nutrition = await self._rows("nutrition_logs", ctx, limit=90, order="logged_at.desc")
        observed = _now()
        base_assumptions = [
            {"assumption_text": "user-entered/wearable data is accurate", "confidence": 0.7, "expires_at": None, "user_confirmed": False, "source": "model"},
            {"assumption_text": "this is wellness coaching only, not medical advice", "confidence": 1.0, "expires_at": None, "user_confirmed": False, "source": "policy"},
            {"assumption_text": "consult a clinician for medical concerns or persistent symptoms", "confidence": 1.0, "expires_at": None, "user_confirmed": False, "source": "policy"},
        ]
        rows: list[dict[str, Any]] = []

        # 1. Sleep consistency
        hours = [h for s in sleep if (h := _num(s.get("total_hours"))) is not None]
        if hours:
            avg = sum(hours) / len(hours)
            if avg < _TARGET_SLEEP_HOURS:
                gap = round(_TARGET_SLEEP_HOURS - avg, 1)
                rows.append(self._hrow(
                    ctx, slug="improve-sleep-consistency", rtype="improve_sleep",
                    title="Improve your sleep consistency",
                    description=f"Recent average sleep ~{avg:.1f}h vs a {_TARGET_SLEEP_HOURS:.1f}h baseline (gap ≈ {gap}h). Wellness coaching, not medical advice.",
                    evidence=[
                        {"metric_name": "avg_sleep_hours", "metric_value": round(avg, 1), "source_table": "health.sleep_logs", "observed_at": observed, "confidence": 0.8, "explanation": f"{len(hours)}-night average"},
                        {"metric_name": "target_sleep_hours", "metric_value": _TARGET_SLEEP_HOURS, "source_table": "policy", "observed_at": observed, "confidence": 1.0, "explanation": "general wellness baseline"},
                        {"metric_name": "nights_logged", "metric_value": len(hours), "source_table": "health.sleep_logs", "observed_at": observed, "confidence": 1.0, "explanation": "nights with sleep data"},
                    ],
                    assumptions=[base_assumptions[0], {"assumption_text": "no medical sleep disorder is inferred", "confidence": 0.9, "expires_at": None, "user_confirmed": False, "source": "model"}, base_assumptions[2]],
                    tradeoffs=[{"option_a": "earlier consistent wind-down", "option_b": "keep evening screen time", "benefit": "more total/deep sleep", "cost": "less evening leisure", "affected_domains": ["health", "career"]}],
                ))

        # 2. Activity consistency (needs activity_logs OR workout_logs evidence)
        sessions = len(activity) + len(workouts)
        if 0 < sessions < _TARGET_ACTIVE_SESSIONS:
            rows.append(self._hrow(
                ctx, slug="activity-consistency", rtype="activity_consistency",
                title="Build more consistent activity",
                description=f"You logged {sessions} activity/workout session(s) recently vs a {_TARGET_ACTIVE_SESSIONS}-session wellness target. Wellness coaching, not medical advice.",
                evidence=[
                    {"metric_name": "sessions_logged", "metric_value": sessions, "source_table": "health.activity_logs", "observed_at": observed, "confidence": 0.9, "explanation": "activity + workout sessions in the recent window"},
                    {"metric_name": "target_sessions", "metric_value": _TARGET_ACTIVE_SESSIONS, "source_table": "policy", "observed_at": observed, "confidence": 1.0, "explanation": "general wellness target (~4/week)"},
                ],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "short daily movement", "option_b": "fewer longer sessions", "benefit": "more consistent activity", "cost": "routine change", "affected_domains": ["health"]}],
            ))

        # 3. Nutrition logging consistency (needs nutrition_logs evidence)
        if nutrition:
            days = len({n.get("logged_at") for n in nutrition if n.get("logged_at")})
            if days < _TARGET_NUTRITION_DAYS:
                rows.append(self._hrow(
                    ctx, slug="nutrition-logging-consistency", rtype="nutrition_logging_consistency",
                    title="Log your nutrition more consistently",
                    description=f"You logged nutrition on {days} day(s) recently vs a {_TARGET_NUTRITION_DAYS}-day target. More consistent logging improves insight. Wellness coaching, not medical advice.",
                    evidence=[
                        {"metric_name": "days_logged", "metric_value": days, "source_table": "health.nutrition_logs", "observed_at": observed, "confidence": 1.0, "explanation": "distinct days with nutrition data"},
                        {"metric_name": "total_logs", "metric_value": len(nutrition), "source_table": "health.nutrition_logs", "observed_at": observed, "confidence": 1.0, "explanation": "nutrition entries in the window"},
                        {"metric_name": "target_days", "metric_value": _TARGET_NUTRITION_DAYS, "source_table": "policy", "observed_at": observed, "confidence": 1.0, "explanation": "consistency target"},
                    ],
                    assumptions=base_assumptions,
                    tradeoffs=[{"option_a": "quick daily logging", "option_b": "detailed weekly logging", "benefit": "better adherence insight", "cost": "daily habit effort", "affected_domains": ["health"]}],
                ))
        return rows
    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Persist all fired wellness families (sleep/activity/nutrition). Wellness only;
        never persisted without evidence; every row carries a medical AdviceBoundary.
        Idempotent (deterministic ids)."""
        persisted: list[dict[str, Any]] = []
        for row in await self._compute_rows(ctx):
            if not row["evidence_json"]:
                continue  # never persist a recommendation without evidence
            res = await self._supabase.upsert("health_recommendations", row, schema=HEALTH)
            if res:
                persisted.append(res[0])
        return persisted

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
