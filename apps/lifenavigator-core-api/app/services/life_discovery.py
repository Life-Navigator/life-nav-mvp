"""Life Discovery Engine (Elite Sprint 33) — the moat foundation.

Onboarding doesn't collect data; it discovers the *need behind the need*. A surface goal ("buy a
house") plus the user's why-chain is resolved to a ROOT life objective ("build family stability"),
and that objective is decomposed into its cross-domain dependencies (home, income, life insurance,
emergency fund, schools, support network, health coverage), risks, and opportunities — each a
first-class object in the Personal Life Graph. These feed readiness, the Recommendation OS, and the
roadmap *before any document is uploaded*. Nothing is fabricated: dependencies are a known
decomposition of the objective, and we mark them unknown until evidence confirms them.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext

LIFE = "life"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


# ── The dependency knowledge map: root objective -> cross-domain dependencies / risks / opportunities ──
ROOT_OBJECTIVES: dict[str, dict[str, Any]] = {
    "family_stability": {
        "label": "Build family stability",
        "dependencies": [("A family-ready home", "family"), ("Stable income", "career"),
                         ("Life insurance to protect dependents", "family"), ("6-month emergency fund", "finance"),
                         ("Good schools / childcare", "family"), ("A family support network", "family"),
                         ("Health coverage for the family", "health")],
        "risks": [("Income loss while dependents rely on you", "finance"), ("No estate plan for guardianship", "family")],
        "opportunities": [("Employer dependent-care FSA + family benefits", "finance")],
    },
    "homeownership": {
        "label": "Own a home",
        "dependencies": [("Down payment saved", "finance"), ("Stable income to qualify", "career"),
                         ("Healthy credit", "finance"), ("Affordable target location", "finance")],
        "risks": [("Overextending on the mortgage", "finance")],
        "opportunities": [("First-time buyer programs", "finance")],
    },
    "financial_independence": {
        "label": "Reach financial independence",
        "dependencies": [("High savings rate", "finance"), ("Invested retirement assets", "finance"),
                         ("Debt paid down", "finance"), ("Healthcare plan for retirement", "health"),
                         ("A withdrawal plan", "finance")],
        "risks": [("Outliving your assets", "finance"), ("Sequence-of-returns risk", "finance")],
        "opportunities": [("Full employer 401(k) match", "finance"), ("Tax-advantaged accounts", "finance")],
    },
    "career_growth": {
        "label": "Advance your career",
        "dependencies": [("In-demand skills / credentials", "education"), ("A professional network", "career"),
                         ("Compensation benchmarking", "career"), ("Geographic / role flexibility", "career")],
        "risks": [("Skill obsolescence", "career")],
        "opportunities": [("Internal promotion path", "career"), ("Higher-paying market move", "career")],
    },
    "education_advancement": {
        "label": "Advance through education",
        "dependencies": [("Program funding / aid", "finance"), ("Time to study", "education"),
                         ("Manageable opportunity cost", "finance"), ("A clear post-degree ROI", "career")],
        "risks": [("Debt without a payoff", "finance")],
        "opportunities": [("Employer tuition assistance", "career"), ("GI Bill / scholarships", "education")],
    },
    "health_longevity": {
        "label": "Optimize health & longevity",
        "dependencies": [("Consistent fitness routine", "health"), ("Sound nutrition", "health"),
                         ("Quality sleep", "health"), ("Preventive care / screenings", "health"), ("Stress management", "health")],
        "risks": [("Undetected chronic risk factors", "health")],
        "opportunities": [("Employer wellness + HSA", "health")],
    },
    "legacy": {
        "label": "Build a lasting legacy",
        "dependencies": [("A will & estate documents", "family"), ("Aligned beneficiaries", "family"),
                         ("Adequate life insurance", "family"), ("A wealth-transfer plan", "finance")],
        "risks": [("The state decides without a plan", "family")],
        "opportunities": [("Trust structures", "family")],
    },
}

# Surface-goal signals -> root objective. Family signals OUTRANK house signals (the need behind the need).
_ROOT_SIGNALS: list[tuple[tuple[str, ...], str]] = [
    (("child", "kids", "baby", "family", "raise a family", "start a family", "parent"), "family_stability"),
    (("retire", "retirement", "financial independence", "freedom", "fire"), "financial_independence"),
    (("legacy", "estate", "inherit", "leave behind", "wealth transfer"), "legacy"),
    (("mba", "school", "degree", "law school", "medical school", "certification", "education"), "education_advancement"),
    (("promotion", "job", "career", "raise", "leadership", "entrepreneur", "business"), "career_growth"),
    (("health", "fitness", "weight", "longevity", "energy", "sleep"), "health_longevity"),
    (("house", "home", "buy", "mortgage", "property"), "homeownership"),
]


class LifeDiscoveryService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    @staticmethod
    def infer_root(surface_goal: str, why_chain: Optional[list] = None) -> str:
        """Resolve the root objective from the surface goal + the why-chain. The why-chain wins —
        'buy a house' because 'we want children' resolves to family_stability, not homeownership."""
        why_text = " ".join(str(w.get("a", "")) if isinstance(w, dict) else str(w) for w in (why_chain or [])).lower()
        surface = (surface_goal or "").lower()
        # why-chain signals first (the real motivation), then the surface goal
        for text in (why_text, surface):
            for signals, root in _ROOT_SIGNALS:
                if any(sig in text for sig in signals):
                    return root
        return "career_growth"

    async def save_vision(self, ctx: UserContext, *, vision_text: str, prompts: Optional[dict] = None) -> dict[str, Any]:
        await self._sb.upsert("life_vision", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                              "vision_text": vision_text, "prompts": prompts or {}, "updated_at": _now()}, schema=LIFE)
        return {"saved": True, "vision_text": vision_text}

    async def discover_goal(self, ctx: UserContext, *, surface_goal: str, why_chain: Optional[list] = None,
                            root_override: Optional[str] = None) -> dict[str, Any]:
        """Capture a surface goal + why-chain → a ROOT objective decomposed into the Life Graph."""
        root = root_override if root_override in ROOT_OBJECTIVES else self.infer_root(surface_goal, why_chain)
        spec = ROOT_OBJECTIVES[root]
        obj_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:{root}"))
        await self._sb.upsert("life_objectives", {
            "id": obj_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "title": spec["label"],
            "root_objective_key": root, "surface_goal": surface_goal, "why_chain": why_chain or [],
            "domain": "cross_domain", "importance": "high",
        }, schema=LIFE)
        # the surface goal becomes a goal under the objective; dependencies/risks/opps become nodes
        await self._sb.upsert("goals", {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:surface")),
                                        "user_id": ctx.user_id, "tenant_id": ctx.user_id, "objective_id": obj_id,
                                        "title": surface_goal, "domain": "cross_domain", "status": "open"}, schema=LIFE)
        deps = []
        for label, domain in spec["dependencies"]:
            d = {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:dep:{label}")), "user_id": ctx.user_id,
                 "tenant_id": ctx.user_id, "objective_id": obj_id, "label": label, "domain": domain,
                 "satisfied": None, "prompt": f"Confirm or upload evidence for: {label}"}
            await self._sb.upsert("dependencies", d, schema=LIFE)
            deps.append(d)
        for label, domain in spec.get("risks", []):
            await self._sb.upsert("risks", {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:risk:{label}")),
                                            "user_id": ctx.user_id, "tenant_id": ctx.user_id, "objective_id": obj_id,
                                            "label": label, "domain": domain, "severity": "medium"}, schema=LIFE)
        for label, domain in spec.get("opportunities", []):
            await self._sb.upsert("opportunities", {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:opp:{label}")),
                                                    "user_id": ctx.user_id, "tenant_id": ctx.user_id, "objective_id": obj_id,
                                                    "label": label, "domain": domain}, schema=LIFE)
        return {"objective_id": obj_id, "root_objective": root, "root_label": spec["label"],
                "surface_goal": surface_goal, "the_need_behind_the_need": spec["label"],
                "dependencies": [{"label": d["label"], "domain": d["domain"]} for d in deps],
                "risks": [r[0] for r in spec.get("risks", [])], "opportunities": [o[0] for o in spec.get("opportunities", [])]}

    async def _rows(self, table: str, ctx: UserContext) -> list[dict]:
        return await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=LIFE)

    async def snapshot(self, ctx: UserContext) -> dict[str, Any]:
        vision = await self._rows("life_vision", ctx)
        objectives = await self._rows("life_objectives", ctx)
        deps = await self._rows("dependencies", ctx)
        risks = await self._rows("risks", ctx)
        opps = await self._rows("opportunities", ctx)
        return {
            "life_vision": vision[0].get("vision_text") if vision else None,
            "objectives": [{"id": o["id"], "title": o["title"], "root": o.get("root_objective_key"),
                            "surface_goal": o.get("surface_goal"), "why_chain": o.get("why_chain")} for o in objectives],
            "top_risks": [r["label"] for r in risks[:5]],
            "top_opportunities": [o["label"] for o in opps[:5]],
            "open_dependencies": [{"label": d["label"], "domain": d["domain"]} for d in deps if not d.get("satisfied")][:8],
            "note": "Your objectives drive recommendations + roadmap before you upload anything.",
        }

    async def personal_graph(self, ctx: UserContext) -> dict[str, Any]:
        """The Personal Life Graph: vision → objectives → goals/dependencies/risks/opportunities."""
        vision = await self._rows("life_vision", ctx)
        objectives = await self._rows("life_objectives", ctx)
        deps = await self._rows("dependencies", ctx)
        goals = await self._rows("goals", ctx)
        risks = await self._rows("risks", ctx)
        opps = await self._rows("opportunities", ctx)
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        if vision and vision[0].get("vision_text"):
            nodes.append({"id": "vision", "type": "Life Vision", "label": vision[0]["vision_text"][:60], "color": "purple"})
        for o in objectives:
            nodes.append({"id": o["id"], "type": "Life Objective", "label": o["title"], "color": "indigo"})
            if vision:
                edges.append({"from": "vision", "to": o["id"], "rel": "realizes"})
        for coll, typ, color, rel in ((goals, "Goal", "blue", "advances"), (deps, "Dependency", "amber", "requires"),
                                      (risks, "Risk", "red", "threatened_by"), (opps, "Opportunity", "green", "accelerated_by")):
            for r in coll:
                nid = r["id"]
                nodes.append({"id": nid, "type": typ, "label": r.get("label") or r.get("title"), "color": color, "domain": r.get("domain")})
                if r.get("objective_id"):
                    edges.append({"from": r["objective_id"], "to": nid, "rel": rel})
        return {"nodes": nodes, "edges": edges, "objective_count": len(objectives),
                "legend": {"purple": "Life Vision", "indigo": "Life Objective", "blue": "Goal",
                           "amber": "Dependency", "red": "Risk", "green": "Opportunity"}}
