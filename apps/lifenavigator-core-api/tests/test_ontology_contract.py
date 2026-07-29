"""The retrieval tier's half of the ontology contract.

The Rust side (`ontology.rs :: manifest_tests`) guarantees the manifest matches the registry that writes
edges to Neo4j. These tests guarantee the retrieval tier can actually REACH everything the manifest
declares — the other end of the same contract, and the end that was broken.

WHAT WAS WRONG
--------------
`planner.EDGE_FAMILY` was a hand-written dict listing 37 relationship types. The worker emits 61. The
24-type gap was invisible to every existing test because both sides were tested against themselves:

    HAS_DOCUMENT, HAS_EXTRACTED_FIELD   all of Document Intelligence
    HAS_TRANSACTION                     spending
    HAS_CERTIFICATION, HAS_INTERVIEW    career
    HAS_HEALTH_GOAL, HAS_EDUCATION_GOAL goals in two domains
    CONSIDERS_SCHOOL, EVALUATES_PROGRAM education
    RELATED_TO                          weighted in traversal, in no family — rankable, unreachable

Every one was written to the graph on ingest and could not be traversed, so an uploaded will could move
the life model and still never reach an answer.

These tests fail if that gap reopens from this side.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.grounding.semantic.planner import (
    EDGE_FAMILY,
    EDGE_WEIGHT_FROM_ONTOLOGY,
    INTENT_FAMILIES,
    Intent,
    allowed_edge_types,
    plan_query,
)
from app.grounding.semantic.traversal import EDGE_WEIGHT

MANIFEST = Path(__file__).resolve().parents[1] / "app/grounding/semantic/ontology_manifest.json"

# Types that the worker emits and traversal could NOT follow before the contract existed. Named
# explicitly: a regression here is a capability going dark, not a number changing.
PREVIOUSLY_UNREACHABLE = [
    "HAS_DOCUMENT", "HAS_EXTRACTED_FIELD", "HAS_TRANSACTION", "HAS_CERTIFICATION",
    "HAS_HEALTH_GOAL", "HAS_EDUCATION_GOAL", "HAS_INTERVIEW", "INCLUDES_INTERVIEW",
    "CONSIDERS_SCHOOL", "EVALUATES_PROGRAM", "HAS_PROGRAM_COMPARISON", "HAS_APPLICATION",
    "HAS_BUDGET_CATEGORY", "HAS_EXPENSE_CATEGORY", "HAS_INSURANCE_PROFILE", "HAS_PROFICIENCY",
    "HAS_RESUME", "HAS_WELLNESS", "HAS_BENEFIT_DEADLINE", "HAS_COMPENSATION",
    "HAS_COMPENSATION_PROJECTION", "COVERS_DEPENDENT", "OFFERS", "RELATED_TO",
]


def _manifest_types() -> set[str]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {r["rel_type"] for r in data["relationships"]}


def test_manifest_ships_inside_the_python_package():
    """It must sit beside the code that reads it.

    core-api's Dockerfile is `COPY app ./app` with the service directory as build context, so a manifest
    anywhere else would be missing from the image and the planner would raise at import — in production
    only. Asserting the location keeps that failure out of the deploy.
    """
    assert MANIFEST.exists(), f"ontology manifest missing at {MANIFEST}"
    assert MANIFEST.is_relative_to(MANIFEST.parents[3])


def test_every_manifest_relationship_is_traversable():
    """THE REGRESSION GUARD. Union of all families == the full declared vocabulary."""
    declared = _manifest_types()
    reachable = {rel for rels in EDGE_FAMILY.values() for rel in rels}
    missing = sorted(declared - reachable)
    assert not missing, (
        f"{len(missing)} relationship types are written to the graph but no family contains them, "
        f"so traversal cannot follow them: {missing}"
    )


def test_every_manifest_relationship_has_a_weight():
    declared = _manifest_types()
    assert not sorted(declared - set(EDGE_WEIGHT)), "unweighted relationship types would rank at default"
    assert not sorted(set(EDGE_WEIGHT) - declared), "weighted types that the worker never emits are dead"


def test_weights_agree_with_the_generated_contract():
    """One source. Traversal must not carry a second opinion about edge strength."""
    assert EDGE_WEIGHT == dict(EDGE_WEIGHT_FROM_ONTOLOGY)


def test_the_twenty_four_previously_unreachable_types_are_reachable():
    reachable = {rel for rels in EDGE_FAMILY.values() for rel in rels}
    still_missing = [r for r in PREVIOUSLY_UNREACHABLE if r not in reachable]
    assert not still_missing, f"regressed to unreachable: {still_missing}"


def test_document_edges_reachable_from_every_intent():
    """An uploaded document is evidence about the user's life, whatever they asked.

    Document Intelligence writes HAS_DOCUMENT / HAS_EXTRACTED_FIELD, and no intent could follow either.
    That is why a will could change the life model and never reach an answer.
    """
    for intent, families in INTENT_FAMILIES.items():
        assert "document" in families, f"intent {intent!r} cannot reach document edges"


def test_related_to_is_reachable_but_ranked_last():
    """It was weighted yet in no family — rankable, never reached. Both halves must now hold."""
    reachable = {rel for rels in EDGE_FAMILY.values() for rel in rels}
    assert "RELATED_TO" in reachable
    assert EDGE_WEIGHT["RELATED_TO"] == min(EDGE_WEIGHT.values())
    assert EDGE_WEIGHT["RELATED_TO"] < EDGE_WEIGHT["HAS_EVIDENCE"]


def test_evidence_outranks_every_other_family():
    assert EDGE_WEIGHT["HAS_EVIDENCE"] == max(EDGE_WEIGHT.values())


def test_intent_families_reference_real_families():
    for intent, families in INTENT_FAMILIES.items():
        for fam in families:
            assert fam in EDGE_FAMILY, f"intent {intent!r} references unknown family {fam!r}"


def test_causal_queries_reach_evidence_and_lookups_stay_narrow():
    """Planning is a policy, and the policy must still discriminate — one vocabulary, not one plan."""
    causal = set(allowed_edge_types(plan_query("why did you recommend the 529?")))
    lookup = set(allowed_edge_types(plan_query("what is my net worth?")))
    assert "HAS_EVIDENCE" in causal
    assert len(lookup) < len(set(allowed_edge_types(plan_query("how am I doing on finance?"))))


def test_a_document_question_can_reach_extracted_fields():
    rels = set(allowed_edge_types(plan_query("what does my will say about guardianship?")))
    assert "HAS_DOCUMENT" in rels
    assert "HAS_EXTRACTED_FIELD" in rels


def test_every_intent_has_a_shape():
    for intent in Intent:
        plan = plan_query("anything")
        assert plan.edge_families, "a plan with no families traverses nothing"
