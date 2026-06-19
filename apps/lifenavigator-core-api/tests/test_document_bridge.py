"""Document Intelligence Trust Sprint — the BRIDGE.

An uploaded document must create visible downstream value: extracted VALUES flow into the life
model (life.facts with document provenance) and into the user-owned Family tables that
FamilyService actually reads (estate_plans.has_will, guardianship_plans.designated_guardian,
insurance_profiles.life_coverage). Nothing is invented; candidate/inferred facts are never
auto-promoted; re-upload is idempotent; tenant scoping is preserved.
"""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import DocumentIntelligenceService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

WILL = """
Last Will and Testament of John Q. Public
Executor: Jane Doe
Guardian: Mary Smith
Beneficiaries: spouse and two children
Date: 2025-01-15
"""

WILL_NO_GUARDIAN = """
Last Will and Testament
Executor: Jane Doe
Date: 2025-01-15
"""

TRUST = """
Revocable Living Trust Agreement
Trust Name: Public Family Trust
Grantor: John Q. Public
Trustee: John Q. Public
Successor Trustee: Jane Doe
Beneficiaries: the children
Revocable Status: revocable
"""

LIFE_INS = """
Northwestern Life — Term Life Insurance Policy
Insurer: Northwestern Mutual
Policy Type: 20-year term
Coverage Amount: $1,000,000
Insured Person: John Q. Public
Beneficiaries: Spouse
Premium: $85
"""


def _facts(sb: FakeSupabase) -> list[dict]:
    return sb._by_table.get("facts", [])


def _life_fact(sb: FakeSupabase, fact_type: str) -> dict | None:
    return next((r for r in _facts(sb) if r["fact_type"] == fact_type), None)


# ───────────────────────── life.facts bridge ─────────────────────────
@pytest.mark.asyncio
async def test_will_upload_writes_life_facts_with_document_provenance():
    sb = FakeSupabase({})
    res = await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL.encode())
    exe = _life_fact(sb, "will.executor")
    grd = _life_fact(sb, "will.guardian")
    assert exe is not None and exe["value"] == "Jane Doe"
    assert grd is not None and grd["value"] == "Mary Smith"
    # provenance is document-sourced and carries the document_id
    assert exe["provenance"]["submitted_by"] == "document-intelligence"
    assert exe["provenance"]["source_type"] == "document"
    assert exe["provenance"]["document_id"] == res["document_id"]
    assert exe["source"] == "document"


@pytest.mark.asyncio
async def test_text_field_below_threshold_is_inferred_not_confirmed():
    """The text extractor returns 0.7 confidence for free-text fields → must be INFERRED, never
    auto-promoted to confirmed (below the 0.85 confirm threshold)."""
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL.encode())
    exe = _life_fact(sb, "will.executor")
    assert exe["confidence"] < 0.85
    assert exe["confirmation_status"] == "inferred"  # NOT auto-confirmed


@pytest.mark.asyncio
async def test_high_confidence_native_text_field_is_confirmed():
    """A high-confidence (>=0.85) labeled native-text field (money/date here) IS confirmed."""
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="life_insurance_policy", filename="p.txt", content_type="text/plain", data=LIFE_INS.encode())
    cov = _life_fact(sb, "life_insurance_policy.coverage_amount")
    assert cov is not None and cov["value"] == "1000000"
    assert cov["confidence"] >= 0.85 and cov["confirmation_status"] == "confirmed"


# ───────────────────────── Family-domain bridge ─────────────────────────
@pytest.mark.asyncio
async def test_will_upserts_estate_and_guardianship_rows():
    sb = FakeSupabase({})
    res = await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL.encode())
    estate = sb._by_table["estate_plans"][0]
    guardian = sb._by_table["guardianship_plans"][0]
    assert estate["has_will"] is True
    assert estate["user_id"] == CTX.user_id and estate["tenant_id"] == CTX.user_id
    assert estate["metadata"]["executor"] == "Jane Doe"   # no executor column → metadata
    assert guardian["status"] == "designated" and guardian["designated_guardian"] == "Mary Smith"
    assert "Estate plan updated (will on file)" in res["changed"]
    assert "Guardian recorded: Mary Smith" in res["changed"]


