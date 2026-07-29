"""Query planning — turn a natural-language turn into a retrieval plan.

WHY THIS EXISTS
---------------
The previous retriever embedded the raw user message and ran one vector search plus a flat node scan.
That treats every question as the same shape, which it is not:

    "what's my net worth?"                    → LOOKUP    — one entity, no traversal needed
    "should I pay the car loan or invest?"    → COMPARE   — two entities, needs both subgraphs
    "how has my savings changed this year?"   → TEMPORAL  — one entity, ordered by time
    "why did you recommend the 529?"          → CAUSAL    — needs the evidence/assumption subgraph
    "what happens if I retire at 60?"         → SCENARIO  — goals + constraints + projections

The plan decides how many seeds to take, how far to traverse, and which edge families matter. It is
deterministic and cheap (regex + lexicon) — no model call, so it adds no latency and cannot hallucinate.
A model-based planner is a later upgrade; the interface below is what it would implement.

NOTHING HERE TOUCHES TENANT SCOPE. The plan describes *what to look for*; the engine and the Neo4j client
enforce *whose data it may look in*. Keeping those separate is deliberate: a planning bug must never be
able to widen tenant access.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Intent(str, Enum):
    LOOKUP = "lookup"        # a single fact about one entity
    COMPARE = "compare"      # two or more options weighed against each other
    TEMPORAL = "temporal"    # change over time
    CAUSAL = "causal"        # why — needs evidence/assumption/tradeoff edges
    SCENARIO = "scenario"    # hypothetical projection
    BROAD = "broad"          # open-ended; widest net, shallowest traversal


# Domain lexicon — matches the `domain` property the ingestion worker writes on every node.
_DOMAIN_TERMS: dict[str, tuple[str, ...]] = {
    "finance": ("money", "cash", "save", "saving", "savings", "debt", "loan", "mortgage", "invest",
                "investment", "retire", "retirement", "401k", "ira", "budget", "income", "salary",
                "net worth", "afford", "expense", "tax", "portfolio", "interest", "credit"),
    "health":  ("health", "weight", "fitness", "exercise", "workout", "sleep", "diet", "nutrition",
                "medical", "doctor", "lab", "blood", "bmi", "body fat", "medication"),
    "career":  ("job", "career", "role", "promotion", "salary", "employer", "work", "resume",
                "interview", "skill", "certification", "manager", "title"),
    "education": ("school", "degree", "college", "university", "tuition", "course", "study",
                  "mba", "bootcamp", "certificate", "student loan", "major"),
    "family":  ("family", "spouse", "wife", "husband", "partner", "child", "children", "kid", "kids",
                "parent", "dependent", "guardian", "estate", "will", "trust", "beneficiary"),
}

_COMPARE_CUES = re.compile(
    r"\b(vs\.?|versus|compare|comparison|better|instead of|rather than|or should i|"
    r"trade[- ]?off|pros and cons|which (?:one|option|is better))\b"
    # "should I A or B" / "is it better to A or B" — the most common comparison shape in chat, and the
    # one the first cue list missed. Bounded so it can't span sentences.
    r"|\b(?:should|shall|would|could|can)\s+(?:i|we)\b[^.?!]{0,80}?\s\bor\b",
    re.IGNORECASE)
_TEMPORAL_CUES = re.compile(
    r"\b(trend|over time|history|historical|last (?:year|month|quarter)|this (?:year|month)|"
    r"since|progress|changed?|growth|ytd|year[- ]over[- ]year)\b", re.IGNORECASE)
_CAUSAL_CUES = re.compile(
    r"\b(why|because|reason|rationale|justif\w+|explain|what makes|how come|"
    r"basis for|evidence for|on what grounds)\b", re.IGNORECASE)
_SCENARIO_CUES = re.compile(
    r"\b(what if|if i|suppose|scenario|projection|project(?:ed)?|simulate|assuming|"
    r"were i to|would i be able)\b", re.IGNORECASE)
_LOOKUP_CUES = re.compile(
    r"^\s*(what(?:'s| is| are)|how much|how many|when (?:is|was|did)|who (?:is|are)|where)\b",
    re.IGNORECASE)

# Quoted spans and Capitalised runs are the strongest mention signals in a short chat turn.
_QUOTED = re.compile(r"[\"'“”‘’]([^\"'“”‘’]{2,60})[\"'“”‘’]")
_PROPER = re.compile(r"\b([A-Z][a-zA-Z0-9&.\-]{1,}(?:\s+[A-Z][a-zA-Z0-9&.\-]{1,}){0,3})\b")
# Words that start a sentence and look proper but carry no entity meaning.
_STOP_PROPER = frozenset({
    "I", "I'm", "Im", "My", "Me", "We", "Our", "Should", "What", "When", "Where", "Who", "Why", "How",
    "Can", "Could", "Would", "Will", "Is", "Are", "Do", "Does", "Did", "If", "The", "A", "An", "This",
    "That", "It", "There", "Here", "And", "But", "Or", "So", "Please", "Thanks", "Hi", "Hello",
})


@dataclass(frozen=True)
class QueryPlan:
    """A deterministic description of how to retrieve for this turn."""

    query: str
    intent: Intent
    domains: tuple[str, ...]          # [] means "any domain"
    mentions: tuple[str, ...]         # candidate entity mentions for linking
    seed_limit: int                   # how many vector seeds to take
    max_hops: int                     # traversal depth bound
    node_budget: int                  # hard cap on nodes visited
    include_central: bool             # consult shared/world knowledge
    edge_families: tuple[str, ...]    # which relationship families matter most
    wants_evidence: bool              # pull Evidence/Assumption/Tradeoff subgraph

    def describe(self) -> str:
        """Human-readable plan — surfaces in traces so retrieval is debuggable."""
        return (f"intent={self.intent.value} domains={list(self.domains) or 'any'} "
                f"mentions={list(self.mentions)} seeds={self.seed_limit} hops={self.max_hops} "
                f"budget={self.node_budget} central={self.include_central}")


# Edge families, keyed to the relationship types the Rust ontology registry actually emits.
EDGE_FAMILY: dict[str, tuple[str, ...]] = {
    "ownership": ("HAS_GOAL", "HAS_DEBT", "HAS_ASSET", "OWNS_ACCOUNT", "HAS_HOLDING", "HAS_INCOME_SOURCE",
                  "HAS_LIABILITY", "HAS_INSURANCE_PLAN", "HAS_SPENDING_ACCOUNT", "HAS_PORTFOLIO_ITEM"),
    "evidence":  ("HAS_EVIDENCE", "HAS_ASSUMPTION", "HAS_TRADEOFF", "REQUIRES_REVIEW",
                  "HAS_RECOMMENDATION", "HAS_DECISION"),
    "progress":  ("TRACKS_METRIC", "HAS_SNAPSHOT", "LOGGED", "CONTRIBUTES_TO", "HAS_SCENARIO"),
    "identity":  ("HAS_CAREER", "HAS_EDUCATION", "HAS_FAMILY", "HAS_SKILL", "HAS_CREDENTIAL",
                  "HAS_DEGREE", "HAS_EXPERIENCE", "HAS_DEPENDENT", "HAS_SPOUSE"),
    "planning":  ("PURSUING", "TARGETS_ROLE", "HAS_LEARNING_PATH", "HAS_SKILL_GAP", "HAS_ESTATE_PLAN",
                  "HAS_COLLEGE_PLAN", "HAS_GUARDIANSHIP_PLAN"),
}


def _detect_domains(text: str) -> tuple[str, ...]:
    low = text.lower()
    hits = [(d, sum(1 for t in terms if t in low)) for d, terms in _DOMAIN_TERMS.items()]
    scored = [(d, n) for d, n in hits if n > 0]
    if not scored:
        return ()
    scored.sort(key=lambda x: -x[1])
    top = scored[0][1]
    # Keep domains within one hit of the leader — a comparison often spans two.
    return tuple(d for d, n in scored if n >= max(1, top - 1))[:3]


def _extract_mentions(text: str) -> tuple[str, ...]:
    out: list[str] = []
    for m in _QUOTED.findall(text):
        s = m.strip()
        if s:
            out.append(s)
    for m in _PROPER.findall(text):
        s = m.strip()
        if s and s not in _STOP_PROPER and s.split()[0] not in _STOP_PROPER:
            out.append(s)
    # Deduplicate, preserve order, cap — mentions drive linking queries and each one costs a round trip.
    seen: set[str] = set()
    uniq: list[str] = []
    for s in out:
        k = s.lower()
        if k not in seen:
            seen.add(k)
            uniq.append(s)
    return tuple(uniq[:5])


def classify_intent(text: str) -> Intent:
    """Order matters: causal and scenario cues are more specific than comparison."""
    if _CAUSAL_CUES.search(text):
        return Intent.CAUSAL
    if _SCENARIO_CUES.search(text):
        return Intent.SCENARIO
    if _COMPARE_CUES.search(text):
        return Intent.COMPARE
    if _TEMPORAL_CUES.search(text):
        return Intent.TEMPORAL
    if _LOOKUP_CUES.search(text):
        return Intent.LOOKUP
    return Intent.BROAD


# Per-intent retrieval shape. Budgets are deliberately small: an unbounded traversal on a dense personal
# graph is a latency and cost incident, and the advisor's p50 is already the dominant user complaint.
_SHAPE: dict[Intent, dict] = {
    Intent.LOOKUP:   dict(seed_limit=6,  max_hops=1, node_budget=40,  central=False,
                          families=("ownership", "identity"), evidence=False),
    Intent.COMPARE:  dict(seed_limit=10, max_hops=2, node_budget=120, central=True,
                          families=("ownership", "evidence", "planning"), evidence=True),
    Intent.TEMPORAL: dict(seed_limit=8,  max_hops=2, node_budget=100, central=False,
                          families=("progress", "ownership"), evidence=False),
    Intent.CAUSAL:   dict(seed_limit=6,  max_hops=2, node_budget=100, central=False,
                          families=("evidence",), evidence=True),
    Intent.SCENARIO: dict(seed_limit=10, max_hops=2, node_budget=120, central=True,
                          families=("planning", "ownership", "evidence"), evidence=True),
    Intent.BROAD:    dict(seed_limit=10, max_hops=1, node_budget=60,  central=True,
                          families=("ownership", "identity", "planning"), evidence=False),
}


def plan_query(message: str, *, domain_hint: Optional[str] = None) -> QueryPlan:
    """Build the retrieval plan for one turn. Pure function — no I/O, no tenant data."""
    text = (message or "").strip()
    intent = classify_intent(text)
    shape = _SHAPE[intent]
    domains = _detect_domains(text)
    if domain_hint and domain_hint not in domains:
        # The orchestrator's routed domain is a strong signal; put it first.
        domains = (domain_hint,) + domains
    return QueryPlan(
        query=text,
        intent=intent,
        domains=domains[:3],
        mentions=_extract_mentions(text),
        seed_limit=shape["seed_limit"],
        max_hops=shape["max_hops"],
        node_budget=shape["node_budget"],
        include_central=shape["central"],
        edge_families=tuple(shape["families"]),
        wants_evidence=shape["evidence"],
    )


def allowed_edge_types(plan: QueryPlan) -> tuple[str, ...]:
    """The concrete relationship types traversal may follow for this plan.

    An allowlist, not a denylist: a relationship type that is not in the ontology cannot be traversed,
    so a malformed or injected edge label cannot widen the walk.
    """
    types: list[str] = []
    for fam in plan.edge_families:
        types.extend(EDGE_FAMILY.get(fam, ()))
    if plan.wants_evidence:
        types.extend(EDGE_FAMILY["evidence"])
    seen: set[str] = set()
    return tuple(t for t in types if not (t in seen or seen.add(t)))
