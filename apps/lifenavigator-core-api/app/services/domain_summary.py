"""Shared Domain Summary Contract — ONE truth per domain.

The dashboard card, the domain page snapshot, the readiness blockers, and the advisor's missing-baseline
prompt must all tell the SAME story. This service is that single source: it reads the durable domain facts
(via DiscoveryCoverageService, which already reads the canonical tables) and layers the domain-specific
missing items, blockers, next-best-action, and an advisor prompt hint on top.

Rules (enforced here so every surface inherits them):
- If facts exist, status is never not_started.
- A KNOWN field never appears in missing_items.
- missing_items are SPECIFIC (waist/lifts/cardio/sleep for health; cost/financing/career-objective for a
  planned JD) — never "current fitness baseline" when body comp exists, never "current education"/"target
  degree" when records exist.
- No raw enums / snake_case / classifier text / quoted paragraphs.

Implemented for education + health first; the same shape extends to career/family/finance next.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext

_SUPPORTED = ("education", "health")


def missing_for(domain: str, facts: dict[str, Any]) -> list[str]:
    """Specific missing items derived from which facts are already known."""
    fk = {str(k).lower() for k in facts}
    if domain == "health":
        cand = [("waist measurement", "waist"), ("training routine", "training"),
                ("starting lifts", "lift"), ("cardio benchmark", "cardio"), ("sleep average", "sleep"),
                ("injuries / limitations", "injur"), ("nutrition baseline", "nutrition")]
        return [label for label, key in cand if not any(key in k for k in fk)][:5]
    if domain == "education":
        has_planned = any("planned" in k for k in fk)
        if has_planned:  # active/planned credential (e.g. a JD) → confirm the plan, not "current education"
            return ["cost / financing plan", "career / legal objective", "credential documents (if useful)"]
        if facts:  # completed record(s) only → optional next steps, never "missing a goal"
            return ["certifications / licenses (if relevant)", "ROI / cost only if planning more study"]
        return ["highest completed education", "current or planned program"]
    return []


def known_items_for(domain: str, facts: dict[str, Any]) -> list[str]:
    return [f"{k}: {v}" for k, v in facts.items()]


def prompt_hint(domain: str, facts: dict[str, Any], missing: list[str]) -> str | None:
    """What the advisor should ask NEXT — never for fields already known."""
    if not facts:
        return None
    if domain == "health":
        nxt = ", ".join(missing[:5]) if missing else "your next progress metrics"
        return ("I have your body composition and goal. Next I need " + nxt + ".")
    if domain == "education":
        if any("planned" in str(k).lower() for k in facts):
            return ("I have your completed degree and planned JD. Next I'd confirm the JD's cost/financing and "
                    "how it supports your career/legal objective.")
        return "I have your education record. Want to add certifications or compare ROI?"
    return None


def _blockers(domain: str, facts: dict[str, Any], missing: list[str]) -> list[str]:
    if facts and missing:
        return ["Add " + ", ".join(missing[:5]) + "."]
    if not facts:
        if domain == "health":
            return ["Add height, weight, body composition, a fitness goal, and any injuries or constraints."]
        if domain == "education":
            return ["Add your highest completed education and whether you're planning further study."]
    return []


def _next_best(domain: str, facts: dict[str, Any], missing: list[str]) -> dict[str, Any] | None:
    if domain == "health":
        return {"label": "Add progress metrics" if facts else "Build your health baseline",
                "href": "/dashboard/advisor?agent=health_advisor"}
    if domain == "education":
        return {"label": "Discuss education plan" if facts else "Add your education record",
                "href": "/dashboard/advisor?agent=education_advisor"}
    return None


async def domain_summary(coverage_svc: Any, ctx: UserContext, domain: str) -> dict[str, Any]:
    """The shared contract for one domain. coverage_svc = DiscoveryCoverageService (canonical fact reader)."""
    cov = await coverage_svc.coverage(ctx)
    d = next((x for x in (cov.get("domains") or []) if x.get("domain") == domain), {})
    facts: dict[str, Any] = d.get("facts") or {}
    missing = missing_for(domain, facts) if domain in _SUPPORTED else (d.get("missing") or [])
    status = d.get("status") or ("started" if facts else "not_started")
    cta = (_next_best(domain, facts, missing) or {}).get("href") or d.get("cta")
    return {
        "domain": domain,
        "status": status,
        "coverage_pct": d.get("coverage_pct", 0),
        "confidence_pct": d.get("confidence_pct", 0),
        "readiness_score": d.get("coverage_pct", 0),
        "facts": facts,
        "known_items": known_items_for(domain, facts),
        "missing_items": missing,
        "goals": d.get("goals") or [],
        "current_priority": d.get("current_priority"),
        "blockers": _blockers(domain, facts, missing),
        "next_best_action": _next_best(domain, facts, missing),
        "advisor_prompt_hint": prompt_hint(domain, facts, missing),
        "cta": cta,
        "source_count": len(facts),
        "last_updated": d.get("last_updated"),
    }
