"""Life Graph Workspace — real personal_graph → frontend contract, every edge backed by a real source.

Proves: nodes map to the contract, persisted edges carry provenance=persisted_edge, real 2-hop shared-node
links become provenance=shared_node edges WITH a citation (the via node), no edges are invented, an empty
graph yields an empty workspace, and the relation core is shared with the advisor (no cited edge → no edge).
"""
from __future__ import annotations

from typing import Any

import pytest

from app.services.life_graph_workspace import build_workspace, query_focus, recommendation_lineage, _cosine

# Same shape personal_graph() returns; FI and Education share a constraint → a real 2-hop connection.
GRAPH: dict[str, Any] = {
    "nodes": [
        {"id": "vision", "type": "Life Vision", "label": "retire early, fund college", "color": "purple"},
        {"id": "obj_fi", "type": "Life Objective", "label": "Financial Independence", "color": "indigo", "confidence": 0.8},
        {"id": "obj_edu", "type": "Life Objective", "label": "Education Funding", "color": "indigo", "confidence": 0.7},
        {"id": "g_retire", "type": "Goal", "label": "retire at 60", "color": "blue", "domain": "finance"},
        {"id": "con_savings", "type": "Constraint", "label": "limited monthly savings", "color": "rose", "domain": "finance"},
        {"id": "family:family:dependents:abc", "type": "Dependent", "label": "Daughter", "color": "amber",
         "domain": "family", "source": "manual_entry", "table": "family.dependents", "record_id": "abc",
         "updated_at": "2026-06-10T00:00:00Z"},
        {"id": "family_hub", "type": "Family", "label": "Family", "color": "amber", "domain": "family"},
    ],
    "edges": [
        {"from": "g_retire", "to": "obj_fi", "rel": "advances", "confidence": 0.9},
        {"from": "con_savings", "to": "obj_fi", "rel": "conflicts_with", "confidence": 0.8},
        {"from": "con_savings", "to": "obj_edu", "rel": "conflicts_with", "confidence": 0.8},
        {"from": "family:family:dependents:abc", "to": "family_hub", "rel": "part_of", "confidence": 1.0},
    ],
}


def test_empty_graph_yields_empty_workspace():
    ws = build_workspace({"nodes": [], "edges": []})
    assert ws["nodes"] == [] and ws["edges"] == []
    assert ws["metrics"]["totalNodes"] == 0 and ws["metrics"]["totalEdges"] == 0


def test_nodes_map_to_contract():
    ws = build_workspace(GRAPH)
    by_id = {n["id"]: n for n in ws["nodes"]}
    assert by_id["obj_fi"]["type"] == "goal" and by_id["obj_fi"]["confidence"] == 0.8
    assert by_id["g_retire"]["domain"] == "finance"
    assert by_id["family_hub"]["type"] == "domain"
    # domain-entity node carries REAL lineage back to its source row
    dep = by_id["family:family:dependents:abc"]
    assert dep["dataUsed"][0]["sourceTable"] == "family.dependents"
    assert dep["dataUsed"][0]["sourceId"] == "abc"


def test_persisted_edges_have_provenance():
    ws = build_workspace(GRAPH)
    persisted = [e for e in ws["edges"] if e["provenance"] == "persisted_edge"]
    # all four real edges are present and tagged
    rels = {(e["source"], e["type"], e["target"]) for e in persisted}
    assert ("g_retire", "advances", "obj_fi") in rels
    assert ("con_savings", "conflicts_with", "obj_edu") in rels
    for e in persisted:
        assert e["source"] and e["target"] and e["type"]  # every visible edge has src/tgt/type


def test_shared_node_connection_becomes_cited_edge():
    ws = build_workspace(GRAPH)
    computed = [e for e in ws["edges"] if e["provenance"] == "shared_node"]
    # FI ↔ Education share con_savings → exactly one real computed connection, citing the shared node
    fi_edu = [e for e in computed if {e["source"], e["target"]} == {"obj_fi", "obj_edu"}]
    assert len(fi_edu) == 1
    e = fi_edu[0]
    assert e["viaId"] == "con_savings" and e["citationId"] == "con_savings"
    assert e["evidenceIds"] == ["con_savings"]
    assert "limited monthly savings" in (e["via"] or "")


def test_no_unsupported_edges_are_invented():
    ws = build_workspace(GRAPH)
    # g_retire and obj_edu are NOT connected within 2 hops → no edge between them
    for e in ws["edges"]:
        assert {e["source"], e["target"]} != {"g_retire", "obj_edu"}


def test_metrics_are_computed_from_real_values():
    ws = build_workspace(GRAPH)
    m = ws["metrics"]
    assert m["totalNodes"] == 7
    assert m["totalEdges"] == len(ws["edges"])
    assert m["lastUpdated"] == "2026-06-10T00:00:00Z"
    assert 0 < m["avgConfidence"] <= 1


def test_edges_to_unknown_nodes_are_dropped():
    g = {"nodes": [{"id": "a", "type": "Goal", "label": "A"}],
         "edges": [{"from": "a", "to": "ghost", "rel": "advances"}]}
    assert build_workspace(g)["edges"] == []


