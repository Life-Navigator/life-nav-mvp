"""Sprint 18 — Family Office Foundation (estate/trust/beneficiary/survivor/legacy readiness)."""
from __future__ import annotations

import pytest

from app.domains.family import FamilyService
from app.models.common import UserContext
from app.services.comp_benefits import CompensationBenefitsEngine
from app.services.compensation import CompensationIntelligenceEngine
from app.services.family_office import FamilyOfficeService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
BANDS = [{"occupation_code": "15-2051", "geography": "US", "p25": 75000, "p50": 95000, "p75": 120000, "currency": "USD", "confidence": 0.8, "source_name": "OEWS", "as_of_date": "2024-05-01"}]
CAREER = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}


def _svc(rows: dict) -> FamilyOfficeService:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    return FamilyOfficeService(supabase=sb, family_service=FamilyService(sb, comp), comp_benefits=CompensationBenefitsEngine(sb))


@pytest.mark.asyncio
async def test_assess_returns_five_pillars_plus_legacy_index():
    a = await _svc({}).assess(CTX)
    for k in ("estate_readiness", "trust_readiness", "beneficiary_readiness", "survivor_planning", "legacy_readiness"):
        assert k in a and "status" in a[k] and "score" in a[k]
    assert 0 <= a["legacy_index"] <= 100
    assert a["boundary"]["boundary_type"] == "legal"


@pytest.mark.asyncio
async def test_estate_readiness_from_documents_and_family():
    rows = {"estate_plans": [{"id": "e1", "user_id": CTX.user_id, "has_will": True, "has_poa": True, "has_beneficiaries": True}],
            "documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "estate_plan", "uploaded_at": "2026-06-08", "extracted_json": {"has_healthcare_directive": "yes"}}]}
    a = await _svc(rows).assess(CTX)
    est = a["estate_readiness"]
    assert "Will" in est["in_place"] and "Healthcare directive" in est["in_place"]
    assert est["status"] == "green" and est["score"] == 100


@pytest.mark.asyncio
async def test_trust_warranted_with_dependents_but_missing():
    rows = {"dependents": [{"id": "d1", "user_id": CTX.user_id, "relationship": "child"}],
            "career_profiles": [CAREER], "compensation_bands": BANDS}
    a = await _svc(rows).assess(CTX)
    tr = a["trust_readiness"]
    assert tr["warranted"] is True and tr["has_trust"] is False and tr["status"] in ("orange", "red")


@pytest.mark.asyncio
async def test_trust_present_scores_high():
    rows = {"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "trust", "uploaded_at": "2026-06-08", "extracted_json": {"trust_type": "Revocable Living", "trustee": "Spouse", "estimated_value": "750000"}}]}
    a = await _svc(rows).assess(CTX)
    assert a["trust_readiness"]["has_trust"] is True and a["trust_readiness"]["status"] == "green"


@pytest.mark.asyncio
async def test_survivor_planning_flags_coverage_gap():
    rows = {"dependents": [{"id": "d1", "user_id": CTX.user_id, "relationship": "child"}],
            "insurance_profiles": [{"id": "i1", "user_id": CTX.user_id, "life_coverage": 100000}],
            "career_profiles": [CAREER], "compensation_bands": BANDS}
    a = await _svc(rows).assess(CTX)
    sp = a["survivor_planning"]
    # need (10x income) >> 100k coverage -> gap, not covered
    assert sp.get("covered") is False and sp["coverage_gap"] > 0


@pytest.mark.asyncio
async def test_legacy_index_is_weakest_aware_and_missing_docs_listed():
    a = await _svc({}).assess(CTX)
    assert a["legacy_readiness"]["weakest_pillar"]
    assert "will" in a["missing_documents"] and "trust" in a["missing_documents"]


@pytest.mark.asyncio
async def test_nothing_fabricated_when_empty():
    a = await _svc({}).assess(CTX)
    # no estate docs/flags -> estate missing items present, not assumed complete
    assert a["estate_readiness"]["missing"] and a["estate_readiness"]["score"] < 100
