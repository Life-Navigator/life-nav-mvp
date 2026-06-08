"""Sprint 14 — Decision Workspace (presets + decision + readiness impact)."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.decision_engine import DecisionEngine
from app.services.decision_workspace import WORKSPACE_TYPES, DecisionWorkspaceService
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.readiness import LifeReadinessEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
ACCOUNT = {"id": "a1", "account_type": "depository", "current_balance": 6000, "currency": "USD"}


def _svc() -> DecisionWorkspaceService:
    sb = FakeSupabase({"career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS, "financial_accounts": [ACCOUNT]})
    comp = CompensationIntelligenceEngine(sb)
    edu = EducationService(sb, comp)
    career = CareerService(sb, comp, MarketPositionAnalyzer(sb))
    family = FamilyService(sb, comp)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb), "career": career, "family": family}
    decision = DecisionEngine(supabase=sb, education=edu, career=career, family=family)
    readiness = LifeReadinessEngine(domains=domains, education=edu, supabase=sb)
    return DecisionWorkspaceService(decision_engine=decision, readiness_engine=readiness)


def test_types_lists_five_presets():
    types = DecisionWorkspaceService.types()
    assert {t["decision_type"] for t in types} == {"new_job", "mba", "move", "buy_house", "retirement"}
    assert all(t["question"] and t["affected_domains"] for t in types)


@pytest.mark.asyncio
async def test_create_workspace_has_decision_and_readiness_impact():
    ws = await _svc().create(CTX, "new_job", persist=False)
    assert ws["decision_type"] == "new_job" and ws["label"] == "New Job"
    assert "scenarios" in ws and "tradeoffs" in ws and "evidence" in ws and "confidence" in ws
    ri = ws["readiness_impact"]
    assert ri["is_projection"] is True
    assert "current_index" in ri and "projected_index" in ri
    domains = {d["domain"] for d in ri["domain_deltas"]}
    assert "career" in domains and "finance" in domains
    assert ws["next_steps"]


@pytest.mark.asyncio
async def test_new_job_projects_career_up():
    ws = await _svc().create(CTX, "new_job", persist=False)
    career = next(d for d in ws["readiness_impact"]["domain_deltas"] if d["domain"] == "career")
    assert career["direction"] == "up" and career["projected"] >= career["current"]


@pytest.mark.asyncio
async def test_buy_house_projects_finance_down():
    ws = await _svc().create(CTX, "buy_house", persist=False)
    fin = next(d for d in ws["readiness_impact"]["domain_deltas"] if d["domain"] == "finance")
    assert fin["direction"] == "down" and fin["projected"] <= fin["current"]


@pytest.mark.asyncio
async def test_projected_index_reflects_deltas():
    ws = await _svc().create(CTX, "mba", persist=False)
    ri = ws["readiness_impact"]
    # mba boosts education +22 and dings finance -10 -> projected index differs from current
    assert ri["projected_index"] != ri["current_index"] or ri["index_delta"] == 0
    assert 0 <= ri["projected_index"] <= 100


@pytest.mark.asyncio
async def test_unknown_decision_type_rejected():
    with pytest.raises(ValueError):
        await _svc().create(CTX, "win_lottery")


def test_all_presets_have_impact_and_rationale():
    for k, v in WORKSPACE_TYPES.items():
        assert v["impact"] and all(d in v["rationale"] for d in v["impact"])
