"""Advisor agent registry — the cast of the Chat Command Center.

The advisor has always been ONE orchestrator (advisor_orchestrator). This module gives it a roster of
domain-scoped *personas* and a deterministic relevance router so the same pipeline can run in two ways:

  * Relationship Manager mode  — broad, cross-domain. The RM inspects which domains the question touches
    ("tasks" those agents by pulling their grounded fact packets) and synthesizes one cited answer.
  * Direct agent mode          — the user picked Finance / Career / Education / Health / Family /
    Document / Scenario / Report. We scope the grounding (domain_facts) and persona to that domain.

Crucially this changes WHAT GROUNDING the model sees and WHICH PERSONA it adopts — it does NOT weaken the
validator/citation gate. Every agent answers only from its scoped, provenance-carrying facts.

Keep it deterministic and cheap (Phase 8 doctrine: don't DDOS ourselves). The router is keyword-based;
the RM gathers facts (not N LLM calls) and synthesizes once.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

RELATIONSHIP_MANAGER = "relationship_manager"


@dataclass(frozen=True)
class Agent:
    id: str
    name: str
    description: str
    icon: str
    domains: tuple[str, ...]          # grounding domains this agent reads (empty for RM = all)
    capabilities: tuple[str, ...]
    grounding_sources: tuple[str, ...]
    persona: str
    is_orchestrator: bool = False


# Canonical roster. `domains` align with fact-packet domains (advisor_facts) + readiness domains.
AGENTS: tuple[Agent, ...] = (
    Agent(
        id=RELATIONSHIP_MANAGER,
        name="Arcana",
        description="Coordinates every domain advisor to answer broad, cross-cutting questions and pick your next best action.",
        icon="compass",
        domains=(),  # all
        capabilities=("cross-domain synthesis", "next best action", "prioritization", "tasking specialists"),
        grounding_sources=("all domain fact packets", "readiness snapshots", "personal graph"),
        persona=("You are Arcana: the user's lead advisor. Synthesize across the supplied "
                 "domain fact packets, weigh trade-offs between domains, and give one coherent recommendation. "
                 "Name which areas you drew on and cite the grounded facts you used."),
        is_orchestrator=True,
    ),
    Agent(
        id="finance_advisor", name="Finance Advisor",
        description="Cash flow, debt, savings, net worth, and whether you can afford a goal.",
        icon="banknote", domains=("finance",),
        capabilities=("affordability", "debt strategy", "savings", "net worth"),
        grounding_sources=("finance.financial_accounts", "finance readiness"),
        persona=("You are the Finance Advisor. Reason only from the user's grounded financial facts. Be precise "
                 "about money; never invent balances, rates, or returns."),
    ),
    Agent(
        id="career_advisor", name="Career Advisor",
        description="Roles, promotions, skills, and your professional trajectory.",
        icon="briefcase", domains=("career",),
        capabilities=("promotion readiness", "skills gap", "role targeting", "trajectory"),
        grounding_sources=("career.experience_records", "career.career_goals", "career readiness"),
        persona=("You are the Career Advisor. Reason only from the user's grounded career facts (roles, tenure, "
                 "goals). Never invent employers, titles, or tenure."),
    ),
    Agent(
        id="education_advisor", name="Education Advisor",
        description="Degrees, certifications, courses, and whether more schooling pays off.",
        icon="graduation-cap", domains=("education",),
        capabilities=("credential ROI", "certification planning", "degree decisions"),
        grounding_sources=("education_records", "education.certifications", "education readiness"),
        persona=("You are the Education Advisor. Reason only from the user's grounded education facts. Never "
                 "invent degrees, certifications, or institutions."),
    ),
    Agent(
        id="health_advisor", name="Health Advisor",
        description="Wellness, coverage, and health-related goals (general guidance, not medical advice).",
        icon="heart-pulse", domains=("health",),
        capabilities=("wellness goals", "coverage awareness", "habit framing"),
        grounding_sources=("health domain", "health readiness"),
        persona=("You are the Health Advisor. Offer general wellness framing only — never diagnose, never give "
                 "medical advice. The deterministic safety net handles urgent symptoms before you."),
    ),
    Agent(
        id="family_advisor", name="Family Advisor",
        description="Household, dependents, guardianship, and family-office planning.",
        icon="users", domains=("family",),
        capabilities=("dependents", "guardianship", "household planning"),
        grounding_sources=("family.members", "family.guardianship"),
        persona=("You are the Family Advisor. Reason only from the user's grounded family facts (members, "
                 "dependents, guardianship). Never invent people or relationships."),
    ),
    Agent(
        id="document_advisor", name="Document Intelligence Advisor",
        description="What your uploaded documents say and what they change in your plan.",
        icon="file-text", domains=("documents",),
        capabilities=("document facts", "coverage gaps", "what changed"),
        grounding_sources=("documents schema", "extracted document fields"),
        persona=("You are the Document Intelligence Advisor. Reason only from facts extracted from the user's "
                 "uploaded documents. Never assert a document or clause that is not in the grounding."),
    ),
    Agent(
        id="scenario_planner", name="Scenario Planner",
        description="Compare options — e.g. go back to school vs. focus on career growth.",
        icon="git-branch", domains=("career", "education", "finance"),
        capabilities=("option comparison", "trade-off analysis", "what-if framing"),
        grounding_sources=("career/education/finance fact packets", "readiness snapshots"),
        persona=("You are the Scenario Planner. Lay out the options the user is weighing, the trade-offs grounded "
                 "in their real facts, and what each path depends on. Do not fabricate projections."),
    ),
    Agent(
        id="report_advisor", name="Report Advisor",
        description="Explains your readiness scores and what would move them.",
        icon="bar-chart", domains=("career", "education", "finance", "health", "family"),
        capabilities=("score explanation", "what moves the number", "report context"),
        grounding_sources=("readiness snapshots", "domain fact packets"),
        persona=("You are the Report Advisor. Explain readiness scores from the grounded snapshot data and name "
                 "the concrete inputs that would change them. Never invent a score or its drivers."),
    ),
)

_BY_ID = {a.id: a for a in AGENTS}


def get_agent(agent_id: Optional[str]) -> Agent:
    """Resolve an agent id → Agent, defaulting to the Relationship Manager (the safe, broad default)."""
    if agent_id and agent_id in _BY_ID:
        return _BY_ID[agent_id]
    return _BY_ID[RELATIONSHIP_MANAGER]


def agent_catalog() -> list[dict]:
    """Serializable roster for the API / UI agent selector."""
    return [
        {
            "id": a.id, "name": a.name, "description": a.description, "icon": a.icon,
            "domains": list(a.domains), "capabilities": list(a.capabilities),
            "groundingSources": list(a.grounding_sources),
            "mode": "relationship_manager" if a.is_orchestrator else "direct",
            "isOrchestrator": a.is_orchestrator,
        }
        for a in AGENTS
    ]


# Deterministic relevance router for RM mode — which domains does this question touch?
_DOMAIN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "finance": ("money", "afford", "debt", "loan", "save", "saving", "savings", "budget", "invest",
                "investment", "investing", "income", "salary", "net worth", "cash", "expense", "spending",
                "mortgage", "retirement", "401k", "ira", "roth", "pension", "financial", "finances", "tax",
                "taxes", "down payment", "credit", "credit card", "portfolio", "stocks", "wealth",
                "home purchase", "buy a house", "buying a house", "refinance", "emergency fund"),
    "career": ("job", "career", "promotion", "promote", "raise", "employer", "employee", "resume",
               "interview", "professional", "manager", "offer letter", "compensation", "workplace",
               "coworker", "negotiate", "new role", "quit", "layoff", "performance review"),
    "education": ("school", "degree", "college", "university", "certification", "certificate", "course",
                  "study", "mba", "master", "masters", "bachelor", "phd", "doctorate", "education",
                  "tuition", "student", "curriculum", "enroll", "bootcamp"),
    "health": ("health", "fitness", "wellness", "doctor", "medical", "exercise", "workout", "gym",
               "training", "train", "lift", "lifting", "weights", "diet", "nutrition", "sleep", "calorie",
               "calories", "muscle", "cardio", "hiit", "martial arts", "swimming", "swim", "weight loss",
               "lose weight", "testosterone", "trt", "hormone", "supplement", "vitamin", "bloodwork",
               "labs", "cholesterol", "blood pressure", "bmi", "body fat", "protein", "macros", "knee",
               "shoulder", "arthritis", "injury", "injured", "joint", "rehab", "physical therapy",
               "mobility", "strength", "mental health", "therapy", "meditation", "anxiety"),
    "family": ("family", "kids", "child", "children", "spouse", "dependent", "guardian", "guardianship",
               "household", "marriage", "married", "divorce", "partner", "wife", "husband", "parent",
               "estate", "estate plan", "beneficiary", "trust", "will", "inheritance", "legacy", "custody",
               "newborn", "baby", "pregnant", "elderly"),
    "documents": ("document", "upload", "policy", "insurance policy", "contract", "statement", "pdf",
                  "deed", "living will", "power of attorney"),
}

# Precompile word-boundary patterns once. Word boundaries are why "work" no longer fires on "workout"
# (the original substring match mis-routed health questions to career) and multi-word phrases like
# "home purchase" / "net worth" still match.
_DOMAIN_PATTERNS: dict[str, re.Pattern[str]] = {
    d: re.compile(r"\b(?:" + "|".join(re.escape(k) for k in kws) + r")\b")
    for d, kws in _DOMAIN_KEYWORDS.items()
}


def route_domains(message: str) -> list[str]:
    """RM mode: pick the domains a question touches (for fact gathering), by whole-word match. When
    NOTHING matches it's a broad/ambiguous question — ground in ALL life domains and let the RM
    synthesize. Never bias to finance (the old fallback mis-routed health/family questions there)."""
    text = (message or "").lower()
    hit = [d for d, pat in _DOMAIN_PATTERNS.items() if pat.search(text)]
    return hit or ["finance", "career", "education", "health", "family"]


def domains_for(agent: Agent, message: str) -> list[str]:
    """Grounding domains for a turn. Direct agents use their fixed domains; the RM routes by message."""
    if agent.is_orchestrator:
        return route_domains(message)
    return list(agent.domains)
