"""MCP structured ingestion — schema enforcement, provenance, idempotency, tenant isolation."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.ingestion import IngestionService, TOOL_REGISTRY
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
PROV = {"submitted_by": "arcana-discovery", "source_type": "user_message", "conversation_id": "c1"}


def _svc():
    sb = FakeSupabase({})
    return IngestionService(sb), sb


@pytest.mark.asyncio
async def test_valid_fact_write_persists_with_provenance():
    svc, sb = _svc()
    out = await svc.submit_life_fact(CTX, {"fact_type": "employer", "value": "NVIDIA",
                                           "domain": "career", "confidence": 0.9,
                                           "confirmation_status": "confirmed", "provenance": PROV})
    assert out["ok"] and out["table"] == "life.facts"
    row = sb._by_table["facts"][0]
    assert row["user_id"] == CTX.user_id and row["value"] == "NVIDIA"
    assert row["confirmation_status"] == "confirmed"
    assert row["provenance"]["submitted_by"] == "arcana-discovery"
    assert row["source"] == "user_message"


@pytest.mark.asyncio
async def test_invalid_schema_rejected_no_partial_write():
    svc, sb = _svc()
    # confidence out of range + bad domain enum + missing required value
    out = await svc.submit_life_fact(CTX, {"fact_type": "x", "confidence": 2.0, "domain": "spaceship",
                                           "provenance": PROV})
    assert out["ok"] is False and out["code"] == "schema_validation"
    assert sb.inserts == []                       # NOTHING written on rejection


@pytest.mark.asyncio
async def test_provenance_is_required():
    svc, sb = _svc()
    out = await svc.submit_risk(CTX, {"label": "Overcommitment", "domain": "career"})  # no provenance
    assert out["ok"] is False and out["code"] == "schema_validation"
    assert any("provenance" in e["field"] for e in out["errors"])
    assert sb.inserts == []


@pytest.mark.asyncio
async def test_duplicate_submission_is_idempotent():
    svc, sb = _svc()
    body = {"goal_title": "Buy a house", "domain": "family", "provenance": PROV}
    a = await svc.submit_goal(CTX, body)
    b = await svc.submit_goal(CTX, dict(body))     # same goal again
    assert a["id"] == b["id"]                       # deterministic id
    assert len(sb._by_table["candidate_goals"]) == 1   # no duplicate row


@pytest.mark.asyncio
async def test_candidate_is_not_promoted_to_confirmed():
    svc, sb = _svc()
    await svc.submit_goal(CTX, {"goal_title": "Run a marathon", "domain": "health",
                                "confirmation_status": "inferred", "provenance": PROV})
    row = sb._by_table["candidate_goals"][0]
    assert row["confirmation_status"] == "inferred"
    assert row["status"] == "active"               # NOT 'confirmed'


@pytest.mark.asyncio
async def test_confirmed_goal_marked_confirmed():
    svc, sb = _svc()
    await svc.submit_goal(CTX, {"goal_title": "Pay off debt", "confirmation_status": "confirmed",
                                "provenance": PROV})
    assert sb._by_table["candidate_goals"][0]["status"] == "confirmed"


@pytest.mark.asyncio
async def test_tenant_isolation_user_id_from_context_not_payload():
    svc, sb = _svc()
    # a malicious payload tries to set a different user_id — it must be ignored (model has no such field).
    await svc.submit_opportunity(CTX, {"label": "Promotion accelerates housing", "domain": "career",
                                       "user_id": "99999999-9999-9999-9999-999999999999", "provenance": PROV})
    row = sb._by_table["opportunities"][0]
    assert row["user_id"] == CTX.user_id and row["tenant_id"] == CTX.user_id


@pytest.mark.asyncio
async def test_relationship_rejects_self_edge():
    svc, sb = _svc()
    out = await svc.submit_relationship(CTX, {"from_ref": "Goal A", "to_ref": "Goal A",
                                              "relation_type": "supports", "provenance": PROV})
    assert out["ok"] is False and sb.inserts == []


@pytest.mark.asyncio
async def test_narrative_stored_as_candidate_fact_not_overwriting_derived():
    svc, sb = _svc()
    out = await svc.submit_narrative(CTX, {"narrative_key": "family_foundation",
                                           "summary": "building a family", "provenance": PROV})
    assert out["ok"] and out["table"] == "life.facts"
    row = sb._by_table["facts"][0]
    assert row["fact_type"] == "dominant_narrative" and row["value"] == "family_foundation"


@pytest.mark.asyncio
async def test_every_tool_validates_provenance():
    """Every registered tool must reject a payload missing provenance (no unguarded write path)."""
    svc, sb = _svc()
    minimal = {"submit_life_fact": {"fact_type": "a", "value": "b"}, "submit_goal": {"goal_title": "g"},
               "submit_constraint": {"label": "l"}, "submit_risk": {"label": "l"},
               "submit_opportunity": {"label": "l"}, "submit_narrative": {"narrative_key": "exploring"},
               "submit_relationship": {"from_ref": "a", "to_ref": "b", "relation_type": "supports"}}
    for tool in TOOL_REGISTRY:
        out = await getattr(svc, tool)(CTX, minimal[tool])  # no provenance
        assert out["ok"] is False, f"{tool} accepted a write without provenance"
    assert sb.inserts == []
