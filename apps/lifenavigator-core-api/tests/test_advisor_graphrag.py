"""Advisor GraphRAG Relationship Enrichment — the advisor reasons from REAL graph edges, never inferred.

Proven without a live LLM:
  * build_relationships() turns a persisted personal_graph into label-resolved edges + real 2-hop
    connections (and nothing when there are no edges),
  * the advisor may reference a real retirement↔education connection when its shared-node edge exists,
  * the advisor cannot invent a relationship when the graph has no edges (→ fallback),
  * an unsupported / uncited relationship claim is rejected (→ fallback),
  * a previously-rejected goal is still stripped even on a relationship turn.
"""
from __future__ import annotations

from typing import Any, Optional

import pytest

from app.models.common import UserContext
from app.services.advisor_context import AdvisorContext, AdvisorContextBuilder, build_relationships
from app.services.advisor_orchestrator import AdvisorOrchestrator, build_constraints
from app.services.advisor_validator import validate


def _ctx() -> UserContext:
    return UserContext(user_id="u-graph", email="g@example.com")


# A persisted graph where retirement (Financial Independence) and Education Funding both connect to a
# shared constraint node — a REAL 2-hop connection between two objectives.
CONNECTED_GRAPH: dict[str, Any] = {
    "nodes": [
        {"id": "obj_fi", "type": "Life Objective", "label": "Financial Independence"},
        {"id": "obj_edu", "type": "Life Objective", "label": "Education Funding"},
        {"id": "g_retire", "type": "Goal", "label": "retire at 60", "domain": "finance"},
        {"id": "g_college", "type": "Goal", "label": "fund my kids' college", "domain": "education"},
        {"id": "con_savings", "type": "Constraint", "label": "limited monthly savings", "domain": "finance"},
    ],
    "edges": [
        {"from": "g_retire", "to": "obj_fi", "rel": "advances", "confidence": 0.9},
        {"from": "g_college", "to": "obj_edu", "rel": "advances", "confidence": 0.9},
        {"from": "con_savings", "to": "obj_fi", "rel": "conflicts_with", "confidence": 0.7},
        {"from": "con_savings", "to": "obj_edu", "rel": "conflicts_with", "confidence": 0.7},
    ],
}

EMPTY_GRAPH: dict[str, Any] = {"nodes": [], "edges": []}


class FakeSupabase:
    def __init__(self, rejected: Optional[list[dict[str, Any]]] = None) -> None:
        self._rejected = rejected or []

    async def select(self, table: str, **kwargs: Any) -> list[dict[str, Any]]:
        return self._rejected if table == "rejected_goals" else []


class FakeLife:
    def __init__(self, graph: dict[str, Any]) -> None:
        self._graph = graph

    async def personal_graph(self, ctx: UserContext) -> dict[str, Any]:
        return self._graph


class FakeRM:
    def __init__(self, base: dict[str, Any]) -> None:
        self._base = base

    async def converse(self, ctx, message, pending_key=None) -> dict[str, Any]:
        return dict(self._base)


class FakeLLM:
    def __init__(self, out: Optional[dict[str, Any]]) -> None:
        self._out = out

    async def generate(self, context, plan) -> Optional[dict[str, Any]]:
        return self._out


def _base() -> dict[str, Any]:
    return {
        "assistant_message": "Rule-based fallback question.",
        "complete": False,
        "pending_key": "vision",
        "candidate_goals": [],
        "context_panel": {
            "life_vision": "retire early and put my kids through college",
            "primary_objective": "financial independence",
            "domains_touched": ["finance", "education"],
            "missing_areas": [], "top_risks": [], "top_opportunities": [], "top_constraints": [],
            "discovery_completion_pct": 50,
        },
    }


def _llm(**over: Any) -> dict[str, Any]:
    out = {
        "reflection": "You're balancing retiring early with funding your kids' college.",
        "next_question": "If your monthly savings were stretched, which goal would you protect first?",
        "why_this_question": "It tells me how to weigh the two against your shared savings.",
        "summary": "",
        "confirmed_facts": [], "candidate_facts": [], "assumptions": [],
        "candidate_goals": [], "missing_data": [], "relationships_referenced": [], "warnings": [],
        "should_persist": False,
    }
    out.update(over)
    return out


async def _build(graph: dict[str, Any], message="hi", *, rejected=None) -> AdvisorContext:
    b = AdvisorContextBuilder(FakeSupabase(rejected=rejected), coverage=None, life=FakeLife(graph))
    return await b.build(_ctx(), message, _base())


# --------------------------------------------------------------------------- #
# build_relationships — pure edge derivation
# --------------------------------------------------------------------------- #
def test_build_relationships_resolves_labels_and_real_connection():
    edges, connections, pairs = build_relationships(CONNECTED_GRAPH)
    # every raw edge is label-resolved
    rels = {(e["from"], e["rel"], e["to"]) for e in edges}
    assert ("retire at 60", "advances", "Financial Independence") in rels
    # the two objectives share the constraint → a real 2-hop connection
    conn_pairs = {frozenset({c["a"], c["b"]}) for c in connections}
    assert frozenset({"Financial Independence", "Education Funding"}) in conn_pairs
    assert frozenset({"financial independence", "education funding"}) in pairs
    # the connection records its real basis (shared node), not a guess
    fi_edu = next(c for c in connections if {c["a"], c["b"]} == {"Financial Independence", "Education Funding"})
    assert fi_edu["basis"] == "shared_node" and fi_edu["via"] == "limited monthly savings"


def test_build_relationships_empty_graph_is_empty():
    edges, connections, pairs = build_relationships(EMPTY_GRAPH)
    assert edges == [] and connections == [] and pairs == set()


