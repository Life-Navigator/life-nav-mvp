"""Probe B — semantic GraphRAG retrieval.

THIS IS THE EVAL SET `fly.toml` ALREADY DEMANDS
-----------------------------------------------
`apps/lifenavigator-core-api/fly.toml` sets `GRAPH_GROUNDING_ENABLED = "false"` and states the
condition for turning it on: "the honest gate for that is a measured win on the retrieval eval set,
not a config edit." That eval set has never existed. So a 1,177-line semantic engine with 147 typed
relationship types, a generated ontology manifest and CI drift gates has been dark since the day it
landed, because the gate it must pass is unbuildable rather than unmet.

This module is the runner for it. What it CANNOT do is invent the labels.

WHY THE LABELS ARE HUMAN WORK
-----------------------------
Precision and recall need a judgement of which edges SHOULD have come back for a given query and
user. That judgement cannot be derived from the graph: if the system could decide what was relevant,
there would be nothing left to measure. So `RetrievalCase.labelled` defaults False and an unlabelled
case is REFUSED rather than scored — a probe that quietly scored stubs would report a number, and a
number here would immediately be used to justify flipping the flag.

This is the honest reason the retrieval eval set does not exist yet: it is labelling effort, not
code. The code is this file.

WHAT IT MEASURES ONCE LABELLED
------------------------------
    recall    — of the edges that SHOULD have come back, how many did. Misses mean the advisor
                reasons without evidence it had.
    precision — of what came back, how much should have. `irrelevant_edge_ids` exists because a
                dragnet that returns everything scores perfect recall while burning input tokens at
                Opus rates and diluting the prompt.

Both are reported separately, like every other probe here: a retriever tuned to never miss and a
retriever tuned to never over-fetch fail in opposite directions, and one averaged score hides which.
"""
from __future__ import annotations

from typing import Any, Optional

from .model import CaseResult, RetrievalCase, fixture_version, load_retrieval_cases
from .scorecard import ProbeScore, score

PROBE = "retrieval"


async def evaluate_case(case: RetrievalCase, retriever: Any) -> CaseResult:
    """Run one query against a live retriever and compare the edges returned to the labels."""
    if not case.labelled:
        return CaseResult(
            case_id=case.id, direction="must_pass",
            expected="labelled relevance judgement", actual="UNLABELLED",
            ok=False, refused=True,
            known_divergence="stub: no human relevance labels authored yet",
            detail={"why": case.why},
        )

    evidence, _trace = await retriever.retrieve(
        case.query, user_id=case.user_id, domain=case.domain, limit=20
    )
    got = {str(e.get("id") or e.get("edge_id") or "") for e in (evidence or [])}
    want = set(case.relevant_edge_ids)
    must_not = set(case.irrelevant_edge_ids)

    missed = sorted(want - got)
    wrongly_returned = sorted(must_not & got)
    recall = round(100.0 * len(want & got) / len(want), 1) if want else None

    return CaseResult(
        case_id=case.id, direction="must_pass",
        expected=f"recall 100% of {len(want)} edges, none of {len(must_not)} forbidden",
        actual=f"recall {recall}%, {len(wrongly_returned)} forbidden returned",
        ok=(not missed and not wrongly_returned),
        detail={"missed": missed, "wrongly_returned": wrongly_returned,
                "returned": len(got), "recall_pct": recall, "why": case.why},
    )


async def run(retriever: Any = None,
              cases: Optional[list[RetrievalCase]] = None) -> ProbeScore:
    """Run the probe. `retriever` must be a live SemanticGraphRAG — this probe needs Neo4j+Qdrant."""
    cases = cases if cases is not None else load_retrieval_cases()
    notes: list[str] = []

    if not cases:
        notes.append("no retrieval fixtures — UNMEASURED. This is the eval set fly.toml names as the "
                     "gate for GRAPH_GROUNDING_ENABLED; until it is labelled, that flag cannot be "
                     "flipped on evidence.")
        return score(PROBE, fixture_version("retrieval_cases.json"), [], notes)

    labelled = [c for c in cases if c.labelled]
    if not labelled:
        notes.append(f"{len(cases)} case(s) present but NONE labelled — refusing to score. "
                     f"Relevance judgements are human work; see this module's docstring.")
        return score(PROBE, fixture_version("retrieval_cases.json"),
                     [await evaluate_case(c, retriever) for c in cases], notes)

    if retriever is None:
        notes.append("labelled cases exist but no live retriever was supplied (needs Neo4j + Qdrant "
                     "and GRAPH_GROUNDING_ENABLED) — UNMEASURED rather than assumed.")
        return score(PROBE, fixture_version("retrieval_cases.json"), [], notes)

    results = [await evaluate_case(c, retriever) for c in cases]
    notes.append(f"{len(labelled)}/{len(cases)} cases labelled")
    return score(PROBE, fixture_version("retrieval_cases.json"), results, notes)

