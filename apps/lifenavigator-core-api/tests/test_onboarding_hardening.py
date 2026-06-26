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
    # DEPTH GATE: the broad paragraph does NOT complete onboarding — finance stays the main priority and the
    # advisor now collects a baseline (health first) and offers a partial dashboard.
    assert t1["complete"] is False
    assert t1["pending_key"] == "baseline_health"
    assert t1["context_panel"].get("main_priority", "").lower().startswith("financial")
    assert "partial dashboard" in t1["assistant_message"].lower()

    # Turn 2: user opts for a partial dashboard → onboarding completes, remaining gaps marked honestly.
    t2 = await rm.converse(CTX, "Let's just open a partial dashboard for now.", pending_key=t1.get("pending_key"))
    assert t2["complete"] is True and t2["pending_key"] is None
    assert t2["context_panel"].get("main_priority", "").lower().startswith("financial")


# ---- Completion gate: the advisor must LISTEN when the user says something important is missing ----
MISSING = "We haven't discussed what getting in shape means, what the current starting point is, what my career is."


@pytest.mark.asyncio
async def test_completion_gate_blocks_when_user_names_missing_topics():
    sb = FakeSupabase({})
    out = await _rm(sb, FakeInterpreterGemini()).converse(CTX, MISSING, pending_key="final_topics")
    assert out["complete"] is False
    assert "everything i need to start" not in out["assistant_message"].lower()
    assert out["pending_key"] == "baseline_health"  # health first
    assert "dashboard" in out["assistant_message"].lower()  # "we shouldn't open the dashboard yet"
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    pb = ((vis[0].get("prompts") if vis else {}) or {}).get("pending_baselines") or []
    assert "health" in pb and "career" in pb


@pytest.mark.asyncio
async def test_completion_gate_completes_when_nothing_missing():
    sb = FakeSupabase({})
    out = await _rm(sb, FakeInterpreterGemini()).converse(CTX, "No, that's everything.", pending_key="final_topics")
    assert out["complete"] is True and out["pending_key"] is None


@pytest.mark.asyncio
async def test_baseline_capture_advances_then_completes():
    sb = FakeSupabase({})
    rm = _rm(sb, FakeInterpreterGemini())
    o1 = await rm.converse(CTX, MISSING, pending_key="final_topics")
    assert o1["pending_key"] == "baseline_health" and o1["complete"] is False
    # Health answer → synthesis + ONE health follow-up (stays on health), NOT an immediate finance/career jump.
    o2 = await rm.converse(CTX, "I'm 6 ft, 210 lbs, want to stay this weight but cut fat and add muscle, 18% body fat, better cardio.", pending_key="baseline_health")
    assert o2["pending_key"] == "baseline_health" and o2["complete"] is False
    assert "training" in o2["assistant_message"].lower() or "injuries" in o2["assistant_message"].lower()
    # follow-up answer → advance to career
    o3 = await rm.converse(CTX, "3 days lifting, 2 days cardio, no injuries, ~7h sleep.", pending_key="baseline_health")
    assert o3["pending_key"] == "baseline_career" and o3["complete"] is False
    o4 = await rm.converse(CTX, "I'm a software engineer aiming for a senior/staff role.", pending_key="baseline_career")
    assert o4["complete"] is True and o4["pending_key"] is None


# ---- P1: health baseline produces recomposition + fat/lean synthesis BEFORE moving on ----
@pytest.mark.asyncio
async def test_health_baseline_synthesis_recomp_and_mass():
    sb = FakeSupabase({})
    rm = _rm(sb, FakeInterpreterGemini())
    await rm.converse(CTX, "We haven't discussed what getting in shape means.", pending_key="final_topics")
    out = await rm.converse(CTX, ("I am 6 ft tall and 210 lbs. I want to stay this weight but cut significant "
        "fat and increase muscle. I am about 18% body fat now. I also want much better cardio."),
        pending_key="baseline_health")
    msg = out["assistant_message"].lower()
    assert "recomposition" in msg
    assert "37.8" in out["assistant_message"] and "172.2" in out["assistant_message"]  # fat/lean mass
    assert "financially ready" not in msg  # must NOT jump straight to finance
    assert out["pending_key"] == "baseline_health"  # health follow-up, not finance


# ---- P2: a credential fact is persisted + briefly acknowledged, no cross-domain monologue ----
@pytest.mark.asyncio
async def test_education_credential_brief_no_monologue():
    sb = FakeSupabase({})
    rm = _rm(sb, FakeInterpreterGemini())
    out = await rm.converse(CTX, "I have a BS in Business Administration from Cal State Bakersfield.", pending_key=None)
    msg = out["assistant_message"]
    assert "BS in Business Administration from Cal State Bakersfield" in msg
    assert "sufficient for now" in msg.lower()
    assert len(msg) < 400  # brief, not a monologue
    assert "balance sheet" not in msg.lower() and "home" not in msg.lower() and "primary engine" not in msg.lower()
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert "education" in ((vis[0].get("prompts") if vis else {}) or {}).get("deprioritized_domains", [])
    # the general onboarding paragraph (mentions "degree" but no "from <school>") is NOT treated as a credential
    assert rm._is_credential_fact("I already have my degree so that isn't a priority, but getting in shape is.") is False


@pytest.mark.asyncio
async def test_duplicate_goals_consolidated_distinct_kept():
    sb = FakeSupabase({})
    rm = _rm(sb, FakeInterpreterGemini())
    await rm._persist_candidate_goals(CTX, [
        {"goal": "Create a solid financial foundation", "objective": "x", "domain": "finance", "confidence": 0.8, "status": "active", "supporting_quotes": []},
        {"goal": "Build a strong financial foundation", "objective": "x", "domain": "finance", "confidence": 0.9, "status": "active", "supporting_quotes": []},
        {"goal": "Work towards a promotion", "objective": "x", "domain": "career", "confidence": 0.8, "status": "active", "supporting_quotes": []},
        {"goal": "Advance in my career", "objective": "x", "domain": "career", "confidence": 0.7, "status": "active", "supporting_quotes": []},
        {"goal": "Buy a house", "objective": "x", "domain": "family", "confidence": 0.8, "status": "active", "supporting_quotes": []},
        {"goal": "Start a family", "objective": "x", "domain": "family", "confidence": 0.8, "status": "active", "supporting_quotes": []},
    ])
    loaded = await rm._load_candidate_goals(CTX)
    assert len([g for g in loaded if g["domain"] == "finance"]) == 1  # near-identical merged
    assert len([g for g in loaded if g["domain"] == "career"]) == 1   # promotion≈advance merged
    assert len([g for g in loaded if g["domain"] == "family"]) == 2   # distinct goals survive
