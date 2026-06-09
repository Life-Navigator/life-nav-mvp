"""My Life — the flagship Life-OS aggregator (Elite Sprint 44).

One call assembles the six sections of the user's life operating system from the canonical model:
Life Vision, What Matters Most, Life Readiness, Next Best Action, Constraints, and Recent
Intelligence — each tagged with its source (Advisor Discovery / Life Graph / Deterministic tool /
Recommendation OS) so the platform explains where everything came from. No new intelligence — it
composes what already exists into one coherent destination.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext


class MyLifeService:
    def __init__(self, life: Any, readiness: Any, reco_os: Any, supabase: Any, resolver: Any = None) -> None:
        self._life = life
        self._readiness = readiness
        self._os = reco_os
        self._sb = supabase
        self._resolver = resolver

    async def attention(self, ctx: UserContext) -> dict[str, Any]:
        """The DISCIPLINED dashboard feed: exactly one next best action + up to 3 'needs your
        attention' alerts (urgent recs, missing inputs, incomplete discovery, document issues) — the
        full list lives on /dashboard/recommendations. Same canonical source as everything else."""
        ml = await self.my_life(ctx)
        next_action = ml.get("next_best_action")
        alerts: list[dict[str, Any]] = []

        # urgent risk recommendations (severity high)
        try:
            active = await self._os.active(ctx)
            for r in (active.get("recommendations") or []):
                if r.get("classification") == "RISK":
                    alerts.append({"title": r.get("title"), "severity": "high", "source": "Recommendation OS",
                                   "detail": r.get("why") or r.get("recommended_action"), "cta": "/dashboard/recommendations"})
        except Exception:  # noqa: BLE001
            pass

        # missing financial inputs (severity medium) — only the high-leverage ones
        if self._resolver is not None:
            try:
                res = await self._resolver.resolve(ctx)
                for m in (res.get("missing") or []):
                    unlocks = m.get("unlocks") or []
                    if unlocks:
                        alerts.append({"title": f"Missing {m['input'].replace('_', ' ')}", "severity": "medium",
                                       "source": "Financial resolver", "detail": f"Affects {', '.join(unlocks[:2])}",
                                       "cta": "/dashboard/finance/retirement"})
            except Exception:  # noqa: BLE001
                pass

        # incomplete discovery (severity low)
        try:
            health = await self._life.discovery_health(ctx)
            for area in (health.get("missing_areas") or []):
                alerts.append({"title": f"Complete {area} discovery", "severity": "low", "source": "Discovery health",
                               "detail": "Sharpens your plan + unlocks more recommendations.", "cta": "/dashboard/advisor"})
        except Exception:  # noqa: BLE001
            pass

        # document issues (severity medium)
        try:
            docs = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="documents")
            for d in docs:
                if d.get("status") == "needs_review":
                    alerts.append({"title": f"Document needs attention: {d.get('title') or d.get('doc_type')}",
                                   "severity": "medium", "source": "Documents", "detail": d.get("status_reason") or "Upload a digital PDF or paste the text.",
                                   "cta": "/dashboard/documents"})
        except Exception:  # noqa: BLE001
            pass

        rank = {"high": 0, "medium": 1, "low": 2}
        alerts.sort(key=lambda a: rank.get(a["severity"], 3))
        return {"next_best_action": next_action, "alerts": alerts[:3], "alert_count": len(alerts),
                "view_all": "/dashboard/recommendations", "life_vision": ml["life_vision"]}

    async def my_life(self, ctx: UserContext) -> dict[str, Any]:
        snap = await self._life.snapshot(ctx)
        try:
            health = await self._life.discovery_health(ctx)
        except Exception:  # noqa: BLE001
            health = {}
        po = snap.get("primary_objective") or {}

        # Section 1 — Life Vision (the north star)
        vision = {
            "life_vision": snap.get("life_vision"),
            "primary_objective": po.get("title"),
            "confidence_pct": round((po.get("confidence") or 0) * 100),
            "discovery_completion_pct": round((health.get("model_quality") or 0) * 100),
            "source": "Advisor Discovery",
        }

        # Section 2 — What Matters Most (reinforces the Discovery Reveal)
        what_matters = {
            "primary_objective": po.get("title"),
            "reasoning": po.get("reasoning"),
            "depends_on": [d["label"] for d in snap.get("open_dependencies", [])],
            "risks": snap.get("top_risks"),
            "constraints": [c["label"] for c in snap.get("active_constraints", [])],
            "opportunities": snap.get("top_opportunities"),
            "supporting_objectives": [o["title"] for o in snap.get("objectives", [])[1:]],
            "source": "Life Graph",
        }

        # Section 3 — Life Readiness snapshot (cross-domain; missing surfaced honestly)
        try:
            r = await self._readiness.assess(ctx)
            domains = [{"domain": d["domain"], "progress": d["progress"], "status": d["status"],
                        "gap": d.get("gap")} for d in r.get("domains", [])]
            readiness = {"overall": r["index"]["score"], "status": r["index"]["status"],
                         "domains": domains, "source": "Life Readiness Engine"}
        except Exception:  # noqa: BLE001
            readiness = {"overall": None, "domains": [], "source": "Life Readiness Engine"}

        # Section 4 — Next Best Action (exactly one)
        next_action = None
        try:
            pri = await self._os.prioritize(ctx, top=1)
            if pri.get("top_actions"):
                a = pri["top_actions"][0]
                next_action = {"title": a["title"], "why": a.get("why"), "recommended_action": a.get("recommended_action"),
                               "expected_benefit": a.get("expected_benefit"), "confidence_pct": round((a.get("confidence") or 0) * 100),
                               "quantified_impact": a.get("quantified_impact"), "source": "Recommendation OS"}
        except Exception:  # noqa: BLE001
            pass

        # Section 5 — Current Constraints (what's blocking progress)
        constraints = [{"label": c["label"], "detail": c.get("detail"), "source": "Advisor Discovery"}
                       for c in snap.get("active_constraints", [])]
        for d in (readiness.get("domains") or []):
            if d.get("status") in ("red", "orange") and d.get("gap") and "On track" not in str(d.get("gap")):
                constraints.append({"label": d["gap"], "detail": f"{d['domain'].capitalize()} readiness {d['progress']}%", "source": "Life Readiness Engine"})
        for area in (health.get("missing_areas") or []):
            constraints.append({"label": f"Missing {area} discovery", "detail": "Completing this sharpens your plan.", "source": "Discovery health"})

        # Section 6 — Recent Intelligence (the platform feels alive)
        recent = await self._recent_intelligence(ctx)

        return {
            "life_vision": vision, "what_matters_most": what_matters, "life_readiness": readiness,
            "next_best_action": next_action, "constraints": constraints[:6], "recent_intelligence": recent,
            "has_discovery": bool(snap.get("objectives")),
            "note": "Your life operating system — organized around your life, not our architecture.",
        }

    async def _recent_intelligence(self, ctx: UserContext) -> list[dict[str, Any]]:
        feed: list[dict[str, Any]] = []
        try:
            objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=3, order="created_at.desc", schema="life")
            feed += [{"type": "objective", "label": f"Objective discovered: {o['title']}", "when": o.get("created_at")} for o in objs]
        except Exception:  # noqa: BLE001
            pass
        try:
            recs = await self._sb.select("recommendations", filters={"user_id": f"eq.{ctx.user_id}"}, limit=3, order="updated_at.desc", schema="recommendations")
            feed += [{"type": "recommendation", "label": f"Recommendation: {r['title']}", "when": r.get("updated_at")} for r in recs]
        except Exception:  # noqa: BLE001
            pass
        try:
            runs = await self._sb.select("tool_runs", filters={"user_id": f"eq.{ctx.user_id}"}, limit=2, order="created_at.desc", schema="tools")
            feed += [{"type": "calculation", "label": f"Tool calculation: {r['tool']}", "when": r.get("created_at")} for r in runs]
        except Exception:  # noqa: BLE001
            pass
        feed.sort(key=lambda x: str(x.get("when") or ""), reverse=True)
        return feed[:8]
