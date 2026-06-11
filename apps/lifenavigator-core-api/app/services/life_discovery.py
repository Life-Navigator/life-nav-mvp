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

import re
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

# ── Life Theme layer (Sprint 34): statements -> weighted themes -> objectives (not keyword routing) ──
THEMES: dict[str, list[str]] = {
    "freedom": ["freedom", "free", "depend on anyone", "don't want to depend", "not depend", "independent", "independence", "on my own", "not rely", "autonomy", "self-sufficient", "self sufficient"],
    "security": ["security", "secure", "stable", "stability", "safe", "peace of mind", "certainty", "protected", "fallback"],
    "family": ["family", "children", "child", "kids", "kid", "baby", "pregnant", "wife", "husband", "spouse", "raise", "dependents", "newborn", "expecting"],
    "wealth_creation": ["wealth", "rich", "rental income", "passive income", "net worth", "build equity", "investment", "returns", "appreciate"],
    "health": ["health", "healthy", "weight", "fitness", "fit", "energy", "longevity", "strlength", "stronger", "sleep", "wellness", "lose weight"],
    "career_fulfillment": ["career", "promotion", "leadership", "fulfillment", "challenged", "valued", "burnout", "burning me out", "burned out", "change careers", "career change", "new job", "boss", "compensation", "paid more", "salary", "business", "entrepreneur", "start a business", "founder"],
    "achievement": ["achieve", "succeed", "success", "ambition", "advance", "prove", "accomplish"],
    "legacy": ["legacy", "estate", "inherit", "leave behind", "generational", "wealth transfer", "pass on", "heirs"],
    "belonging": ["closer to family", "near family", "community", "belong", "connection", "support network", "support system"],
    "purpose": ["purpose", "meaning", "impact", "service", "give back", "mission", "fulfilling"],
    "adventure": ["adventure", "travel", "explore", "new city", "feel stuck", "stuck", "change of scenery"],
}
THEME_OBJECTIVE: dict[str, str] = {
    "freedom": "financial_independence", "wealth_creation": "financial_independence",
    "security": "family_stability", "family": "family_stability", "belonging": "family_stability",
    "health": "health_longevity", "career_fulfillment": "career_growth", "achievement": "career_growth",
    "legacy": "legacy", "purpose": "legacy", "adventure": "career_growth",
}
# TERMINAL goals: the goal's own domain IS the objective (the why is motivation, not the objective).
# (surface signal -> objective, base confidence). Checked before instrumental routing.
_TERMINAL: list[tuple[tuple[str, ...], str, float]] = [
    (("lose weight", "weight", "fitness", "get fit", "get healthy", "health", "sleep better", "more energy"), "health_longevity", 0.86),
    (("life insurance", "insurance", "protect my family", "coverage"), "family_stability", 0.82),
    (("retire", "retirement"), "financial_independence", 0.85),
    (("new job", "change jobs", "quit my job", "promotion", "leave my job", "hate my boss", "burned out", "burning me out"), "career_growth", 0.84),
]
# INSTRUMENTAL signals: a means to a deeper end — the why-chain decides the objective.
_INSTRUMENTAL = ("house", "home", "buy", "mortgage", "property", "move", "relocat", "save", "money", "invest", "mba", "degree", "school", "certification")
_CONF_THRESHOLD = 0.6  # below this, probe instead of concluding


