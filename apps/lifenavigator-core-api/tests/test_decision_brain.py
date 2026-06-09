"""Sprint 36 — Explainable Decision Brain: weighted factors + missing + excluded + tools + verdict."""
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
from app.services.readiness import LifeReadinessEngine
from app.services.recommendations_os import RecommendationOS
from app.services.decision_brain import DecisionBrainService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _brain(sb):
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    return DecisionBrainService(readiness=readiness, life=LifeDiscoveryService(sb), reco_os=RecommendationOS(sb), supabase=sb)


@pytest.mark.asyncio
async def test_brain_is_decision_centric_with_weighted_factors():
    sb = FakeSupabase({"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "status": "needs_review", "status_reason": "scanned_or_image"}]})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children"}])
    b = await _brain(sb).build(CTX, "buy_house")
    assert b["center"]["type"] == "Decision" and b["decision_label"]
    assert b["factors"] and all({"weight", "direction", "confidence", "source"} <= set(f) for f in b["factors"])
    assert all(f["direction"] in ("positive", "negative", "neutral") for f in b["factors"])
    # the recommendation is an OUTPUT of the weighted factors
    assert b["recommendation"]["verdict"] in ("supported", "conditional", "not_yet")
    assert "positive_weight" in b["recommendation"] and "negative_weight" in b["recommendation"]


@pytest.mark.asyncio
async def test_brain_shows_missing_and_excluded_and_tools():
    sb = FakeSupabase({"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "status": "needs_review", "status_reason": "scanned_or_image"}]})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children"}])
    b = await _brain(sb).build(CTX, "buy_house")
    assert b["missing_information"]  # the graph shows what it does NOT know (open dependencies)
    assert any("scanned" in e["reason"] for e in b["excluded_evidence"])  # zero-weight: the scanned doc
    assert any(t["label"] == "Life Readiness Engine" for t in b["tools"])  # tool transparency


@pytest.mark.asyncio
async def test_report_includes_life_model_section():
    sb = FakeSupabase({"financial_accounts": [{"id": "a1", "account_type": "depository", "current_balance": 5000}]})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    from app.services.report_engine import UniversalReportEngine
    engine = UniversalReportEngine(domains=domains, education=EducationService(sb, comp), supabase=sb, reco_os=RecommendationOS(sb))
    rpt = await engine.build(CTX, "financial")
    sec = next((s for s in rpt.sections if s.key == "life_model"), None)
    assert sec is not None and sec.ord == 1  # life model leads the report
    assert sec.body["primary_objective"]["title"]
