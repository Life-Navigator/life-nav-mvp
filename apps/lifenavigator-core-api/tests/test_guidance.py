"""Elite Sprint 23 — Next-Best-Action / dashboard guidance engine."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.documents import DocumentIntelligenceService
from app.services.guidance import GuidanceEngine
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.readiness import LifeReadinessEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _engine(rows: dict) -> GuidanceEngine:
    sb = FakeSupabase(rows)
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    return GuidanceEngine(readiness=readiness, documents=DocumentIntelligenceService(sb), supabase=sb)


@pytest.mark.asyncio
async def test_new_user_first_action_is_upload_document():
    d = await _engine({}).dashboard(CTX)
    assert d["next_best_action"]["step"] == "documents"
    assert "offer letter" in d["next_best_action"]["title"].lower()
    assert d["next_best_action"]["why"]  # always explains WHY (no dead end)
    assert d["documents_on_file"] == 0


@pytest.mark.asyncio
async def test_dashboard_answers_status_next_why():
    d = await _engine({}).dashboard(CTX)
    assert "status" in d and "index" in d["status"] and d["status"]["headline"]
    nba = d["next_best_action"]
    assert nba["title"] and nba["why"] and nba["href"] and nba["cta_label"]


@pytest.mark.asyncio
async def test_missing_documents_are_outcome_framed_not_empty():
    d = await _engine({}).dashboard(CTX)
    md = d["missing_critical_documents"]
    assert md and all("unlock" in m["why"].lower() or "value" in m["why"].lower() for m in md)


@pytest.mark.asyncio
async def test_with_docs_but_no_decision_next_action_is_decision_or_gap():
    rows = {"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08", "extracted_json": {"base_salary": "150000"}},
                          {"id": "d2", "user_id": CTX.user_id, "doc_type": "medical_plan", "uploaded_at": "2026-06-08", "extracted_json": {}},
                          {"id": "d3", "user_id": CTX.user_id, "doc_type": "401k_statement", "uploaded_at": "2026-06-08", "extracted_json": {}},
                          {"id": "d4", "user_id": CTX.user_id, "doc_type": "life_insurance_policy", "uploaded_at": "2026-06-08", "extracted_json": {}}]}
    d = await _engine(rows).dashboard(CTX)
    assert d["documents_on_file"] == 4
    # with docs present, the next step is no longer "upload" — it's a gap or a decision
    assert d["next_best_action"]["step"] in ("gaps", "decision")


@pytest.mark.asyncio
async def test_journey_progress_tracked():
    d = await _engine({}).dashboard(CTX)
    j = d["journey"]
    assert j["documents"] is False and j["decision_analyzed"] is False and j["readiness"] is True


@pytest.mark.asyncio
async def test_top_gaps_use_outcome_language():
    d = await _engine({}).dashboard(CTX)
    for g in d["top_gaps"]:
        assert g["label"] and g["href"] and g["gap"]  # human outcome label + a place to go
