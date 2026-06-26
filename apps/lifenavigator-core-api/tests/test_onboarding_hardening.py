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


class TwoTurnGem:
    """Realistic interpreter for the two-turn marriage/foundation conversation. Turn 1: multi-domain plan with
    family north star + finance/health/career pillars + education deprioritized. Turn 2 (finance is main):
    finance becomes main_priority, career/health are levers, next question defines financial readiness."""
    configured = True

    async def generate_with_usage(self, system, user, temperature=None):
        import re as _re
        msg = (_re.search(r'"""(.*?)"""', user, _re.S) or [None, user])[1].lower()
        finance_main = "main one" in msg or "financial foundation is the main" in msg or "strong financial foundation is the main" in msg
        if finance_main:
            return json.dumps({
                "north_star": "Build the foundation for marriage, a home, and starting a family.",
                "main_priority": "Financial security",
                "goals": [{"goal": "Build a strong financial foundation", "domain": "finance", "confidence": 0.95}],
                "dependencies": ["Emergency fund", "Monthly cash flow", "Debt level", "Home down-payment target",
                                 "Promotion / income path"],
                "deprioritized_domains": ["education"],
                "synthesis": "Good — financial security becomes the organizing priority. Career is the income lever and health is the performance lever.",
                "next_question": "What would make you feel financially ready in a year — cash saved, debt down, income up, or a down payment started?"}), {}
        return json.dumps({
            "north_star": "Build the foundation for marriage, a home, and starting a family.",
            "main_priority": "Financial security",
            "goals": [
                {"goal": "Get in shape for the wedding", "domain": "health", "confidence": 0.85},
                {"goal": "Build a strong financial foundation", "domain": "finance", "confidence": 0.9},
                {"goal": "Work toward a promotion", "domain": "career", "confidence": 0.8},
                {"goal": "Buy a house and start a family", "domain": "family", "confidence": 0.85}],
            "dependencies": ["Emergency fund", "Monthly cash flow", "Wedding budget", "Home down-payment target",
                             "Promotion / income path", "Health routine & recovery"],
            "deprioritized_domains": ["education"],
            "synthesis": "You're using the year before the wedding to build the foundation for marriage, a home, and a family.",
            "next_question": "Which of these pillars creates the most momentum for the others?"}), {}


@pytest.mark.asyncio
async def test_two_turn_finance_primary_not_career_collapse():
    sb = FakeSupabase({})
    rm = _rm(sb, TwoTurnGem())
    t1 = await rm.converse(CTX, ("I am hoping that you can help me create a solid foundation. I have one year "
        "before my wedding, I need to get in shape, I need to create a solid foundation financially, I already "
        "have a degree so that is good for now, and I would like to work towards a promotion. Once we get "
        "married my fiancee and I want to buy a house and start building a family."), pending_key="vision")
    rev1 = t1["reveal"]
    # P1: panel/reveal summarize the multi-domain plan, NOT "Advance your career"
    assert "Advance your career" not in (rev1["we_discovered"] or "")
    assert "marriage" in rev1["we_discovered"].lower() or "foundation" in rev1["we_discovered"].lower()
    # P2: dependencies are plan-specific, not the generic career template
    deps1 = " ".join(rev1["dependencies"]).lower()
    assert "emergency fund" in deps1 or "down-payment" in deps1 or "cash flow" in deps1
    assert "in-demand skills" not in deps1 and "compensation benchmarking" not in deps1
    # education deprioritized, finance present
    assert "education" in (t1["context_panel"].get("deprioritized_domains") or [])
    goal_domains = {g["domain"] for g in t1["candidate_goals"]}
    assert {"finance", "health", "career", "family"} <= goal_domains
    # P4: response reads naturally (no "1) ...; 2) ...;" schema wording)
    assert "1)" not in t1["assistant_message"] and "I'm capturing these pillars" not in t1["assistant_message"]

    # Turn 2: user clarifies finance is the main goal, career is the engine
    t2 = await rm.converse(CTX, ("The strong financial foundation is the main one. Advancing career is for that "
        "purpose, and that helps with stress and will allow me to eat well, take supplements, and stay healthier."),
        pending_key=t1.get("pending_key"))
    # P3/P5: finance becomes the main priority; next question defines financial readiness, not a career step
    assert t2["context_panel"].get("main_priority", "").lower().startswith("financial")
    msg2 = t2["assistant_message"].lower()
    assert "next step in your career" not in msg2 and "step in your career" not in msg2
    assert "financially ready" in msg2 or "down payment" in msg2 or "debt" in msg2 or "cash" in msg2
