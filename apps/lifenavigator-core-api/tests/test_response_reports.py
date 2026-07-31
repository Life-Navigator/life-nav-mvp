"""Advisor-response reporting — audit finding R-3.

EVIDENCE BOUNDARY: every store here is FAKED. These are **contract verification**, not live-store
verification. They prove the ownership predicate, the trust boundary and the payload shape. They
prove nothing about the deployed system.
"""
from __future__ import annotations

import pytest

from app.services.response_reports import (
    CATEGORIES,
    MAX_EXPLANATION,
    ReportRejected,
    ResponseReportService,
)

USER_A = "aaaaaaaa-0000-4000-8000-000000000001"
USER_B = "bbbbbbbb-0000-4000-8000-000000000002"
TURN_A = "11111111-0000-4000-8000-00000000000a"
TURN_B = "22222222-0000-4000-8000-00000000000b"

SENTINEL_B = "TENANT-B-SECRET-DO-NOT-LEAK"


class FakeSupabase:
    """Honours the filters, so an ownership bug actually shows up.

    A fake that returns canned rows regardless of `filters` would make every ownership test
    tautological — the same defect the two-tenant traversal fixture was written to avoid.
    """

    def __init__(self) -> None:
        self.turns = [
            {"turn_id": TURN_A, "conversation_id": "conv-a", "user_id": USER_A,
             "prompt_version": "advisor-hybrid-6.2.0", "user_message": "What is my savings rate?",
             "advisor_response": "Your savings rate is about 12%.",
             "relationships_referenced": ["HAS_GOAL"], "sources": ["consumer_finance"],
             "llm_response_raw": "RAW-CHAIN-OF-THOUGHT-MUST-NEVER-BE-COPIED"},
            {"turn_id": TURN_B, "conversation_id": "conv-b", "user_id": USER_B,
             "prompt_version": "advisor-hybrid-6.2.0", "user_message": SENTINEL_B,
             "advisor_response": SENTINEL_B,
             "relationships_referenced": [], "sources": [],
             "llm_response_raw": SENTINEL_B},
        ]
        self.reports: list[dict] = []
        self.inserted: list[dict] = []

    @staticmethod
    def _eq(value: str) -> str:
        return value.split("eq.", 1)[1] if value.startswith("eq.") else value

    async def select(self, table, *, columns="*", filters=None, schema="public", **_):
        filters = filters or {}
        rows = self.turns if table == "advisor_turns" else self.reports
        out = []
        for r in rows:
            if all(str(r.get(k)) == self._eq(v) for k, v in filters.items()):
                out.append(dict(r))
        if table == "advisor_turns" and columns != "*":
            wanted = columns.split(",")
            out = [{k: v for k, v in r.items() if k in wanted} for r in out]
        return out

    async def insert(self, table, row, *, schema="public"):
        # Emulate the partial unique index (user, turn, category) WHERE status in (new,investigating)
        for existing in self.reports:
            if (existing["user_id"], existing["turn_id"], existing["category"]) == (
                row["user_id"], row["turn_id"], row["category"]
            ) and existing["review_status"] in ("new", "investigating"):
                return []  # unique violation -> client returns []
        created = {**row, "report_id": f"rep-{len(self.reports) + 1}"}
        self.reports.append(created)
        self.inserted.append(row)
        return [created]


@pytest.fixture
def svc():
    sb = FakeSupabase()
    return ResponseReportService(sb), sb


# ── happy path ───────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_authenticated_owner_can_report_their_own_response(svc):
    service, sb = svc
    result = await service.submit(
        authenticated_user_id=USER_A, turn_id=TURN_A,
        category="wrong_or_unsupported", explanation="The figure looks wrong.",
    )
    assert result.report_id and not result.duplicate
    row = sb.inserted[0]
    assert row["user_id"] == USER_A and row["tenant_id"] == USER_A
    assert row["question_snapshot"] == "What is my savings rate?"
    assert row["prompt_version"] == "advisor-hybrid-6.2.0"


@pytest.mark.parametrize("category", CATEGORIES)
@pytest.mark.asyncio
async def test_every_required_category_is_accepted(svc, category):
    """All seven audit categories, or a user cannot express the problem they actually hit."""
    service, _ = svc
    assert (await service.submit(
        authenticated_user_id=USER_A, turn_id=TURN_A, category=category)).report_id


