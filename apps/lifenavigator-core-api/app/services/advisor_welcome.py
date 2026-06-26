"""Advisor welcome contract — a domain-aware, fact-grounded entry state for the advisor.

Given the answering agent + the user's REAL known facts (from the shared discovery-coverage facts + the
semantic north star), builds the welcome the CommandCenter renders: title, subtitle, a warm message, the
known-facts summary, the specific missing items, and contextual action chips. Never fabricates facts; falls
back to a welcoming (not generic) empty state. Reuses the same per-domain facts that drive the dashboard cards
so the advisor and the dashboard agree.
"""
from __future__ import annotations

from typing import Any

from ..models.common import UserContext
from .advisor_agents import get_agent

# Welcoming empty states (NOT "how can I help?") + contextual chips, per the Advisor Entry spec.
_EMPTY: dict[str, str] = {
    "finance": ("Welcome. I can help you build a financial foundation, set savings targets, review debt, plan "
                "for a home, or compare major money decisions."),
    "health": ("Welcome. I can help you set a fitness, nutrition, sleep, or wellness baseline. Start with "
               "height, weight, goal, current activity, and any injuries or constraints."),
    "career": ("Welcome. I can help you clarify your current role, target role, promotion path, compensation "
               "goals, and next best career move."),
    "education": ("Welcome. I can help you capture your education record, compare degrees or certifications, "
                  "analyze tuition ROI, or connect learning to your career goals."),
    "family": ("Welcome. I can help you plan around marriage, children, pets, caregiving, household "
               "responsibilities, emergency contacts, insurance, and estate readiness."),
}
_CHIPS: dict[str, list[str]] = {
    "finance": ["Set emergency fund target", "Plan home down payment", "Review cash flow",
                "Prioritize debt vs savings", "Analyze a financial decision"],
    "health": ["Build next week's workout plan", "Add progress metrics", "Review nutrition target",
               "Add cardio benchmark", "Update body composition"],
    "career": ["Build promotion plan", "Identify promotion gaps", "Prepare manager conversation",
               "Map high-impact projects", "Update compensation target"],
    "education": ["Discuss education", "Explore certifications", "Compare degree/certification ROI",
                  "Update education record", "Connect education to career goal"],
    "family": ["Build family readiness plan", "Add wedding timeline", "Plan first home readiness",
               "Discuss children/family timeline", "Review insurance and estate needs"],
}
_DASH_CHIPS = ["Review my life plan", "Work on finance", "Work on health", "Work on career",
               "Work on education", "Work on family", "Analyze a decision"]


async def build_welcome(coverage_svc: Any, life_svc: Any, ctx: UserContext,
                        agent_id: str | None) -> dict[str, Any]:
    agent = get_agent(agent_id or "") or get_agent("relationship_manager")
    try:
        cov = await coverage_svc.coverage(ctx)
        domains = cov.get("domains") or []
    except Exception:  # noqa: BLE001
        domains = []
    by_domain = {d.get("domain"): d for d in domains}
    try:
        north_star = (await life_svc.snapshot(ctx)).get("north_star")
    except Exception:  # noqa: BLE001
        north_star = None

    if getattr(agent, "is_orchestrator", False):
        known_facts = [f"{d['label']}: {', '.join(str(v) for v in list(d['facts'].values())[:2])}"
                       for d in domains if d.get("facts")][:5]
        gaps: list[str] = []
        for d in domains:
            for m in (d.get("missing") or [])[:1]:
                gaps.append(m)
        if north_star:
            message = (f"Welcome back. I'm ready to help you keep building toward {north_star.rstrip('.')}. "
                       "We can work on your finances, health, career, education, family planning, or any "
                       "decision you're weighing.")
        elif known_facts:
            message = ("Welcome back. I have your plan so far — let's keep building it. We can work on "
                       "finances, health, career, education, family, or a decision you're weighing.")
        else:
            message = ("Welcome. I can help you build your life plan across finances, health, career, "
                       "education, family, and major decisions. Tell me what you want to work on first, or I "
                       "can guide you to the next best step.")
        return {"agent_id": agent.id, "title": "Life Advisor",
                "subtitle": "Your cross-domain planning advisor", "message": message,
                "known_facts": known_facts, "missing": gaps[:4], "chips": _DASH_CHIPS}

    dom = (agent.domains or ("",))[0]
    d = by_domain.get(dom, {})
    facts = d.get("facts") or {}
    missing = [m for m in (d.get("missing") or [])][:5]
    label = agent.name.replace(" Advisor", "")
    if facts:
        fact_line = "; ".join(f"{k} {v}" for k, v in list(facts.items())[:4])
        message = (f"Welcome back. Here's what I have for your {label.lower()}: {fact_line}. "
                   "Let's build on it" + (f" — next up: {missing[0]}." if missing else "."))
    else:
        message = _EMPTY.get(dom, f"Welcome. Let's build your {label.lower()} plan together.")
    return {"agent_id": agent.id, "title": agent.name, "subtitle": agent.description, "message": message,
            "known_facts": [f"{k}: {v}" for k, v in facts.items()][:6], "missing": missing,
            "chips": _CHIPS.get(dom, [])}
