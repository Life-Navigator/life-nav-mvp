"""HARDENING: the legacy regex fragment fallback is unreachable for substantive onboarding discovery; a
failed interpreter cannot corrupt persisted goals (returns a safe clarification). (Fallback hardening pass)"""
import json
import pytest
from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from app.services.life_bridge import LifeBridgeService
from app.services.relationship_manager import RelationshipManager
from .conftest import FakeSupabase, FakeInterpreterGemini

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
PARA = ("My goals for this app are to help me set the foundation for my life and keep everything organized. I am "
        "getting married next year and after that we want to start a family. This gives me a year to get my "
        "financial, physical, and career foundation built. I already have my degree so that isn't a priority, "
        "but getting back in shape and building my financial profile is.")
FORBIDDEN = ["this gives me a year to get my financial", "career foundation built", "but getting back in shape",
             "did i capture that correctly", "more about family, or something else"]


def _rm(sb, gem):
    life = LifeDiscoveryService(sb)
    return RelationshipManager(sb, life, LifeBridgeService(sb, life), gemini=gem)


class FailingGem:
    configured = True
    async def generate_with_usage(self, system, user, temperature=None):
        raise RuntimeError("simulated interpreter outage")


class DeprioGem:
    configured = True
    async def generate_with_usage(self, system, user, temperature=None):
        return json.dumps({"goals": [], "deprioritized_domains": ["education"],
                           "synthesis": "I'll mark education as deprioritized since your degree is complete.",
                           "next_question": "What should we focus on first?"}), {}


class CleanGem:
    """Real-LLM stand-in for the reported paragraph: returns COMPLETE goals (no fragments)."""
    configured = True
    async def generate_with_usage(self, system, user, temperature=None):
        return json.dumps({"north_star": "Build a stable foundation before marriage and family.",
                           "goals": [
                               {"goal": "Prepare for marriage next year", "domain": "family", "confidence": 0.9},
                               {"goal": "Build a stronger financial foundation", "domain": "finance", "confidence": 0.9},
                               {"goal": "Get back in shape and improve performance", "domain": "health", "confidence": 0.85},
                               {"goal": "Strengthen career stability and income", "domain": "career", "confidence": 0.8}],
                           "deprioritized_domains": ["education"],
                           "synthesis": "Your north star is preparing to lead a family.",
                           "next_question": "Which pillar needs the most attention first?"}), {}


@pytest.mark.asyncio
async def test_llm_failure_no_fragments_safe_clarification():
    sb = FakeSupabase({})
    out = await _rm(sb, FailingGem()).converse(CTX, PARA, pending_key="vision")
    tr = out["onboarding_trace"]
    assert tr["legacy_fragment_path_used"] is False
    assert tr["interpreter_failed"] is True
    assert tr["response_source"] == "safe_clarification"
    assert tr["persisted_goals_count"] == 0
    assert out["candidate_goals"] == []
    assert "having trouble turning that into a clean plan" in out["assistant_message"].lower()
    # nothing fragment-y persisted
    cands = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert cands == []
    msg = out["assistant_message"].lower()
    assert not any(b in msg for b in FORBIDDEN)


@pytest.mark.asyncio
async def test_known_good_uses_semantic_path_no_fragments():
    sb = FakeSupabase({})
    out = await _rm(sb, CleanGem()).converse(CTX, PARA, pending_key="vision")
    tr = out["onboarding_trace"]
    assert tr["legacy_fragment_path_used"] is False
    assert tr["semantic_path_used"] is True
    assert tr["persisted_goals_count"] >= 3
    goals = [g.get("goal", "").lower() for g in out["candidate_goals"]]
    assert not any(b in g for g in goals for b in FORBIDDEN)
    assert all(len(g.get("goal", "").split()) >= 2 for g in out["candidate_goals"])


@pytest.mark.asyncio
async def test_deprioritization_only_no_fake_goal_no_fragments():
    sb = FakeSupabase({})
    out = await _rm(sb, DeprioGem()).converse(CTX, "I already have my degree, so education is not a priority.", pending_key="vision")
    tr = out["onboarding_trace"]
    assert tr["legacy_fragment_path_used"] is False
    # no fake education goal created
    assert all("education" not in g.get("goal", "").lower() for g in out["candidate_goals"])
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert "education" in ((vis[0].get("prompts") if vis else {}) or {}).get("deprioritized_domains", [])


@pytest.mark.asyncio
async def test_short_vague_input_no_persist_no_fragment():
    sb = FakeSupabase({})
    out = await _rm(sb, FakeInterpreterGemini()).converse(CTX, "family", pending_key="vision")
    assert out["onboarding_trace"]["legacy_fragment_path_used"] is False
    assert out["candidate_goals"] == []  # one vague word → no persisted raw goal
    cands = await sb.select("candidate_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert cands == []
    assert out.get("assistant_message")  # a focused follow-up, not blank
