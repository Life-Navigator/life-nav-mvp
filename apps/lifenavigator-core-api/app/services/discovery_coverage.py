"""Discovery Coverage (Elite Sprint 47).

Every domain understands its own completeness: started / partial / complete, a coverage %, the
missing inputs, and what completing it unlocks. This is the canonical source for the domain cards
(never "No Data") and the "My Discovery" page. It composes existing signals — advisor answers
(life_vision.prompts), canonical objectives, and the financial resolver's missing inputs — into one
per-domain view. No new intelligence.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext

# Each domain: the advisor question(s) that cover it, keyword match for a canonical objective, and
# what completing discovery unlocks. Education has no advisor question yet (honest: coverage caps).
# `baseline_missing`: what's still needed when the user HAS named a goal in the domain (baseline detail, NOT
# "a goal"). `goal_missing`: the label when the user has NOT named any goal in the domain yet.
DOMAINS: dict[str, dict[str, Any]] = {
    "finance": {"label": "Financial", "advisor_keys": ["financial_goal", "risk", "time_horizon"],
                "objective_kw": ["financ", "retire", "wealth", "debt", "saving", "invest"],
                "baseline_missing": ["financial readiness target", "savings/debt priorities"],
                "goal_missing": "financial goal",
                "unlocks": ["Retirement projection", "Readiness scoring", "Scenario planning"]},
    "career": {"label": "Career", "advisor_keys": ["career_goal"],
               "objective_kw": ["career", "job", "professional", "promotion"],
               "baseline_missing": ["current role", "target promotion", "timeline"],
               "goal_missing": "career goal",
               "unlocks": ["Career readiness", "Compensation analysis", "Offer comparison"]},
    "family": {"label": "Family", "advisor_keys": ["family_goal"],
               "objective_kw": ["family", "child", "parent", "spouse", "home", "housing"],
               "baseline_missing": ["wedding timeline", "house timeline", "family timeline"],
               "goal_missing": "family goal",
               "unlocks": ["Protection planning", "Housing affordability", "Survivor planning"]},
    "health": {"label": "Health", "advisor_keys": ["health_goal"],
               "objective_kw": ["health", "wellness", "fitness", "longevity"],
               "baseline_missing": ["current fitness baseline", "target definition", "training routine"],
               "goal_missing": "health goal",
               "unlocks": ["Health readiness", "Wellness recommendations", "Longevity planning"]},
    "education": {"label": "Education", "advisor_keys": [],
                  "objective_kw": ["education", "degree", "school", "college", "study", "learn"],
                  "baseline_missing": ["program/skill target"], "goal_missing": "education interest",
                  "unlocks": ["Degree ROI", "Education funding", "Skill planning"]},
}


class DiscoveryCoverageService:
    def __init__(self, life: Any, supabase: Any, resolver: Any = None) -> None:
        self._life = life
        self._sb = supabase
        self._resolver = resolver

    async def coverage(self, ctx: UserContext) -> dict[str, Any]:
        vis = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="life")
        prompts0 = (vis[0].get("prompts") or {}) if vis else {}
        answered = set(prompts0.get("discovery_answered") or [])
        deprioritized = {str(d).lower() for d in (prompts0.get("deprioritized_domains") or [])}
        objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="life")
        obj_text = [f"{o.get('root_objective_key', '')} {o.get('title', '')}".lower() for o in objs]
        # P0.3: persisted candidate goals carry an explicit domain — a domain the user spoke to is never 0%.
        try:
            cands = await self._sb.select("candidate_goals", filters={"user_id": f"eq.{ctx.user_id}"},
                                          limit=50, schema="life")
        except Exception:  # noqa: BLE001
            cands = []
        goal_domains = {str(c.get("domain") or "").lower() for c in cands}
        fin_missing: list[dict[str, Any]] = []
        if self._resolver is not None:
            try:
                fin_missing = (await self._resolver.resolve(ctx)).get("missing") or []
            except Exception:  # noqa: BLE001
                pass

        domains = []
        for key, spec in DOMAINS.items():
            answered_here = [k for k in spec["advisor_keys"] if k in answered]
            # P0.3: an explicit candidate goal tagged to this domain means the user spoke to it.
            has_goal = key in goal_domains
            has_objective = any(any(kw in t for kw in spec["objective_kw"]) for t in obj_text)
            # coverage signals: each answered advisor question + an objective + (finance) resolved inputs
            total_signals = max(1, len(spec["advisor_keys"]) + 1)  # +1 for "has an objective"
            got = len(answered_here) + (1 if has_objective else 0)
            coverage_pct = round(100 * got / total_signals)
            if not spec["advisor_keys"] and not has_objective and not has_goal:
                coverage_pct = 0  # no path to cover this domain yet (e.g. education with no stated goal)
            # P0.3: a stated goal floors coverage at "started" — a domain the user named is never 0%.
            if has_goal:
                coverage_pct = max(coverage_pct, 30)
            is_deprioritized = key in deprioritized
            # MISSING labels (P3): say what's actually missing — never "X goal" once the user named a goal.
            if is_deprioritized:
                missing_inputs = []  # the user explicitly set this aside (e.g. education: degree complete)
            elif has_goal:
                # they named a goal → what's missing is BASELINE detail, not "a goal"
                missing_inputs = list(spec.get("baseline_missing", [])) if coverage_pct < 80 else []
            else:
                # no goal yet in this domain → name the missing goal (+ finance: resolved-input gaps)
                missing_inputs = [spec.get("goal_missing", f"{key} goal")]
                if key == "finance" and fin_missing:
                    missing_inputs += [m["input"] for m in fin_missing]
            status = ("deprioritized" if is_deprioritized else
                      "complete" if coverage_pct >= 80 else "partial" if coverage_pct >= 40
                      else "started" if coverage_pct > 0 else "not_started")
            domains.append({
                "domain": key, "label": spec["label"], "coverage_pct": coverage_pct, "status": status,
                "confidence_pct": min(95, coverage_pct) if coverage_pct else 0,
                "has_objective": has_objective or has_goal,
                "missing": missing_inputs[:5], "unlocks": spec["unlocks"],
                # Scope the CTA to the DOMAIN advisor so "Continue health discovery" opens the Health
                # Advisor, not the generic Arcana orchestrator (CommandCenter reads ?agent=).
                "cta": (f"/dashboard/advisor?agent={key}_advisor" if (missing_inputs or coverage_pct < 80)
                        else None),
                "source": "Advisor Discovery",
            })

        overall = round(sum(d["coverage_pct"] for d in domains) / len(domains))
        return {
            "overall_coverage_pct": overall,
            "domains": domains,
            "recommendation_quality": _band(overall),
            "scenario_quality": _band(overall),
            "decision_brain_quality": _band(overall),
            "note": "Coverage is computed from advisor answers + canonical objectives + resolved inputs — no domain is ever just 'No Data'.",
        }


def _band(pct: int) -> str:
    return "High" if pct >= 70 else "Medium" if pct >= 40 else "Low"
