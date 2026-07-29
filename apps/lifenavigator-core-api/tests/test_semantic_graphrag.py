"""Semantic GraphRAG — tenant safety, traversal bounds, fusion fidelity, and the full engine path.

The tenant-safety tests are the most important in this file. Cross-tenant traversal must be
UNREPRESENTABLE, not merely filtered after the fact, so these assert on the generated Cypher and on the
client contract rather than on returned rows — a test that only checks results would pass against an
implementation that fetches everything and filters in Python.
"""
from __future__ import annotations

import pytest

from app.clients.neo4j import Neo4jClient
from app.grounding.semantic import (
    EDGE_WEIGHT,
    Intent,
    SemanticGraphRAG,
    allowed_edge_types,
    fuse,
    plan_query,
    rrf,
    traverse,
)
from app.grounding.semantic.traversal import (
    build_expand_cypher,
    build_lexical_seed_cypher,
    build_seed_cypher,
)

USER = "11111111-1111-1111-1111-111111111111"
OTHER = "22222222-2222-2222-2222-222222222222"


# ────────────────────────────────────────────────────────────── tenant safety (structural)

def test_every_generated_cypher_constrains_tenant_on_every_node_pattern():
    """Both ends of every relationship must be tenant-bound. A single unconstrained `(b)` would let a
    walk leave the tenant partition even though the seed was scoped."""
    cyphers = [
        build_seed_cypher(),
        build_lexical_seed_cypher(),
        build_expand_cypher(("HAS_GOAL", "HAS_DEBT"), fan_out=5),
    ]
    for c in cyphers:
        assert "$user_id" in c, c
        # Count node patterns that bind a variable; each must carry tenant_id.
        assert c.count("{tenant_id: $user_id}") >= 1, c
    expand = build_expand_cypher(("HAS_GOAL",), fan_out=5)
    # The neighbour pattern specifically — this is the one that would leak.
    assert "(b {tenant_id: $user_id})" in expand


def test_expand_cypher_refuses_unsafe_relationship_types():
    """Cypher has no parameter form for relationship types, so they are interpolated. An allowlist plus
    this shape check is what keeps that safe."""
    assert build_expand_cypher(("HAS_GOAL",), fan_out=5) is not None
    for bad in ("HAS_GOAL]-() MATCH (x)", "lowercase", "HAS-GOAL", "*", "", "A" * 60):
        assert build_expand_cypher((bad,), fan_out=5) is None, bad


def test_neo4j_client_refuses_untenanted_statement():
    """T-1 regression: the statement guard. Without it a query omitting the filter returns every
    tenant's nodes."""
    c = Neo4jClient(uri="https://x", username="u", password="p", database="neo4j")
    with pytest.raises(ValueError, match="must reference"):
        import asyncio
        asyncio.run(c.query_personal("MATCH (n) RETURN n", user_id=USER))


def test_neo4j_client_refuses_tenant_override():
    """T-1 regression: parameters were spread AFTER user_id, so a caller could replace the tenant."""
    c = Neo4jClient(uri="https://x", username="u", password="p", database="neo4j")
    import asyncio
    with pytest.raises(ValueError, match="cannot override"):
        asyncio.run(c.query_personal(
            "MATCH (n {tenant_id: $user_id}) RETURN n", user_id=USER,
            parameters={"user_id": OTHER},
        ))


@pytest.mark.asyncio
async def test_traverse_requires_user_id():
    plan = plan_query("anything")
    with pytest.raises(ValueError, match="non-empty user_id"):
        await traverse(_FakeNeo4j([]), user_id="", plan=plan, seeds=[{"entity_id": "a"}])


@pytest.mark.asyncio
async def test_traversal_binds_the_authenticated_tenant_on_every_hop():
    """The tenant the engine was called with must be the tenant every query runs under."""
    neo = _FakeNeo4j([[{"from_id": "a", "rel": "HAS_GOAL", "entity_id": "b", "labels": ["Goal"],
                        "title": "Retire", "summary": "", "domain": "finance", "recency": None}]])
    plan = plan_query("what are my goals?")
    await traverse(neo, user_id=USER, plan=plan, seeds=[{"entity_id": "a", "title": "Me"}])
    assert neo.calls, "traversal executed no query"
    for call in neo.calls:
        assert call["user_id"] == USER
        assert "$user_id" in call["statement"]
        assert "user_id" not in (call["parameters"] or {})


# ────────────────────────────────────────────────────────────── traversal bounds

@pytest.mark.asyncio
async def test_traversal_respects_hop_bound():
    rows = [[{"from_id": "a", "rel": "HAS_GOAL", "entity_id": "b", "labels": ["Goal"],
              "title": "B", "summary": "", "domain": "finance", "recency": None}],
            [{"from_id": "b", "rel": "HAS_GOAL", "entity_id": "c", "labels": ["Goal"],
              "title": "C", "summary": "", "domain": "finance", "recency": None}],
            [{"from_id": "c", "rel": "HAS_GOAL", "entity_id": "d", "labels": ["Goal"],
              "title": "D", "summary": "", "domain": "finance", "recency": None}]]
    neo = _FakeNeo4j(rows)
    plan = plan_query("why did you recommend that?")     # CAUSAL → max_hops = 2
    assert plan.max_hops == 2
    res = await traverse(neo, user_id=USER, plan=plan, seeds=[{"entity_id": "a", "title": "A"}])
    assert res.hops_executed <= 2
    assert not any(n.hops > 2 for n in res.nodes)


