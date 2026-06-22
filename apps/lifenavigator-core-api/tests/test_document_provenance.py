"""Document Intelligence Trust Sprint — P0 provenance: page/section/char locators + review lifecycle."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import DocumentExtractor, DocumentIntelligenceService, _page_for_offset
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
OFFER = "OFFER LETTER\nBase salary $150,000\nSigning bonus $20,000\nStart date 2025-01-15"


def test_page_for_offset_maps_into_spans():
    pages = [(0, 10), (11, 40)]
    assert _page_for_offset(3, pages) == 1
    assert _page_for_offset(20, pages) == 2
    assert _page_for_offset(999, pages) == 2  # past the end → last page
    assert _page_for_offset(5, None) is None   # pasted text → no page


def test_extract_carries_page_section_and_span():
    text = "COVER\nBase salary $150,000"
    pages = [(0, 5), (6, len(text))]  # page1="COVER", page2=rest
    ext = DocumentExtractor().extract("offer_letter", text, pages)
    sal = next(f for f in ext["fields"] if f["field_key"] == "base_salary")
    assert sal["page_number"] == 2
    assert "salary" in sal["section"]
    assert isinstance(sal["char_start"], int) and sal["char_start"] >= 6
    assert sal["char_end"] > sal["char_start"]
    assert sal["extraction_method"] == "regex"


@pytest.mark.asyncio
async def test_register_persists_provenance_columns():
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).register(CTX, doc_type="offer_letter", text=OFFER)
    field_rows = [row for (table, row) in sb.inserts if table == "document_fields"]
    assert field_rows, "expected document_fields inserts"
    for row in field_rows:
        assert "page_number" in row            # present (None for pasted text — no page structure)
        assert "section" in row and row["section"]
        assert isinstance(row["char_start"], int)
        assert row["extraction_method"] == "regex"
        assert row["review_status"] in ("extracted", "needs_review")


@pytest.mark.asyncio
async def test_set_field_review_confirm_edit_reject():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    await svc.register(CTX, doc_type="offer_letter", text=OFFER)
    field = (await sb.select("document_fields", schema="documents"))[0]
    fid = field["id"]

    r = await svc.set_field_review(CTX, field_id=fid, action="confirm")
    assert r["review_status"] == "user_confirmed"
    assert (await sb.select("document_fields", filters={"id": f"eq.{fid}"}))[0]["review_status"] == "user_confirmed"

    r = await svc.set_field_review(CTX, field_id=fid, action="edit", new_value="160000")
    assert r["review_status"] == "user_edited" and r["field_value"] == "160000"
    assert (await sb.select("document_fields", filters={"id": f"eq.{fid}"}))[0]["field_value"] == "160000"

    r = await svc.set_field_review(CTX, field_id=fid, action="reject")
    assert r["review_status"] == "rejected"

    with pytest.raises(ValueError):
        await svc.set_field_review(CTX, field_id=fid, action="bogus")
    with pytest.raises(ValueError):
        await svc.set_field_review(CTX, field_id=fid, action="edit")  # edit needs new_value


@pytest.mark.asyncio
async def test_field_evidence_returns_document_and_fields():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.register(CTX, doc_type="offer_letter", text=OFFER)
    ev = await svc.field_evidence(CTX, document_id=res["document_id"])
    assert ev["document"] and ev["document"]["doc_type"] == "offer_letter"
    assert ev["fields"] and all("page_number" in f and "review_status" in f for f in ev["fields"])
