"""Canonical goal read-path join — dedup, source priority, candidate protection, clustering, empty state."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.canonical_goals import CanonicalGoalsService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
LIFE = "life"


class _StubLife:
    def __init__(self, snap): self._snap = snap
    async def snapshot(self, ctx): return self._snap


class _StubSB:
    """Schema-aware stub (unlike FakeSupabase) so life.goals vs public.goals stay distinct."""
    def __init__(self, by_key=None): self._d = by_key or {}
    async def select(self, table, *, filters=None, schema="public", **_):
        return list(self._d.get((schema, table), []))


def _svc(snap, sb_data=None):
    return CanonicalGoalsService(_StubLife(snap), _StubSB(sb_data or {}))


def _obj(title, *, confirmed=True, origin="user", conf=0.8, oid="o1"):
    return {"id": oid, "title": title, "surface_goal": title, "confirmed": confirmed, "origin": origin,
            "confidence": conf, "themes": [], "root": "core"}


@pytest.mark.asyncio
async def test_confirmed_beats_candidate_and_no_duplicate():
    # same goal as a confirmed objective AND a candidate-portfolio entry → ONE goal, confirmed.
    snap = {"objectives": [_obj("Buy a house", confirmed=True)],
            "goal_portfolio": [{"goal": "buy a house", "domain": "family", "status": "candidate", "confidence": 0.5}]}
    goals = await _svc(snap).canonical_goals(CTX)
    assert len(goals) == 1                                  # candidate did NOT duplicate the confirmed goal
    assert goals[0]["confirmation_status"] == "confirmed"
    assert goals[0]["provenance"]["is_duplicate_merge"] is True
    assert set(goals[0]["provenance"]["merged_from"]) == {"life.life_objectives", "life.candidate_goals"}


@pytest.mark.asyncio
async def test_public_goal_progress_merges_into_confirmed_goal_no_dup():
    snap = {"objectives": [_obj("Pay off debt", confirmed=True)], "goal_portfolio": []}
    sb = {("public", "goals"): [{"id": "p1", "title": "Pay off debt", "progress_percent": 40, "status": "active"}]}
    goals = await _svc(snap, sb).canonical_goals(CTX)
    assert len(goals) == 1                                  # public goal did not duplicate the life objective
    assert goals[0]["progress"] == 40                       # quantitative progress attached from public.goals
    assert goals[0]["confirmation_status"] == "confirmed"


@pytest.mark.asyncio
async def test_persona_goal_never_overrides_user_goal():
    snap = {"objectives": [_obj("Reach financial independence", confirmed=False, origin="persona_bridge", oid="p"),
                           _obj("Start a family", confirmed=True, oid="u")],
            "goal_portfolio": []}
    goals = await _svc(snap).canonical_goals(CTX)
    by_title = {g["title"]: g for g in goals}
    assert by_title["Reach financial independence"]["confirmation_status"] == "candidate"  # demoted
    assert by_title["Start a family"]["confirmation_status"] == "confirmed"
    assert goals[0]["title"] == "Start a family"            # confirmed user goal ranks first, persona last


@pytest.mark.asyncio
async def test_related_goals_cluster_without_merging():
    snap = {"objectives": [_obj("Buy a house", oid="a"), _obj("Save for a down payment", oid="b")],
            "goal_portfolio": []}
    goals = await _svc(snap).canonical_goals(CTX)
    assert len(goals) == 2                                  # NOT merged (different titles)
    assert all(g["cluster"] == "home" for g in goals)       # but grouped under one cluster


@pytest.mark.asyncio
async def test_empty_state_is_honest():
    goals = await _svc({"objectives": [], "goal_portfolio": []}).canonical_goals(CTX)
    assert goals == []                                      # no fabricated/backfilled goals


@pytest.mark.asyncio
async def test_dashboard_payload_includes_canonical_goals():
    from app.services.my_life import MyLifeService
    from app.services.life_discovery import LifeDiscoveryService
    from app.services.readiness import LifeReadinessEngine
    from app.services.recommendations_os import RecommendationOS
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Build a secure family")
    await life.discover_goal(CTX, surface_goal="buy a house")
    svc = MyLifeService(life, LifeReadinessEngine(domains={}, education=None, supabase=sb), RecommendationOS(sb), sb)
    out = await svc.my_life(CTX)
    assert "canonical_goals" in out                         # dashboard consumes the canonical view
    goals = await svc.canonical_goals(CTX)
    assert "goals" in goals and goals["source"].startswith("Canonical")


@pytest.mark.asyncio
async def test_empty_state_message_via_service():
    from app.services.my_life import MyLifeService
    from app.services.life_discovery import LifeDiscoveryService
    from app.services.readiness import LifeReadinessEngine
    from app.services.recommendations_os import RecommendationOS
    sb = FakeSupabase({})
    svc = MyLifeService(LifeDiscoveryService(sb), LifeReadinessEngine(domains={}, education=None, supabase=sb),
                        RecommendationOS(sb), sb)
    out = await svc.canonical_goals(CTX)
    assert out["count"] == 0 and out["empty_message"] == "Arcana is still learning your goals."
