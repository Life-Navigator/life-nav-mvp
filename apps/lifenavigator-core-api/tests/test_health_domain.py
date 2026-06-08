"""Phase 4/6/8 — HealthService summary shape, missing prompts, sleep recommendation."""

import pytest

from app.domains.health import HealthService, _rec_id
from app.models.common import DomainViewModel, UserContext

from .conftest import FakeSupabase

CTX = UserContext(user_id="u-h1")
SLEEP_LOW = [
    {"id": "s1", "night_of": "2026-06-07", "total_hours": 5.6},
    {"id": "s2", "night_of": "2026-06-06", "total_hours": 5.8},
]
SLEEP_GOOD = [{"id": "s", "night_of": "2026-06-07", "total_hours": 8.0}]


def _svc(tables: dict) -> HealthService:
    return HealthService(supabase=FakeSupabase(tables))


@pytest.mark.asyncio
async def test_summary_missing_when_no_data_no_fake_zero():
    vm = await _svc({}).summary(CTX)
    assert isinstance(vm, DomainViewModel)
    assert vm.domain == "health"
    assert vm.data["avg_sleep_hours"] is None  # absent -> null, never fake 0
    assert "sleep_logs" in vm.missing
    assert vm.data["safety_boundaries"][0]["boundary_type"] == "medical"


@pytest.mark.asyncio
async def test_summary_with_sleep_data_and_recommendation():
    vm = await _svc({"sleep_logs": SLEEP_LOW}).summary(CTX)
    assert vm.data["avg_sleep_hours"] == 5.7
    assert vm.recommendations  # improve_sleep fires below target


@pytest.mark.asyncio
async def test_no_sleep_data_no_recommendation():
    assert await _svc({}).persist_recommendations(CTX) == []
    assert await _svc({}).recommendations(CTX) == []


@pytest.mark.asyncio
async def test_good_sleep_no_recommendation():
    assert await _svc({"sleep_logs": SLEEP_GOOD}).persist_recommendations(CTX) == []


@pytest.mark.asyncio
async def test_sleep_recommendation_persists_with_evidence_and_medical_boundary():
    persisted = await _svc({"sleep_logs": SLEEP_LOW}).persist_recommendations(CTX)
    assert len(persisted) == 1
    row = persisted[0]
    assert row["recommendation_type"] == "improve_sleep"
    assert row["user_id"] == "u-h1" and row["tenant_id"] == "u-h1"
    metrics = {e["metric_name"] for e in row["evidence_json"]}
    assert {"avg_sleep_hours", "target_sleep_hours", "nights_logged"} <= metrics
    assert row["assumptions_json"]
    assert row["governance_verdict"]["boundary_type"] == "medical"
    assert "not medical advice" in row["governance_verdict"]["disclaimer_text"].lower()


@pytest.mark.asyncio
async def test_persist_is_idempotent_deterministic_id():
    svc = _svc({"sleep_logs": SLEEP_LOW})
    a = await svc.persist_recommendations(CTX)
    b = await svc.persist_recommendations(CTX)
    assert a[0]["id"] == b[0]["id"] == _rec_id("u-h1", "improve-sleep-consistency")


@pytest.mark.asyncio
async def test_list_view_missing_when_empty():
    vm = await _svc({}).list_view(CTX, "vitals", "vitals")
    assert vm.data["vitals"] == []
    assert "vitals" in vm.missing
