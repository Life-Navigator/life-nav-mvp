"""Personal-retrieval filter contract.

Two invariants:

  1. Qdrant personal search MUST filter by ``tenant_id`` AND ``user_id``
     equal to the authenticated user. ``build_personal_filter`` is the
     single source of truth; calling it with an empty user_id raises.

  2. Neo4j personal-graph reads MUST reference ``$tenant_id``. The
     client's helper refuses to run a Cypher statement that doesn't.
"""
from __future__ import annotations

import pytest

from app.services.neo4j_client import Neo4jClient
from app.services.qdrant import build_personal_filter


# --- Qdrant filter ------------------------------------------------------


def test_qdrant_personal_filter_carries_tenant_and_user_id():
    flt = build_personal_filter("user-a")
    must = flt["must"]
    keys = {clause["key"]: clause["match"]["value"] for clause in must if "match" in clause}
    assert keys["tenant_id"] == "user-a"
    assert keys["user_id"] == "user-a"
    assert keys["access_scope"] == "personal"


def test_qdrant_personal_filter_supports_domain_scope():
    flt = build_personal_filter("user-a", domain="financial")
    domains = [c["match"]["value"] for c in flt["must"] if c["key"] == "domain"]
    assert domains == ["financial"]


def test_qdrant_personal_filter_refuses_empty_user_id():
    with pytest.raises(ValueError):
        build_personal_filter("")
    with pytest.raises(ValueError):
        build_personal_filter(None)  # type: ignore[arg-type]


def test_two_users_produce_distinct_qdrant_filters():
    a = build_personal_filter("user-a")
    b = build_personal_filter("user-b")
    assert a != b
    a_tenant = next(c["match"]["value"] for c in a["must"] if c["key"] == "tenant_id")
    b_tenant = next(c["match"]["value"] for c in b["must"] if c["key"] == "tenant_id")
    assert a_tenant != b_tenant


# --- Neo4j personal params + cypher guard -------------------------------


def _neo4j() -> Neo4jClient:
    return Neo4jClient(
        base_url="https://neo4j.local",
        username="neo4j",
        password="x",
        personal_database="neo4j",
        central_database="central",
    )


def test_neo4j_personal_params_bind_tenant_to_authenticated_user():
    n = _neo4j()
    params = n.build_personal_params("user-a", extra={"limit": 10})
    assert params["tenant_id"] == "user-a"
    assert params["limit"] == 10


def test_neo4j_personal_params_refuse_tenant_override_in_extra():
    n = _neo4j()
    with pytest.raises(ValueError):
        n.build_personal_params("user-a", extra={"tenant_id": "ATTACKER"})


def test_neo4j_personal_params_refuse_empty_user_id():
    n = _neo4j()
    with pytest.raises(ValueError):
        n.build_personal_params("")


def test_neo4j_cypher_filter_helper():
    assert Neo4jClient.cypher_filters_personal("MATCH (n) WHERE n.tenant_id = $tenant_id RETURN n")
    assert not Neo4jClient.cypher_filters_personal("MATCH (n) RETURN n")


@pytest.mark.asyncio
async def test_neo4j_run_personal_refuses_cypher_without_tenant_filter():
    n = _neo4j()
    with pytest.raises(ValueError):
        await n.run_personal(user_id="user-a", cypher="MATCH (n) RETURN n LIMIT 1")
