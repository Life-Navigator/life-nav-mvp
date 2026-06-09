"""Sprint 44 — My Life flagship aggregator: six sections from the canonical model, source-labeled."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.life_discovery import LifeDiscoveryService
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.my_life import MyLifeService
from app.services.readiness import LifeReadinessEngine
from app.services.recommendations_os import RecommendationOS
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _svc(sb):
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    return MyLifeService(LifeDiscoveryService(sb), readiness, RecommendationOS(sb), sb)


@pytest.mark.asyncio
async def test_my_life_has_all_six_sections_with_sources():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Retire by 60 and raise a secure family")
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    out = await _svc(sb).my_life(CTX)
    for sec in ("life_vision", "what_matters_most", "life_readiness", "constraints", "recent_intelligence"):
        assert sec in out
    assert out["life_vision"]["source"] == "Advisor Discovery"
    assert out["what_matters_most"]["primary_objective"] == "Build family stability"
    assert out["what_matters_most"]["depends_on"]  # reinforces the reveal
    assert out["has_discovery"] is True


@pytest.mark.asyncio
async def test_my_life_recent_intelligence_feed():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    out = await _svc(sb).my_life(CTX)
    feed = out["recent_intelligence"]
    assert feed and any(f["type"] == "objective" for f in feed)


@pytest.mark.asyncio
async def test_my_life_empty_for_no_discovery():
    out = await _svc(FakeSupabase({})).my_life(CTX)
    assert out["has_discovery"] is False
