"""Sprint 20 — Military / VA Pack (service/transition/GI Bill/VA-benefits readiness)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.military import MilitaryService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
DD214 = {"id": "d1", "user_id": CTX.user_id, "doc_type": "dd214", "uploaded_at": "2026-06-08",
         "extracted_json": {"branch": "Army", "discharge_type": "Honorable", "separation_date": "2024-03-01", "rank": "E-6"}}
VA = {"id": "v1", "user_id": CTX.user_id, "doc_type": "va_award_letter", "uploaded_at": "2026-06-08",
      "extracted_json": {"disability_rating": "70", "monthly_benefit": "1716"}}


def _svc(docs, career=False) -> MilitaryService:
    rows = {"documents": docs}
    if career:
        rows["career_profiles"] = [{"id": "cp1", "user_id": CTX.user_id, "current_title": "Ops Manager"}]
    return MilitaryService(FakeSupabase(rows))


@pytest.mark.asyncio
async def test_four_pillars_plus_index_and_boundary():
    a = await _svc([DD214]).assess(CTX)
    for k in ("military_readiness", "transition_readiness", "gi_bill_readiness", "va_benefits_readiness"):
        assert k in a and "status" in a[k] and "score" in a[k]
    assert 0 <= a["military_index"] <= 100 and a["boundary"]["boundary_type"] == "benefits_guidance"
    assert a["is_service_connected"] is True


@pytest.mark.asyncio
async def test_dd214_honorable_drives_military_and_gi_bill():
    a = await _svc([DD214]).assess(CTX)
    mr = a["military_readiness"]
    assert mr["honorable"] is True and mr["branch"] == "Army" and mr["status"] == "green"
    assert a["gi_bill_readiness"]["eligible"] is True  # honorable -> Post-9/11 eligible (informational)


@pytest.mark.asyncio
async def test_va_award_surfaces_rating_and_benefit():
    a = await _svc([DD214, VA]).assess(CTX)
    va = a["va_benefits_readiness"]
    assert va["disability_rating"] == 70 and va["monthly_benefit"] == 1716 and va["status"] == "green"


@pytest.mark.asyncio
async def test_transition_readiness_counts_elements():
    a = await _svc([DD214, VA], career=True).assess(CTX)
    tr = a["transition_readiness"]
    assert "Civilian career profile" in tr["in_place"] and "Service record (DD214)" in tr["in_place"]
    assert "VA benefits filed" in tr["in_place"]


@pytest.mark.asyncio
async def test_no_dd214_prompts_to_upload_not_fabricated():
    a = await _svc([]).assess(CTX)
    assert a["is_service_connected"] is False
    assert a["military_readiness"]["score"] < 50 and "dd214" in a["missing_documents"]
    assert a["gi_bill_readiness"]["eligible"] is None  # unknown, not assumed


@pytest.mark.asyncio
async def test_general_discharge_flags_lower_confidence():
    gen = {**DD214, "extracted_json": {**DD214["extracted_json"], "discharge_type": "General"}}
    a = await _svc([gen]).assess(CTX)
    assert a["military_readiness"]["honorable"] is False
    assert a["gi_bill_readiness"]["eligible"] is False  # non-honorable -> not auto-eligible
