"""LifeReadinessEngine (Sprint 5) — the executive command center.

Aggregates every live domain (Finance/Health/Career/Education/Family) + Decision Confidence
into a single Life Readiness Index, each scored GREEN/YELLOW/ORANGE/RED with progress / gap /
confidence / timeline / recommendations. Plus a Goal Status engine across domain goals. Reuses
the live domain summaries — no new evidence, no invented status; a domain with no data reads
honestly as "get started", never a fake green.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..domains.base import DomainService
from ..domains.education import EducationService
from ..models.common import DomainViewModel, UserContext

GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"
_ORDER = {GREEN: 3, YELLOW: 2, ORANGE: 1, RED: 0}
# Index weights (sum 1.0). Decision confidence is a lighter signal than the foundational domains.
_WEIGHTS = {"finance": 0.25, "family": 0.20, "career": 0.20, "health": 0.15, "education": 0.10, "decision": 0.10}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _status_from(progress: int) -> str:
    if progress >= 80:
        return GREEN
    if progress >= 60:
        return YELLOW
    if progress >= 35:
        return ORANGE
    return RED


def _index_status(score: int) -> str:
    return _status_from(score)


class LifeReadinessEngine:
    def __init__(self, domains: dict[str, DomainService], education: EducationService, supabase: SupabaseClient) -> None:
        self._domains = domains
        self._edu = education
        self._sb = supabase

    async def assess(self, ctx: UserContext) -> dict[str, Any]:
        readinesses: list[dict[str, Any]] = []
        for domain in ("finance", "health", "career", "family"):
            svc = self._domains.get(domain)
            if not svc:
                continue
            try:
                vm = await svc.summary(ctx)
            except Exception:  # noqa: BLE001 — a failing domain reads as "needs attention", never breaks the board
                readinesses.append(self._unavailable(domain))
                continue
            readinesses.append(self._assess_vm(domain, vm))
        # Education (backed engine, not in get_domain_services)
        try:
            evm = await self._edu.summary(ctx)
            readinesses.append(self._assess_vm("education", evm))
        except Exception:  # noqa: BLE001
            readinesses.append(self._unavailable("education"))
        # Decision confidence
        readinesses.append(await self._decision_readiness(ctx))

        index_score = round(sum(_WEIGHTS.get(r["domain"], 0.0) * r["progress"] for r in readinesses))
        goals = await self._goals(ctx)
        worst = min((r["status"] for r in readinesses), key=lambda s: _ORDER[s], default=GREEN)
        return {
            "generated_at": _now(),
            "index": {
                "score": index_score,
                "status": _index_status(index_score),
                "headline": self._headline(index_score, readinesses, worst),
                "weakest_domain": min(readinesses, key=lambda r: r["progress"])["domain"] if readinesses else None,
            },
            "domains": readinesses,
            "goals": goals,
        }

    def _assess_vm(self, domain: str, vm: DomainViewModel) -> dict[str, Any]:
        recs = vm.recommendations
        high = [r for r in recs if getattr(r, "priority", "") == "high"]
        missing = vm.missing or []
        basis = vm.confidence.basis
        progress = 100 - 25 * len(high) - 12 * len(missing) - (45 if basis == "missing" else 0)
        progress = max(0, min(100, progress))
        status = _status_from(progress)
        return {
            "domain": domain,
            "status": status,
            "progress": progress,
            "gap": self._gap(domain, vm, high),
            "confidence": round(vm.confidence.score, 2),
            "timeline": self._timeline(high, missing),
            "recommendations": [{"title": r.title, "priority": getattr(r, "priority", "medium")} for r in recs[:3]],
        }

    def _gap(self, domain: str, vm: DomainViewModel, high: list[Any]) -> str:
        d = vm.data or {}
        if domain == "family":
            cg = _num(((d.get("protection") or {}).get("coverage_gap")))
            if cg and cg > 0:
                return f"~${cg:,.0f} life-insurance protection gap"
        if domain == "career":
            comp = (d.get("compensation") or {}).get("current_estimated_market_value")
            rec = (d.get("compensation") or {}).get("recorded_comp_median")
            if comp and rec and _num(rec) and _num(comp) and _num(rec) < _num(comp):  # type: ignore[operator]
                return "Pay below market median for your role"
        if domain == "education":
            best = d.get("best_program")
            if best and best.get("program_name"):
                return f"Top option: {best['program_name']} (review ROI)"
            if "programs" in (vm.missing or []):
                return "No programs compared yet"
        if vm.confidence.basis == "missing":
            return "No data yet — get started"
        if high:
            return high[0].title
        return "On track"

    @staticmethod
    def _timeline(high: list[Any], missing: list[str]) -> str:
        if missing and not high:
            return "Set up this week"
        if high:
            return "Address now"
        return "Review this quarter"

    @staticmethod
    def _unavailable(domain: str) -> dict[str, Any]:
        return {"domain": domain, "status": ORANGE, "progress": 30, "gap": "Temporarily unavailable",
                "confidence": 0.0, "timeline": "Retry shortly", "recommendations": []}

    async def _decision_readiness(self, ctx: UserContext) -> dict[str, Any]:
        rows = await self._sb.select("decisions", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, order="updated_at.desc", schema="decision")
        confs = [c for r in rows if (c := _num(r.get("confidence"))) is not None]
        if not confs:
            return {"domain": "decision", "status": ORANGE, "progress": 40, "gap": "No decisions analyzed yet",
                    "confidence": 0.0, "timeline": "Ask a 'Should I…?' question", "recommendations": []}
        avg = sum(confs) / len(confs)
        progress = round(avg * 100)
        return {
            "domain": "decision", "status": _status_from(progress), "progress": progress,
            "gap": f"{len(rows)} decision(s) analyzed; avg confidence {avg:.0%}",
            "confidence": round(avg, 2), "timeline": "Revisit as data deepens",
            "recommendations": [{"title": r.get("title"), "priority": "medium"} for r in rows[:3]],
        }

    async def _goals(self, ctx: UserContext) -> list[dict[str, Any]]:
        goals: list[dict[str, Any]] = []
        for schema, table, domain in (("career", "career_goals", "career"), ("education", "education_goals", "education")):
            rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}", "status": "eq.active"}, limit=20, schema=schema)
            for g in rows:
                goals.append(self._goal_status(domain, g))
        return goals

    @staticmethod
    def _goal_status(domain: str, g: dict[str, Any]) -> dict[str, Any]:
        target = g.get("target_date")
        status, timeline = YELLOW, "In progress"
        if target:
            try:
                td = date.fromisoformat(str(target)[:10])
                days = (td - datetime.now(timezone.utc).date()).days
                if days < 0:
                    status, timeline = RED, "Past target date"
                elif days < 90:
                    status, timeline = ORANGE, f"~{days} days to target"
                else:
                    status, timeline = GREEN, f"~{days // 30} months to target"
            except (ValueError, TypeError):
                pass
        return {"domain": domain, "title": g.get("title") or g.get("target_role") or "Goal",
                "status": status, "target_date": target, "timeline": timeline}

    @staticmethod
    def _headline(score: int, readinesses: list[dict], worst: str) -> str:
        reds = [r["domain"] for r in readinesses if r["status"] == RED]
        if reds:
            return f"Needs attention: {', '.join(reds)}."
        if score >= 80:
            return "You're in strong shape across your life domains."
        if score >= 60:
            return "Mostly on track — a few areas to tighten up."
        return "Several areas need attention to get on track."
