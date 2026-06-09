"""Recommendation Operating System (Elite Sprint 25).

One registry every module's recommendations flow into, and the single place every consumer
(dashboard, chat, prioritization, conflicts, reports) reads from — so the platform gives ONE
answer to "what should I do next?". A central collector normalizes each module's output into the
first-class recommendation schema with evidence + confidence + readiness impact; a prioritization
engine ranks them; a conflict engine flags competing actions. No recommendation lives outside here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext

RECOS = "recommendations"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000c")
_PRIORITY_W = {"high": 1.0, "medium": 0.6, "low": 0.3}
_EFFORT_PEN = {"low": 0.0, "medium": 0.1, "high": 0.25}
LIFECYCLE = {"new", "viewed", "accepted", "in_progress", "deferred", "completed", "dismissed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rid(user_id: str, source: str, title: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{source}:{title}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


class RecommendationOS:
    def __init__(self, supabase: Any, *, readiness: Any = None, family_office: Any = None,
                 health: Any = None, military: Any = None, comp: Any = None, planning: Any = None,
                 platform: Any = None) -> None:
        self._sb = supabase
        self._readiness, self._fo, self._health, self._mil = readiness, family_office, health, military
        self._comp, self._planning, self._platform = comp, planning, platform

    # ---- write (the ONLY way a recommendation enters the platform) ----
    async def write(self, ctx: UserContext, *, title: str, source_module: str, category: str,
                    description: str = "", priority: str = "medium", confidence: Optional[float] = None,
                    evidence: Optional[list] = None, assumptions: Optional[list] = None,
                    impacted_domains: Optional[list] = None, readiness_impact: Optional[dict] = None,
                    recommended_action: str = "", estimated_effort: str = "medium",
                    estimated_benefit: str = "", resource: str = "", time_sensitive: bool = False,
                    chat_visibility: bool = True, report_visibility: bool = True) -> Optional[str]:
        # Integrity: no recommendation without evidence (Deliverable 3).
        ev = evidence or []
        if not ev:
            return None
        rid = _rid(ctx.user_id, source_module, title)
        row = {
            "id": rid, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "title": title,
            "description": description, "category": category, "source_module": source_module,
            "priority": priority, "confidence": confidence, "evidence": ev,
            "assumptions": assumptions or [], "impacted_domains": impacted_domains or [],
            "readiness_impact": {**(readiness_impact or {}), "resource": resource, "time_sensitive": time_sensitive},
            "recommended_action": recommended_action, "estimated_effort": estimated_effort,
            "estimated_benefit": estimated_benefit, "chat_visibility": chat_visibility,
            "report_visibility": report_visibility, "updated_at": _now(),
        }
        await self._sb.upsert("recommendations", row, schema=RECOS)
        return rid

    async def active(self, ctx: UserContext, *, only_visible_to: str = "") -> list[dict[str, Any]]:
        rows = await self._sb.select("recommendations", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=RECOS)
        for r in rows:  # normalize: a freshly-written row uses the DB default 'new'
            r.setdefault("status", "new")
            r.setdefault("chat_visibility", True)
            r.setdefault("report_visibility", True)
        rows = [r for r in rows if r.get("status") not in ("dismissed", "completed")]
        if only_visible_to == "chat":
            rows = [r for r in rows if r.get("chat_visibility", True)]
        elif only_visible_to == "report":
            rows = [r for r in rows if r.get("report_visibility", True)]
        return rows

    # ---- the collector: every module's recommendations -> the one registry ----
    async def sync(self, ctx: UserContext) -> dict[str, Any]:
        written: list[str] = []
        sources: dict[str, int] = {}

        async def emit(**kw: Any) -> None:
            rid = await self.write(ctx, **kw)
            if rid:
                written.append(rid)
                sources[kw["source_module"]] = sources.get(kw["source_module"], 0) + 1

        # 1) Readiness gaps -> recommendations (Deliverable 4)
        if self._readiness:
            r = await self._readiness.assess(ctx)
            for d in r.get("domains", []):
                if d["status"] in ("red", "orange") and d["gap"] not in ("On track", "No data yet — get started"):
                    await emit(title=f"Address {d['domain']} gap: {d['gap']}", source_module=f"readiness:{d['domain']}",
                               category=d["domain"], priority="high" if d["status"] == "red" else "medium",
                               confidence=round(d.get("confidence", 0.5), 2),
                               evidence=[{"statement": f"{d['domain'].capitalize()} readiness {d['progress']}% — {d['gap']}", "source_table": f"{d['domain']} domain"}],
                               impacted_domains=[d["domain"]], readiness_impact={"domain": d["domain"], "current": d["progress"], "expected_improvement": "raises this domain's readiness"},
                               recommended_action=(d.get("recommendations") or [{}])[0].get("title", "") if d.get("recommendations") else d["timeline"],
                               resource="savings_dollars" if d["domain"] == "finance" else d["domain"])

        # 2) Financial planning -> retirement recommendation
        if self._planning:
            try:
                p = await self._planning.plan(ctx)
            except Exception:  # noqa: BLE001
                p = {"available": False}
            if p.get("available"):
                rr = p.get("retirement_readiness", {})
                if rr.get("readiness_ratio") is not None and not rr.get("on_track"):
                    await emit(title="Increase retirement contributions", source_module="financial_planning", category="finance",
                               description=f"Projected {rr['readiness_ratio']:.0%} of your target nest egg.", priority="high",
                               confidence=p.get("confidence", {}).get("overall_fraction", 0.5),
                               evidence=[{"statement": f"Projected median ${rr.get('projected_median', 0):,.0f} vs target ${rr.get('target_nest_egg', 0):,.0f}", "source_table": "finance.net_worth_snapshots + Monte Carlo"}],
                               assumptions=p.get("assumptions_used", []), impacted_domains=["finance"],
                               readiness_impact={"domain": "finance", "expected_improvement": "raises retirement readiness toward target"},
                               recommended_action="Raise your 401(k)/IRA contribution; capture the full employer match first.",
                               resource="savings_dollars", time_sensitive=True, estimated_benefit="Higher retirement success probability")

        # 3) Compensation -> maximize 401(k) match
        if self._comp:
            try:
                a = await self._comp.analyze(ctx)
            except Exception:  # noqa: BLE001
                a = {}
            match = next((b for b in a.get("benefit_valuation", []) if "401" in b.get("benefit", "")), None)
            if match:
                await emit(title="Maximize your 401(k) employer match", source_module="comp_benefits", category="finance", priority="high",
                           confidence=a.get("confidence", {}).get("score", 0.6),
                           evidence=[{"statement": f"Employer match worth ${match['annual_value']:,.0f}/yr ({match.get('basis', '')})", "source_table": "documents:401k_statement"}],
                           impacted_domains=["finance"], readiness_impact={"domain": "finance", "expected_improvement": "free money + compounding"},
                           recommended_action="Contribute at least enough to capture the full employer match.",
                           resource="savings_dollars", estimated_benefit=f"${match['annual_value']:,.0f}/yr free money")

        # 4) Family Office pillars
        if self._fo:
            try:
                fo = await self._fo.assess(ctx)
            except Exception:  # noqa: BLE001
                fo = {}
            for key in ("estate_readiness", "trust_readiness", "beneficiary_readiness", "survivor_planning"):
                pillar = fo.get(key) or {}
                if pillar.get("status") in ("red", "orange") and pillar.get("recommendation"):
                    await emit(title=f"{pillar['pillar']}: {pillar['recommendation'][:60]}", source_module="family_office", category="family",
                               priority="high" if pillar["status"] == "red" else "medium", confidence=0.6,
                               evidence=pillar.get("evidence", [{"statement": pillar["pillar"], "source_table": "family + documents"}]),
                               impacted_domains=["family"], readiness_impact={"domain": "family", "expected_improvement": "improves legacy readiness"},
                               recommended_action=pillar["recommendation"], resource="legal_time")

        # 5) Health action items (medical boundary preserved — informational)
        if self._health:
            try:
                h = await self._health.assess(ctx)
            except Exception:  # noqa: BLE001
                h = {}
            for item in (h.get("action_items") or [])[:3]:
                await emit(title=item[:70], source_module="health_intelligence", category="health", priority="medium", confidence=0.5,
                           evidence=[{"statement": item, "source_table": "documents:lab_report (vs reference range)"}],
                           impacted_domains=["health"], readiness_impact={"domain": "health", "expected_improvement": "discuss with clinician"},
                           recommended_action="Review with your clinician — informational, not medical advice.", resource="health_time")

        # 6) Military pillars (only reachable for military users — endpoint is gated)
        if self._mil:
            try:
                m = await self._mil.assess(ctx)
            except Exception:  # noqa: BLE001
                m = {}
            if m.get("is_service_connected"):
                for key in ("transition_readiness", "gi_bill_readiness", "va_benefits_readiness"):
                    p2 = m.get(key) or {}
                    if p2.get("status") in ("red", "orange", "yellow") and p2.get("recommendation"):
                        await emit(title=f"{p2['pillar']}: {p2['recommendation'][:55]}", source_module="military", category="military",
                                   priority="medium", confidence=0.6,
                                   evidence=p2.get("evidence", [{"statement": p2["pillar"], "source_table": "documents:dd214/va"}]),
                                   impacted_domains=["finance", "career"], readiness_impact={"expected_improvement": "improves benefits readiness"},
                                   recommended_action=p2["recommendation"], resource="benefits_time", chat_visibility=True)

        # rank everything after writing
        await self._rank(ctx)
        return {"written": len(written), "by_source": sources}

    # ---- prioritization: ONE answer to "what should I do first?" ----
    @staticmethod
    def _score(r: dict[str, Any]) -> float:
        pw = _PRIORITY_W.get(r.get("priority", "medium"), 0.6)
        conf = _num(r.get("confidence")) or 0.5
        ev = len(r.get("evidence") or [])
        effort = _EFFORT_PEN.get(r.get("estimated_effort", "medium"), 0.1)
        ts = 0.15 if (r.get("readiness_impact") or {}).get("time_sensitive") else 0.0
        return round(pw * 0.45 + conf * 0.30 + min(ev, 3) / 3 * 0.10 + ts - effort + 0.0, 4)

    async def _rank(self, ctx: UserContext) -> None:
        recs = await self.active(ctx)
        for r in recs:
            await self._sb.update("recommendations", {"rank_score": self._score(r)}, filters={"id": f"eq.{r['id']}"}, schema=RECOS)

    async def prioritize(self, ctx: UserContext, top: int = 3) -> dict[str, Any]:
        recs = await self.active(ctx)
        ranked = sorted(recs, key=self._score, reverse=True)
        top_actions = [{
            "id": r["id"], "title": r["title"], "category": r["category"], "source_module": r["source_module"],
            "priority": r["priority"], "confidence": r.get("confidence"), "rank_score": self._score(r),
            "why": (r.get("evidence") or [{}])[0].get("statement", ""), "recommended_action": r.get("recommended_action"),
            "expected_benefit": r.get("estimated_benefit") or (r.get("readiness_impact") or {}).get("expected_improvement"),
            "evidence": r.get("evidence"), "impacted_domains": r.get("impacted_domains"),
        } for r in ranked[:top]]
        return {"total": len(recs), "top_actions": top_actions,
                "conflicts": await self.conflicts(ctx, recs),
                "note": "One prioritized answer for the whole platform — the dashboard and chat read this same list."}

    # ---- conflict engine: competing actions on the same resource ----
    async def conflicts(self, ctx: UserContext, recs: Optional[list] = None) -> list[dict[str, Any]]:
        recs = recs if recs is not None else await self.active(ctx)
        by_resource: dict[str, list[dict]] = {}
        for r in recs:
            res = (r.get("readiness_impact") or {}).get("resource") or ""
            if res:
                by_resource.setdefault(res, []).append(r)
        out = []
        for res, group in by_resource.items():
            competing = [g for g in group if g.get("priority") in ("high", "medium")]
            if len(competing) >= 2:
                seq = sorted(competing, key=self._score, reverse=True)
                out.append({
                    "resource": res, "reason": f"{len(competing)} recommendations compete for the same {res.replace('_', ' ')}.",
                    "competing": [{"title": g["title"], "source": g["source_module"], "priority": g["priority"]} for g in competing],
                    "tradeoff": "These can't all be funded/done at once.",
                    "suggested_sequence": [g["title"] for g in seq],
                })
        return out

    # ---- lifecycle ----
    async def set_status(self, ctx: UserContext, rid: str, status: str) -> dict[str, Any]:
        if status not in LIFECYCLE:
            raise ValueError(f"status must be one of {sorted(LIFECYCLE)}")
        res = await self._sb.update("recommendations", {"status": status, "updated_at": _now()},
                                    filters={"id": f"eq.{rid}", "user_id": f"eq.{ctx.user_id}"}, schema=RECOS)
        if res:
            await self._sb.insert("recommendation_events", {"id": str(uuid.uuid4()), "recommendation_id": rid,
                                                            "user_id": ctx.user_id, "tenant_id": ctx.user_id, "event": status}, schema=RECOS)
        return {"updated": bool(res), "status": status}
