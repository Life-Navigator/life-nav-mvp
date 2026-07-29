"""The Neo4j row-shape contract, pinned against a realistic Aura Query API v2 payload.

WHY THIS FILE EXISTS
--------------------
A defect shipped because every Neo4j test used a fake that returned dict rows, while the real client
returned the Query API's POSITIONAL rows (`data.values`). The semantic engine's traversal read those rows
by name. Under test it passed; against a live database every `row.get(...)` raised `AttributeError`, the
hop-level handler caught it, and graph traversal silently degraded to "seeds only" — a failure shaped
exactly like a sparse user graph.

No test in the suite touched the client's actual response parsing, so nothing could have caught it. These
tests do, by driving `Neo4jClient` against a mocked HTTP response in the API's real envelope. If the
mapping regresses, or if a caller picks the wrong method, this fails.
"""
from __future__ import annotations

import httpx
import pytest
import respx

from app.clients.neo4j import Neo4jClient

QUERY_URL = "https://test.databases.neo4j.io/db/neo4j/query/v2"


def _client() -> Neo4jClient:
    return Neo4jClient(uri="neo4j+s://test.databases.neo4j.io", username="neo4j",
                       password="pw", database="neo4j", timeout=2.0)


# The envelope Aura actually returns: named columns in `fields`, positional rows in `values`.
AURA_PAYLOAD = {
    "data": {
        "fields": ["from_id", "rel", "entity_id", "labels", "title", "summary", "domain", "recency"],
        "values": [
            ["seed-1", "HAS_GOAL", "e-2", ["Goal"], "Retire at 60", "target", "finance", "2026-07-01"],
            ["seed-1", "HAS_DEBT", "e-3", ["Debt"], "Car loan", "auto", "finance", "2026-06-01"],
        ],
    }
}

STATEMENT = "MATCH (n {tenant_id: $user_id}) RETURN n.entity_id AS entity_id"


@pytest.mark.asyncio
@respx.mock
async def test_query_personal_returns_positional_rows():
    """The legacy retriever indexes by integer — that contract must not silently change."""
    respx.post(QUERY_URL).mock(return_value=httpx.Response(200, json=AURA_PAYLOAD))
    rows = await _client().query_personal(STATEMENT, user_id="u1")
    assert rows and isinstance(rows[0], list)
    assert rows[0][2] == "e-2"


@pytest.mark.asyncio
@respx.mock
async def test_query_personal_dicts_binds_field_names():
    """The semantic engine reads by name — the mapping must come from the API's own `fields`."""
    respx.post(QUERY_URL).mock(return_value=httpx.Response(200, json=AURA_PAYLOAD))
    rows = await _client().query_personal_dicts(STATEMENT, user_id="u1")
    assert rows and isinstance(rows[0], dict)
    assert rows[0]["from_id"] == "seed-1"
    assert rows[0]["rel"] == "HAS_GOAL"
    assert rows[0]["entity_id"] == "e-2"
    assert rows[0]["labels"] == ["Goal"]
    assert rows[1]["title"] == "Car loan"


@pytest.mark.asyncio
@respx.mock
async def test_dict_rows_are_what_traversal_reads():
    """THE REGRESSION GUARD.

    This is the exact access pattern `traversal.traverse` uses. Run against `query_personal` it raises
    `AttributeError` — which is precisely what happened in production. Asserting both halves keeps the
    two methods from being confused for one another again.
    """
    respx.post(QUERY_URL).mock(return_value=httpx.Response(200, json=AURA_PAYLOAD))
    client = _client()

    named = await client.query_personal_dicts(STATEMENT, user_id="u1")
    assert [r.get("entity_id") for r in named] == ["e-2", "e-3"]

    positional = await client.query_personal(STATEMENT, user_id="u1")
    with pytest.raises(AttributeError):
        positional[0].get("entity_id")


@pytest.mark.asyncio
@respx.mock
async def test_field_value_length_mismatch_does_not_raise():
    """A short row pads with None rather than throwing — retrieval degrades, never breaks the turn."""
    respx.post(QUERY_URL).mock(return_value=httpx.Response(200, json={
        "data": {"fields": ["a", "b", "c"], "values": [["x"]]}
    }))
    rows = await _client().query_personal_dicts(STATEMENT, user_id="u1")
    assert rows == [{"a": "x", "b": None, "c": None}]


@pytest.mark.asyncio
@respx.mock
async def test_dicts_path_enforces_tenant_like_the_positional_path():
    """Tenant enforcement must not be weaker on the newer method — it is the one traversal uses."""
    respx.post(QUERY_URL).mock(return_value=httpx.Response(200, json=AURA_PAYLOAD))
    client = _client()

    with pytest.raises(ValueError):                      # untenanted statement
        await client.query_personal_dicts("MATCH (n) RETURN n", user_id="u1")
    with pytest.raises(ValueError):                      # empty tenant
        await client.query_personal_dicts(STATEMENT, user_id="")
    with pytest.raises(ValueError):                      # tenant override attempt
        await client.query_personal_dicts(STATEMENT, user_id="u1",
                                          parameters={"user_id": "victim"})


@pytest.mark.asyncio
@respx.mock
async def test_transport_failure_degrades_to_empty_on_both_methods():
    respx.post(QUERY_URL).mock(return_value=httpx.Response(500, json={}))
    client = _client()
    assert await client.query_personal_dicts(STATEMENT, user_id="u1") == []
    assert await client.query_personal(STATEMENT, user_id="u1") == []