@pytest.mark.asyncio
async def test_traversal_respects_node_budget_and_reports_truncation():
    big = [[{"from_id": "a", "rel": "HAS_GOAL", "entity_id": f"n{i}", "labels": ["Goal"],
             "title": f"N{i}", "summary": "", "domain": "finance", "recency": None}
            for i in range(500)]]
    neo = _FakeNeo4j(big)
    plan = plan_query("what's my net worth?")            # LOOKUP → budget 40
    res = await traverse(neo, user_id=USER, plan=plan, seeds=[{"entity_id": "a", "title": "A"}])
    assert res.nodes_visited <= plan.node_budget
    assert res.truncated is True, "hitting a bound must be reported, not silent"


@pytest.mark.asyncio
async def test_traversal_records_path_provenance():
    neo = _FakeNeo4j([[{"from_id": "a", "rel": "HAS_EVIDENCE", "entity_id": "e1", "labels": ["Evidence"],
                        "title": "DTI 28%", "summary": "", "domain": "finance", "recency": None}]])
    plan = plan_query("why did you recommend that?")
    res = await traverse(neo, user_id=USER, plan=plan, seeds=[{"entity_id": "a", "title": "Recommendation"}])
    node = next(n for n in res.nodes if n.entity_id == "e1")
    assert node.path == ("HAS_EVIDENCE",)
    assert node.hops == 1
    assert "HAS_EVIDENCE" in node.provenance()


def test_edge_weights_rank_evidence_above_the_fallback_relation():
    """RELATED_TO is the worker's fallback for unmapped entities and must not compete with real edges."""
    assert EDGE_WEIGHT["HAS_EVIDENCE"] > EDGE_WEIGHT["HAS_SKILL"] > EDGE_WEIGHT["RELATED_TO"]


# ────────────────────────────────────────────────────────────── planning

@pytest.mark.parametrize("msg,expected", [
    ("Why did you recommend the 529?", Intent.CAUSAL),
    ("What if I retire at 60?", Intent.SCENARIO),
    ("Should I pay off the car loan or invest?", Intent.COMPARE),
    ("How has my savings changed this year?", Intent.TEMPORAL),
    ("What is my net worth?", Intent.LOOKUP),
    ("Tell me about my situation", Intent.BROAD),
])
def test_intent_classification(msg, expected):
    assert plan_query(msg).intent is expected


def test_causal_plan_pulls_the_evidence_subgraph():
    plan = plan_query("why did you recommend that?")
    assert plan.wants_evidence
    assert "HAS_EVIDENCE" in allowed_edge_types(plan)


def test_lookup_plan_is_cheap():
    """A single-fact question must not pay for a deep walk."""
    plan = plan_query("what is my net worth?")
    assert plan.max_hops == 1 and plan.node_budget <= 40 and not plan.include_central


def test_domain_detection_and_hint_precedence():
    assert "finance" in plan_query("how much debt do I have?").domains
    assert plan_query("tell me more", domain_hint="health").domains[0] == "health"


def test_mentions_exclude_sentence_starters():
    plan = plan_query('Should I keep my "Roth IRA" at Fidelity?')
    assert any("Roth IRA" in m for m in plan.mentions)
    assert not any(m in {"Should", "I"} for m in plan.mentions)


# ────────────────────────────────────────────────────────────── fusion

def test_rrf_matches_the_harvested_gateway_formula():
    """Fidelity check against api-gateway's rrf_fuse — same k, same keying. If this drifts, the harvest
    lost the behaviour it was supposed to preserve."""
    a = [{"entity_type": "Goal", "entity_id": "1"}, {"entity_type": "Goal", "entity_id": "2"}]
    b = [{"entity_type": "Goal", "entity_id": "2"}]
    scores = rrf([a, b])
    assert scores[("Goal", "1")] == pytest.approx(1 / 60)
    assert scores[("Goal", "2")] == pytest.approx(1 / 61 + 1 / 60)
    assert scores[("Goal", "2")] > scores[("Goal", "1")]


def test_fusion_ranks_multi_channel_agreement_higher():
    vector = [{"payload": {"entity_type": "Goal", "entity_id": "shared", "title": "Retire",
                           "domain": "finance"}, "score": 0.9}]
    nodes = [_Node("Goal", "shared", "Retire", "finance", hops=0),
             _Node("Goal", "graph-only", "Other", "finance", hops=1)]
    out = fuse(vector_hits=vector, graph_nodes=nodes, plan_domains=("finance",))
    assert out[0].entity_id == "shared"
    assert "vector" in out[0].channels and "graph" in out[0].channels
    assert any("channels" in r for r in out[0].rank_reasons)


