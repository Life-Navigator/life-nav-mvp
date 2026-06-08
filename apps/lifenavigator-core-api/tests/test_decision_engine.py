"""Decision Engine D1 — cross-domain decision classification + scenarios + persistence."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.decision_engine import DecisionEngine, classify
from app.services.market_intelligence import MarketPositionAnalyzer

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

BANDS = [
    {"occupation_code": "15-2051", "geography": "US", "p10": 60000, "p25": 75000, "p50": 95000, "p75": 120000, "p90": 145000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"},
    {"occupation_code": "15-1252", "geography": "US", "p10": 80000, "p25": 105000, "p50": 133000, "p75": 165000, "p90": 200000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"},
]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
EDU_GOAL = {"id": "eg1", "target_role": "Platform Engineer", "title": "MS"}
PROGRAM = {"id": "p1", "name": "MS Computer Science", "level": "masters", "major": "Computer Science", "modality": "hybrid", "duration_months": 24, "tuition": 42000, "graduation_rate": 0.86, "median_salary": 145000, "source": "College Scorecard", "school_id": "s1"}
JOB_TARGET = {"id": "t1", "role_title": "Platform Engineer", "location": "US"}
COLLEGE = [{"id": "c1", "target_year": 2033, "projected_cost": 120000, "saved_amount": 8000}]


def _engine(rows: dict) -> DecisionEngine:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    edu = EducationService(sb, comp)
    career = CareerService(sb, comp, MarketPositionAnalyzer(sb))
    family = FamilyService(sb, comp)
    return DecisionEngine(sb, edu, career, family)


def test_classify_routes_questions():
    assert classify("Should I get an MBA or invest the money?") == "mba_or_invest"
    assert classify("Is graduate school worth it?") == "grad_school"
    assert classify("Should I take the new job offer?") == "new_job"
    assert classify("Should we move to another state?") == "move_states"
    assert classify("How do I fund college for my kids?") == "college_funding"
    assert classify("What should I have for lunch?") == "general"


@pytest.mark.asyncio
async def test_education_decision_has_three_scenarios_and_evidence():
    eng = _engine({"programs": [PROGRAM], "career_profiles": [CAREER_PROFILE], "education_goals": [EDU_GOAL], "compensation_bands": BANDS})
    d = await eng.decide(CTX, "Should I get an MBA or invest?")
    assert d["decision_type"] == "mba_or_invest"
    labels = {s["label"] for s in d["scenarios_json"]}
    assert labels == {"worst", "expected", "best"}
    assert d["evidence_json"]  # cited
    assert "education" in d["affected_domains"] and "finance" in d["affected_domains"]
    assert d["governance_verdict"]["boundary_type"] == "decision_guidance"


@pytest.mark.asyncio
async def test_career_decision_uses_comp_band_scenarios():
    eng = _engine({"career_profiles": [CAREER_PROFILE], "job_targets": [JOB_TARGET], "compensation_bands": BANDS})
    d = await eng.decide(CTX, "Should I take the new job?")
    assert d["decision_type"] == "new_job"
    vals = {s["label"]: s["value"] for s in d["scenarios_json"]}
    assert vals["worst"] < vals["expected"] < vals["best"]  # banded
    assert any(e["metric_name"] == "current_market_value" for e in d["evidence_json"])


@pytest.mark.asyncio
async def test_college_funding_decision():
    eng = _engine({"college_planning": COLLEGE, "dependents": [{"id": "d1", "relationship": "child"}], "career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS})
    d = await eng.decide(CTX, "How do I fund college?")
    assert d["decision_type"] == "college_funding"
    assert {"family", "education"} <= set(d["affected_domains"])
    assert any(e["metric_name"] == "projected_cost" for e in d["evidence_json"])


@pytest.mark.asyncio
async def test_persist_stores_decision_with_scenarios():
    eng = _engine({"programs": [PROGRAM], "career_profiles": [CAREER_PROFILE], "education_goals": [EDU_GOAL], "compensation_bands": BANDS})
    res = await eng.persist(CTX, "MBA or invest?")
    assert res["stored"]
    assert len(res["decision"]["scenarios_json"]) == 3
    assert res["decision"]["confidence"] > 0


@pytest.mark.asyncio
async def test_no_evidence_decision_not_persisted():
    res = await _engine({}).persist(CTX, "Should I get an MBA?")
    assert res["stored"] is False  # no programs -> no fabricated decision
