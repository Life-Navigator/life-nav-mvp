"""Document Intelligence Trust Sprint — Phase 6 conflict detection.

Trust invariants:
  * values that match after normalization are NOT a conflict
  * values that differ ARE a conflict, with both sources cited
  * precedence (user_confirmed > user_entered > extracted) recommends the winner — never auto-applies
  * low-confidence-only divergence is a *potential* conflict (low severity)
  * resolving stores the winning value; ignoring stops it blocking; tenant isolation holds
  * the advisor sees open conflicts; reports flag them
"""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.advisor_facts import build_fact_packet
from app.services.conflicts import ConflictDetectionService, open_conflict_facts
from .conftest import FakeSupabase

UID = "11111111-1111-1111-1111-111111111111"
CTX = UserContext(user_id=UID)


def _doc(doc_id, doc_type, title="Doc"):
    return {"id": doc_id, "user_id": UID, "doc_type": doc_type, "title": title}


def _field(fid, doc_id, key, value, *, conf=0.9, review="extracted"):
    return {"id": fid, "user_id": UID, "document_id": doc_id, "field_key": key,
            "field_value": value, "confidence": conf, "review_status": review,
            "page_number": 1, "section": key.replace("_", " ")}


async def _scan(rows) -> tuple[FakeSupabase, list[dict]]:
    sb = FakeSupabase(rows)
    conflicts = await ConflictDetectionService(sb).scan(CTX)
    return sb, conflicts


# ── normalization: match vs differ ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_no_conflict_when_values_match_after_normalization():
    _, conflicts = await _scan({
        "documents": [_doc("d1", "offer_letter")],
        "document_fields": [_field("f1", "d1", "title", "VP Engineering")],
        "experience_records": [{"id": "e1", "user_id": UID, "is_current": True,
                                "title": "Vice President of Engineering"}],
    })
    assert conflicts == []  # "VP Engineering" == "Vice President of Engineering" after normalization


@pytest.mark.asyncio
async def test_conflict_when_values_differ():
    _, conflicts = await _scan({
        "documents": [_doc("d1", "offer_letter", "Acme Offer")],
        "document_fields": [_field("f1", "d1", "title", "Director")],
        "experience_records": [{"id": "e1", "user_id": UID, "is_current": True, "title": "Senior Manager"}],
    })
    assert len(conflicts) == 1
    c = conflicts[0]
    assert c["conflict_type"] == "current_role_mismatch"
    assert sorted(c["competing_values"]) == ["director", "senior manager"]
    assert len(c["items"]) == 2  # both sources cited
    assert {i["source_type"] for i in c["items"]} == {"document", "domain"}


