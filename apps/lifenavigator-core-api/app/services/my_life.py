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
from .life_discovery import GENERIC_DEPENDENCY_LABELS, GENERIC_RISK_OPP_LABELS, life_brief


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

        # urgent risk recommendations (severity high). NOTE: active() returns a LIST of rec rows, and the
        # type field is `rec_type` (not `classification`) — the prior `.get("recommendations")`/`classification`
        # combo raised AttributeError that the except swallowed, so RISK alerts silently never surfaced.
        try:
            active = await self._os.active(ctx)
            for r in (active or []):
                if str(r.get("rec_type") or "").upper() == "RISK" and r.get("title"):
                    alerts.append({"title": r.get("title"), "severity": "high", "source": "Recommendation OS",
                                   "detail": r.get("description") or r.get("recommended_action"), "cta": "/dashboard/recommendations"})
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

        # Grounded risks/opportunities ONLY (Dashboard Trust Fix). Source from the recommendation engine
        # (evidence-backed) — archetype objective-template labels (GENERIC_RISK_OPP_LABELS) are NOT surfaced
        # as personalized dashboard risks/opps without real grounding. They still live in the Life Graph.
        ranked: list[dict[str, Any]] = []
        try:
            pri = await self._os.prioritize(ctx, top=6)
            ranked = pri.get("top_actions") or []
        except Exception:  # noqa: BLE001
            ranked = []

        def _typ(x: dict[str, Any]) -> str:
            return str(x.get("rec_type") or x.get("classification") or "").upper()

        grounded_risks = [x["title"] for x in ranked if _typ(x) == "RISK" and x.get("title")]
        grounded_opps = [x["title"] for x in ranked if _typ(x) == "OPPORTUNITY" and x.get("title")]
        # Keep any genuinely user-specific (non-archetype) snapshot risks/opps; drop the generic templates.
        extra_risks = [r for r in (snap.get("top_risks") or []) if str(r).strip().lower() not in GENERIC_RISK_OPP_LABELS]
        extra_opps = [o for o in (snap.get("top_opportunities") or []) if str(o).strip().lower() not in GENERIC_RISK_OPP_LABELS]
        risks_out = list(dict.fromkeys([*grounded_risks, *extra_risks]))[:5]
        opps_out = list(dict.fromkeys([*grounded_opps, *extra_opps]))[:5]

        # Section 1 — Life Vision (the north star). Only a USER-AUTHORED, high-confidence vision is treated
        # as a confirmed north star; otherwise the model is "still forming" and the objective is inferred.
        discovery_pct = round((health.get("model_quality") or 0) * 100)
        obj_conf_pct = round((po.get("confidence") or 0) * 100)
        authored = bool(snap.get("vision_authored"))
        vision_confirmed = authored and obj_conf_pct >= 60 and discovery_pct >= 40
        # Provenance (User Truth Model): confirmed > stated > inferred > assumed. The objective is an
        # advisor INFERENCE until the user authors/confirms a high-confidence vision.
        if vision_confirmed:
            prov_type, prov_source = "user_confirmed", "Advisor Discovery"
        elif authored:
            prov_type, prov_source = "user_stated", "Advisor Discovery"
        elif po.get("title"):
            prov_type, prov_source = "advisor_inferred", "Inferred from onboarding"
        else:
            prov_type, prov_source = "assumption", "Not yet established"
        vision = {
            "life_vision": snap.get("life_vision"),
            "vision_authored": authored,
            "vision_confirmed": vision_confirmed,
            "primary_objective": po.get("title"),
            "objective_inferred": bool(po.get("title")) and not authored,
            "confidence_pct": obj_conf_pct,
            "discovery_completion_pct": discovery_pct,
            "source": prov_source,
            # Per-item provenance the UI surfaces (where it came from / type / confidence / when).
            "provenance": {
                "provenance_type": prov_type,
                "source": prov_source,
                "confidence": (po.get("confidence") if po.get("confidence") is not None else None),
                "updated_at": po.get("updated_at"),
            },
        }

        # Section 2 — What Matters Most (grounded risks/opportunities only). depends_on also drops
        # archetype dependency labels (legacy rows) — objectives no longer create them.
        what_matters = {
            "primary_objective": po.get("title"),
            "reasoning": po.get("reasoning"),
            "depends_on": [d["label"] for d in snap.get("open_dependencies", [])
                           if str(d.get("label", "")).strip().lower() not in GENERIC_DEPENDENCY_LABELS],
            "risks": risks_out,
            "constraints": [c["label"] for c in snap.get("active_constraints", [])],
            "opportunities": opps_out,
            "supporting_objectives": [o["title"] for o in snap.get("objectives", [])[1:]],
            "source": "Recommendation OS + Advisor Discovery",
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

        # Section 4 — Next Best Action OR Highest Priority Issue (P4). Prefer the top ACTION/OPPORTUNITY
        # (something the user can DO). If only RISK/DEPENDENCY recs exist, reframe as the highest-priority
        # issue. If NOTHING is grounded, say so honestly + list the inputs needed — never invent an issue.
        action = next((x for x in ranked if _typ(x) in ("ACTION", "OPPORTUNITY")), None)
        if action:
            next_action = {"kind": "action", "label": "Your next best action", "title": action["title"],
                           "why": action.get("why"), "recommended_action": action.get("recommended_action"),
                           "expected_benefit": action.get("expected_benefit"), "confidence_pct": round((action.get("confidence") or 0) * 100),
                           "quantified_impact": action.get("quantified_impact"), "rec_type": action.get("rec_type", "ACTION"),
                           "source": "Recommendation OS"}
        elif ranked:
            issue = ranked[0]
            next_action = {"kind": "priority_issue", "label": "Highest priority issue", "title": issue["title"],
                           "why": issue.get("why"), "priority": "high", "rec_type": issue.get("rec_type", "RISK"),
                           "needed_to_act": "Add your income, savings rate, and retirement details so we can turn this into a concrete recommendation.",
                           "confidence_pct": round((issue.get("confidence") or 0) * 100), "source": "Recommendation OS"}
        else:
            next_action = {"kind": "insufficient", "label": "Highest priority issue",
                           "title": "Not enough information to identify a highest-priority issue yet.",
                           "needed_to_act": "Add income, savings rate, major debts, retirement target, and family obligations so LifeNavigator can identify your highest-priority issue.",
                           "source": "Recommendation OS"}

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

        # Life Brief — the narrative the user reads first ("this understands me"). Pure surfacing of the
        # already-computed Life Model (snapshot narrative + goals + grounded risk + Recommendation OS action).
        brief = life_brief(snap, next_action=next_action, readiness=readiness)

        return {
            "life_brief": brief,
            # "Why Arcana believes this" — explainability for the dominant narrative (None until one exists).
            "narrative_explanation": snap.get("narrative_explanation"),
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
