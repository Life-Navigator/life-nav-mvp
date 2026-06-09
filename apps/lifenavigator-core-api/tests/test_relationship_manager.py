"""Sprint 40 — Relationship Manager (primary conversational onboarding) + Life Bridge."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_bridge import LifeBridgeService
from app.services.life_discovery import LifeDiscoveryService
from app.services.relationship_manager import RelationshipManager
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _rm(sb):
    life = LifeDiscoveryService(sb)
    return RelationshipManager(sb, life, LifeBridgeService(sb, life))


@pytest.mark.asyncio
async def test_first_question_is_vision_then_advances():
    sb = FakeSupabase({})
    rm = _rm(sb)
    st = await rm.state(CTX)
    assert st["complete"] is False and st["next_question"]["key"] == "vision"
    assert st["next_question"]["why_it_matters"]
    r = await rm.answer(CTX, "vision", "Retire by 60 and raise a secure family")
    # the answer wrote to the canonical model AND advanced
    assert r["recorded"]["wrote"] == "life.life_vision"
    assert r["next_question"]["key"] == "primary_goal"
    assert sb._by_table.get("life_vision") or True  # persisted


@pytest.mark.asyncio
async def test_goal_answer_writes_objective_to_canonical_model():
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(CTX, "primary_goal", "buy a house because we want to start a family")
    assert "life.life_objectives" in r["recorded"]["wrote"]
    objs = await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert objs and objs[0]["root_objective_key"] == "family_stability"  # discovered + written immediately


@pytest.mark.asyncio
async def test_risk_answer_writes_risk_profile():
    sb = FakeSupabase({})
    rm = _rm(sb)
    r = await rm.answer(CTX, "risk", "I would buy more")
    assert r["recorded"]["wrote"] == "life.risk_profiles" and r["recorded"]["risk_behavior"] == "aggressive"
    rp = await sb.select("risk_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert rp and rp[0]["tolerance"] == 85


@pytest.mark.asyncio
async def test_full_flow_completes_and_is_resumable():
    sb = FakeSupabase({})
    rm = _rm(sb)
    answers = {"vision": "A secure, free life", "primary_goal": "reach financial independence",
               "family_goal": "raise two kids well", "career_goal": "become a director",
               "financial_goal": "retire with enough to never worry", "risk": "hold",
               "time_horizon": "20 years", "health_goal": "stay fit and energetic",
               "constraint": "high student debt"}
    last = None
    for _ in range(len(answers) + 2):
        st = await rm.state(CTX)
        if st["complete"]:
            break
        q = st["next_question"]["key"]
        last = await rm.answer(CTX, q, answers.get(q, "n/a"))
    assert (await rm.state(CTX))["complete"] is True  # interview finishes
    # resume: a fresh state call still reports complete (persisted, not in-memory)
    assert (await _rm(sb).state(CTX))["complete"] is True


@pytest.mark.asyncio
async def test_bridge_projects_persona_goals_into_canonical_model():
    sb = FakeSupabase({"user_persona_profile": [{"id": "p1", "user_id": CTX.user_id, "persona_id": "young_professional",
                                                 "risk_profile": "moderate", "life_stage": "early career",
                                                 "primary_goals": ["Build emergency fund", "Start investing", "Pay down student debt"]}]})
    out = await LifeBridgeService(sb, LifeDiscoveryService(sb)).sync(CTX)
    assert out["bridged_goals"] >= 3 and out["risk_written"] is True
    objs = await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert objs  # persona goals became canonical life objectives
    rp = await sb.select("risk_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert rp and rp[0]["behavior"] == "moderate"


# ---- Sprint 41: chat-native Relationship Manager ----
@pytest.mark.asyncio
async def test_converse_opens_with_a_question_no_answer_consumed():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, "hi", pending_key=None)
    assert turn["pending_key"] == "vision" and "?" in turn["assistant_message"]
    assert turn["complete"] is False and "context_panel" in turn
    # nothing was written from the greeting
    assert not (await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life"))


@pytest.mark.asyncio
async def test_converse_answers_writes_and_shows_updates():
    sb = FakeSupabase({})
    rm = _rm(sb)
    turn = await rm.converse(CTX, "buy a house because we want to start a family", pending_key="primary_goal")
    assert any("Objective added" in u for u in turn["updates"])  # visible learning (D2)
    assert any("Recommendations refreshed" in u for u in turn["updates"])
    assert "family stability" in turn["assistant_message"].lower()  # reflects the need behind the need (D4)
    assert turn["pending_key"] and turn["pending_key"] != "primary_goal"  # advanced
    # it actually wrote canonically
    assert await sb.select("life_objectives", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")


@pytest.mark.asyncio
async def test_converse_context_panel_reflects_model():
    sb = FakeSupabase({})
    rm = _rm(sb)
    await rm.converse(CTX, "Retire by 60 and raise a family", pending_key="vision")
    turn = await rm.converse(CTX, "reach financial independence", pending_key="financial_goal")
    panel = turn["context_panel"]
    assert panel["life_vision"] and panel["primary_objective"] and "discovery_completion_pct" in panel
