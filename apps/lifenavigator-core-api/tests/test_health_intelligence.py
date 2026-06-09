"""Sprint 19 — Health Intelligence Foundation (labs/supplements/meds/fitness/nutrition)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import DocumentExtractor
from app.services.health_intelligence import HealthIntelligenceService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
HEALTH_DOCS = [
    {"id": "l1", "user_id": CTX.user_id, "doc_type": "lab_report", "uploaded_at": "2026-06-08",
     "extracted_json": {"total_cholesterol": "210", "hdl": "55", "ldl": "120", "glucose": "92", "a1c": "5.4", "vitamin_d": "22"}},
    {"id": "s1", "user_id": CTX.user_id, "doc_type": "supplement_list", "uploaded_at": "2026-06-08",
     "extracted_json": {"supplements": "Vitamin D, Omega-3, Magnesium"}},
    {"id": "m1", "user_id": CTX.user_id, "doc_type": "medication_list", "uploaded_at": "2026-06-08",
     "extracted_json": {"medications": "Lisinopril; Atorvastatin"}},
    {"id": "f1", "user_id": CTX.user_id, "doc_type": "fitness_plan", "uploaded_at": "2026-06-08",
     "extracted_json": {"weekly_workouts": "4", "goal": "Run a half marathon", "target_weight": "170"}},
    {"id": "n1", "user_id": CTX.user_id, "doc_type": "nutrition_log", "uploaded_at": "2026-06-08",
     "extracted_json": {"daily_calories": "2200", "protein_g": "150"}},
]


def _svc(docs=HEALTH_DOCS) -> HealthIntelligenceService:
    return HealthIntelligenceService(FakeSupabase({"documents": docs}))


def test_lab_report_doc_type_extracts_markers():
    text = "Lab Results\nTotal Cholesterol: 210 mg/dL\nHDL: 55\nLDL: 120\nGlucose: 92\nA1C: 5.4\nVitamin D: 22"
    ext = DocumentExtractor().extract("lab_report", text)
    keys = {f["field_key"]: f["field_value"] for f in ext["fields"]}
    assert keys["total_cholesterol"] == "210" and keys["a1c"] == "5.4" and keys["vitamin_d"] == "22"


@pytest.mark.asyncio
async def test_labs_flag_out_of_range_without_diagnosis():
    a = await _svc().assess(CTX)
    labs = a["labs"]
    chol = next(m for m in labs["markers"] if m["marker"] == "total_cholesterol")
    vitd = next(m for m in labs["markers"] if m["marker"] == "vitamin_d")
    assert chol["flag"] == "outside_range"   # 210 > 200
    assert vitd["flag"] == "outside_range"   # 22 < 30
    assert next(m for m in labs["markers"] if m["marker"] == "hdl")["flag"] == "within_range"  # 55 >= 40
    # the safe framing: explicitly NOT a diagnosis, discuss with clinician
    assert "not a diagnosis" in labs["note"].lower() and "clinician" in labs["note"].lower()


@pytest.mark.asyncio
async def test_supplements_and_medications_listed():
    a = await _svc().assess(CTX)
    assert a["supplements"]["count"] == 3 and "Omega-3" in a["supplements"]["items"]
    assert a["medications"]["count"] == 2 and "Atorvastatin" in a["medications"]["items"]


@pytest.mark.asyncio
async def test_fitness_and_nutrition():
    a = await _svc().assess(CTX)
    assert a["fitness"]["weekly_workouts"] == 4 and a["fitness"]["status"] == "green"
    assert a["nutrition"]["daily_calories"] == 2200 and a["nutrition"]["protein_g"] == 150


@pytest.mark.asyncio
async def test_readiness_and_action_items_and_medical_boundary():
    a = await _svc().assess(CTX)
    assert a["readiness"]["score"] == 100  # all five inputs present
    assert any("reference range" in s for s in a["action_items"])  # flagged labs surfaced
    assert a["boundary"]["boundary_type"] == "medical"


@pytest.mark.asyncio
async def test_empty_prompts_not_fabricated():
    a = await _svc(docs=[]).assess(CTX)
    assert a["readiness"]["score"] == 0 and a["labs"]["tracked"] == 0
    assert "lab_report" in a["missing_documents"]
