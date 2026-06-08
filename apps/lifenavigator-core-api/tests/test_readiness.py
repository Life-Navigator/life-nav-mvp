"""Sprint 5 — Life Readiness Index + Goal Status engine."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.readiness import LifeReadinessEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
ACCOUNT = {"id": "a1", "name": "Checking", "account_type": "depository", "current_balance": 6000, "currency": "USD"}
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
DEPENDENTS = [{"id": "d1", "relationship": "child"}]
INSURANCE = [{"id": "i1", "life_coverage": 50000}]
DECISION = {"id": "x1", "confidence": 0.7, "title": "MBA?", "scenarios_json": []}
CAREER_GOAL = {"id": "g1", "title": "Reach Platform Eng", "status": "active", "target_date": "2030-01-01"}


def _engine(rows: dict) -> LifeReadinessEngine:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    domains = {
        "finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
        "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp),
    }
    return LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)


@pytest.mark.asyncio
async def test_assess_returns_index_and_six_domains():
    r = await _engine({}).assess(CTX)
    assert "index" in r and "domains" in r and "goals" in r
    domains = {d["domain"] for d in r["domains"]}
    assert {"finance", "health", "career", "education", "family", "decision"} == domains
    assert 0 <= r["index"]["score"] <= 100
    assert r["index"]["status"] in ("green", "yellow", "orange", "red")


@pytest.mark.asyncio
async def test_each_domain_has_required_fields():
    r = await _engine({"financial_accounts": [ACCOUNT], "career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS}).assess(CTX)
    for d in r["domains"]:
        for f in ("status", "progress", "gap", "confidence", "timeline", "recommendations"):
            assert f in d, f"{d['domain']} missing {f}"
        assert d["status"] in ("green", "yellow", "orange", "red")
        assert 0 <= d["progress"] <= 100


@pytest.mark.asyncio
async def test_empty_domains_read_as_needs_setup_not_fake_green():
    r = await _engine({}).assess(CTX)
    # no data -> low progress, never a green "all good"
    statuses = {d["domain"]: d["status"] for d in r["domains"]}
    assert statuses["family"] in ("orange", "red")
    assert r["index"]["status"] in ("orange", "red")


@pytest.mark.asyncio
async def test_decision_confidence_from_decisions():
    r = await _engine({"decisions": [DECISION]}).assess(CTX)
    dec = next(d for d in r["domains"] if d["domain"] == "decision")
    assert dec["progress"] == 70 and dec["confidence"] == 0.7


@pytest.mark.asyncio
async def test_family_gap_surfaces_protection_gap():
    rows = {"dependents": DEPENDENTS, "insurance_profiles": INSURANCE, "career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS}
    r = await _engine(rows).assess(CTX)
    fam = next(d for d in r["domains"] if d["domain"] == "family")
    assert "protection gap" in fam["gap"]


@pytest.mark.asyncio
async def test_goal_status_engine_lists_goals_with_status():
    r = await _engine({"career_goals": [CAREER_GOAL]}).assess(CTX)
    assert any(g["title"] == "Reach Platform Eng" and g["status"] in ("green", "yellow", "orange", "red") for g in r["goals"])
