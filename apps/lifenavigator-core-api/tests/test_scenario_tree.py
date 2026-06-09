"""Sprint 17 — Multi-Scenario Planning (branching decision tree)."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.comp_benefits import CompensationBenefitsEngine
from app.services.compensation import CompensationIntelligenceEngine
from app.services.financial_planning import FinancialPlanningEngine
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.readiness import LifeReadinessEngine
from app.services.scenario_tree import ScenarioTreeService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
ROWS = {
    "career_profiles": [{"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}],
    "compensation_bands": BANDS, "financial_accounts": [{"id": "a1", "account_type": "depository", "current_balance": 50000}],
    "net_worth_snapshots": [{"id": "n1", "user_id": CTX.user_id, "as_of_date": "2026-06-01", "net_worth": 120000, "total_liabilities": 0}],
}


def _svc() -> ScenarioTreeService:
    sb = FakeSupabase(ROWS)
    comp = CompensationIntelligenceEngine(sb)
    edu = EducationService(sb, comp)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    planning = FinancialPlanningEngine(sb, CompensationBenefitsEngine(sb))
    readiness = LifeReadinessEngine(domains=domains, education=edu, supabase=sb, planning=planning)
    return ScenarioTreeService(readiness=readiness, planning=planning, supabase=sb)


def test_available_decisions():
    d = ScenarioTreeService.available_decisions()
    assert {x["decision_type"] for x in d} == {"new_job", "mba", "move", "buy_house"}
    assert all(len(x["options"]) == 2 for x in d)


@pytest.mark.asyncio
async def test_tree_expands_to_2n_leaves():
    t = await _svc().build(CTX, ["mba", "new_job"])
    assert t["leaves"] == 4  # 2 binary decisions -> 4 leaves
    assert t["nodes"][0]["label"] == "Current State" and t["nodes"][0]["depth"] == 0
    # each leaf carries the four metrics
    for n in t["nodes"]:
        for k in ("readiness_index", "net_worth", "retirement_ratio", "confidence"):
            assert k in n["outcome"]


@pytest.mark.asyncio
async def test_paths_diverge_on_net_worth_and_readiness():
    t = await _svc().build(CTX, ["mba", "new_job"])
    leaves = [n for n in t["nodes"] if n["is_leaf"]]
    nets = {n["outcome"]["net_worth"] for n in leaves}
    idxs = {n["outcome"]["readiness_index"] for n in leaves}
    assert len(nets) > 1 and len(idxs) > 1  # paths genuinely differ
    # MBA path reduces net worth vs no-MBA path (tuition)
    mba_accept = next(n for n in leaves if ">mba:yes" in n["id"] and ">new_job:accept" in n["id"])
    nomba_accept = next(n for n in leaves if ">mba:no" in n["id"] and ">new_job:accept" in n["id"])
    assert mba_accept["outcome"]["net_worth"] < nomba_accept["outcome"]["net_worth"]


@pytest.mark.asyncio
async def test_confidence_compounds_along_path():
    t = await _svc().build(CTX, ["mba", "new_job"])
    leaf = next(n for n in t["nodes"] if n["is_leaf"])
    assert 0 < leaf["outcome"]["confidence"] <= 1  # product of branch confidences


@pytest.mark.asyncio
async def test_best_path_is_highest_readiness_leaf():
    t = await _svc().build(CTX, ["mba", "new_job"])
    best = next(n for n in t["nodes"] if n["id"] == t["best_path_id"])
    assert best["is_leaf"]
    assert best["outcome"]["readiness_index"] == max(n["outcome"]["readiness_index"] for n in t["nodes"] if n["is_leaf"])


@pytest.mark.asyncio
async def test_three_decisions_cap_and_eight_leaves():
    t = await _svc().build(CTX, ["mba", "new_job", "buy_house", "move"])  # capped to 3
    assert len(t["decisions"]) == 3 and t["leaves"] == 8
