"""Sprint 15 — Decision Intelligence Graph (reasoning made visible)."""
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
from app.services.decision_engine import DecisionEngine
from app.services.decision_graph import DecisionGraphService
from app.services.decision_workspace import DecisionWorkspaceService
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.readiness import LifeReadinessEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
DOCS = [
    {"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08", "confidence": 0.86,
     "extracted_json": {"base_salary": "192000", "annual_bonus": "18", "equity_grant": "400000"}},
    {"id": "d2", "user_id": CTX.user_id, "doc_type": "medical_plan", "uploaded_at": "2026-06-08", "confidence": 0.85,
     "extracted_json": {"coverage_type": "HDHP Family", "premium": "300"}},
    {"id": "d3", "user_id": CTX.user_id, "doc_type": "life_insurance_policy", "uploaded_at": "2026-06-08", "confidence": 0.82,
     "extracted_json": {"coverage_amount": "1000000"}},
]
VALID_COLORS = {"green", "yellow", "orange", "red", "blue", "purple", "slate"}


def _svc() -> DecisionGraphService:
    sb = FakeSupabase({"documents": DOCS, "career_profiles": [{"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}], "compensation_bands": BANDS})
    comp = CompensationIntelligenceEngine(sb)
    edu = EducationService(sb, comp)
    career = CareerService(sb, comp, MarketPositionAnalyzer(sb))
    family = FamilyService(sb, comp)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb), "career": career, "family": family}
    decision = DecisionEngine(supabase=sb, education=edu, career=career, family=family)
    readiness = LifeReadinessEngine(domains=domains, education=edu, supabase=sb)
    ws = DecisionWorkspaceService(decision_engine=decision, readiness_engine=readiness)
    cb = CompensationBenefitsEngine(sb)
    return DecisionGraphService(workspace=ws, comp_benefits=cb, supabase=sb)


@pytest.mark.asyncio
async def test_graph_has_full_reasoning_chain():
    g = await _svc().build(CTX, "new_job")
    types = {n["type"] for n in g["nodes"]}
    assert {"document", "analysis", "impact", "recommendation", "readiness"} <= types
    assert g["layers"][0] == "Documents" and g["layers"][-1] == "Readiness"
    assert g["edges"]  # connected


@pytest.mark.asyncio
async def test_every_node_has_valid_color_and_detail():
    g = await _svc().build(CTX, "new_job")
    for n in g["nodes"]:
        assert n["color"] in VALID_COLORS, n
        assert "detail" in n and "title" in n


@pytest.mark.asyncio
async def test_compensation_analysis_node_shows_pay_components():
    g = await _svc().build(CTX, "new_job")
    comp = next(n for n in g["nodes"] if n["id"] == "an:comp")
    assert comp["color"] == "green" and comp["type"] == "analysis"
    d = comp["detail"]
    assert d["Base Salary"] == "$192,000" and d["RSUs / Equity (annualized)"] == "$100,000"
    assert d["evidence"]  # cited


@pytest.mark.asyncio
async def test_family_impact_node_shows_expected_facets():
    g = await _svc().build(CTX, "new_job")
    fam = next(n for n in g["nodes"] if n["id"] == "im:family")
    assert set(["Insurance", "Education / college", "Commute / time"]).issubset(fam["detail"].keys())


@pytest.mark.asyncio
async def test_recommendation_node_has_why_confidence_assumptions_alternatives():
    g = await _svc().build(CTX, "new_job")
    rec = next(n for n in g["nodes"] if n["type"] == "recommendation")
    assert rec["color"] == "purple"
    for k in ("Why it was recommended", "Confidence", "Assumptions", "Alternatives"):
        assert k in rec["detail"]


@pytest.mark.asyncio
async def test_readiness_node_terminates_the_graph():
    g = await _svc().build(CTX, "new_job")
    rd = next(n for n in g["nodes"] if n["type"] == "readiness")
    assert "Projected index" in rd["detail"] and rd["layer"] == 5
    assert any(e["to"] == rd["id"] for e in g["edges"])  # something points to it
