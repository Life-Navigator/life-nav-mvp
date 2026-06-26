"""My Life / North Star must never leak internal-model labels (peak_earning, classifier reasoning, snake_case)."""
import pytest
from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
async def test_snapshot_prefers_north_star_and_suppresses_leakage():
    sb = FakeSupabase({})
    await sb.upsert("life_vision", {
        "user_id": CTX.user_id,
        "vision_text": "Build security and progress through peak_earning.",
        "prompts": {"north_star": "Build a strong foundation before marriage.",
                    "main_priority": "Financial security"}}, schema="life")
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    assert snap["life_vision"] == "Build a strong foundation before marriage."
    assert "peak_earning" not in str(snap.get("life_vision"))
    assert snap["north_star"] == "Build a strong foundation before marriage."
    po = snap.get("primary_objective") or {}
    assert po.get("title") == "Build a strong foundation before marriage."
    assert "_" not in str(po.get("title"))
    assert "treated as motivation" not in str(po.get("reasoning") or "")


@pytest.mark.asyncio
async def test_snapshot_drops_persona_bridge_vision_when_no_north_star():
    sb = FakeSupabase({})
    await sb.upsert("life_vision", {"user_id": CTX.user_id,
                                    "vision_text": "Build security and progress through peak_earning.",
                                    "prompts": {"source": "persona_bridge"}}, schema="life")
    snap = await LifeDiscoveryService(sb).snapshot(CTX)
    assert snap.get("life_vision") is None  # internal/persona vision suppressed, not shown as a north star
    assert snap.get("vision_authored") is False
