"""Sprint 32 P0 — scanned/image documents never fail silently; processing status is explicit."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import DocumentIntelligenceService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _svc():
    return DocumentIntelligenceService(FakeSupabase({}))


@pytest.mark.asyncio
async def test_scanned_image_explains_never_silent():
    svc = _svc()
    res = await svc.register(CTX, doc_type="offer_letter", text="", source_kind="image")
    assert res["status"] == "needs_review" and res["status_reason"] == "scanned_or_image"
    assert "scanned document" in res["message"].lower() and res["next_steps"]
    ocr_step = next(s for s in res["processing_status"] if "OCR" in s["step"])
    assert ocr_step["done"] is False  # OCR step explicitly not done — not a silent 0
    assert res["fields_extracted"] == 0


@pytest.mark.asyncio
async def test_text_with_no_matching_fields_explains():
    svc = _svc()
    res = await svc.register(CTX, doc_type="offer_letter", text="Dear employee, welcome aboard!", source_kind="text")
    assert res["status"] == "needs_review" and res["status_reason"] == "no_fields_matched"
    assert "couldn't find the expected values" in res["message"]


@pytest.mark.asyncio
async def test_good_text_extracts_all_steps_done():
    svc = _svc()
    res = await svc.register(CTX, doc_type="offer_letter", text="Base Salary: $150,000\nSigning Bonus: $20,000", source_kind="text")
    assert res["status"] == "extracted" and res["status_reason"] == "extracted"
    assert res["message"] is None and res["fields_extracted"] >= 1
    assert all(s["done"] for s in res["processing_status"])
