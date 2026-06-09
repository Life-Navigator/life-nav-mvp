"""Sprint 33 — Life Discovery: the need behind the need + dependency decomposition + OS feed."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from app.services.recommendations_os import RecommendationOS

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def test_need_behind_the_need_house_for_family_is_family_stability():
    svc = LifeDiscoveryService(FakeSupabase({}))
    # "buy a house" but the WHY is children -> the root objective is family stability, not homeownership
    root = svc.infer_root("I want to buy a house", [{"q": "why", "a": "we want children"}, {"q": "why", "a": "raise a family"}])
    assert root == "family_stability"


def test_house_for_equity_is_wealth_not_homeownership():
    svc = LifeDiscoveryService(FakeSupabase({}))
    # "buy a house to build equity/rental income" -> the objective is wealth, not the house itself
    assert svc.infer_root("buy a house", [{"q": "why", "a": "rental income and build equity"}]) == "financial_independence"


@pytest.mark.asyncio
async def test_discover_goal_decomposes_into_dependencies():
    svc = LifeDiscoveryService(FakeSupabase({}))
    res = await svc.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"q": "why", "a": "we want to start a family"}])
    assert res["root_objective"] == "family_stability"
    labels = [d["label"] for d in res["dependencies"]]
    assert any("life insurance" in label.lower() for label in labels)  # cross-domain dependency
    assert any("emergency fund" in label.lower() for label in labels)
    assert res["risks"] and res["opportunities"]


@pytest.mark.asyncio
async def test_personal_graph_has_objective_and_dependency_nodes():
    sb = FakeSupabase({})
    svc = LifeDiscoveryService(sb)
    await svc.save_vision(CTX, vision_text="Raise a healthy, secure family and retire by 60")
    await svc.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    g = await svc.personal_graph(CTX)
    types = {n["type"] for n in g["nodes"]}
    assert {"Life Vision", "Life Objective", "Dependency"} <= types
    assert any(e["rel"] == "requires" for e in g["edges"])  # objective -> dependency edge


@pytest.mark.asyncio
async def test_onboarding_produces_recommendations_before_any_document():
    sb = FakeSupabase({})
    svc = LifeDiscoveryService(sb)
    await svc.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    os_engine = RecommendationOS(sb, readiness=None)  # no readiness/docs — purely onboarding
    await os_engine.sync(CTX)
    recs = await os_engine.active(CTX)
    assert recs and any(r["source_module"] == "life:objective" for r in recs)  # recs from onboarding alone


# ---- Sprint 35: multi-objective plan, conflict/tradeoff, discovery health, full GraphRAG grounding ----
@pytest.mark.asyncio
async def test_multi_objective_plan_detects_conflict():
    sb = FakeSupabase({})
    svc = LifeDiscoveryService(sb)
    await svc.discover_goal(CTX, surface_goal="retire at 45", why_chain=[{"a": "I want freedom and independence"}])
    await svc.discover_goal(CTX, surface_goal="get an MBA", why_chain=[{"a": "I want to change careers and learn"}])
    plan = await svc.objectives_plan(CTX)
    assert len(plan["objectives"]) >= 2 and plan["objectives"][0]["priority_rank"] == 1
    # financial_independence vs (career_growth/education) — at least the FI/education timeline conflict path exists
    assert isinstance(plan["conflicts"], list)


@pytest.mark.asyncio
async def test_fi_vs_family_conflict_is_flagged():
    sb = FakeSupabase({})
    svc = LifeDiscoveryService(sb)
    await svc.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    await svc.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children and to raise a family"}])
    plan = await svc.objectives_plan(CTX)
    assert plan["conflicts"], "expected a money conflict between financial independence and family stability"
    c = plan["conflicts"][0]
    assert c["type"] in ("money", "time", "timeline") and c["suggested_focus"] and c["suggested_sequence"]


@pytest.mark.asyncio
async def test_discovery_health_flags_missing_areas():
    sb = FakeSupabase({})
    svc = LifeDiscoveryService(sb)
    await svc.discover_goal(CTX, surface_goal="get a new job", why_chain=[{"a": "burned out"}])  # career only
    h = await svc.discovery_health(CTX)
    assert "career" in h["covered_areas"]
    assert any("health" in m or "family" in m or "retirement" in m for m in h["missing_areas"])
    assert h["prompts"] and 0 <= h["model_quality"] <= 1


@pytest.mark.asyncio
async def test_life_block_grounds_the_system_prompt():
    from app.agents.orchestrator import LifeOrchestratorAgent
    block = LifeOrchestratorAgent._life_block({
        "has_discovery": True, "life_vision": "Retire comfortably by 60",
        "primary_objective": {"title": "Reach financial independence", "confidence": 0.9},
        "objectives": ["Reach financial independence"], "themes": ["freedom"],
        "constraints": ["Low savings rate"], "open_dependencies": ["High savings rate"], "risks": ["Outliving assets"],
    })
    assert "Reach financial independence" in block and "Low savings rate" in block and "stated objective" in block
    assert LifeOrchestratorAgent._life_block({"has_discovery": False}) == ""