class LifeDiscoveryService:
    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    @staticmethod
    def _score_themes(text: str) -> dict[str, float]:
        scores = {t: sum(1 for sig in sigs if sig in text) for t, sigs in THEMES.items()}
        scores = {t: c for t, c in scores.items() if c > 0}
        total = sum(scores.values()) or 1
        return {t: round(c / total, 2) for t, c in scores.items()}

    @staticmethod
    def _detect_constraints(text: str) -> list[dict[str, Any]]:
        """Recognize conflicting / unrealistic goals — trust over optimism."""
        out: list[dict[str, Any]] = []
        broke = any(p in text for p in ("no savings", "haven't saved", "no retirement", "nothing saved", "broke", "in debt", "lot of debt", "no money"))
        early_retire = ("retire" in text and any(a in text for a in ("45", "40", "early", "50", "by 4", "by 5")))
        if early_retire and broke:
            out.append({"label": "Retirement timeline appears inconsistent with current savings", "kind": "savings",
                        "detail": "An early-retirement goal with little/no savings needs a higher savings rate or a later timeline — not impossible, but it requires explicit action.", "severity": "high"})
        if any(p in text for p in ("$2m", "$2 m", "2 million", "expensive house", "dream house")) and broke:
            out.append({"label": "Home budget may exceed current capacity", "kind": "affordability",
                        "detail": "The target home value looks high relative to stated savings/income — review affordability before committing.", "severity": "medium"})
        return out

    def analyze(self, *, surface_goal: str, why_chain: Optional[list] = None, vision: str = "") -> dict[str, Any]:
        """Reason from statement → themes → objective with confidence, alternatives, and (if
        uncertain) a follow-up question. Terminal goals (lose weight, new job) take their own domain;
        instrumental goals (house, save, move) are resolved by the why-chain."""
        why_text = " ".join(str(w.get("a", "")) if isinstance(w, dict) else str(w) for w in (why_chain or [])).lower()
        surface = (surface_goal or "").lower()
        # The immediate discovery signal is the goal + why-chain. The broad life vision is captured
        # separately and used only as a weak tie-breaker — it must not dilute goal-specific signal.
        text = f"{surface} {why_text}".strip()
        themes = self._score_themes(text)
        if not themes and vision:
            themes = self._score_themes(vision.lower())
        ranked = sorted(themes.items(), key=lambda kv: kv[1], reverse=True)
        constraints = self._detect_constraints(text)

        # 1) Terminal goal? Its domain is the objective; the why is motivation.
        for sigs, obj, conf in _TERMINAL:
            if any(s in surface for s in sigs):
                alts = [{"objective": THEME_OBJECTIVE[t], "weight": w} for t, w in ranked[:3]
                        if THEME_OBJECTIVE.get(t) and THEME_OBJECTIVE[t] != obj][:2]
                return {"primary_objective": obj, "confidence": conf, "themes": themes, "alternatives": alts,
                        "reasoning": f"'{surface_goal}' is a goal whose own domain defines the objective ({ROOT_OBJECTIVES[obj]['label']}); your stated reasons are treated as motivation, not the objective.",
                        "needs_followup": False, "constraints": constraints}

        # 2) Instrumental goal with no why-chain → PROBE, never invent.
        instrumental = any(s in surface for s in _INSTRUMENTAL)
        if instrumental and not why_text.strip():
            return {"primary_objective": None, "confidence": 0.3, "themes": {}, "alternatives": [],
                    "reasoning": f"'{surface_goal}' can serve very different life objectives — we shouldn't guess.",
                    "needs_followup": True,
                    "followup_question": f"Why is '{surface_goal}' important to you right now?",
                    "followup_options": ["Family", "Investment / wealth", "Stability / security", "Freedom / independence", "Relocation / change", "Something else"],
                    "constraints": constraints}

        # 3) Resolve from themes (instrumental-with-why, or unmapped).
        if not ranked:
            return {"primary_objective": None, "confidence": 0.3, "themes": {}, "alternatives": [],
                    "reasoning": "Not enough signal to infer your underlying objective.", "needs_followup": True,
                    "followup_question": f"What would achieving '{surface_goal}' really give you?",
                    "followup_options": ["Security", "Freedom", "Family", "Growth", "Health", "Legacy"], "constraints": constraints}
        top_theme, top_w = ranked[0]
        second_w = ranked[1][1] if len(ranked) > 1 else 0.0
        primary = THEME_OBJECTIVE.get(top_theme, "career_growth")
        margin = top_w - second_w
        confidence = round(min(0.92, 0.55 + margin + (0.1 if len(ranked) == 1 else 0)), 2)
        alts = [{"objective": THEME_OBJECTIVE[t], "weight": w} for t, w in ranked[1:4]
                if THEME_OBJECTIVE.get(t) and THEME_OBJECTIVE[t] != primary][:2]
        result = {"primary_objective": primary, "confidence": confidence, "themes": themes, "alternatives": alts,
                  "reasoning": f"Your reasons point most to '{top_theme}' (weight {top_w}), which maps to {ROOT_OBJECTIVES[primary]['label']}.",
                  "needs_followup": confidence < _CONF_THRESHOLD, "constraints": constraints}
        if result["needs_followup"]:
            result["followup_question"] = f"Is '{surface_goal}' more about {top_theme}, or something else?"
            result["followup_options"] = [t for t, _ in ranked[:3]] + ["Something else"]
        return result

    # Conversation-derived dependencies (V3 Sprint 8): keyed off the user's OWN words, not a generic
    # per-objective template. Each tuple = (signal words in the statement) → (dependencies they imply).
    _DEP_SIGNALS: list[tuple[tuple[str, ...], list[str]]] = [
        (("italy", "travel", "trip", "vacation", "honeymoon", "europe"), ["Vacation fund"]),
        (("business", "company", "startup", "llc", "my own"), ["Business cash flow", "Owner replacement plan"]),
        (("security", "secure", "protect", "stability", "stable"), ["Emergency reserve", "Life insurance"]),
        (("family", "wife", "husband", "kids", "children", "spouse", "partner"), ["Survivor income plan"]),
        (("income", "earn", "raise", "salary", "make more"), ["Income growth plan"]),
        (("house", "home", "mortgage", "property", "bigger place"), ["Down payment", "Mortgage capacity"]),
        (("retire", "retirement", "independence", "passive", "step back"), ["Passive income", "Investment assets"]),
        (("health", "fitness", "weight", "get fit", "energy"), ["Sustainable health routine"]),
        (("debt", "loan", "payoff", "pay off"), ["Debt reduction plan"]),
        (("college", "school", "education", "degree", "tuition"), ["Education funding"]),
    ]

    def _derive_deps(self, text: str) -> list[str]:
        out: list[str] = []
        for sigs, deps in self._DEP_SIGNALS:
            if any(s in text for s in sigs):
                out += deps
        return list(dict.fromkeys(out))[:4]

    def analyze_statement(self, statement: str) -> list[dict[str, Any]]:
        """V3 Sprint 2: a single answer can contain SEVERAL goals. Split it into clauses, reason about
        each, and return candidate_goals[] — never collapsed to one. Dependencies are derived from the
        user's own words (Sprint 8)."""
        text = (statement or "").strip()
        if not text:
            return []
        parts = re.split(r"\band\b|,|;|&|\bplus\b|\bas well as\b", text, flags=re.IGNORECASE)
        clauses = [p.strip() for p in parts if len(p.strip()) >= 3] or [text]
        candidates: list[dict[str, Any]] = []
        seen: set[str] = set()
        for clause in clauses:
            a = self.analyze(surface_goal=clause)
            obj_key = a.get("primary_objective")
            label = ROOT_OBJECTIVES.get(obj_key, {}).get("label") if obj_key else None
            deps = self._derive_deps(clause.lower())
            if not label and not deps:
                continue  # pure connector clause with no signal
            key = (label or clause).lower()
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "goal": clause,
                "objective": label or clause,
                "objective_key": obj_key,
                "confidence": round(a.get("confidence") or 0.5, 2),
                "supporting_statements": [clause],
                "dependencies": deps,
                "domain": ROOT_OBJECTIVES.get(obj_key, {}).get("domain", "core") if obj_key else "core",
            })
        return candidates

    @staticmethod
    def infer_root(surface_goal: str, why_chain: Optional[list] = None) -> str:
        """Back-compat thin wrapper — returns the primary objective (or career_growth if probing)."""
        r = LifeDiscoveryService(None).analyze(surface_goal=surface_goal, why_chain=why_chain)
        return r.get("primary_objective") or "career_growth"

    async def save_vision(self, ctx: UserContext, *, vision_text: str, prompts: Optional[dict] = None) -> dict[str, Any]:
        await self._sb.upsert("life_vision", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                              "vision_text": vision_text, "prompts": prompts or {}, "updated_at": _now()}, schema=LIFE)
        return {"saved": True, "vision_text": vision_text}

    async def _edge(self, ctx: UserContext, src: str, tgt: str, etype: str, domain: str = "", conf: float = 0.7) -> None:
        eid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:{src}->{tgt}:{etype}"))
        await self._sb.upsert("life_graph_edges", {"edge_id": eid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                   "source_node": src, "target_node": tgt, "edge_type": etype,
                                                   "domain": domain or None, "confidence": conf, "status": "active", "updated_at": _now()}, schema=LIFE)

    async def discover_goal(self, ctx: UserContext, *, surface_goal: str, why_chain: Optional[list] = None,
                            root_override: Optional[str] = None) -> dict[str, Any]:
        """Discover the objective: reason about it; PROBE if uncertain; else decompose + persist the
        graph with confidence/themes/alternatives/constraints + supersede stale objectives."""
        vis = await self._rows("life_vision", ctx)
        vision_text = vis[0].get("vision_text", "") if vis else ""
        a = self.analyze(surface_goal=surface_goal, why_chain=why_chain, vision=vision_text)
        root = root_override if root_override in ROOT_OBJECTIVES else a.get("primary_objective")

        # Adaptive: if uncertain (and not overridden), ask a follow-up — never invent an objective.
        if not root_override and (a.get("needs_followup") or not root):
            return {"needs_followup": True, "surface_goal": surface_goal,
                    "followup_question": a.get("followup_question"), "followup_options": a.get("followup_options", []),
                    "confidence": a.get("confidence"), "reasoning": a.get("reasoning"),
                    "themes": a.get("themes", {}), "constraints": a.get("constraints", [])}

        assert root is not None  # guaranteed by the probe guard above
        spec = ROOT_OBJECTIVES[root]
        obj_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:{root}"))
        # Lifecycle: supersede any active objective for this SAME surface goal with a different root.
        for o in await self._rows("life_objectives", ctx):
            if (o.get("surface_goal", "").strip().lower() == surface_goal.strip().lower()
                    and o.get("root_objective_key") != root and o.get("status", "active") == "active"):
                await self._sb.update("life_objectives", {"status": "superseded", "updated_at": _now()},
                                      filters={"id": f"eq.{o['id']}"}, schema=LIFE)

        await self._sb.upsert("life_objectives", {
            "id": obj_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "title": spec["label"],
            "root_objective_key": root, "surface_goal": surface_goal, "why_chain": why_chain or [],
            "domain": "cross_domain", "importance": "high", "status": "active",
            "confidence": a.get("confidence"), "themes": list(a.get("themes", {}).keys()),
            "alternatives": a.get("alternatives", []), "reasoning": a.get("reasoning"), "updated_at": _now(),
        }, schema=LIFE)
        goal_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:surface"))
        await self._sb.upsert("goals", {"id": goal_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                        "objective_id": obj_id, "title": surface_goal, "domain": "cross_domain", "status": "open"}, schema=LIFE)
        await self._edge(ctx, goal_id, obj_id, "advances", "cross_domain", a.get("confidence", 0.7))
        deps = []
        for label, domain in spec["dependencies"]:
            did = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:dep:{label}"))
            await self._sb.upsert("dependencies", {"id": did, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                   "objective_id": obj_id, "label": label, "domain": domain,
                                                   "satisfied": None, "prompt": f"Confirm or upload evidence for: {label}"}, schema=LIFE)
            await self._edge(ctx, obj_id, did, "requires", domain)
            deps.append({"label": label, "domain": domain})
        for label, domain in spec.get("risks", []):
            rid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:risk:{label}"))
            await self._sb.upsert("risks", {"id": rid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                            "objective_id": obj_id, "label": label, "domain": domain, "severity": "medium"}, schema=LIFE)
            await self._edge(ctx, obj_id, rid, "threatened_by", domain)
        for label, domain in spec.get("opportunities", []):
            oid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:opp:{label}"))
            await self._sb.upsert("opportunities", {"id": oid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                    "objective_id": obj_id, "label": label, "domain": domain}, schema=LIFE)
            await self._edge(ctx, obj_id, oid, "accelerated_by", domain)
        # Constraint intelligence — conflicts become first-class nodes, not optimistic recommendations.
        constraints = a.get("constraints", [])
        for c in constraints:
            cid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{obj_id}:con:{c['label']}"))
            await self._sb.upsert("constraints", {"id": cid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                  "objective_id": obj_id, "label": c["label"], "kind": c.get("kind"),
                                                  "detail": c.get("detail"), "severity": c.get("severity", "medium")}, schema=LIFE)
            await self._edge(ctx, obj_id, cid, "conflicts_with", c.get("kind", ""), 0.8)
        return {"objective_id": obj_id, "root_objective": root, "root_label": spec["label"],
                "surface_goal": surface_goal, "the_need_behind_the_need": spec["label"],
                "confidence": a.get("confidence"), "themes": a.get("themes", {}), "reasoning": a.get("reasoning"),
                "alternatives": a.get("alternatives", []), "needs_followup": False,
                "dependencies": deps, "risks": [r[0] for r in spec.get("risks", [])],
                "opportunities": [o[0] for o in spec.get("opportunities", [])],
                "constraints": [{"label": c["label"], "detail": c.get("detail")} for c in constraints]}

    async def _rows(self, table: str, ctx: UserContext) -> list[dict]:
        return await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=LIFE)

    @staticmethod
    def _active(objectives: list[dict]) -> list[dict]:
        return [o for o in objectives if o.get("status", "active") == "active"]

    async def snapshot(self, ctx: UserContext) -> dict[str, Any]:
        vision = await self._rows("life_vision", ctx)
        objectives = self._active(await self._rows("life_objectives", ctx))
        active_ids = {o["id"] for o in objectives}
        deps = [d for d in await self._rows("dependencies", ctx) if d.get("objective_id") in active_ids]
        risks = [r for r in await self._rows("risks", ctx) if r.get("objective_id") in active_ids]
        opps = [o for o in await self._rows("opportunities", ctx) if o.get("objective_id") in active_ids]
        cons = [c for c in await self._rows("constraints", ctx) if c.get("objective_id") in active_ids]
        primary = max(objectives, key=lambda o: float(o.get("confidence") or 0), default=None)
        return {
            "life_vision": vision[0].get("vision_text") if vision else None,
            "primary_objective": ({"title": primary["title"], "confidence": primary.get("confidence"),
                                   "reasoning": primary.get("reasoning"), "alternatives": primary.get("alternatives"),
                                   "themes": primary.get("themes")} if primary else None),
            "objectives": [{"id": o["id"], "title": o["title"], "root": o.get("root_objective_key"),
                            "surface_goal": o.get("surface_goal"), "confidence": o.get("confidence"),
                            "themes": o.get("themes"), "why_chain": o.get("why_chain")} for o in objectives],
            "top_themes": list(primary.get("themes") or [])[:5] if primary else [],
            "top_risks": [r["label"] for r in risks[:5]],
            "top_opportunities": [o["label"] for o in opps[:5]],
            "active_constraints": [{"label": c["label"], "detail": c.get("detail")} for c in cons[:5]],
            "open_dependencies": [{"label": d["label"], "domain": d["domain"]} for d in deps if not d.get("satisfied")][:8],
            "discovery_status": "in_progress" if not objectives else "active",
            "note": "Your objectives drive recommendations + roadmap before you upload anything.",
        }

    async def life_context(self, ctx: UserContext) -> dict[str, Any]:
        """Compact retrieval context for GraphRAG / advisor memory — what we know about the user."""
        snap = await self.snapshot(ctx)
        return {
            "has_discovery": bool(snap["objectives"]),
            "life_vision": snap["life_vision"],
            "primary_objective": snap["primary_objective"],
            "objectives": [o["title"] for o in snap["objectives"]],
            "themes": snap["top_themes"], "risks": snap["top_risks"], "opportunities": snap["top_opportunities"],
            "constraints": [c["label"] for c in snap["active_constraints"]],
            "open_dependencies": [d["label"] for d in snap["open_dependencies"]],
        }

    # Cross-objective conflicts (symmetric) — competing objectives + the tradeoff to make explicit.
    _CONFLICTS: dict[frozenset, tuple[str, str]] = {
        frozenset({"financial_independence", "education_advancement"}): ("timeline", "An education investment delays earning + saving — it competes with an early-financial-independence timeline."),
        frozenset({"financial_independence", "family_stability"}): ("money", "Both draw on the same savings; pursuing them at full speed simultaneously slows each."),
        frozenset({"financial_independence", "homeownership"}): ("money", "A down payment + mortgage reduces the savings rate financial independence needs."),
        frozenset({"career_growth", "family_stability"}): ("time", "Career advancement often means more hours or relocation, which can compete with family stability."),
        frozenset({"education_advancement", "family_stability"}): ("time", "School time + cost competes with family time + stability."),
        frozenset({"career_growth", "health_longevity"}): ("time", "Career intensity can crowd out the consistency health requires."),
    }

    async def objectives_plan(self, ctx: UserContext) -> dict[str, Any]:
        """Multi-objective planning (D8/D9): rank active objectives + detect conflicts/tradeoffs."""
        objs = self._active(await self._rows("life_objectives", ctx))
        ranked = sorted(objs, key=lambda o: float(o.get("confidence") or 0), reverse=True)
        plan = [{"objective_id": o["id"], "title": o["title"], "root": o.get("root_objective_key"),
                 "confidence": o.get("confidence"), "priority_rank": i + 1} for i, o in enumerate(ranked)]
        roots = {o.get("root_objective_key"): o for o in ranked}
        conflicts = []
        keys = [o.get("root_objective_key") for o in ranked]
        for i in range(len(keys)):
            for j in range(i + 1, len(keys)):
                pair = frozenset({keys[i], keys[j]})
                if pair in self._CONFLICTS:
                    kind, reason = self._CONFLICTS[pair]
                    a, b = roots[keys[i]], roots[keys[j]]
                    focus = a if float(a.get("confidence") or 0) >= float(b.get("confidence") or 0) else b
                    conflicts.append({"between": [a["title"], b["title"]], "type": kind, "reason": reason,
                                      "tradeoff": "You likely can't fully fund/pursue both at once.",
                                      "suggested_focus": focus["title"],
                                      "suggested_sequence": [focus["title"], (b if focus is a else a)["title"]]})
        return {"objectives": plan, "primary": plan[0] if plan else None, "conflicts": conflicts,
                "note": "Multiple objectives are ranked by confidence; conflicts show where they compete."}

    async def discovery_health(self, ctx: UserContext) -> dict[str, Any]:
        """Discovery health monitoring (D10): coverage, confidence, gaps + prompts to improve."""
        objs = self._active(await self._rows("life_objectives", ctx))
        roots_present = {o.get("root_objective_key") for o in objs}
        confidences = [float(o.get("confidence") or 0) for o in objs]
        avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else 0.0
        # key life areas we'd like a defined objective for
        key_areas = {"financial_independence": "retirement / financial independence", "family_stability": "family",
                     "career_growth": "career", "health_longevity": "health"}
        missing = {label for root, label in key_areas.items() if root not in roots_present}
        weak = [o["title"] for o in objs if float(o.get("confidence") or 0) < 0.6]
        coverage = round(len(roots_present & set(key_areas)) / len(key_areas), 2)
        prompts = []
        for label in sorted(missing):
            prompts.append(f"Your {label} goals are not defined yet — completing {label} discovery would improve recommendation quality.")
        for t in weak:
            prompts.append(f"'{t}' is low-confidence — a quick follow-up would sharpen it.")
        return {"objective_count": len(objs), "average_confidence": avg_conf, "coverage": coverage,
                "covered_areas": sorted(key_areas[r] for r in roots_present if r in key_areas), "missing_areas": sorted(missing),
                "weak_objectives": weak, "model_quality": round(coverage * 0.5 + avg_conf * 0.5, 2),
                "prompts": prompts[:4]}

    async def personal_graph(self, ctx: UserContext) -> dict[str, Any]:
        """The Personal Life Graph from PERSISTED nodes + edges (active objectives only)."""
        vision = await self._rows("life_vision", ctx)
        objectives = self._active(await self._rows("life_objectives", ctx))
        active_ids = {o["id"] for o in objectives}
        deps = [d for d in await self._rows("dependencies", ctx) if d.get("objective_id") in active_ids]
        goals = [g for g in await self._rows("goals", ctx) if g.get("objective_id") in active_ids]
        risks = [r for r in await self._rows("risks", ctx) if r.get("objective_id") in active_ids]
        opps = [o for o in await self._rows("opportunities", ctx) if o.get("objective_id") in active_ids]
        cons = [c for c in await self._rows("constraints", ctx) if c.get("objective_id") in active_ids]
        stored_edges = [e for e in await self._rows("life_graph_edges", ctx) if e.get("status", "active") == "active"]
        nodes: list[dict[str, Any]] = []
        if vision and vision[0].get("vision_text"):
            nodes.append({"id": "vision", "type": "Life Vision", "label": vision[0]["vision_text"][:60], "color": "purple"})
        for o in objectives:
            nodes.append({"id": o["id"], "type": "Life Objective", "label": o["title"], "color": "indigo", "confidence": o.get("confidence")})
        for coll, typ, color in ((goals, "Goal", "blue"), (deps, "Dependency", "amber"),
                                 (risks, "Risk", "red"), (opps, "Opportunity", "green"), (cons, "Constraint", "rose")):
            for r in coll:
                nodes.append({"id": r["id"], "type": typ, "label": r.get("label") or r.get("title"), "color": color, "domain": r.get("domain")})
        # ── Domain population: real domain CRUD data becomes graph nodes (Family is live) ──
        fam_nodes: list[dict[str, Any]] = []
        fam_edges: list[dict[str, Any]] = []
        fam_total = 0
        for table, typ, labelfield in (("dependents", "Dependent", "relationship"), ("beneficiaries", "Beneficiary", "name"),
                                       ("emergency_contacts", "Emergency Contact", "name"), ("trusted_advisors", "Trusted Advisor", "name")):
            try:
                rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema="family")
            except Exception:  # noqa: BLE001
                rows = []
            for r in rows:
                fam_total += 1
                nid = f"family:{table}:{r['id']}"
                fam_nodes.append({"id": nid, "type": typ, "label": str(r.get(labelfield) or r.get("name") or typ),
                                  "color": "amber", "domain": "family", "source": "User entry", "updated_at": r.get("updated_at")})
                fam_edges.append({"from": nid, "to": "family_hub", "rel": "part_of", "confidence": 1.0})
        if fam_total:
            fam_nodes.append({"id": "family_hub", "type": "Family", "label": "Family", "color": "amber", "domain": "family"})
            for o in objectives:
                if o.get("root_objective_key") == "family_stability":
                    fam_edges.append({"from": "family_hub", "to": o["id"], "rel": "supports", "confidence": 0.8})
        nodes.extend(fam_nodes)

        node_ids = {n["id"] for n in nodes}
        edges = [{"from": e["source_node"], "to": e["target_node"], "rel": e["edge_type"], "confidence": e.get("confidence")}
                 for e in stored_edges if e["source_node"] in node_ids and e["target_node"] in node_ids]
        edges.extend([e for e in fam_edges if e["from"] in node_ids and e["to"] in node_ids])
        integrity = await self._graph_integrity(ctx, objective_count=len(objectives), family_count=fam_total)
        return {"nodes": nodes, "edges": edges, "objective_count": len(objectives), "edge_count": len(edges),
                "graph_integrity": integrity,
                "legend": {"purple": "Life Vision", "indigo": "Life Objective", "blue": "Goal", "amber": "Dependency/Family",
                           "red": "Risk", "green": "Opportunity", "rose": "Constraint"}}

    async def _graph_integrity(self, ctx: UserContext, *, objective_count: int, family_count: int) -> dict[str, Any]:
        """Graph Integrity — per-domain completeness from REAL data presence (not question counts).
        Each domain reads its primary table defensively; absent data → 0 (honest, not fabricated)."""
        async def cnt(table: str, schema: str) -> int:
            try:
                return len(await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=schema))
            except Exception:  # noqa: BLE001
                return 0
        finance = min(100, await cnt("financial_accounts", "finance") * 25)
        career = min(100, await cnt("career_profiles", "career") * 60 + await cnt("certifications", "career") * 20)
        education = min(100, await cnt("education_records", "education") * 30 + await cnt("courses", "education") * 15)
        health = min(100, await cnt("sleep_logs", "health") * 15 + await cnt("vitals", "health") * 15)
        family = min(100, family_count * 20)
        life = min(100, objective_count * 25)
        domains = {"finance": finance, "career": career, "health": health, "education": education, "family": family, "life": life}
        overall = round(sum(domains.values()) / len(domains))
        return {"domains": domains, "overall": overall}
