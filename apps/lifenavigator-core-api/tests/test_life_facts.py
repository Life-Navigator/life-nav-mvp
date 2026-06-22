"""UI/Backend Parity Sprint — life.facts surfacing reader (the dashboard 'recently learned' source)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_facts import recent_facts
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _facts():
    return {"facts": [
        {"id": "f1", "fact_type": "trust.successor_trustee", "value": "Jane Doe", "domain": "family",
         "confidence": 0.9, "confirmation_status": "confirmed", "source": "document",
         "provenance": {"document_id": "doc-1"}, "updated_at": "2026-06-21"},
        {"id": "f2", "fact_type": "life_insurance_policy.coverage_amount", "value": "1000000", "domain": "family",
         "confidence": 0.7, "confirmation_status": "inferred", "source": "document",
         "provenance": {"document_id": "doc-2"}, "updated_at": "2026-06-20"},
        {"id": "f3", "fact_type": "trust.note", "value": "speculative", "domain": "family",
         "confidence": 0.3, "confirmation_status": "candidate", "source": "agent_inference",
         "provenance": {}, "updated_at": "2026-06-19"},
    ]}


@pytest.mark.asyncio
async def test_empty_user_returns_empty_list():
    assert await recent_facts(FakeSupabase({}), CTX) == []


@pytest.mark.asyncio
async def test_recent_facts_gates_and_shapes():
    items = await recent_facts(FakeSupabase(_facts()), CTX)
    vals = {i["value"] for i in items}
    assert "Jane Doe" in vals and "1000000" in vals     # confirmed + inferred surface
    assert "speculative" not in vals                    # candidate excluded (trust gate)

    # confirmed leads inferred
    assert items[0]["value"] == "Jane Doe"

    trustee = next(i for i in items if i["value"] == "Jane Doe")
    assert trustee["label"] == "Successor trustee"
    assert trustee["docType"] == "trust"
    assert trustee["documentId"] == "doc-1"             # provenance back-link for the Evidence drawer
    assert trustee["sourceTable"] == "life.facts"
    assert trustee["needsConfirmation"] is False

    cov = next(i for i in items if i["value"] == "1000000")
    assert cov["needsConfirmation"] is True             # inferred -> one-click confirm, never asserted


@pytest.mark.asyncio
async def test_domain_scope_filters():
    data = _facts()
    data["facts"].append({"id": "f4", "fact_type": "offer_letter.base_salary", "value": "200000",
                          "domain": "career", "confidence": 0.9, "confirmation_status": "confirmed",
                          "source": "document", "provenance": {"document_id": "doc-3"}, "updated_at": "2026-06-22"})
    career = await recent_facts(FakeSupabase(data), CTX, domain="career")
    assert {i["value"] for i in career} == {"200000"}
