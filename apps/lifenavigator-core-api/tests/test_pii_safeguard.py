"""Sprint 42B — PII upload safeguard: detect, warn, don't store, log counts (never values)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.documents import DocumentIntelligenceService, scan_pii
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def test_scan_detects_ssn_and_card_not_balances():
    # SSN (dashed) + a Luhn-valid Visa test number — detected
    hit = scan_pii("Employee SSN: 123-45-6789 and card 4111 1111 1111 1111")
    assert hit.get("ssn") and hit.get("credit_or_debit_card")
    # normal financial numbers must NOT false-positive
    clean = scan_pii("Base salary $192,000. 401(k) balance $80,000 at 6% match. Rate 6.5%.")
    assert clean == {}


def test_labeled_account_and_routing_detected():
    hit = scan_pii("Routing number 021000021, Account Number: 12345678")
    assert "routing_number" in hit and "account_number" in hit


@pytest.mark.asyncio
async def test_register_blocks_unacknowledged_pii_and_does_not_store():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.register(CTX, doc_type="offer_letter", text="Base Salary: $150,000. SSN: 123-45-6789")
    assert res["stored"] is False and res["pii_warning"] is True and res["requires_confirmation"] is True
    assert any(d["category"] == "ssn" for d in res["detected"])
    # NOTHING was written to documents (blocked)
    assert not await sb.select("documents", filters={"user_id": f"eq.{CTX.user_id}"}, schema="documents")
    # a detection event WAS logged — with the category, NOT the value
    ev = await sb.select("pii_scan_events", filters={"user_id": f"eq.{CTX.user_id}"}, schema="documents")
    assert ev and ev[0]["categories"].get("ssn") == 1 and ev[0]["acknowledged"] is False
    assert "123-45-6789" not in str(ev[0])  # the value is never stored


@pytest.mark.asyncio
async def test_register_proceeds_when_acknowledged():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.register(CTX, doc_type="offer_letter", text="Base Salary: $150,000. SSN: 123-45-6789",
                             acknowledge_sensitive=True)
    assert res.get("document_id") and res.get("status") in ("extracted", "needs_review")  # stored
    ev = await sb.select("pii_scan_events", filters={"user_id": f"eq.{CTX.user_id}"}, schema="documents")
    assert ev and ev[-1]["acknowledged"] is True


@pytest.mark.asyncio
async def test_clean_document_stores_normally_no_event():
    sb = FakeSupabase({})
    svc = DocumentIntelligenceService(sb)
    res = await svc.register(CTX, doc_type="offer_letter", text="Base Salary: $150,000\nSigning Bonus: $20,000")
    assert res.get("document_id") and res.get("fields_extracted", 0) >= 1
    assert not await sb.select("pii_scan_events", filters={"user_id": f"eq.{CTX.user_id}"}, schema="documents")
