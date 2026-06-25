"""Onboarding LLM interpreter: paragraph → clean structured plan, no fragments (ONBOARDING_QUALITY)."""
import json
import pytest
from app.services.relationship_manager import RelationshipManager


class FakeGem:
    configured = True
    async def generate_with_usage(self, system, user, temperature=None):
        return json.dumps({
            "north_star": "Build a stable foundation before marriage and starting a family.",
            "time_horizon": "12 months before marriage; family planning after.",
            "goals": [
                {"goal": "Prepare for marriage next year", "domain": "family", "status": "active", "confidence": 0.9},
                {"goal": "Build a stronger financial foundation", "domain": "finance", "status": "active", "confidence": 0.9},
                {"goal": "Get back in shape and improve physical performance", "domain": "health", "status": "active", "confidence": 0.85},
                {"goal": "Strengthen career stability and income trajectory", "domain": "career", "status": "active", "confidence": 0.8},
            ],
            "values": ["family leadership", "security", "performance"],
            "deprioritized_domains": ["education"],
            "synthesis": "Your north star is preparing to lead a family — a 12-month foundation plan before marriage.",
            "next_question": "Over the next 12 months, which pillar needs the most attention first — financial security, health/performance, or career momentum?",
        }), {}


def _rm(gem):
    return RelationshipManager(supabase=object(), life=object(), bridge=None, gemini=gem)


PARA = ("My goals for this app are to set the foundation for my life and keep everything organized. I am "
        "getting married next year and after that we want to start a family. This gives me a year to get my "
        "financial, physical, and career foundation built. I already have my degree so that isn't a priority, "
        "but getting back in shape and building my financial profile is.")


@pytest.mark.asyncio
async def test_interpret_plan_clean_goals_no_fragments():
    plan = await _rm(FakeGem())._interpret_plan(PARA)
    assert plan is not None
    goals = [g["goal"] for g in plan["candidate_goals"]]
    # complete goals, NOT fragments
    assert "Build a stronger financial foundation" in goals
    assert not any(g.lower().strip() in ("get my financial", "physical", "career foundation built") for g in goals)
    assert all(len(g.split()) >= 2 for g in goals)
    domains = {g["domain"] for g in plan["candidate_goals"]}
    assert {"family", "finance", "health", "career"} <= domains
    assert "education" in plan["deprioritized_domains"]
    assert plan["north_star"] and plan["next_question"] and plan["synthesis"]


@pytest.mark.asyncio
async def test_interpret_plan_none_without_llm():
    assert await _rm(None)._interpret_plan(PARA) is None  # fail-safe → deterministic extractor

@pytest.mark.asyncio
async def test_interpret_plan_none_when_too_short():
    assert await _rm(FakeGem())._interpret_plan("hi there") is None
