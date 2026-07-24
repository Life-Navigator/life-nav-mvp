"""Elite integration: the GraphRAG read path (WS-E). Mocks the store boundaries (Gemini embed, Qdrant
vector search, Neo4j graph query) and verifies the Retriever fuses vector + graph evidence, scopes BOTH
stores to the turn's domain, and degrades to empty (never raises) when unconfigured."""
import pytest
from app.grounding.retriever import Retriever
from app.models.common import UserContext


def _ctx():
    return UserContext(user_id="u1", email="u1@example.com")


class _Gem:
    configured = True
    async def embed(self, text):
        return [0.1] * 8


class _Qdrant:
    configured = True
    def __init__(self):
        self.calls = []
    async def search_personal(self, vector, *, user_id, limit, domain=None):
        self.calls.append({"user_id": user_id, "limit": limit, "domain": domain})
        return [{"payload": {"entity_type": "goal", "entity_id": "g1", "title": "Masters degree"}, "score": 0.9}]


class _Neo4j:
    configured = True
    def __init__(self):
        self.calls = []
    async def query_personal(self, cypher, *, user_id, parameters=None):
        self.calls.append({"cypher": cypher, "user_id": user_id, "params": parameters or {}})
        # labels, entity_id, title, summary, domain — the WS-E domain-scoped RETURN shape
        return [[["EducationGoal"], "e1", "Finish MBA", "The user wants to finish an MBA", "education"]]


@pytest.mark.asyncio
async def test_retriever_fuses_vector_and_graph_scoped_by_domain():
    q, n = _Qdrant(), _Neo4j()
    r = Retriever(gemini=_Gem(), qdrant=q, neo4j=n)
    ev = await r.retrieve_personal("should I go back to school?", _ctx(), domain="education", limit=5)

    vec = [e for e in ev if e["source"] == "qdrant"]
    graph = [e for e in ev if e["source"] == "neo4j"]
    assert vec and vec[0]["title"] == "Masters degree"
    assert graph and graph[0]["title"] == "Finish MBA"
    assert graph[0]["summary"] and graph[0]["domain"] == "education"
    assert graph[0]["label"] == "EducationGoal"        # first label, not the raw list
    # domain scoping propagated to BOTH stores + the domain-scoped Cypher (not a blind node dump)
    assert q.calls[0]["domain"] == "education"
    assert n.calls[0]["params"]["domain"] == "education"
    assert "n.domain = $domain" in n.calls[0]["cypher"]
    assert n.calls[0]["user_id"] == "u1"               # tenant-scoped


@pytest.mark.asyncio
async def test_retriever_degrades_to_empty_when_stores_unconfigured():
    class Off:
        configured = False
    r = Retriever(gemini=Off(), qdrant=Off(), neo4j=Off())
    assert await r.retrieve_personal("anything", _ctx(), domain="finance") == []


@pytest.mark.asyncio
async def test_retriever_never_raises_on_store_error():
    class Boom:
        configured = True
        async def embed(self, text):
            raise RuntimeError("gemini down")
        async def search_personal(self, *a, **k):
            raise RuntimeError("qdrant down")
        async def query_personal(self, *a, **k):
            raise RuntimeError("neo4j down")
    r = Retriever(gemini=Boom(), qdrant=Boom(), neo4j=Boom())
    assert await r.retrieve_personal("x", _ctx()) == []   # degrades, never raises into the turn
