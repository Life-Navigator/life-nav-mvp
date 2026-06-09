"""Explainable Decision Brain (Elite Sprint 36).

A decision-centric reasoning model: the CENTER is the decision, surrounded by weighted factor nodes
(each positive / negative / neutral, with weight, confidence, and source), plus the things the
platform does NOT know (missing-info nodes), the evidence it deliberately ignored (zero-weight /
excluded nodes), and the deterministic tools that contributed. The recommendation is an OUTPUT of
the graph, never an assertion. Everything is auditable — nothing is magical.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext
from .readiness import _WEIGHTS

DECISIONS = {
    "buy_house": "Buy a house now", "delay_house": "Delay the home purchase", "new_job": "Take the new job",
    "mba": "Attend graduate school", "retire_early": "Retire early", "have_children": "Have children",
    "start_business": "Start a business", "relocate": "Relocate",
}
# How each domain's status maps to influence on a major life/financial decision.
_DOMAIN_LABEL = {"finance": "Financial readiness", "family": "Family / protection", "career": "Career stability",
                 "health": "Health", "education": "Education", "decision": "Decision readiness"}


class DecisionBrainService:
    def __init__(self, readiness: Any, life: Any, reco_os: Any, supabase: Any) -> None:
        self._readiness = readiness
        self._life = life
        self._os = reco_os
        self._sb = supabase

    @staticmethod
    def decisions() -> list[dict[str, str]]:
        return [{"key": k, "label": v} for k, v in DECISIONS.items()]

    @staticmethod
    def _direction(status: str) -> str:
        return {"green": "positive", "yellow": "neutral", "orange": "negative", "red": "negative"}.get(status, "neutral")

    async def build(self, ctx: UserContext, decision: str) -> dict[str, Any]:
        label = DECISIONS.get(decision, decision.replace("_", " ").title())
        readiness = await self._readiness.assess(ctx)
        domains = {d["domain"]: d for d in readiness.get("domains", [])}
        try:
            life = await self._life.life_context(ctx)
        except Exception:  # noqa: BLE001
            life = {"has_discovery": False}

        factors: list[dict[str, Any]] = []
        # 1) Readiness domains are the weighted factors (weight = the readiness-index weight, normalized).
        total_w = sum(_WEIGHTS.values())
        for dom, w in _WEIGHTS.items():
            d = domains.get(dom)
            if not d:
                continue
            status = d.get("status", "yellow")
            factors.append({
                "id": f"factor:{dom}", "label": _DOMAIN_LABEL.get(dom, dom.title()),
                "weight": round(w / total_w * 100), "direction": self._direction(status),
                "confidence": round(d.get("confidence", 0.5), 2), "source": f"readiness:{dom}",
                "detail": d.get("gap") or f"{dom} readiness {d.get('progress')}%",
                "related_objectives": [], "tool": "Life Readiness Engine",
            })
        # 2) Life constraints are explicit negative factors (trust over optimism).
        for c in (life.get("constraints") or []):
            factors.append({"id": f"constraint:{c[:20]}", "label": c, "weight": 8, "direction": "negative",
                            "confidence": 0.7, "source": "life:constraints", "detail": "A stated constraint that works against this decision.",
                            "tool": "Constraint Intelligence"})
        # 3) The user's primary objective is a positive/neutral factor (the decision should serve it).
        po = life.get("primary_objective") or {}
        if po:
            factors.append({"id": "objective:primary", "label": f"Objective: {po.get('title')}", "weight": 12,
                            "direction": "positive", "confidence": round(po.get("confidence") or 0.5, 2),
                            "source": "life:objectives", "detail": "Your primary life objective — the decision is judged by how well it serves this.",
                            "tool": "Life Discovery Engine"})

        # MISSING-INFO nodes (D7): open dependencies / unknown inputs the platform admits it lacks.
        missing = [{"id": f"missing:{m[:20]}", "label": m, "kind": "missing",
                    "detail": "Not yet known — providing this would sharpen the recommendation."}
                   for m in (life.get("open_dependencies") or [])[:6]]

        # ZERO-WEIGHT / EXCLUDED nodes (D8): considered but not used, with the reason.
        excluded = await self._excluded(ctx)

        # TOOL nodes (D9): the deterministic engines that contributed.
        tools = [{"id": "tool:readiness", "label": "Life Readiness Engine", "output": f"Index {readiness['index']['score']}/100"},
                 {"id": "tool:discovery", "label": "Life Discovery Engine", "output": po.get("title", "—")},
                 {"id": "tool:recos", "label": "Recommendation OS", "output": "prioritized actions"}]

        # The recommendation is an OUTPUT of the factors, not an assertion.
        neg = [f for f in factors if f["direction"] == "negative"]
        pos = [f for f in factors if f["direction"] == "positive"]
        neg_w = sum(f["weight"] for f in neg)
        pos_w = sum(f["weight"] for f in pos)
        if neg_w > pos_w + 15:
            verdict, vlabel = "not_yet", f"Strengthen {neg[0]['label']} before committing to '{label}'."
        elif pos_w > neg_w + 15:
            verdict, vlabel = "supported", f"'{label}' is well-supported by your current readiness."
        else:
            verdict, vlabel = "conditional", f"'{label}' is viable but depends on closing {neg[0]['label'] if neg else 'a few gaps'}."

        return {
            "decision": decision, "decision_label": label,
            "center": {"id": "decision", "label": label, "type": "Decision"},
            "factors": sorted(factors, key=lambda f: f["weight"], reverse=True),
            "missing_information": missing, "excluded_evidence": excluded, "tools": tools,
            "recommendation": {"verdict": verdict, "summary": vlabel,
                               "positive_weight": pos_w, "negative_weight": neg_w,
                               "explanation": "This verdict is the net of the weighted factors above — every factor is inspectable, nothing is hidden."},
            "boundary": "An explainable decision model, not advice — every factor traces to your data or a stated assumption.",
        }

    async def _excluded(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Considered-but-not-used: documents that yielded no usable values, superseded objectives."""
        out: list[dict[str, Any]] = []
        try:
            docs = await self._sb.select("documents", columns="doc_type,status,status_reason", filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema="documents")
        except Exception:  # noqa: BLE001
            docs = []
        for d in docs:
            if d.get("status") == "needs_review":
                reason = {"scanned_or_image": "scanned — no extractable text", "no_fields_matched": "no expected values found"}.get(d.get("status_reason", ""), "needs review")
                out.append({"id": f"excluded:{d.get('doc_type')}", "label": f"{d.get('doc_type')} document", "reason": reason, "weight": 0})
        try:
            objs = await self._sb.select("life_objectives", columns="title,status", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="life")
        except Exception:  # noqa: BLE001
            objs = []
        for o in objs:
            if o.get("status") == "superseded":
                out.append({"id": "excluded:obj", "label": f"Objective: {o.get('title')}", "reason": "superseded by newer discovery", "weight": 0})
        return out[:8]
