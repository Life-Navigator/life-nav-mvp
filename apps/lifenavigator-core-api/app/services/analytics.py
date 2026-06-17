"""AnalyticsService (Sprint 9) — beta instrumentation + the Executive Dashboard.

emit() records funnel events (onboarding / decisions / reports / shares / retention) to
analytics.events. dashboard() aggregates platform-wide metrics (Users / Reports / Shares /
Goals / Domain Usage / Decisions / Retention) — COUNTS ONLY, never user content or PII.
Aggregates read existing persisted artifacts + the event ledger via service-role.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext

ANALYTICS = "analytics"
EVENT_TYPES = ("onboarding_step", "decision_generated", "report_generated", "share_created", "login", "domain_viewed")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AnalyticsService:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def emit(self, ctx: UserContext, event_type: str, *, domain: Optional[str] = None, props: Optional[dict[str, Any]] = None) -> None:
        """Best-effort, non-blocking funnel event. props must be non-PII (counts/types/status)."""
        try:
            await self._sb.insert("events", {
                "id": str(uuid.uuid4()), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                "event_type": event_type, "domain": domain, "props": props or {},
            }, schema=ANALYTICS)
        except Exception:  # noqa: BLE001 — instrumentation must never break the request path
            pass

    async def advisor_metrics(self) -> dict[str, Any]:
        """Advisor observability rollup (P0.1) — last-30d counts/rates only, no PII. Reads the
        analytics.advisor_turn_metrics view; returns an honest empty shape if no turns logged yet."""
        rows = await self._sb.select("advisor_turn_metrics", schema=ANALYTICS, limit=1)
        empty = {
            "total_sessions": 0, "total_turns": 0, "fallback_turns": 0, "fallback_rate": None,
            "validator_rejections": 0, "validation_failure_rate": None, "validator_repairs": 0,
            "avg_latency_ms": None, "p95_latency_ms": None, "avg_confidence": None,
            "avg_graph_edges": None, "avg_total_tokens": None,
        }
        if not rows:
            return empty
        return {**empty, **{k: v for k, v in rows[0].items() if v is not None}}

    async def _by_type(self, table: str, schema: str, type_col: str, types: list[str]) -> dict[str, int]:
        return {t: await self._sb.count(table, filters={type_col: f"eq.{t}"}, schema=schema) for t in types}

    async def dashboard(self) -> dict[str, Any]:
        since7 = (_now() - timedelta(days=7)).isoformat()
        since30 = (_now() - timedelta(days=30)).isoformat()

        # Reports
        reports_total = await self._sb.count("reports", schema="reporting")
        reports_by_type = await self._by_type("reports", "reporting", "report_type", ["full", "financial", "education", "decision"])
        # Shares + access
        shares_total = await self._sb.count("report_shares", schema="reporting")
        shares_active = await self._sb.count("report_shares", filters={"revoked": "eq.false"}, schema="reporting")
        share_accesses = await self._sb.count("share_access_log", schema="reporting")
        shares_by_audience = await self._by_type("report_shares", "reporting", "audience", ["advisor", "cpa", "attorney", "parent", "spouse"])
        # Decisions
        decisions_total = await self._sb.count("decisions", schema="decision")
        decisions_by_type = await self._by_type("decisions", "decision", "decision_type", ["mba_or_invest", "grad_school", "new_job", "move_states", "delay_retirement", "college_funding", "general"])
        # Goals
        career_goals = await self._sb.count("career_goals", schema="career")
        edu_goals = await self._sb.count("education_goals", schema="education")
        # Domain usage = persisted recommendations per domain
        domain_usage = {
            "finance": await self._sb.count("financial_recommendations", schema="finance"),
            "health": await self._sb.count("health_recommendations", schema="health"),
            "career": await self._sb.count("career_recommendations", schema="career"),
            "education": await self._sb.count("education_recommendations", schema="education"),
            "family": await self._sb.count("family_recommendations", schema="family"),
            "decision": decisions_total,
        }
        # Funnel + retention (event ledger)
        events_total = await self._sb.count("events", schema=ANALYTICS)
        funnel = await self._by_type("events", ANALYTICS, "event_type", list(EVENT_TYPES))
        active_7d = await self._distinct_users(since7)
        active_30d = await self._distinct_users(since30)
        # Users (distinct across artifacts — no auth table / PII)
        users = await self._distinct_users(None)

        return {
            "generated_at": _now().isoformat(),
            "users": {"total_active": users, "active_7d": active_7d, "active_30d": active_30d,
                      "retention_7d_pct": round(100 * active_7d / users) if users else 0},
            "reports": {"total": reports_total, "by_type": reports_by_type},
            "shares": {"total": shares_total, "active": shares_active, "accesses": share_accesses, "by_audience": shares_by_audience},
            "goals": {"career": career_goals, "education": edu_goals, "total": career_goals + edu_goals},
            "decisions": {"total": decisions_total, "by_type": {k: v for k, v in decisions_by_type.items() if v}},
            "domain_usage": domain_usage,
            "funnel": {"events_total": events_total, "by_type": funnel},
        }

    async def _distinct_users(self, since: Optional[str]) -> int:
        """Approximate active users = distinct user_id in the event ledger (+ falls back to
        distinct across recommendation artifacts when the ledger is sparse). Counts only."""
        f = {"created_at": f"gte.{since}"} if since else None
        rows = await self._sb.select("events", columns="user_id", filters=f, limit=10000, schema=ANALYTICS)
        users = {r.get("user_id") for r in rows if r.get("user_id")}
        if not since and not users:  # ledger empty -> approximate from persisted reports
            rrows = await self._sb.select("reports", columns="user_id", limit=10000, schema="reporting")
            users = {r.get("user_id") for r in rrows if r.get("user_id")}
        return len(users)
