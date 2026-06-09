"""Sprint 17/24 — Multi-Scenario tree: DERIVED deltas + lineage + no fabrication."""
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
OFFER = {"id": "o1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08", "extracted_json": {"base_salary": "150000", "signing_bonus": "20000", "annual_bonus": "10"}}
PROGRAM = {"id": "p1", "user_id": CTX.user_id, "doc_type": "program_details", "uploaded_at": "2026-06-08", "extracted_json": {"tuition": "60000", "duration_months": "24"}}
AID = {"id": "a1", "user_id": CTX.user_id, "doc_type": "financial_aid_letter", "uploaded_at": "2026-06-08", "extracted_json": {"grants": "30000"}}
NW = [{"id": "n1", "user_id": CTX.user_id, "as_of_date": "2026-06-01", "net_worth": 100000, "total_liabilities": 0}]


def _svc(docs) -> ScenarioTreeService:
    rows = {"documents": docs, "career_profiles": [{"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}],
            "compensation_bands": BANDS, "net_worth_snapshots": NW}
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    edu = EducationService(sb, comp)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    planning = FinancialPlanningEngine(sb, CompensationBenefitsEngine(sb))
    readiness = LifeReadinessEngine(domains=domains, education=edu, supabase=sb, planning=planning)
    return ScenarioTreeService(readiness=readiness, planning=planning, supabase=sb, comp_benefits=CompensationBenefitsEngine(sb))


@pytest.mark.asyncio
async def test_new_job_net_worth_derived_from_offer_letter():
    t = await _svc([OFFER]).build(CTX, ["new_job"])
    take = next(n for n in t["nodes"] if n.get("option") == "accept")
    # 20k signing + 10% of 150k bonus = 20000 + 15000 = 35000
    assert take["outcome"]["net_worth_known"] is True
    assert take["lineage"]["evidence"] and "offer_letter" in take["lineage"]["evidence"][0]["source"]
    assert "signing bonus + annual bonus" in take["lineage"]["calculation"]


@pytest.mark.asyncio
async def test_no_offer_letter_is_unknown_not_fabricated():
    t = await _svc([]).build(CTX, ["new_job"])
    take = next(n for n in t["nodes"] if n.get("option") == "accept")
    assert take["outcome"]["net_worth_known"] is False  # unknown, NOT a hardcoded number
    assert "Upload your offer letter" in take["lineage"]["missing"]


@pytest.mark.asyncio
async def test_mba_cost_derived_with_tuition_aid_and_assumptions():
    t = await _svc([PROGRAM, AID, OFFER]).build(CTX, ["mba"])
    yes = next(n for n in t["nodes"] if n.get("option") == "yes")
    assert yes["outcome"]["net_worth_known"] is True and yes["outcome"]["net_worth"] < 0  # it's a cost
    keys = {a.get("key") for a in yes["lineage"]["assumptions"] if a.get("key")}
    assert "tuition_inflation" in keys  # cited from the registry
    assert any("program_details" in e["source"] for e in yes["lineage"]["evidence"])


@pytest.mark.asyncio
async def test_mba_without_program_prompts_upload():
    t = await _svc([]).build(CTX, ["mba"])
    yes = next(n for n in t["nodes"] if n.get("option") == "yes")
    assert yes["outcome"]["net_worth_known"] is False and "Upload your program details" in yes["lineage"]["missing"]


@pytest.mark.asyncio
async def test_buy_house_never_fabricates_down_payment():
    t = await _svc([]).build(CTX, ["buy_house"])
    yes = next(n for n in t["nodes"] if n.get("option") == "yes")
    assert yes["outcome"]["net_worth_known"] is False  # no home price -> unknown, not -60000
    assert "home price" in yes["lineage"]["missing"]
    assert any(a.get("key") == "down_payment_pct" for a in yes["lineage"]["assumptions"])


@pytest.mark.asyncio
async def test_every_node_carries_confidence_breakdown():
    t = await _svc([OFFER]).build(CTX, ["new_job", "mba"])
    for n in t["nodes"]:
        if n["parent"] is not None:
            assert "confidence_breakdown" in n and n["confidence_breakdown"]["components"]
            assert "lineage" in n
    assert t["assumptions_used"]  # registry exposed
    assert t["leaves"] == 4


@pytest.mark.asyncio
async def test_path_with_unknown_branch_is_marked_unknown():
    t = await _svc([OFFER]).build(CTX, ["new_job", "buy_house"])  # buy_house unknown
    leaf = next(n for n in t["nodes"] if n["is_leaf"] and ">buy_house:yes" in n["id"])
    assert leaf["outcome"]["net_worth_known"] is False and leaf["outcome"]["missing"]