@pytest.mark.asyncio
async def test_insurance_coverage_conflict_is_critical_and_recommends_user_value():
    """The canonical sprint example: policy says $500k, profile says $250k."""
    _, conflicts = await _scan({
        "documents": [_doc("p1", "life_insurance_policy", "Term Life")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    assert len(conflicts) == 1
    c = conflicts[0]
    assert c["conflict_type"] == "insurance_coverage_mismatch"
    assert c["severity"] == "critical"  # two strong sources disagree on a high-base concept
    # user-entered (250000) outranks extracted (500000) → recommended keep the profile value
    assert c["recommended"]["value"] == "250000"
    assert "insurance profile" in (c["recommended"]["source_label"] or "")


# ── precedence ──────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_user_confirmed_outranks_extracted():
    _, conflicts = await _scan({
        "documents": [_doc("a", "life_insurance_policy", "Policy A"),
                      _doc("b", "life_insurance_policy", "Policy B")],
        "document_fields": [
            _field("fa", "a", "coverage_amount", "500000", review="user_confirmed"),
            _field("fb", "b", "coverage_amount", "250000", review="extracted"),
        ],
    })
    c = conflicts[0]
    assert c["recommended"]["value"] == "500000"  # user_confirmed wins
    assert c["severity"] in ("high", "critical")


@pytest.mark.asyncio
async def test_low_confidence_only_is_potential_conflict():
    _, conflicts = await _scan({
        "documents": [_doc("a", "life_insurance_policy"), _doc("b", "life_insurance_policy")],
        "document_fields": [
            _field("fa", "a", "coverage_amount", "500000", conf=0.5, review="needs_review"),
            _field("fb", "b", "coverage_amount", "250000", conf=0.5, review="needs_review"),
        ],
    })
    c = conflicts[0]
    assert c["severity"] == "low"
    assert c["recommended"]["text"].startswith("Potential conflict")


# ── resolution lifecycle ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_resolved_conflict_stores_winning_value():
    sb, conflicts = await _scan({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    svc = ConflictDetectionService(sb)
    cid = conflicts[0]["id"]
    doc_item = next(i for i in conflicts[0]["items"] if i["source_type"] == "document")
    res = await svc.resolve(CTX, conflict_id=cid, resolution="keep", item_id=doc_item["id"])
    assert res["status"] == "user_resolved"
    assert res["winning_value"] == "500000"
    # it no longer appears as an OPEN conflict
    assert await svc.list_conflicts(CTX, status="open") == []


@pytest.mark.asyncio
async def test_ignored_conflict_does_not_block_and_does_not_reopen():
    sb, conflicts = await _scan({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    svc = ConflictDetectionService(sb)
    await svc.resolve(CTX, conflict_id=conflicts[0]["id"], resolution="ignore")
    assert await svc.list_conflicts(CTX, status="open") == []
    # re-scan must respect the decision (not reopen)
    reopened = await svc.scan(CTX)
    assert reopened == []
    assert await svc.list_conflicts(CTX, status="open") == []


@pytest.mark.asyncio
async def test_value_now_matches_auto_resolves_open_conflict():
    sb = FakeSupabase({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    svc = ConflictDetectionService(sb)
    assert len(await svc.scan(CTX)) == 1
    # user fixes the profile to agree with the document → next scan auto-resolves it
    (await sb.select("insurance_profiles"))[0]["life_coverage"] = 500000
    assert await svc.scan(CTX) == []
    row = (await sb.select("field_conflicts"))[0]
    assert row["status"] == "system_resolved"


# ── tenant isolation ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_tenant_isolation():
    other = "22222222-2222-2222-2222-222222222222"
    _, conflicts = await _scan({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [
            {"id": "ins1", "user_id": UID, "life_coverage": 250000},
            {"id": "ins2", "user_id": other, "life_coverage": 999999},  # different tenant
        ],
    })
    c = conflicts[0]
    assert "999999" not in [i["value"] for i in c["items"]]  # other tenant never leaks in


# ── advisor + reports grounding ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_advisor_sees_conflict_state():
    sb, _ = await _scan({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    facts = await open_conflict_facts(sb, CTX)
    assert facts and facts[0]["label"] == "Data conflict"
    assert "500000" in facts[0]["value"] and "250000" in facts[0]["value"]
    # and it flows through the full advisor fact packet
    packet = await build_fact_packet(sb, CTX)
    assert any(f["label"] == "Data conflict" for f in packet)


@pytest.mark.asyncio
async def test_reports_flag_unresolved_conflicts():
    sb, _ = await _scan({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    summary = await ConflictDetectionService(sb).unresolved_summary(CTX)
    assert len(summary) == 1
    assert summary[0]["conflict_type"] == "insurance_coverage_mismatch"
    assert "500000" in summary[0]["values"] and "250000" in summary[0]["values"]


# ── HTTP surface ─────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_conflict_endpoints_flow(make_client):
    client = make_client({
        "documents": [_doc("p1", "life_insurance_policy")],
        "document_fields": [_field("f1", "p1", "coverage_amount", "500000")],
        "insurance_profiles": [{"id": "ins1", "user_id": UID, "life_coverage": 250000}],
    })
    from .conftest import make_jwt
    h = {"Authorization": f"Bearer {make_jwt(UID)}"}

    scanned = client.post("/v1/documents/conflicts/scan", headers=h)
    assert scanned.status_code == 200
    assert scanned.json()["conflicts"]

    listed = client.get("/v1/documents/conflicts", headers=h).json()
    assert listed["open_count"] == 1
    cid = listed["conflicts"][0]["id"]

    resolved = client.post(f"/v1/documents/conflicts/{cid}/resolve", headers=h,
                           json={"resolution": "value", "value": "300000"})
    assert resolved.status_code == 200
    assert resolved.json()["winning_value"] == "300000"
    assert client.get("/v1/documents/conflicts", headers=h).json()["open_count"] == 0
