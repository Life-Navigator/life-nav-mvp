"""Decision Workspace (Sprint 14).

A guided decision surface: the user picks a preset life decision (New Job / MBA / Move / Buy House
/ Retirement) and LifeNavigator assembles a workspace — the cross-domain decision (tradeoffs,
evidence, confidence, scenarios from the Decision Engine) PLUS its projected READINESS IMPACT:
how the decision would move their Life Readiness Index and each domain. This ties decisions to
the readiness command center so the platform feels cohesive. Readiness deltas are transparent
scenario projections (flagged), not guarantees; the decision's numbers stay cited.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext
from .readiness import _WEIGHTS, _index_status

# Preset decisions: canonical question + per-domain readiness-impact model (projected deltas).
WORKSPACE_TYPES: dict[str, dict[str, Any]] = {
    "new_job": {
        "label": "New Job", "question": "Should I take a new job offer?",
        "impact": {"career": 12, "finance": 8},
        "rationale": {"career": "Advancement + new role", "finance": "Likely higher total compensation"}},
    "mba": {
        "label": "MBA", "question": "Should I get an MBA or invest the money instead?",
        "impact": {"education": 22, "finance": -10, "career": 12},
        "rationale": {"education": "Pursuing a graduate degree", "finance": "Near-term tuition / opportunity cost", "career": "Long-term earning power"}},
    "move": {
        "label": "Move", "question": "Should I move to another state?",
        "impact": {"finance": -4, "family": 6, "career": 6},
        "rationale": {"finance": "Relocation cost + cost-of-living shift", "family": "Proximity / quality of life", "career": "New market opportunities"}},
    "buy_house": {
        "label": "Buy House", "question": "Should I buy a house now?",
        "impact": {"finance": -14, "family": 8},
        "rationale": {"finance": "Down payment reduces liquidity; new mortgage", "family": "Housing stability"}},
    "retirement": {
        "label": "Retirement", "question": "Can I afford to retire, or should I delay retirement?",
        "impact": {"finance": -2},
        "rationale": {"finance": "Drawdown begins — this is a readiness gate; confirm the plan supports it"}},
}


class DecisionWorkspaceService:
    def __init__(self, decision_engine: Any, readiness_engine: Any) -> None:
        self._decision = decision_engine
        self._readiness = readiness_engine

    @staticmethod
    def types() -> list[dict[str, Any]]:
        return [{"decision_type": k, "label": v["label"], "question": v["question"],
                 "affected_domains": sorted(v["impact"].keys())} for k, v in WORKSPACE_TYPES.items()]

    async def create(self, ctx: UserContext, decision_type: str, *, persist: bool = True) -> dict[str, Any]:
        spec = WORKSPACE_TYPES.get(decision_type)
        if not spec:
            raise ValueError(f"decision_type must be one of {tuple(WORKSPACE_TYPES)}")
        question = spec["question"]
        if persist:
            res = await self._decision.persist(ctx, question)
            decision = res.get("decision", {})
            stored = res.get("stored", False)
        else:
            decision = await self._decision.decide(ctx, question)
            stored = False

        readiness = await self._readiness.assess(ctx)
        impact = self._readiness_impact(spec, readiness)

        return {
            "decision_type": decision_type, "label": spec["label"], "question": question, "stored": stored,
            "verdict": decision.get("description"), "title": decision.get("title"),
            "confidence": decision.get("confidence"),
            "scenarios": decision.get("scenarios_json", []),
            "tradeoffs": decision.get("tradeoffs_json", []),
            "evidence": decision.get("evidence_json", []),
            "assumptions": decision.get("assumptions_json", []),
            "affected_domains": decision.get("affected_domains", sorted(spec["impact"].keys())),
            "boundary": decision.get("governance_verdict", {}),
            "readiness_impact": impact,
            "next_steps": self._next_steps(decision_type, decision),
        }

    @staticmethod
    def _readiness_impact(spec: dict[str, Any], readiness: dict[str, Any]) -> dict[str, Any]:
        progress = {d["domain"]: d["progress"] for d in readiness.get("domains", [])}
        current_index = readiness.get("index", {}).get("score", 0)
        deltas = []
        projected_progress = dict(progress)
        for domain, delta in spec["impact"].items():
            cur = progress.get(domain)
            if cur is None:
                continue
            proj = max(0, min(100, cur + delta))
            projected_progress[domain] = proj
            deltas.append({"domain": domain, "current": cur, "projected": proj, "delta": proj - cur,
                           "direction": "up" if delta > 0 else "down" if delta < 0 else "flat",
                           "rationale": spec["rationale"].get(domain, "")})
        projected_index = round(sum(_WEIGHTS.get(d, 0.0) * p for d, p in projected_progress.items()))
        return {
            "is_projection": True,
            "current_index": current_index, "current_status": readiness.get("index", {}).get("status"),
            "projected_index": projected_index, "projected_status": _index_status(projected_index),
            "index_delta": projected_index - current_index,
            "domain_deltas": deltas,
            "note": "Projected scenario impact on your Life Readiness — directional, not a guarantee.",
        }

    @staticmethod
    def _next_steps(decision_type: str, decision: dict[str, Any]) -> list[str]:
        base = {
            "new_job": ["Upload the offer letter so we can value total comp", "Compare against your market rate (BLS OEWS)"],
            "mba": ["Add the program + a financial aid letter to ground the ROI", "Compare worst/expected/best payback"],
            "move": ["Add target-location cost-of-living + any new offer", "Check the family + career tradeoffs above"],
            "buy_house": ["Confirm your down payment + emergency fund stay intact", "Model the mortgage against cash flow"],
            "retirement": ["Upload retirement + Social Security statements", "Run the finance readiness gate before deciding"],
        }
        steps = list(base.get(decision_type, []))
        if not decision.get("evidence_json"):
            steps.insert(0, "Add the relevant documents/data — this decision needs more evidence to be confident")
        return steps