@pytest.mark.asyncio
async def test_life_insurance_upserts_coverage_into_insurance_profiles():
    sb = FakeSupabase({})
    res = await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="life_insurance_policy", filename="p.txt", content_type="text/plain", data=LIFE_INS.encode())
    ins = sb._by_table["insurance_profiles"][0]
    assert ins["life_coverage"] == 1000000.0   # real column FamilyService reads
    assert ins["source"] == "document-intelligence"
    assert ins["metadata"]["policy_type"] == "20-year term"  # no column → metadata
    assert _life_fact(sb, "life_insurance_policy.coverage_amount") is not None
    assert any("Family readiness will recalculate" in c for c in res["changed"])


@pytest.mark.asyncio
async def test_trust_records_metadata_only_no_invented_columns():
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="trust", filename="t.txt", content_type="text/plain", data=TRUST.encode())
    estate = sb._by_table["estate_plans"][0]
    # trust attributes go to metadata (no has_trust/trustee top-level COLUMN invented)
    assert "trustee" not in {k for k in estate if k != "metadata"}
    assert estate["metadata"]["trustee"] == "John Q. Public"
    assert estate["metadata"]["has_trust"] is True
    assert _life_fact(sb, "trust.trustee") is not None


# ───────────────────────── no fabrication ─────────────────────────
@pytest.mark.asyncio
async def test_no_guardian_extracted_means_no_guardianship_row():
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL_NO_GUARDIAN.encode())
    assert sb._by_table["estate_plans"][0]["has_will"] is True       # will WAS present
    assert "guardianship_plans" not in sb._by_table                  # guardian was NOT → nothing written
    assert _life_fact(sb, "will.guardian") is None                   # no fabricated guardian fact


@pytest.mark.asyncio
async def test_insurance_without_coverage_writes_no_insurance_row():
    sb = FakeSupabase({})
    no_cov = "Term Life Insurance Policy\nInsurer: Northwestern Mutual\nPolicy Type: term\n"
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="life_insurance_policy", filename="p.txt", content_type="text/plain", data=no_cov.encode())
    assert "insurance_profiles" not in sb._by_table  # no coverage value → no insurance row fabricated


# ───────────────────────── preserve user data ─────────────────────────
@pytest.mark.asyncio
async def test_does_not_overwrite_user_designated_guardian():
    sb = FakeSupabase({"guardianship_plans": [
        {"id": "g1", "user_id": CTX.user_id, "status": "designated", "designated_guardian": "Aunt May"}]})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL.encode())
    g = sb._by_table["guardianship_plans"][0]
    assert g["designated_guardian"] == "Aunt May"  # user's designation preserved, not overwritten


@pytest.mark.asyncio
async def test_does_not_lower_user_higher_coverage():
    sb = FakeSupabase({"insurance_profiles": [
        {"id": "i1", "user_id": CTX.user_id, "life_coverage": 2000000.0, "source": "user"}]})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="life_insurance_policy", filename="p.txt", content_type="text/plain", data=LIFE_INS.encode())
    ins = sb._by_table["insurance_profiles"][0]
    assert ins["life_coverage"] == 2000000.0  # higher user coverage kept, not lowered to 1,000,000


# ───────────────────────── idempotency + tenant scope ─────────────────────────
@pytest.mark.asyncio
async def test_reupload_is_idempotent_no_duplicate_facts_or_rows():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    # register twice with the SAME document id so the document+field idempotency key is stable
    await svc.register(CTX, doc_type="will", text=WILL, _doc_id="doc-fixed", acknowledge_sensitive=True)
    await svc.register(CTX, doc_type="will", text=WILL, _doc_id="doc-fixed", acknowledge_sensitive=True)
    exec_facts = [r for r in _facts(sb) if r["fact_type"] == "will.executor"]
    assert len(exec_facts) == 1                              # deterministic id → no dup fact
    assert len(sb._by_table["estate_plans"]) == 1           # one estate row per user
    assert len(sb._by_table["guardianship_plans"]) == 1


@pytest.mark.asyncio
async def test_bridged_rows_are_tenant_scoped_from_context():
    sb = FakeSupabase({})
    await DocumentIntelligenceService(sb).upload(
        CTX, doc_type="will", filename="will.txt", content_type="text/plain", data=WILL.encode())
    for table in ("facts", "estate_plans", "guardianship_plans"):
        for row in sb._by_table[table]:
            assert row["user_id"] == CTX.user_id and row["tenant_id"] == CTX.user_id
