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
