"""Onboarding Depth Gate — onboarding behaves like a first advisor meeting: it captures cross-domain facts
from a broad statement, then collects minimum useful baselines (one at a time) before completing, unless the
user explicitly chooses a partial dashboard."""
import json
import pytest
from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from app.services.life_bridge import LifeBridgeService
from app.services.relationship_manager import RelationshipManager
from .conftest import FakeSupabase

CTX = UserContext(user_id="22222222-2222-2222-2222-222222222222")

BROAD = ("I am hoping you can help me create a solid foundation. I have one year before my wedding, I need to "
         "get in shape, I need to create a solid foundation financially, I already have a degree so that is good "
         "for now, and I would like to work towards a promotion. Once we get married my fiancee and I want to "
         "buy a house and start building a family.")


def _rm(sb, gem):
    life = LifeDiscoveryService(sb)
    return RelationshipManager(sb, life, LifeBridgeService(sb, life), gemini=gem)


class DepthGem:
    """Interpreter mock keyed on message content (numbers/role => captured baselines)."""
    configured = True

    async def generate_with_usage(self, system, user, temperature=None):
        import re as _re
        msg = (_re.search(r'"""(.*?)"""', user, _re.S) or [None, user])[1].lower()

        def plan(goals, depri=None, captured=None):
            return json.dumps({
                "north_star": "Build a strong foundation before marriage",
                "main_priority": "Financial security", "time_horizon": "1 year", "goals": goals,
                "dependencies": ["Emergency fund", "Monthly cash flow", "Home down-payment target"],
                "deprioritized_domains": depri or [], "captured_baselines": captured or [],
                "synthesis": "Building the foundation before marriage.",
                "next_question": "What would make you feel financially ready in a year?"}), {}

        has_health = ("body fat" in msg or "lbs" in msg) and ("ft" in msg or "'" in msg or "foot" in msg)
        has_career = "architect" in msg or "principal" in msg
        if has_health:
            goals = [{"goal": "Body recomposition for the wedding", "domain": "health", "confidence": 0.9}]
            caps = ["health"]
            if has_career:
                goals.append({"goal": "Become Principal Architect", "domain": "career", "confidence": 0.9})
                caps.append("career")
            return plan(goals, captured=caps)
        if has_career:
            return plan([{"goal": "Become Principal Architect", "domain": "career", "confidence": 0.9}],
                        captured=["career"])
        if "degree" in msg and ("sufficient" in msg or "good for now" in msg) and "wedding" not in msg:
            return plan([], depri=["education"])
        # default = broad statement: goals for 4 domains, education deprioritized, NO concrete baselines
        return plan([
            {"goal": "Get in shape for the wedding", "domain": "health", "confidence": 0.85},
            {"goal": "Build a strong financial foundation", "domain": "finance", "confidence": 0.9},
            {"goal": "Work toward a promotion", "domain": "career", "confidence": 0.8},
            {"goal": "Buy a house and start a family", "domain": "family", "confidence": 0.85},
        ], depri=["education"])


async def _pending_baselines(sb):
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    return ((vis[0].get("prompts") if vis else {}) or {}).get("pending_baselines") or []


# 1 — broad statement extracts cross-domain goals + does NOT complete + asks a baseline
@pytest.mark.asyncio
async def test_broad_statement_does_not_complete_and_asks_baseline():
    sb = FakeSupabase({})
    out = await _rm(sb, DepthGem()).converse(CTX, BROAD, pending_key="vision")
    assert out["complete"] is False
    assert out["pending_key"] == "baseline_health"  # health first
    assert "everything i need to start" not in out["assistant_message"].lower()
    assert "partial dashboard" in out["assistant_message"].lower()
    doms = {g["domain"] for g in out["candidate_goals"]}
    assert {"finance", "health", "career", "family"} <= doms
    pb = await _pending_baselines(sb)
    assert "finance" in pb and "career" in pb and "family" in pb and "education" not in pb


# 5 — user asks for a partial dashboard → completes, gaps marked honestly
@pytest.mark.asyncio
async def test_partial_dashboard_completes_with_honest_gaps():
    sb = FakeSupabase({})
    rm = _rm(sb, DepthGem())
    t1 = await rm.converse(CTX, BROAD, pending_key="vision")
    t2 = await rm.converse(CTX, "Let's just open a partial dashboard for now.", pending_key=t1["pending_key"])
    assert t2["complete"] is True and t2["pending_key"] is None
    assert "dashboard" in t2["assistant_message"].lower()


# 2/6 — user gives the health baseline → captured, keeps collecting (not complete)
@pytest.mark.asyncio
async def test_health_baseline_captured_then_continues():
    sb = FakeSupabase({})
    rm = _rm(sb, DepthGem())
    t1 = await rm.converse(CTX, BROAD, pending_key="vision")
    t2 = await rm.converse(CTX, "I am six foot, 210 lbs, 18% body fat, lifting four days a week.",
                           pending_key=t1["pending_key"])
    assert t2["complete"] is False  # finance/career/family still pending
    cap = ((await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life"))[0]
           .get("prompts") or {}).get("baselines_captured") or []
    assert "health" in cap


# 7 — cross-domain answer during a baseline question captures BOTH domains
@pytest.mark.asyncio
async def test_cross_domain_answer_captures_both():
    sb = FakeSupabase({})
    rm = _rm(sb, DepthGem())
    t1 = await rm.converse(CTX, BROAD, pending_key="vision")
    # answering the health baseline, the user also gives career facts
    await rm.converse(CTX, "I'm six foot, 210 lbs, 18% body fat, and also a Senior Architect aiming for Principal Architect.",
                      pending_key=t1["pending_key"])
    cap = ((await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life"))[0]
           .get("prompts") or {}).get("baselines_captured") or []
    assert "health" in cap and "career" in cap
    pb = await _pending_baselines(sb)
    assert "career" not in pb  # not re-asked


# 9 — broad paragraph never becomes a raw quoted/snake_case goal
@pytest.mark.asyncio
async def test_no_raw_paragraph_or_snake_case_goal():
    sb = FakeSupabase({})
    out = await _rm(sb, DepthGem()).converse(CTX, BROAD, pending_key="vision")
    for g in out["candidate_goals"]:
        gl = str(g.get("goal", ""))
        assert "_" not in gl  # no snake_case enum
        assert len(gl) < 120 and "I am hoping you can help" not in gl  # not the raw paragraph


# 8 — depth gate persists missing baselines (completion blocked structurally)
@pytest.mark.asyncio
async def test_completion_blocked_until_baselines_or_partial():
    sb = FakeSupabase({})
    rm = _rm(sb, DepthGem())
    t1 = await rm.converse(CTX, BROAD, pending_key="vision")
    assert t1["complete"] is False
    assert (await _pending_baselines(sb))  # non-empty queue gates completion
