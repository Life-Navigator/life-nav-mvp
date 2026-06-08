"""Education E2 — EducationROIEngine + EducationService comparison + families."""
from __future__ import annotations

import pytest

from app.domains.education import EducationService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.education_roi import EducationROIEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

BANDS = [{"occupation_code": "15-2051", "geography": "US", "p10": 60000, "p25": 75000, "p50": 95000, "p75": 120000, "p90": 145000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
GOAL = {"id": "eg1", "target_role": "Platform Engineer", "title": "MS CS", "goal_type": "degree"}
SCHOOL = {"id": "sch1", "name": "State University"}
PROGRAM_MS = {"id": "prog1", "name": "MS Computer Science", "level": "masters", "major": "Computer Science", "modality": "hybrid", "duration_months": 24, "tuition": 42000, "graduation_rate": 0.86, "median_salary": 118000, "source": "College Scorecard", "school_id": "sch1", "accreditation_status": "accredited"}
# Cheaper but lower career payoff (median ~= current), so MS wins composite while the
# bootcamp remains a genuine lower-cost alternative.
PROGRAM_BOOT = {"id": "prog2", "name": "K8s Bootcamp", "level": "certificate", "major": "Computer Science", "modality": "online", "duration_months": 4, "tuition": 12000, "graduation_rate": 0.80, "median_salary": 96000, "source": "provider", "school_id": "sch1"}
PROGRAM_PRICEY = {"id": "prog3", "name": "Elite MS", "level": "masters", "major": "Computer Science", "modality": "in_person", "duration_months": 24, "tuition": 130000, "graduation_rate": 0.9, "median_salary": 125000, "source": "College Scorecard", "school_id": "sch1"}


def _svc(rows: dict) -> EducationService:
    sb = FakeSupabase(rows)
    return EducationService(sb, CompensationIntelligenceEngine(sb))


# ---- ROI engine ----
def test_roi_engine_cited_scores_and_scenarios():
    s = EducationROIEngine().score_program(PROGRAM_MS, current_median=95000, current_source="OEWS", target_role="Platform Engineer", total_debt=None)
    assert s.income_lift == 23000  # 118000 - 95000
    assert set(s.scenarios) == {"worst", "expected", "best"}
    assert s.scenarios["best"]["annual_income_lift"] > s.scenarios["expected"]["annual_income_lift"]
    assert set(s.scores) == {"fit", "roi", "career", "family", "risk", "time", "confidence"}
    # every score is backed by cited evidence (no uncited ROI)
    metrics = {e["metric_name"] for e in s.evidence}
    assert {"program_median_salary", "current_market_value", "income_lift", "net_cost"} <= metrics
    assert all(e.get("source_table") for e in s.evidence)


def test_roi_engine_missing_inputs_lower_confidence_no_fabrication():
    s = EducationROIEngine().score_program({"id": "x", "name": "Mystery", "tuition": 20000}, current_median=None, current_source=None, target_role=None, total_debt=None)
    assert s.income_lift is None  # not fabricated
    assert "current_market_value" in s.missing and "program_median_salary" in s.missing
    assert s.scores["confidence"] < 100


# ---- Service summary ----
@pytest.mark.asyncio
async def test_summary_empty_no_programs_missing_prompt():
    vm = await _svc({}).summary(CTX)
    assert vm.domain == "education"
    assert vm.data["best_program"] is None
    assert "programs" in vm.missing
    assert vm.data["safety_boundaries"][0]["boundary_type"] == "education_guidance"
    assert vm.confidence.basis == "missing"


@pytest.mark.asyncio
async def test_summary_ranks_programs_with_cited_scores():
    vm = await _svc({"programs": [PROGRAM_MS], "schools": [SCHOOL], "career_profiles": [CAREER_PROFILE], "education_goals": [GOAL], "compensation_bands": BANDS}).summary(CTX)
    best = vm.data["best_program"]
    assert best["program_name"] == "MS Computer Science"
    assert best["income_lift"] == 23000
    assert best["scores"]["confidence"] == 100  # all inputs present
    assert best["scenarios"]["expected"]["annual_income_lift"] is not None


# ---- Recommendation families ----
@pytest.mark.asyncio
async def test_best_program_match_persists_with_evidence_and_boundary():
    rows = await _svc({"programs": [PROGRAM_MS], "schools": [SCHOOL], "career_profiles": [CAREER_PROFILE], "education_goals": [GOAL], "compensation_bands": BANDS}).persist_recommendations(CTX)
    best = next((r for r in rows if r["recommendation_type"] == "best_program_match"), None)
    assert best is not None
    assert best["evidence_json"]
    assert best["governance_verdict"]["boundary_type"] == "education_guidance"


@pytest.mark.asyncio
async def test_lower_cost_alternative_with_two_programs():
    rows = await _svc({"programs": [PROGRAM_MS, PROGRAM_BOOT], "schools": [SCHOOL], "career_profiles": [CAREER_PROFILE], "education_goals": [GOAL], "compensation_bands": BANDS}).persist_recommendations(CTX)
    types = {r["recommendation_type"] for r in rows}
    assert "best_program_match" in types
    assert "lower_cost_alternative" in types  # bootcamp is cheaper


@pytest.mark.asyncio
async def test_high_debt_warning_escalates():
    rows = await _svc({"programs": [PROGRAM_PRICEY], "schools": [SCHOOL], "career_profiles": [CAREER_PROFILE], "education_goals": [GOAL], "compensation_bands": BANDS}).persist_recommendations(CTX)
    warn = next((r for r in rows if r["recommendation_type"] == "high_debt_warning"), None)
    assert warn is not None  # net_cost 130000 > current market value 95000
    assert warn["governance_verdict"]["escalation_path"] == "financial_advisor"


@pytest.mark.asyncio
async def test_no_recommendation_without_programs():
    assert await _svc({}).persist_recommendations(CTX) == []


# ---- Chat grounding ----
@pytest.mark.asyncio
async def test_chat_context_cites_best_program():
    ctx_obj = await _svc({"programs": [PROGRAM_MS], "schools": [SCHOOL], "career_profiles": [CAREER_PROFILE], "education_goals": [GOAL], "compensation_bands": BANDS}).chat_context(CTX)
    joined = " ".join(f"{f['fact']} {f['value']}" for f in ctx_obj.authoritative_facts)
    assert "MS Computer Science" in joined and "income lift" in joined.lower()