@pytest.mark.asyncio
async def test_harmful_and_privacy_reports_are_triaged_high_on_arrival(svc):
    service, sb = svc
    await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A,
                         category="inappropriate_or_harmful")
    assert sb.inserted[-1]["severity"] == "high"


# ── ownership · the security property ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_another_users_turn_is_rejected(svc):
    """USER_A holds USER_B's turn_id. This must fail."""
    service, sb = svc
    with pytest.raises(ReportRejected):
        await service.submit(authenticated_user_id=USER_A, turn_id=TURN_B,
                             category="wrong_or_unsupported")
    assert not sb.inserted, "a cross-user report was persisted"


@pytest.mark.asyncio
async def test_foreign_turn_and_missing_turn_are_indistinguishable(svc):
    """No enumeration oracle: the caller cannot learn whether another tenant's turn exists."""
    service, _ = svc
    with pytest.raises(ReportRejected) as foreign:
        await service.submit(authenticated_user_id=USER_A, turn_id=TURN_B, category="other")
    with pytest.raises(ReportRejected) as absent:
        await service.submit(authenticated_user_id=USER_A,
                             turn_id="99999999-0000-4000-8000-999999999999", category="other")
    assert str(foreign.value) == str(absent.value) == "not found"


@pytest.mark.asyncio
async def test_no_tenant_b_sentinel_ever_reaches_a_tenant_a_report(svc):
    service, sb = svc
    with pytest.raises(ReportRejected):
        await service.submit(authenticated_user_id=USER_A, turn_id=TURN_B, category="other")
    assert SENTINEL_B not in str(sb.inserted)


@pytest.mark.asyncio
async def test_unauthenticated_submission_is_rejected(svc):
    service, sb = svc
    with pytest.raises(ReportRejected):
        await service.submit(authenticated_user_id="", turn_id=TURN_A, category="other")
    assert not sb.inserted


# ── trust boundary ───────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_client_cannot_supply_identity_or_metadata(svc):
    """The service signature accepts only turn_id, category, explanation.

    Anything identity-, tenant-, model- or deployment-shaped is resolved server-side. This test
    documents that as a contract: adding such a parameter should require deleting this assertion.
    """
    import inspect

    params = set(inspect.signature(ResponseReportService.submit).parameters) - {"self"}
    assert params == {"authenticated_user_id", "turn_id", "category", "explanation"}, (
        f"submit() gained a parameter: {params}. Identity/tenant/model/deployment metadata must be "
        "resolved server-side, never accepted from a caller."
    )


@pytest.mark.asyncio
async def test_llm_response_raw_is_never_persisted(svc):
    """No chain-of-thought in a report record."""
    service, sb = svc
    await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="other")
    blob = str(sb.inserted[0])
    assert "llm_response_raw" not in blob
    assert "RAW-CHAIN-OF-THOUGHT" not in blob


@pytest.mark.asyncio
async def test_report_does_not_write_to_the_graph(svc):
    """A user report enters a human review queue. It never mutates knowledge."""
    service, sb = svc
    await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="other")
    assert all(not hasattr(sb, attr) for attr in ("query_personal", "merge", "upsert"))
    assert len(sb.inserted) == 1 and sb.inserted[0]["review_status"] == "new"


# ── validation & duplicates ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_category_is_rejected(svc):
    service, _ = svc
    with pytest.raises(ReportRejected, match="invalid category"):
        await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="not_a_category")


@pytest.mark.asyncio
async def test_overlong_explanation_is_rejected(svc):
    service, _ = svc
    with pytest.raises(ReportRejected, match="too long"):
        await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A,
                             category="other", explanation="x" * (MAX_EXPLANATION + 1))


@pytest.mark.asyncio
async def test_duplicate_same_category_returns_the_existing_report(svc):
    service, sb = svc
    first = await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="other")
    second = await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="other")
    assert second.duplicate and second.report_id == first.report_id
    assert len(sb.reports) == 1


@pytest.mark.asyncio
async def test_a_different_category_is_a_new_report(svc):
    """A materially different concern is not a duplicate — the audit asked for this explicitly."""
    service, sb = svc
    await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A, category="other")
    second = await service.submit(authenticated_user_id=USER_A, turn_id=TURN_A,
                                  category="privacy_concern")
    assert not second.duplicate and len(sb.reports) == 2
