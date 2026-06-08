"""Career X4 — CareerService + Compensation/Market engines + recommendation families."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.market_intelligence import MarketPositionAnalyzer

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

# Realistic, CITED OEWS bands (BLS OEWS May 2024, national). Not fantasy: source + as_of.
BANDS = [
    {"occupation_code": "15-2051", "geography": "US", "p10": 60000, "p25": 75000, "p50": 95000, "p75": 120000, "p90": 145000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"},
    {"occupation_code": "15-1252", "geography": "US", "p10": 80000, "p25": 105000, "p50": 133000, "p75": 165000, "p90": 200000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"},
]
PROFILE = {"id": "p1", "current_title": "Data Analyst", "current_employer": "Acme", "industry": "tech", "seniority_level": "mid", "years_experience": 5, "location": "US"}
GOAL = {"id": "g1", "title": "Move to platform engineering", "goal_type": "advancement", "target_role": "Platform Engineer"}
TARGET = {"id": "t1", "role_title": "Platform Engineer", "location": "US", "target_comp_median": 150000}
GAP = {"id": "sg1", "skill_name": "Kubernetes", "target_role": "Platform Engineer", "severity": "medium"}
COMP_LOW = {"id": "c1", "role": "Data Analyst", "comp_median": 80000, "effective_date": "2026-01-01"}  # below market 95k


def _svc(rows: dict) -> CareerService:
    sb = FakeSupabase(rows)
    return CareerService(sb, CompensationIntelligenceEngine(sb), MarketPositionAnalyzer(sb))


# ---- Compensation engine ----
@pytest.mark.asyncio
async def test_compensation_engine_returns_cited_band():
    eng = CompensationIntelligenceEngine(FakeSupabase({"compensation_bands": BANDS}))
    est = await eng.market_value(role_title="Data Analyst", seniority="mid", geography="US")
    assert est is not None
    assert (est.low, est.median, est.high) == (75000, 95000, 120000)  # p25/p50/p75 for 'mid'
    assert "OEWS" in est.source and est.confidence == 0.8 and est.as_of == "2024-05-01"


@pytest.mark.asyncio
async def test_no_band_returns_none_never_fantasy():
    eng = CompensationIntelligenceEngine(FakeSupabase({"compensation_bands": BANDS}))
    assert await eng.market_value(role_title="Astronaut", seniority="mid") is None  # no SOC mapping
    eng2 = CompensationIntelligenceEngine(FakeSupabase({}))  # no bands at all
    assert await eng2.market_value(role_title="Data Analyst", seniority="mid") is None


@pytest.mark.asyncio
async def test_scenario_lift_is_cited_delta():
    eng = CompensationIntelligenceEngine(FakeSupabase({"compensation_bands": BANDS}))
    sc = await eng.scenario(current_role="Data Analyst", target_role="Platform Engineer", seniority="mid")
    assert sc["median_lift"] == 38000  # 133000 - 95000
    assert sc["before"]["median"] == 95000 and sc["after"]["median"] == 133000


# ---- Market analyzer ----
@pytest.mark.asyncio
async def test_market_analyzer_unknown_without_snapshot():
    pos = await MarketPositionAnalyzer(FakeSupabase({})).position(role_title="Data Analyst")
    assert pos["demand_level"] == "unknown" and "market_demand_snapshot" in pos["missing"]


@pytest.mark.asyncio
async def test_market_analyzer_with_snapshot():
    snap = [{"occupation_code": "15-2051", "geography": "US", "growth_rate": 0.08, "saturation": 0.3, "openings": 12000, "source_name": "BLS", "as_of_date": "2024-05-01", "confidence": 0.7}]
    pos = await MarketPositionAnalyzer(FakeSupabase({"market_demand_snapshots": snap})).position(role_title="Data Analyst")
    assert pos["demand_level"] == "high" and pos["competition_level"] == "low" and pos["source"] == "BLS"


# ---- Summary / no fake compensation / missing prompts ----
@pytest.mark.asyncio
async def test_summary_empty_no_fake_comp_and_prompts():
    vm = await _svc({}).summary(CTX)
    assert vm.domain == "career"
    assert vm.data["compensation"]["current_estimated_market_value"] is None  # never fabricated
    assert "career_profiles" in vm.missing
    assert vm.data["safety_boundaries"][0]["boundary_type"] == "career_guidance"
    assert vm.confidence.basis == "missing"


@pytest.mark.asyncio
async def test_summary_sections_with_data():
    vm = await _svc({"career_profiles": [PROFILE], "job_targets": [TARGET], "compensation_bands": BANDS}).summary(CTX)
    comp = vm.data["compensation"]
    assert comp["current_estimated_market_value"]["median"] == 95000
    assert comp["target_estimated_market_value"]["median"] == 133000
    assert vm.data["current_state"]["title"] == "Data Analyst"
    assert vm.data["target_state"]["role"] == "Platform Engineer"


# ---- Recommendation families + evidence + boundary ----
@pytest.mark.asyncio
async def test_families_persist_with_evidence_and_boundary():
    svc = _svc({"career_profiles": [PROFILE], "career_goals": [GOAL], "job_targets": [TARGET],
                "compensation_records": [COMP_LOW], "skill_gaps": [GAP], "compensation_bands": BANDS})
    rows = await svc.persist_recommendations(CTX)
    types = {r["recommendation_type"] for r in rows}
    assert {"skill_gap_closure", "compensation_growth", "role_transition"} <= types
    for r in rows:
        assert r["evidence_json"]  # never persisted without evidence
        assert r["governance_verdict"]["boundary_type"] == "career_guidance"


@pytest.mark.asyncio
async def test_compensation_growth_fires_when_underpaid():
    svc = _svc({"career_profiles": [PROFILE], "compensation_records": [COMP_LOW], "compensation_bands": BANDS})
    rows = await svc.persist_recommendations(CTX)
    growth = next((r for r in rows if r["recommendation_type"] == "compensation_growth"), None)
    assert growth is not None
    metrics = {e["metric_name"] for e in growth["evidence_json"]}
    assert {"recorded_comp_median", "market_comp_median"} <= metrics


@pytest.mark.asyncio
async def test_no_recommendation_without_evidence():
    rows = await _svc({}).persist_recommendations(CTX)
    assert rows == []  # no data -> no fabricated advice


# ---- Chat grounding ----
@pytest.mark.asyncio
async def test_chat_context_cites_market_value():
    ctx_obj = await _svc({"career_profiles": [PROFILE], "compensation_bands": BANDS}).chat_context(CTX)
    joined = " ".join(f"{f['fact']} {f['value']}" for f in ctx_obj.authoritative_facts)
    assert "market value" in joined and "95000" in joined


# ---- Report model (Phase 7) ----
@pytest.mark.asyncio
async def test_report_model_has_sections():
    rpt = await _svc({"career_profiles": [PROFILE], "job_targets": [TARGET], "compensation_bands": BANDS}).report_model(CTX)
    secs = rpt["sections"]
    for k in ["executive_summary", "current_market_value", "target_role_analysis", "skill_gap_analysis", "compensation_forecast", "recommendations", "evidence_appendix"]:
        assert k in secs
    assert rpt["safety"]["boundary_type"] == "career_guidance"
