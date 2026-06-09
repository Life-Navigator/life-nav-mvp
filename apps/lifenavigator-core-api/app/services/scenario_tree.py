"""Multi-Scenario Planning (Sprint 17) — a branching decision tree.

Instead of one decision, chain several (Take Job + MBA + Move + Buy House). Each decision point
branches into options; the engine expands the tree from the user's CURRENT state and computes,
for every path, the cumulative readiness index, net worth, retirement readiness, and confidence.
The deltas are transparent scenario projections (flagged), composed on top of the real current
state (readiness + net-worth snapshot + retirement plan). Not investment/tax advice.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext
from .readiness import _WEIGHTS, _index_status

FINANCE = "finance"

# Per-decision-point options + their projected effects (readiness domain deltas, net-worth $,
# retirement-readiness ratio delta, branch confidence). "no/stay/rent" branches are no-ops.
EFFECTS: dict[str, dict[str, dict[str, Any]]] = {
    "new_job": {
        "accept": {"label": "Take Job", "readiness": {"career": 12, "finance": 8}, "net_worth": 25000, "retirement_ratio": 0.03, "confidence": 0.6},
        "decline": {"label": "Stay Put", "readiness": {}, "net_worth": 0, "retirement_ratio": 0.0, "confidence": 0.85}},
    "mba": {
        "yes": {"label": "MBA", "readiness": {"education": 22, "finance": -10, "career": 12}, "net_worth": -80000, "retirement_ratio": -0.05, "confidence": 0.7},
        "no": {"label": "No MBA", "readiness": {}, "net_worth": 0, "retirement_ratio": 0.0, "confidence": 0.9}},
    "move": {
        "yes": {"label": "Move", "readiness": {"family": 6, "career": 6, "finance": -4}, "net_worth": -15000, "retirement_ratio": -0.01, "confidence": 0.55},
        "no": {"label": "Stay", "readiness": {}, "net_worth": 0, "retirement_ratio": 0.0, "confidence": 0.85}},
    "buy_house": {
        "yes": {"label": "Buy House", "readiness": {"finance": -14, "family": 8}, "net_worth": -60000, "retirement_ratio": -0.02, "confidence": 0.5},
        "no": {"label": "Rent", "readiness": {}, "net_worth": 0, "retirement_ratio": 0.0, "confidence": 0.8}},
}
DECISION_LABEL = {"new_job": "Job Offer", "mba": "MBA", "move": "Relocate", "buy_house": "Buy House"}
MAX_DECISIONS = 3


class ScenarioTreeService:
    def __init__(self, readiness: Any, planning: Any, supabase: Any) -> None:
        self._readiness = readiness
        self._planning = planning
        self._sb = supabase

    @staticmethod
    def available_decisions() -> list[dict[str, Any]]:
        return [{"decision_type": k, "label": DECISION_LABEL[k], "options": list(EFFECTS[k].keys())} for k in EFFECTS]

    def _index(self, progress: dict[str, float]) -> int:
        return round(sum(_WEIGHTS.get(d, 0.0) * p for d, p in progress.items()))

    async def build(self, ctx: UserContext, decisions: Optional[list[str]] = None) -> dict[str, Any]:
        decisions = [d for d in (decisions or ["mba", "new_job"]) if d in EFFECTS][:MAX_DECISIONS]
        if not decisions:
            decisions = ["mba", "new_job"]

        # ── current state ──
        readiness = await self._readiness.assess(ctx)
        base_progress = {d["domain"]: float(d["progress"]) for d in readiness["domains"]}
        nw_rows = await self._sb.select("net_worth_snapshots", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, order="as_of_date.desc", schema=FINANCE)
        base_net_worth = float(nw_rows[0].get("net_worth") or 0) if nw_rows else 0.0
        try:
            plan = await self._planning.plan(ctx)
            base_retire = (plan.get("retirement_readiness", {}).get("readiness_ratio") or 0.0) if plan.get("available") else 0.0
        except Exception:  # noqa: BLE001
            base_retire = 0.0

        nodes: list[dict[str, Any]] = []
        root_state: dict[str, Any] = {"progress": dict(base_progress), "net_worth": base_net_worth, "retirement_ratio": base_retire, "confidence": 1.0}
        root_id = "root"
        nodes.append({"id": root_id, "parent": None, "depth": 0, "decision_type": None, "option": None,
                      "label": "Current State", "is_leaf": False,
                      "outcome": self._outcome(root_state)})

        # ── expand the tree ──
        frontier = [(root_id, root_state)]
        for depth, dtype in enumerate(decisions, start=1):
            next_frontier: list[tuple[str, dict]] = []
            for parent_id, state in frontier:
                for opt, eff in EFFECTS[dtype].items():
                    progress = dict(state["progress"])
                    for dom, delta in eff["readiness"].items():
                        if dom in progress:
                            progress[dom] = max(0.0, min(100.0, progress[dom] + delta))
                    new_state = {
                        "progress": progress,
                        "net_worth": state["net_worth"] + eff["net_worth"],
                        "retirement_ratio": max(0.0, state["retirement_ratio"] + eff["retirement_ratio"]),
                        "confidence": state["confidence"] * eff["confidence"],
                    }
                    nid = f"{parent_id}>{dtype}:{opt}"
                    is_leaf = depth == len(decisions)
                    nodes.append({"id": nid, "parent": parent_id, "depth": depth, "decision_type": dtype,
                                  "option": opt, "label": eff["label"], "is_leaf": is_leaf,
                                  "outcome": self._outcome(new_state)})
                    next_frontier.append((nid, new_state))
            frontier = next_frontier

        leaves = [n for n in nodes if n["is_leaf"]]
        best = max(leaves, key=lambda n: n["outcome"]["readiness_index"]) if leaves else None
        return {
            "decisions": decisions, "decision_labels": [DECISION_LABEL[d] for d in decisions],
            "current": nodes[0]["outcome"], "nodes": nodes, "leaves": len(leaves),
            "best_path_id": best["id"] if best else None,
            "note": "Projected scenarios composed on your current state — directional, not guarantees.",
            "boundary": {"boundary_type": "financial_guidance", "disclaimer_text": "Scenario projections with stated assumptions — not investment, tax, or legal advice."},
        }

    def _outcome(self, state: dict[str, Any]) -> dict[str, Any]:
        idx = self._index(state["progress"])
        return {"readiness_index": idx, "readiness_status": _index_status(idx),
                "net_worth": round(state["net_worth"], 0),
                "retirement_ratio": round(state["retirement_ratio"], 2),
                "confidence": round(state["confidence"], 2)}