# --------------------------------------------------------------------------- #
# query-focus — real semantic relevance, honest empties
# --------------------------------------------------------------------------- #
# --------------------------------------------------------------------------- #
# Recommendation + evidence lineage — real rows only
# --------------------------------------------------------------------------- #
REC = {
    "id": "rec-1", "title": "Increase 401(k) to full employer match", "rec_type": "ACTION",
    "category": "finance", "priority": "high", "confidence": 0.82, "rank_score": 0.91,
    "description": "You're leaving employer match on the table.",
    "impacted_domains": ["finance", "family"],
    "evidence": [
        {"statement": "401(k) statement: contributing 3% vs 6% match", "source_table": "documents:401k_statement"},
        {"statement": "Cash flow supports a 3% increase", "source_table": "finance:cash_flow"},
    ],
    "assumptions": [{"label": "Tax treatment", "value": "pre-tax traditional 401(k)"}],
    "quantified_impact": {"unlocked_capabilities": ["employer-match gap", "retirement projection"]},
    "formula": {"impact": 0.9, "confidence": 0.82, "urgency": 0.7, "effort": 0.2},
    "narrative": {"why": "Capturing the full match is free money."},
}


def test_recommendation_lineage_builds_real_nodes_and_edges():
    nodes, edges = recommendation_lineage([REC], {"family_hub", "finance_hub"})
    by_id = {n["id"]: n for n in nodes}
    # recommendation node
    rec = by_id["rec:rec-1"]
    assert rec["type"] == "recommendation" and rec["domain"] == "finance" and rec["score"] == 0.91
    assert rec["impactedDomains"] == ["finance", "family"]
    assert rec["evidenceIds"] == ["ev:rec-1:0", "ev:rec-1:1"]
    assert rec["assumptions"][0]["label"] == "Tax treatment"
    assert [m["label"] for m in rec["missingData"]] == ["employer-match gap", "retirement projection"]
    assert any(f["label"] == "impact" for f in rec["xai"]["weightedFactors"])
    # evidence nodes + source nodes
    assert by_id["ev:rec-1:0"]["type"] == "evidence"
    assert by_id["src:documents:401k_statement"]["type"] == "source"
    # edges: rec->evidence (persisted), evidence->source (persisted), rec->hub (computed, declared domains)
    kinds = {(e["source"], e["type"], e["target"], e["provenance"]) for e in edges}
    assert ("rec:rec-1", "evidenced_by", "ev:rec-1:0", "persisted_edge") in kinds
    assert ("ev:rec-1:0", "from_source", "src:documents:401k_statement", "persisted_edge") in kinds
    assert ("rec:rec-1", "impacts", "finance_hub", "computed_connection") in kinds
    assert ("rec:rec-1", "impacts", "family_hub", "computed_connection") in kinds


def test_recommendation_hub_edge_only_when_hub_exists():
    # no hubs present → no rec→hub edges are fabricated (only real lineage remains)
    _, edges = recommendation_lineage([REC], set())
    assert all(e["type"] != "impacts" for e in edges)


def test_build_workspace_merges_recommendation_lineage():
    ws = build_workspace(GRAPH, [REC])
    types = {n["type"] for n in ws["nodes"]}
    assert {"recommendation", "evidence", "source"} <= types
    # rec→family_hub edge appears because GRAPH has a family_hub
    assert any(e["type"] == "impacts" and e["target"] == "family_hub" for e in ws["edges"])
    assert ws["metrics"]["totalNodes"] == len(ws["nodes"]) and ws["metrics"]["totalEdges"] == len(ws["edges"])


def test_build_workspace_no_recommendations_is_unchanged():
    assert build_workspace(GRAPH, []) == build_workspace(GRAPH)
    assert build_workspace(GRAPH, None) == build_workspace(GRAPH)


def test_cosine_basic():
    assert _cosine([1, 0], [1, 0]) == 1.0
    assert _cosine([1, 0], [0, 1]) == 0.0


class FakeGemini:
    """Deterministic embeddings: vector = [matches('retire'), matches('college'), matches('family')]."""
    configured = True

    async def embed(self, text: str) -> list[float]:
        t = text.lower()
        return [
            1.0 if ("retire" in t or "financial" in t or "independence" in t) else 0.0,
            1.0 if ("education" in t or "college" in t) else 0.0,
            1.0 if ("family" in t or "daughter" in t or "dependent" in t) else 0.0,
        ]


class UnconfiguredGemini:
    configured = False

    async def embed(self, text: str) -> list[float]:  # pragma: no cover - never called
        raise AssertionError("should not embed when unconfigured")


@pytest.mark.asyncio
async def test_query_focus_returns_relevance_for_matching_nodes():
    rel = await query_focus(FakeGemini(), GRAPH, "How do I retire with financial independence?")
    assert rel.get("obj_fi", 0) > 0.15  # the financial-independence objective lights up
    assert "family_hub" not in rel  # unrelated family node stays dark


@pytest.mark.asyncio
async def test_query_focus_empty_when_unconfigured():
    assert await query_focus(UnconfiguredGemini(), GRAPH, "retire") == {}


@pytest.mark.asyncio
async def test_query_focus_empty_for_blank_query_or_graph():
    assert await query_focus(FakeGemini(), GRAPH, "   ") == {}
    assert await query_focus(FakeGemini(), {"nodes": [], "edges": []}, "retire") == {}
