"""Document Intelligence Trust Sprint — Phase 8 resume import pipeline.

Trust invariants:
  * PDF and DOCX resumes extract structured records (employment/education/certs/skills)
  * nothing auto-imports — items stage as reviewable, low-confidence ones flagged needs_review
  * a user edit before import is honored; ignored items never import
  * imported domain rows carry provenance (which resume, page, confidence) in metadata
  * conflict detection runs before import (reuse Phase 6) and after import (Phase 6 scan)
  * advisor cites the resume; reports flag imported-from-resume; tenant isolation holds
"""
from __future__ import annotations

import io
import zipfile

import pytest

from app.models.common import UserContext
from app.services.advisor_facts import build_fact_packet
from app.services.documents import DocumentParser, DocumentIntelligenceService
from app.services.resume import ResumeExtractor, ResumeImportService
from .conftest import FakeSupabase

UID = "11111111-1111-1111-1111-111111111111"
CTX = UserContext(user_id=UID)

RESUME = """Jane Smith

EXPERIENCE
VP Engineering, Acme Inc | Jan 2020 - Present | New York, NY
- Led the platform team

Software Engineer at Globex | 2016 - 2019
- Shipped features

VOLUNTEER
Mentor at Code Club | 2018 - Present

PROJECTS
OpenGraph
- A graph visualization library

EDUCATION
Master of Science in Computer Science, Stanford University, 2016
Bachelor of Science in Mathematics, MIT, 2014

CERTIFICATIONS
AWS Certified Solutions Architect — Amazon, 2021

SKILLS
Python, Go, Kubernetes, Leadership
"""


def _docx_bytes(text: str) -> bytes:
    """Minimal valid .docx (zip with word/document.xml) for the DOCX parse path."""
    paras = "".join(
        f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in text.splitlines()
    )
    doc = ('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/'
           f'wordprocessingml/2006/main"><w:body>{paras}</w:body></w:document>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", doc)
    return buf.getvalue()


# ── extraction ───────────────────────────────────────────────────────────────────
def test_extractor_pulls_all_sections():
    items = ResumeExtractor().extract(RESUME, None)
    by = {}
    for i in items:
        by.setdefault(i["section"], []).append(i["fields"])
    assert len(by["employment"]) == 2
    assert by["employment"][0]["title"] == "VP Engineering"
    assert by["employment"][0]["employer"] == "Acme Inc"
    assert by["employment"][0]["is_current"] is True
    assert len(by["education"]) == 2
    assert by["education"][0]["institution_name"] == "Stanford University"
    assert by["certifications"][0]["name"] == "AWS Certified Solutions Architect"
    assert {f["name"] for f in by["skills"]} == {"Python", "Go", "Kubernetes", "Leadership"}


def test_docx_parser_roundtrip():
    parsed = DocumentParser().parse("resume.docx",
                                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                    _docx_bytes(RESUME))
    assert parsed["kind"] == "docx"
    assert "VP Engineering" in parsed["text"] and "Stanford University" in parsed["text"]


# ── ingest (staging, no auto-import) ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_ingest_stages_items_without_importing():
    sb = FakeSupabase({})
    res = await ResumeImportService(sb).ingest(CTX, text=RESUME)
    assert res["doc_type"] == "resume" and res["fields_extracted"] > 0
    staged = [r for (t, r) in sb.inserts if t == "resume_items"]
    assert staged, "expected staged resume_items"
    # nothing was written to any domain table during ingest
    assert not any(t in ("experience_records", "education_records", "certifications") for t, _ in sb.inserts)
    # review payload is grouped by section with per-item review status
    sections = {s["section"] for s in res["review"]["sections"]}
    assert {"employment", "education", "certifications", "skills"} <= sections


@pytest.mark.asyncio
async def test_low_confidence_item_flagged_needs_review():
    sb = FakeSupabase({})
    # a bare employer line with no title/dates → low confidence
    await ResumeImportService(sb).ingest(CTX, text="EXPERIENCE\nSomeCompany\n")
    staged = [r for (t, r) in sb.inserts if t == "resume_items"]
    assert any(r["review_status"] == "needs_review" for r in staged)


# ── review actions + import ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_edit_before_import_is_honored_and_ignored_items_skip():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    doc_id = res["document_id"]
    emp = [s for s in res["review"]["sections"] if s["section"] == "employment"][0]["items"]
    edit_id, ignore_id = emp[0]["id"], emp[1]["id"]

    fixed = dict(emp[0]["fields"]); fixed["title"] = "Chief Technology Officer"
    await svc.set_item(CTX, item_id=edit_id, action="edit", fields=fixed)
    await svc.set_item(CTX, item_id=ignore_id, action="ignore")

    summary = await svc.import_items(CTX, document_id=doc_id)
    rows = {t: r for (t, r) in sb.inserts if t == "experience_records"}
    exp_rows = [r for (t, r) in sb.inserts if t == "experience_records"]
    assert len(exp_rows) == 1  # one employment imported (the other was ignored)
    assert exp_rows[0]["title"] == "Chief Technology Officer"  # edit honored
    assert summary["imported"].get("employment") == 1


@pytest.mark.asyncio
async def test_import_preserves_provenance_in_metadata():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    await svc.import_items(CTX, document_id=res["document_id"])
    cert = [r for (t, r) in sb.inserts if t == "certifications"][0]
    meta = cert["metadata"]
    assert meta["source"] == "resume-import"
    assert meta["source_document_id"] == res["document_id"]
    assert "source_field_id" in meta and "imported_at" in meta
    # the staging item is back-linked to the imported domain row
    item = [r for (t, r) in sb.inserts if t == "resume_items" and r["section"] == "certifications"][0]
    linked = [r for (t, r) in sb.inserts if t == "resume_items"]  # updates applied in place
    assert any(i.get("target_record_id") == cert["id"] for i in await sb.select("resume_items"))


@pytest.mark.asyncio
async def test_education_without_institution_is_skipped_not_crashed():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text="EDUCATION\nMaster of Science in Data\n")  # no institution
    summary = await svc.import_items(CTX, document_id=res["document_id"])
    assert not any(t == "education_records" for t, _ in sb.inserts)
    assert any(s["reason"].startswith("missing institution") for s in summary["skipped"])


