"""Elite Sprint 10 — Document Intelligence Platform: extraction + readiness/timeline/recs."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import (
    DocumentExtractor,
    DocumentIntelligenceService,
    DocumentParser,
    evidence_from_fields,
)

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

OFFER = """
ACME Corp — Offer of Employment
Title: Senior Software Engineer
Base Salary: $185,000
Signing Bonus: $25,000
Annual Bonus: 15%
Equity Grant: $300,000 over 4 years
Start Date: 2026-08-01
"""
POLICY = """
Northwestern Life — Term Life Insurance Policy
Coverage Amount: $1,000,000
Premium: $85
Beneficiary: Spouse
Term Years: 20
"""


def test_extractor_pulls_labeled_fields():
    ext = DocumentExtractor().extract("offer_letter", OFFER)
    fields = {f["field_key"]: f["field_value"] for f in ext["fields"]}
    assert fields["base_salary"] == "185000"
    assert fields["signing_bonus"] == "25000"
    assert fields["start_date"] == "2026-08-01"
    assert ext["confidence"] > 0.7
    assert ext["dates"]["document_date"] == "2026-08-01"


def test_extractor_invents_nothing_when_absent():
    ext = DocumentExtractor().extract("offer_letter", "Title: Analyst\n")  # no salary present
    keys = {f["field_key"] for f in ext["fields"]}
    assert "base_salary" not in keys  # not fabricated


@pytest.mark.asyncio
async def test_register_persists_document_and_fields():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.register(CTX, doc_type="offer_letter", text=OFFER)
    assert res["fields_extracted"] >= 4 and res["category"] == "employment"
    assert "career" in res["affects_domains"] and res["status"] == "extracted"
    docs = await sb.select("documents", schema="documents")
    fields = await sb.select("document_fields", schema="documents")
    assert len(docs) == 1 and len(fields) >= 4  # fields become :DocumentField graph rows


@pytest.mark.asyncio
async def test_readiness_scores_categories_and_flags_missing():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    await svc.register(CTX, doc_type="offer_letter", text=OFFER)
    r = await svc.readiness(CTX)
    emp = next(c for c in r["categories"] if c["category"] == "employment")
    assert emp["have"] == 1 and emp["status"] in ("green", "yellow")
    ins = next(c for c in r["categories"] if c["category"] == "insurance")
    assert ins["status"] == "red" and "Life Insurance Policy" in ins["missing"]
    assert 0 <= r["overall_score"] <= 100


@pytest.mark.asyncio
async def test_timeline_and_recommendations():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    await svc.register(CTX, doc_type="offer_letter", text=OFFER)
    await svc.register(CTX, doc_type="life_insurance_policy", text=POLICY)
    tl = await svc.timeline(CTX)
    assert len(tl) == 2
    recs = await svc.recommendations(CTX)
    # still missing critical docs (401k, brokerage, will, etc.) -> recommendations to upload them
    assert any("Upload your" in r["title"] for r in recs)


@pytest.mark.asyncio
async def test_unknown_doc_type_rejected():
    with pytest.raises(ValueError):
        await DocumentIntelligenceService(FakeSupabase({})).register(CTX, doc_type="mystery", text="x")


# ---- Sprint 11: parse + upload + generated evidence ----

def test_parser_passthrough_text():
    out = DocumentParser().parse("offer.txt", "text/plain", OFFER.encode())
    assert out["kind"] == "text" and "Base Salary" in out["text"]


def test_parser_pdf_extracts_text():
    fpdf = pytest.importorskip("fpdf")
    pdf = fpdf.FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    for line in OFFER.strip().splitlines():
        ascii_line = line.encode("latin-1", "ignore").decode("latin-1")  # fpdf core fonts are latin-1
        pdf.cell(0, 8, ascii_line, ln=1)
    data = bytes(pdf.output())
    out = DocumentParser().parse("offer.pdf", "application/pdf", data)
    assert out["kind"] == "pdf"
    assert "185,000" in out["text"] or "185000" in out["text"].replace(",", "")


def test_parser_image_defers_to_ocr():
    out = DocumentParser().parse("scan.png", "image/png", b"\x89PNG\r\n")
    assert out["kind"] == "image" and out["text"] == ""


def test_evidence_generated_from_fields():
    ext = DocumentExtractor().extract("offer_letter", OFFER)
    ev = evidence_from_fields("offer_letter", ext["fields"])
    salary = next(e for e in ev if e["field_key"] == "base_salary")
    assert "Offer Letter" in salary["statement"] and "$185,000" in salary["statement"]
    assert "career" in salary["domains"] and "finance" in salary["domains"]


@pytest.mark.asyncio
async def test_upload_stores_parses_extracts_generates_evidence():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.upload(CTX, doc_type="offer_letter", filename="offer.txt", content_type="text/plain", data=OFFER.encode())
    assert res["parsed_kind"] == "text" and res["parsed_chars"] > 0
    assert res["fields_extracted"] >= 4
    assert res["evidence"] and any("Offer Letter" in e["statement"] for e in res["evidence"])
    docs = await sb.select("documents", schema="documents")
    assert docs[0]["file_ref"].startswith(CTX.user_id)  # stored under the user's folder