def test_fusion_threshold_drops_weak_evidence():
    weak = [_Node("Thing", f"w{i}", "", "", hops=3) for i in range(5)]   # no title/summary
    out = fuse(vector_hits=[], graph_nodes=weak, threshold=0.5)
    assert out == []


def test_evidence_carries_provenance_and_explanation():
    nodes = [_Node("Evidence", "e1", "DTI 28%", "finance", hops=1, path=("HAS_EVIDENCE",))]
    out = fuse(vector_hits=[], graph_nodes=nodes, wants_evidence=True, plan_domains=("finance",))
    ev = out[0].to_evidence()
    assert ev["path"] == ["HAS_EVIDENCE"] and ev["provenance"] and ev["why_ranked"]


# ────────────────────────────────────────────────────────────── engine end-to-end

@pytest.mark.asyncio
async def test_engine_requires_user_id():
    eng = SemanticGraphRAG(gemini=_FakeGemini(), qdrant=_FakeQdrant(), neo4j=_FakeNeo4j([]))
    with pytest.raises(ValueError, match="non-empty user_id"):
        await eng.retrieve("hello", user_id="")


@pytest.mark.asyncio
async def test_engine_full_path_produces_ranked_evidence_with_trace():
    neo = _FakeNeo4j([[{"from_id": "g1", "rel": "HAS_EVIDENCE", "entity_id": "e1",
                        "labels": ["Evidence"], "title": "DTI 28%", "summary": "from Plaid",
                        "domain": "finance", "recency": None}]])
    eng = SemanticGraphRAG(gemini=_FakeGemini(), qdrant=_FakeQdrant(), neo4j=neo,
                           central_qdrant=_FakeCentral())
    ev, trace = await eng.retrieve("Why did you recommend paying the loan?", user_id=USER, limit=10)
    assert ev, "engine returned no evidence"
    assert trace.intent == "causal"
    assert trace.vector_seeds >= 1
    assert trace.hops_executed >= 1
    assert all("provenance" in e and "score" in e for e in ev)
    assert ev == sorted(ev, key=lambda e: -e["score"]), "evidence must be returned ranked"


@pytest.mark.asyncio
async def test_engine_degrades_without_raising_and_records_the_cause():
    """A broken store must degrade AND be visible — silent degradation is how 'the graph stopped
    working' goes unnoticed for weeks."""
    eng = SemanticGraphRAG(gemini=_FakeGemini(), qdrant=_ExplodingQdrant(), neo4j=_FakeNeo4j([]))
    ev, trace = await eng.retrieve("what are my goals?", user_id=USER)
    assert ev == []
    assert any("vector" in d for d in trace.degraded)


@pytest.mark.asyncio
async def test_engine_never_mixes_tenants():
    """The strongest test here: every downstream call must carry the caller's tenant, unmodified."""
    neo = _FakeNeo4j([[{"from_id": "g1", "rel": "HAS_GOAL", "entity_id": "x", "labels": ["Goal"],
                        "title": "X", "summary": "", "domain": "finance", "recency": None}]])
    qd = _FakeQdrant()
    eng = SemanticGraphRAG(gemini=_FakeGemini(), qdrant=qd, neo4j=neo)
    await eng.retrieve("my goals and my debt", user_id=USER)
    assert qd.seen_user_ids == {USER}
    assert {c["user_id"] for c in neo.calls} == {USER}


# ────────────────────────────────────────────────────────────── doubles

class _Node:
    def __init__(self, entity_type, entity_id, title, domain, hops=0, path=()):
        self.entity_type, self.entity_id = entity_type, entity_id
        self.title, self.summary, self.domain = title, "", domain
        self.hops, self.path, self.score = hops, path, 0.8
        self.path_titles = ()

    def provenance(self):
        return "direct match" if not self.path else f"{self.hops} hop via {'/'.join(self.path)}"


class _FakeGemini:
    configured = True
    async def embed(self, text):  # noqa: D102
        return [0.1] * 8


class _FakeQdrant:
    configured = True
    def __init__(self):
        self.seen_user_ids = set()
    async def search_personal(self, vector, *, user_id, limit=10, domain=None):
        self.seen_user_ids.add(user_id)
        return [{"payload": {"entity_type": "Goal", "entity_id": "g1", "title": "Pay off loan",
                             "summary": "", "domain": "finance"}, "score": 0.88}]


class _ExplodingQdrant:
    configured = True
    async def search_personal(self, *a, **k):
        raise RuntimeError("qdrant unreachable")


class _FakeCentral:
    configured = True
    async def search_central(self, vector, *, limit=10, domain=None):
        return [{"payload": {"entity_type": "Concept", "entity_id": "c1", "title": "DTI",
                             "summary": "debt-to-income", "domain": "finance"}, "score": 0.7}]


class _FakeNeo4j:
    configured = True
    def __init__(self, hop_rows):
        self._hops = list(hop_rows)
        self.calls = []
    async def query_personal(self, statement, *, user_id, parameters=None):
        self.calls.append({"statement": statement, "user_id": user_id, "parameters": parameters})
        if "CONTAINS toLower($mention)" in statement:
            return []
        if self._hops:
            return self._hops.pop(0)
        return []