# ── Synthetic mode: retrieval BEHAVIOUR, gateable in CI ───────────────────────────────────────────
# Over a DECLARED graph (eval/graph_world.py) the ground truth is known, so behaviour can be asserted
# without human labels and without live stores. This is what makes the engine's mechanics gateable
# on every PR, while real-user relevance stays the human task above.
#
# It found a production bug the first time it ran. See SYNTHETIC_CASES[0].
SYNTHETIC_CASES: list[dict[str, Any]] = [
    {
        "id": "synthetic.cross-domain-question-reaches-both-domains",
        "query": "Can I retire at 55 and still fund college for my kids?",
        "must_include": ["a-goal-college", "a-goal-retire"],
        "must_exclude": ["a-unrelated-pet"],
        "why": ("THE headline GraphRAG use case: a question spanning finance and education. Found a "
                "real bug on first run — the engine filtered vector seeding to `plan.domains[0]`, so "
                "a query planned as ('family','financial','education') was narrowed to `family`, "
                "whose only node was a pet record. Zero seeds, zero evidence, with which domain won "
                "decided by detection ORDER rather than by the question. Fixed in "
                "engine._seed_domain_filter; this case is the regression guard."),
    },
    {
        "id": "synthetic.typed-traversal-reaches-evidence-two-hops-out",
        "query": "why is my monthly surplus limited?",
        "must_include": ["a-constraint-cash", "a-evidence-surplus"],
        "must_exclude": ["a-unrelated-pet"],
        "why": ("What typed traversal is FOR: the evidence behind a constraint is two hops out and "
                "flat vector search over titles cannot reach it. If this ever returns seeds only, "
                "the walk has silently stopped — the exact degradation the dual row contract hides."),
    },
    {
        "id": "synthetic.document-field-is-reachable-from-the-document",
        "query": "what does my offer letter say about salary?",
        "must_include": ["a-doc-offer", "a-field-salary"],
        "must_exclude": ["a-unrelated-pet"],
        "why": ("Document edges were among the 24 previously-unreachable types. An uploaded document "
                "that cannot reach its own extracted fields is the documented reason a document "
                "could change the life model yet never reach an answer."),
    },
    {
        "id": "synthetic.non-traversable-edges-are-never-followed",
        "query": "Can I retire at 55 and still fund college for my kids?",
        "must_include": [],
        "must_exclude": ["a-unrelated-pet"],
        "why": ("The dragnet guard. a-goal-retire -RELATED_TO- a-unrelated-pet exists in the world, "
                "and RELATED_TO is traversable=false in the manifest. Following it would flood the "
                "prompt with irrelevant nodes at Opus input rates — recall is not free."),
    },
    {
        "id": "synthetic.another-tenants-subgraph-never-appears",
        "query": "Can I retire at 55 and still fund college for my kids?",
        "must_include": ["a-goal-retire"],
        "must_exclude": ["b-goal-retire", "b-constraint-cash"],
        "why": ("Tenant isolation against a graph that CONTAINS another tenant, whose nodes are "
                "titled to score highly on this exact query. Strictly stronger than a fake "
                "returning one hardcoded row: a leak here would be found by the vector seeding. "
                "`must_include` is non-empty on purpose — the first version of this case asserted "
                "only exclusions and passed VACUOUSLY when retrieval returned nothing at all, which "
                "is how a totally broken engine scores perfectly on isolation."),
    },
]


def build_world_engine() -> tuple[Any, Any]:
    """A real SemanticGraphRAG wired to the declared world. Returns (engine, neo4j_double)."""
    from app.grounding.semantic import SemanticGraphRAG

    from .graph_world import GraphWorld, WorldGemini, WorldNeo4j, WorldQdrant

    world = GraphWorld.load()
    neo = WorldNeo4j(world)
    engine = SemanticGraphRAG(gemini=WorldGemini(), qdrant=WorldQdrant(world), neo4j=neo,
                              central_qdrant=None)
    return engine, neo


async def run_synthetic() -> ProbeScore:
    """Run the synthetic behaviour cases. Free, offline, no credentials."""
    engine, neo = build_world_engine()
    results: list[CaseResult] = []

    for case in SYNTHETIC_CASES:
        evidence, trace = await engine.retrieve(case["query"], user_id="user-a", limit=20)
        got = [str(e.get("entity_id") or "") for e in (evidence or [])]
        missing = [i for i in case["must_include"] if i not in got]
        leaked = [i for i in case["must_exclude"] if i in got]
        # A case asserting exclusions must still have retrieved SOMETHING, or it passes vacuously:
        # a totally broken engine excludes everything.
        vacuous = (not case["must_include"]) and not got

        results.append(CaseResult(
            case_id=case["id"], direction="must_pass",
            expected=f"include {case['must_include']}, exclude {case['must_exclude']}",
            actual=f"returned {got}",
            ok=(not missing and not leaked and not vacuous),
            detail={"missing": missing, "leaked": leaked, "vacuous": vacuous,
                    "returned_count": len(got), "trace": trace.as_dict(), "why": case["why"]},
        ))

    notes = [f"{len(SYNTHETIC_CASES)} behaviour cases over the declared graph "
             f"(eval/fixtures/graph_world.json) — no model, no stores, no credentials",
             f"tenants the store was asked for: {sorted(neo.tenants_seen)}"]
    return score("retrieval_synthetic", fixture_version("graph_world.json"), results, notes)