def test_build_relationships_drops_edges_to_unknown_nodes():
    g = {"nodes": [{"id": "a", "type": "Goal", "label": "A"}],
         "edges": [{"from": "a", "to": "ghost", "rel": "advances"}]}
    edges, connections, pairs = build_relationships(g)
    assert edges == [] and connections == []


# --------------------------------------------------------------------------- #
# Context + constraints expose relationships honestly
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_context_exposes_real_relationships():
    ctx = await _build(CONNECTED_GRAPH)
    assert ctx.relationships_available is True
    d = ctx.prompt_dict()
    assert d["relationships_available"] is True
    assert d["relationship_edges"] and d["graph_connections"]


@pytest.mark.asyncio
async def test_context_empty_graph_says_nothing():
    ctx = await _build(EMPTY_GRAPH)
    assert ctx.relationships_available is False
    assert ctx.relationship_edges == [] and ctx.connections == []
    assert build_constraints(_base(), ctx)["relationships_available"] is False


@pytest.mark.asyncio
async def test_context_no_life_service_is_safe():
    b = AdvisorContextBuilder(FakeSupabase(), coverage=None, life=None)
    ctx = await b.build(_ctx(), "hi", _base())
    assert ctx.relationship_edges == [] and ctx.connected_pairs == set()


# --------------------------------------------------------------------------- #
# Validator — relationship trust gate
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_validator_accepts_real_relationship_with_citation():
    ctx = await _build(CONNECTED_GRAPH)
    out = _llm(
        reflection="Your retirement goal is connected to your education-funding goal through your savings.",
        relationships_referenced=[{"from": "Financial Independence", "to": "Education Funding", "rel": "shared_node"}],
    )
    ok, safe, reasons = validate(out, ctx)
    assert ok, reasons
    assert safe["relationships_referenced"]  # the real citation is kept


@pytest.mark.asyncio
async def test_validator_rejects_relationship_when_no_edges():
    ctx = await _build(EMPTY_GRAPH)
    out = _llm(reflection="Your retirement goal is connected to your education-funding goal.")
    ok, _, reasons = validate(out, ctx)
    assert not ok and any("no edges" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_rejects_unsupported_citation():
    ctx = await _build(CONNECTED_GRAPH)  # FI↔EDU is real; health↔career is not
    out = _llm(
        reflection="Your health goal is tied to your career goal.",
        relationships_referenced=[{"from": "Health Longevity", "to": "Career Growth", "rel": "shared_node"}],
    )
    ok, _, reasons = validate(out, ctx)
    assert not ok and any("unsupported relationship" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_rejects_uncited_relationship_claim():
    ctx = await _build(CONNECTED_GRAPH)
    out = _llm(reflection="These two goals are interconnected.")  # connective language, no citation
    ok, _, reasons = validate(out, ctx)
    assert not ok and any("without a supporting graph edge" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_allows_non_relationship_turn_with_edges_present():
    ctx = await _build(CONNECTED_GRAPH)
    out = _llm()  # no connective language, no citation — perfectly fine
    ok, _, reasons = validate(out, ctx)
    assert ok, reasons


# --------------------------------------------------------------------------- #
# Orchestrator end-to-end (fake LLM)
# --------------------------------------------------------------------------- #
async def _run(graph: dict[str, Any], llm_out: Optional[dict[str, Any]], *, rejected=None) -> dict[str, Any]:
    orch = AdvisorOrchestrator(
        FakeRM(_base()),
        AdvisorContextBuilder(FakeSupabase(rejected=rejected), coverage=None, life=FakeLife(graph)),
        FakeLLM(llm_out),
    )
    return await orch.converse(_ctx(), "I want to retire at 60 and fund my kids' college")


@pytest.mark.asyncio
async def test_advisor_references_real_retirement_education_relationship():
    out = await _run(CONNECTED_GRAPH, _llm(
        reflection="Your retirement goal is connected to your education-funding goal through your savings.",
        next_question="If savings got tight, would you protect retiring at 60 or funding college first?",
        relationships_referenced=[{"from": "Financial Independence", "to": "Education Funding", "rel": "shared_node"}],
    ))
    assert out["llm_status"] == "enhanced"
    assert "connected to" in out["assistant_message"]
    assert out["relationships_referenced"]  # surfaced for display


@pytest.mark.asyncio
async def test_advisor_does_not_invent_relationship_without_edges():
    base_msg = _base()["assistant_message"]
    out = await _run(EMPTY_GRAPH, _llm(
        reflection="Your retirement goal is connected to your education-funding goal.",
    ))
    assert out["assistant_message"] == base_msg  # fell back to safe rule-based text
    assert out["llm_status"].startswith("fallback:")


@pytest.mark.asyncio
async def test_advisor_unsupported_relationship_triggers_fallback():
    base_msg = _base()["assistant_message"]
    out = await _run(CONNECTED_GRAPH, _llm(
        reflection="Your health goal is tied to your career goal.",
        relationships_referenced=[{"from": "Health", "to": "Career", "rel": "shared_node"}],
    ))
    assert out["assistant_message"] == base_msg
    assert out["llm_status"].startswith("fallback:")


@pytest.mark.asyncio
async def test_relationship_turn_still_respects_rejected_goal():
    rejected = [{"rejected_goal": "advance my career"}]
    out = await _run(CONNECTED_GRAPH, _llm(
        reflection="Your retirement goal is connected to your education-funding goal.",
        relationships_referenced=[{"from": "Financial Independence", "to": "Education Funding"}],
        candidate_goals=[{"title": "advance my career", "domain": "career"}, {"title": "save more", "domain": "finance"}],
    ), rejected=rejected)
    assert out["llm_status"] == "enhanced"
    titles = [g.get("title") for g in out.get("candidate_goals", [])]
    assert "advance my career" not in titles  # rejected goal never resurfaces, even on a relationship turn