# ── conflict integration (Phase 6 reuse) ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_preview_conflicts_before_import():
    sb = FakeSupabase({
        "career_profiles": [{"id": "cp1", "user_id": UID, "current_title": "Senior Engineering Manager"}],
    })
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)  # resume says VP Engineering
    conflicts = await svc.preview_conflicts(CTX, document_id=res["document_id"])
    roles = [c for c in conflicts if c["concept"] == "current_role"]
    assert roles, "expected a current_role conflict (VP Engineering vs Senior Engineering Manager)"
    vals = {i["value"] for i in roles[0]["items"]}
    assert "VP Engineering" in vals and "Senior Engineering Manager" in vals


@pytest.mark.asyncio
async def test_import_triggers_conflict_scan():
    sb = FakeSupabase({
        "career_profiles": [{"id": "cp1", "user_id": UID, "current_title": "Senior Engineering Manager"}],
    })
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    await svc.import_items(CTX, document_id=res["document_id"])
    # the Phase 6 scan persisted a conflict (imported current role vs profile)
    conflicts = await sb.select("field_conflicts", filters={"user_id": f"eq.{UID}"})
    assert any(c.get("conflict_type") == "current_role_mismatch" for c in conflicts)


# ── graph + advisor + reports ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_import_creates_graph_life_facts():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    await svc.import_items(CTX, document_id=res["document_id"])
    facts = [r for (t, r) in sb.inserts if t == "facts"]
    assert any(f.get("fact_type") == "resume.employment" for f in facts)
    assert any(f.get("fact_type") == "resume.education" for f in facts)


@pytest.mark.asyncio
async def test_advisor_cites_resume_after_import():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    await svc.import_items(CTX, document_id=res["document_id"])
    packet = await build_fact_packet(sb, CTX)
    role = next((f for f in packet if f["label"] == "Current role"), None)
    assert role is not None and role["source"] == "Imported from your resume"


# ── tenant isolation ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_tenant_isolation_on_review_and_import():
    sb = FakeSupabase({})
    svc = ResumeImportService(sb)
    res = await svc.ingest(CTX, text=RESUME)
    other = UserContext(user_id="22222222-2222-2222-2222-222222222222")
    assert await svc.review_payload(other, document_id=res["document_id"]) == {
        "document_id": res["document_id"], "sections": []}
    summary = await svc.import_items(other, document_id=res["document_id"])
    assert summary["imported_total"] == 0


# ── HTTP surface ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_resume_endpoints_flow(make_client):
    client = make_client({})
    from .conftest import make_jwt
    h = {"Authorization": f"Bearer {make_jwt(UID)}"}

    reg = client.post("/v1/documents", headers=h, json={"doc_type": "resume", "text": RESUME})
    assert reg.status_code == 200
    doc_id = reg.json()["document_id"]
    assert reg.json()["doc_type"] == "resume"

    review = client.get(f"/v1/documents/resume/{doc_id}/review", headers=h).json()
    assert any(s["section"] == "employment" for s in review["sections"])

    imported = client.post(f"/v1/documents/resume/{doc_id}/import", headers=h, json={})
    assert imported.status_code == 200
    assert imported.json()["imported_total"] > 0
