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
DOMAINS: dict[str, dict[str, Any]] = {
    "finance": {"label": "Financial", "advisor_keys": ["financial_goal", "risk", "time_horizon"],
                "objective_kw": ["financ", "retire", "wealth", "debt", "saving", "invest"],
                "unlocks": ["Retirement projection", "Readiness scoring", "Scenario planning"]},
    "career": {"label": "Career", "advisor_keys": ["career_goal"],
               "objective_kw": ["career", "job", "professional", "promotion"],
               "unlocks": ["Career readiness", "Compensation analysis", "Offer comparison"]},
    "family": {"label": "Family", "advisor_keys": ["family_goal"],
               "objective_kw": ["family", "child", "parent", "spouse", "home", "housing"],
               "unlocks": ["Protection planning", "Housing affordability", "Survivor planning"]},
    "health": {"label": "Health", "advisor_keys": ["health_goal"],
               "objective_kw": ["health", "wellness", "fitness", "longevity"],
               "unlocks": ["Health readiness", "Wellness recommendations", "Longevity planning"]},
    "education": {"label": "Education", "advisor_keys": [],
                  "objective_kw": ["education", "degree", "school", "college", "study", "learn"],
                  "unlocks": ["Degree ROI", "Education funding", "Skill planning"]},
}


class DiscoveryCoverageService:
    def __init__(self, life: Any, supabase: Any, resolver: Any = None) -> None:
        self._life = life
        self._sb = supabase
        self._resolver = resolver

    async def coverage(self, ctx: UserContext) -> dict[str, Any]:
        vis = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="life")
        answered = set(((vis[0].get("prompts") or {}).get("discovery_answered") or []) if vis else [])
        objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="life")
        obj_text = [f"{o.get('root_objective_key', '')} {o.get('title', '')}".lower() for o in objs]
        fin_missing: list[dict[str, Any]] = []
        if self._resolver is not None:
            try:
                fin_missing = (await self._resolver.resolve(ctx)).get("missing") or []
            except Exception:  # noqa: BLE001
                pass

        domains = []
        for key, spec in DOMAINS.items():
            answered_here = [k for k in spec["advisor_keys"] if k in answered]
            has_objective = any(any(kw in t for kw in spec["objective_kw"]) for t in obj_text)
            # coverage signals: each answered advisor question + an objective + (finance) resolved inputs
            total_signals = max(1, len(spec["advisor_keys"]) + 1)  # +1 for "has an objective"
            got = len(answered_here) + (1 if has_objective else 0)
            missing_inputs = [k for k in spec["advisor_keys"] if k not in answered]
            if key == "finance" and fin_missing:
                missing_inputs += [m["input"] for m in fin_missing]
            coverage_pct = round(100 * got / total_signals)
            if not spec["advisor_keys"] and not has_objective:
                coverage_pct = 0  # no path to cover this domain yet (e.g. education)
            status = ("complete" if coverage_pct >= 80 else "partial" if coverage_pct >= 40
                      else "started" if coverage_pct > 0 else "not_started")
            domains.append({
                "domain": key, "label": spec["label"], "coverage_pct": coverage_pct, "status": status,
                "confidence_pct": min(95, coverage_pct) if coverage_pct else 0,
                "has_objective": has_objective,
                "missing": missing_inputs[:5], "unlocks": spec["unlocks"],
                "cta": "/dashboard/advisor" if missing_inputs or coverage_pct < 80 else None,
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
