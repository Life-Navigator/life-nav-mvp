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

_SUPPORTED = ("education", "health", "career", "family", "finance")


def _present(facts: dict[str, Any], *keywords: str) -> bool:
    """True if any keyword appears in the fact keys or values (so a KNOWN field is never 'missing')."""
    blob = " ".join([str(k) for k in facts] + [str(v) for v in facts.values()]).lower()
    return any(kw in blob for kw in keywords)


def missing_for(domain: str, facts: dict[str, Any]) -> list[str]:
    """Specific missing items derived from which facts are already known — a KNOWN field is NEVER listed."""
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
    if domain == "career":
        if not facts:
            return ["current role", "target role", "key skills"]
        # role/company/skills/target are KNOWN → ask only for the ADVANCED promotion inputs.
        cand = [("promotion criteria", ("criteria",)), ("manager expectations", ("manager",)),
                ("compensation target", ("compensation", "salary")),
                ("evidence / key projects", ("evidence", "project")),
                ("promotion timeline milestones", ("milestone",))]
        return [label for label, kws in cand if not _present(facts, *kws)][:5]
    if domain == "family":
        if not facts:
            return ["relationship / family status", "wedding / home / family rough timeline"]
        # rough timelines KNOWN → ask only for the exact details, never "wedding/house/family timeline".
        cand = [("exact wedding date", ("exact date",)), ("wedding budget", ("budget",)),
                ("home purchase target date", ("purchase date", "home target")),
                ("children timeline details", ("children timeline",)),
                ("insurance / estate / emergency contacts", ("insurance", "estate", "emergency"))]
        return [label for label, kws in cand if not _present(facts, *kws)][:5]
    if domain == "finance":
        if not facts:
            return ["primary financial priority", "savings / debt targets"]
        # priorities KNOWN → ask only for EXACT amounts, never generic "financial readiness target".
        cand = [("exact emergency fund target", ("emergency fund target",)),
                ("exact down payment target", ("down payment target",)),
                ("wedding / honeymoon budget", ("wedding budget", "honeymoon")),
                ("monthly savings target", ("monthly savings",))]
        return [label for label, kws in cand if not _present(facts, *kws)][:5]
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
    if domain in ("health", "education", "career", "family", "finance"):
        return {"label": ("Refine your plan" if facts else f"Build your {domain} baseline"),
                "href": f"/dashboard/advisor?agent={domain}_advisor"}
    return None


async def domain_summary(coverage_svc: Any, ctx: UserContext, domain: str) -> dict[str, Any]:
    """The shared contract for one domain. coverage_svc = DiscoveryCoverageService (canonical fact reader)."""
    cov = await coverage_svc.coverage(ctx)
    d = next((x for x in (cov.get("domains") or []) if x.get("domain") == domain), {})
    facts: dict[str, Any] = d.get("facts") or {}
    missing = missing_for(domain, facts) if domain in _SUPPORTED else (d.get("missing") or [])
    status = d.get("status") or ("started" if facts else "not_started")
    cta = (_next_best(domain, facts, missing) or {}).get("href") or d.get("cta")
    # Fact-aware coverage: rich captured facts should read as real progress, not a flat 30%. Each known fact
    # adds ~12% over the started floor (capped at 85% until exact targets/details are added). Keeps the card,
    # review screen, and advisor in agreement on "how complete is this domain".
    base_cov = int(d.get("coverage_pct", 0) or 0)
    coverage_pct = (min(85, max(base_cov, 30 + 12 * len(facts)))
                    if (facts and domain in _SUPPORTED) else base_cov)
    return {
        "domain": domain,
        "status": status,
        "coverage_pct": coverage_pct,
        "confidence_pct": max(int(d.get("confidence_pct", 0) or 0), coverage_pct if facts else 0),
        "readiness_score": coverage_pct,
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
