"""Phase 6 — chat retrieval of the recommendation evidence subgraph."""

import pytest

from app.grounding.retriever import Retriever
from app.models.common import UserContext

CTX = UserContext(user_id="u-1")


class _FakeNeo4j:
    def __init__(self, rows, *, configured=True) -> None:
        self.configured = configured
        self._rows = rows
        self.calls: list = []

    async def query_personal(self, statement, *, user_id, parameters=None):
        self.calls.append((statement, user_id, parameters))
        return self._rows


class _Off:
    configured = False


def _retriever(neo4j):
    return Retriever(gemini=_Off(), qdrant=_Off(), neo4j=neo4j)


@pytest.mark.asyncio
async def test_recommendation_evidence_maps_subgraph_to_facts():
    rows = [
        [
            "Close your emergency fund gap",
            [["cash", 500.0, "finance.financial_accounts", 1.0], ["gap", 16919.68, "derived", 0.7]],
            ["monthly expense estimate remains stable"],
            ["Not individualized investment advice"],
        ]
    ]
    neo = _FakeNeo4j(rows)
    facts = await _retriever(neo).recommendation_evidence(CTX)
    joined = " ".join(f"{f['fact']} {f['value']}" for f in facts)
    assert "evidence: cash" in joined and "500.0" in joined
    assert "finance.financial_accounts" in joined  # provenance points at the fact
    assert "assumption" in joined and "expense estimate" in joined
    assert "governance" in joined and "investment advice" in joined
    # tenant-scoped: the query is bound to the caller's id
    assert neo.calls[0][1] == "u-1"


@pytest.mark.asyncio
async def test_no_recommendation_yields_no_evidence_facts():
    facts = await _retriever(_FakeNeo4j([])).recommendation_evidence(CTX)
    assert facts == []  # -> chat hits the missing-data path, never invents rationale


@pytest.mark.asyncio
async def test_evidence_retrieval_safe_when_neo4j_down():
    facts = await _retriever(_Off()).recommendation_evidence(CTX)
    assert facts == []
