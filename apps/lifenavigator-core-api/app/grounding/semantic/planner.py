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

import json
import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
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


# ── The ontology contract ────────────────────────────────────────────────────────────────────────
#
# THIS USED TO BE A HAND-WRITTEN DICT, AND IT WAS WRONG.
#
# It listed 37 relationship types. The ingestion worker's registry — the thing that actually writes
# edges to Neo4j — emits 61. The 24 missing ones were written to the graph on every ingest and were
# unreachable by traversal, because an edge type absent from this dict is absent from the generated
# Cypher. Whole capabilities were invisible to the advisor: HAS_DOCUMENT and HAS_EXTRACTED_FIELD (all
# of Document Intelligence), HAS_TRANSACTION, HAS_CERTIFICATION, HAS_HEALTH_GOAL, HAS_EDUCATION_GOAL,
# HAS_INTERVIEW, CONSIDERS_SCHOOL. RELATED_TO was worse than missing: it had a weight in
# traversal.EDGE_WEIGHT but no family here, so it could be ranked and never reached.
#
# Nothing detected this. Two vocabularies in two languages, with no shared artifact, drifted for as
# long as they both existed — which is the predictable outcome, not bad luck.
#
# So the vocabulary is now DERIVED. `ontology_manifest.json` is generated from the Rust registry
# (`apps/ingestion-worker/src/ontology.rs :: relationship_manifest()`), and a Rust test fails the build
# if the file and the registry disagree. Adding an edge type in the worker without regenerating breaks
# CI; regenerating updates traversal automatically. There is one vocabulary now, and this file reads it
# rather than restating it.
#
# Regenerate:  cargo test -p ingestion-worker export_relationship_manifest -- --ignored

_MANIFEST_PATH = Path(__file__).with_name("ontology_manifest.json")


def _load_ontology() -> tuple[dict[str, tuple[str, ...]], dict[str, float], frozenset[str]]:
    """Read the generated contract into (families, weights, personal-advisor-traversable).

    Fails LOUDLY on a missing or malformed manifest. The tempting alternative — fall back to a built-in
    list — would recreate exactly the bug this replaced: a silent second vocabulary that looks like it
    works. A graph-grounded advisor with no ontology should refuse to start, not quietly retrieve less.
    """
    try:
        data = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
        rows = data["relationships"]
        if not rows:
            raise ValueError("manifest contains no relationships")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"ontology manifest unreadable at {_MANIFEST_PATH}: {exc}. "
            "Traversal cannot be ontology-derived without it. Regenerate with: "
            "cargo test -p ingestion-worker export_relationship_manifest -- --ignored"
        ) from exc

    families: dict[str, list[str]] = {}
    weights: dict[str, float] = {}
    traversable: set[str] = set()
    for row in rows:
        rel, fam = row["rel_type"], row["family"]
        families.setdefault(fam, []).append(rel)
        weights[rel] = float(row["weight"])
        # FAIL CLOSED. A row with no explicit `traversable` decision is NOT traversable. Defaulting to
        # True would let a relationship acquire personal-advisor reach because someone forgot to decide
        # — which is how the provider/B2B edges would otherwise have entered personal retrieval.
        if row.get("traversable") is True:
            traversable.add(rel)
    return {k: tuple(v) for k, v in families.items()}, weights, frozenset(traversable)


EDGE_FAMILY, EDGE_WEIGHT_FROM_ONTOLOGY, PERSONAL_ADVISOR_TRAVERSABLE = _load_ontology()

# Which families each query intent should traverse. This is a RETRIEVAL policy, not an ontology fact —
# the ontology says what an edge means; this says which meanings matter for a given question — so it
# stays here, expressed in families rather than in 61 individual type names.
INTENT_FAMILIES: dict[str, tuple[str, ...]] = {
    "lookup":   ("ownership", "identity", "document"),
    "compare":  ("ownership", "planning", "evidence", "document"),
    # `document` belongs here too: documents are DATED artifacts. "How has my coverage changed?" is
    # answered by two policy documents a year apart, and excluding them made the one intent most likely
    # to need dated evidence the one intent that could not see any.
    "temporal": ("progress", "ownership", "document"),
    "causal":   ("evidence", "ownership", "document"),
    "scenario": ("planning", "ownership", "progress", "evidence", "document"),
    "broad":    ("ownership", "identity", "planning", "progress", "document"),
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
#
# `families` comes from INTENT_FAMILIES above so the intent→family policy is stated once. Every intent
# now includes the `document` family: an uploaded will, policy or statement is evidence about the user's
# life, and omitting it is why a document could change the life model yet never reach an answer.
_SHAPE: dict[Intent, dict] = {
    Intent.LOOKUP:   dict(seed_limit=6,  max_hops=1, node_budget=40,  central=False,
                          families=INTENT_FAMILIES["lookup"], evidence=False),
    Intent.COMPARE:  dict(seed_limit=10, max_hops=2, node_budget=120, central=True,
                          families=INTENT_FAMILIES["compare"], evidence=True),
    Intent.TEMPORAL: dict(seed_limit=8,  max_hops=2, node_budget=100, central=False,
                          families=INTENT_FAMILIES["temporal"], evidence=False),
    Intent.CAUSAL:   dict(seed_limit=6,  max_hops=2, node_budget=100, central=False,
                          families=INTENT_FAMILIES["causal"], evidence=True),
    Intent.SCENARIO: dict(seed_limit=10, max_hops=2, node_budget=120, central=True,
                          families=INTENT_FAMILIES["scenario"], evidence=True),
    Intent.BROAD:    dict(seed_limit=10, max_hops=1, node_budget=60,  central=True,
                          families=INTENT_FAMILIES["broad"], evidence=False),
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

    Family membership alone is NOT sufficient. Every candidate is additionally filtered through the
    catalog's per-context traversal policy (`PERSONAL_ADVISOR_TRAVERSABLE`), because this planner serves
    the PERSONAL advisor context only. Provider/Arcana B2B edges carry ordinary families — `identity`,
    `evidence`, `progress` — so a family-only allowlist would pull provider-operational data into a
    user's personal retrieval. Contexts other than the personal advisor need their own planner and their
    own authorization design; they do not get one by widening this filter.
    """
    types: list[str] = []
    for fam in plan.edge_families:
        types.extend(EDGE_FAMILY.get(fam, ()))
    if plan.wants_evidence:
        types.extend(EDGE_FAMILY["evidence"])
    seen: set[str] = set()
    return tuple(
        t
        for t in types
        if t in PERSONAL_ADVISOR_TRAVERSABLE and not (t in seen or seen.add(t))
    )
