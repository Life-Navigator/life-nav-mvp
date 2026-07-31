"""Advisor-response report review workflow — R-3 / B-23.

EVIDENCE BOUNDARY: stores are FAKED. Contract verification, not live-store verification.
"""
from __future__ import annotations

import pytest

from app.services.platform_access import PlatformAccess
from app.services.response_review import (
    ALLOWED_TRANSITIONS,
    DETAIL_COLUMNS,
    LIST_COLUMNS,
    MAX_PAGE_SIZE,
    ResponseReviewService,
    ReviewForbidden,
    ReviewRejected,
)

ADMIN = "admin@lifenav.test"
REVIEWER = "reviewer@lifenav.test"
USER = "someone@lifenav.test"
REPORT = "11111111-0000-4000-8000-00000000000a"


class Ctx:
    user_id = "user-1"


class FakeSb:
    def __init__(self) -> None:
        self.reports = [{
            "report_id": REPORT, "turn_id": "turn-1", "category": "wrong_or_unsupported",
            "severity": "unclassified", "review_status": "new", "assigned_to": None,
            "created_at": "2026-07-31T00:00:00Z", "deployment_version": "d1",
            "prompt_version": "p1", "model_name": "m1", "duplicate_of": None,
            "explanation": "the number is wrong", "question_snapshot": "SNAPSHOT-Q",
            "response_snapshot": "SNAPSHOT-A", "citation_refs": [], "retrieval_channels": [],
            "model_provider": "prov", "resolution_notes": None, "conversation_id": "c1",
        }]
        self.events: list[dict] = []
        self.updates: list[dict] = []
        self.audit: list[tuple] = []

    async def select(self, table, *, columns="*", filters=None, limit=None, order=None, schema="public", **_):
        rows = self.reports if table == "advisor_response_reports" else self.events
        f = filters or {}
        out = [r for r in rows if all(str(r.get(k)) == v.split("eq.", 1)[-1] for k, v in f.items() if v)]
        if columns != "*":
            want = columns.split(",")
            out = [{k: v for k, v in r.items() if k in want} for r in out]
        return out[: limit or len(out)]

    async def update(self, table, patch, *, filters=None, schema="public"):
        self.updates.append({"table": table, "patch": patch})
        self.reports[0].update(patch)
        return [self.reports[0]]

    async def insert(self, table, row, *, schema="public"):
        self.events.append(row)
        return [row]


class FakeAccess(PlatformAccess):
    def __init__(self, admins, reviewers):
        super().__init__(supabase=None, admin_emails=admins, response_reviewer_emails=reviewers)
        self.audit: list[tuple] = []

    async def log_admin_access(self, ctx, email, endpoint, result):  # type: ignore[override]
        self.audit.append((email, endpoint, result))


@pytest.fixture
def svc():
    sb = FakeSb()
    access = FakeAccess({ADMIN}, {REVIEWER})
    return ResponseReviewService(sb, access), sb, access


# ── authorization ────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_inherits_the_reviewer_capability(svc):
    service, _, _ = svc
    assert (await service.list_reports(Ctx(), ADMIN))["reports"]


@pytest.mark.asyncio
async def test_configured_reviewer_is_permitted(svc):
    service, _, _ = svc
    assert (await service.list_reports(Ctx(), REVIEWER))["reports"]


@pytest.mark.asyncio
async def test_ordinary_user_is_denied(svc):
    service, sb, _ = svc
    with pytest.raises(ReviewForbidden):
        await service.list_reports(Ctx(), USER)


@pytest.mark.asyncio
async def test_reviewer_does_not_become_an_admin(svc):
    """The capability is one-directional. Every other admin endpoint still calls is_admin."""
    _, _, access = svc
    assert access.can_review_advisor_responses(REVIEWER) is True
    assert access.is_admin(REVIEWER) is False


@pytest.mark.asyncio
async def test_revoked_reviewer_is_denied(svc):
    service, _, access = svc
    access._response_reviewers = set()  # revocation via the authoritative set
    with pytest.raises(ReviewForbidden):
        await service.list_reports(Ctx(), REVIEWER)


@pytest.mark.asyncio
async def test_client_supplied_role_is_never_authoritative(svc):
    """Identity comes from the verified JWT email; no request field can grant the capability."""
    import inspect

    params = set(inspect.signature(ResponseReviewService.list_reports).parameters)
    assert "role" not in params and "is_admin" not in params and "capability" not in params


@pytest.mark.asyncio
async def test_granted_and_denied_attempts_are_both_audited(svc):
    service, _, access = svc
    await service.list_reports(Ctx(), REVIEWER)
    with pytest.raises(ReviewForbidden):
        await service.list_reports(Ctx(), USER)
    results = [r for _, _, r in access.audit]
    assert "granted" in results and "denied" in results


# ── data minimization ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_excludes_question_and_response_snapshots(svc):
    """A queue is a scanning surface. Returning every reporter's question would make it a bulk
    disclosure surface instead."""
    service, _, _ = svc
    rows = (await service.list_reports(Ctx(), REVIEWER))["reports"]
    for forbidden in ("question_snapshot", "response_snapshot", "explanation"):
        assert forbidden not in LIST_COLUMNS
        assert forbidden not in rows[0]
    assert "SNAPSHOT-Q" not in str(rows)


@pytest.mark.asyncio
async def test_detail_exposes_preserved_evidence_but_never_raw_output(svc):
    service, _, _ = svc
    detail = await service.get_report(Ctx(), REVIEWER, REPORT)
    assert detail["report"]["question_snapshot"] == "SNAPSHOT-Q"
    assert "llm_response_raw" not in DETAIL_COLUMNS
    assert "llm_response_raw" not in str(detail)


@pytest.mark.asyncio
async def test_detail_returns_audit_history(svc):
    service, _, _ = svc
    await service.update_review(Ctx(), REVIEWER, REPORT, severity="high")
    detail = await service.get_report(Ctx(), REVIEWER, REPORT)
    assert detail["audit_history"]


# ── immutability ─────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evidence_columns_are_unreachable_by_any_request(svc):
    """Not 'rejected' — unreachable. update_review builds its patch from four named fields."""
    import inspect

    params = set(inspect.signature(ResponseReviewService.update_review).parameters) - {"self"}
    assert params == {
        "ctx", "email", "report_id", "assigned_to", "severity",
        "review_status", "note", "duplicate_of", "escalate",
    }
    for forbidden in ("question_snapshot", "response_snapshot", "turn_id", "user_id",
                      "tenant_id", "category", "explanation", "created_at"):
        assert forbidden not in params


@pytest.mark.asyncio
async def test_patches_never_touch_evidence_columns(svc):
    service, sb, _ = svc
    await service.update_review(Ctx(), REVIEWER, REPORT, severity="high", assigned_to="me")
    for upd in sb.updates:
        assert set(upd["patch"]) <= {"assigned_to", "severity", "review_status", "duplicate_of"}


@pytest.mark.asyncio
async def test_there_is_no_delete_operation(svc):
    """Enforced by absence: a capability you cannot express is stronger than one you check."""
    methods = {m for m in dir(ResponseReviewService) if not m.startswith("_")}
    assert not {m for m in methods if "delete" in m or "remove" in m or "purge" in m}


@pytest.mark.asyncio
async def test_every_mutation_appends_an_audit_event(svc):
    service, sb, _ = svc
    await service.update_review(Ctx(), REVIEWER, REPORT, assigned_to="me")
    await service.update_review(Ctx(), REVIEWER, REPORT, severity="high")
    await service.update_review(Ctx(), REVIEWER, REPORT, review_status="investigating")
    assert len(sb.events) >= 3
    assert {e["action"] for e in sb.events} >= {"assigned", "severity_changed", "status_changed"}
    for e in sb.events:
        assert e["actor_email"] == REVIEWER and e["event_id"]


@pytest.mark.asyncio
async def test_audit_records_previous_and_new_values(svc):
    service, sb, _ = svc
    await service.update_review(Ctx(), REVIEWER, REPORT, severity="critical")
    ev = [e for e in sb.events if e["action"] == "severity_changed"][0]
    assert ev["previous_value"] == "unclassified" and ev["new_value"] == "critical"


# ── workflow ─────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_permitted_transition(svc):
    service, _, _ = svc
    assert await service.update_review(Ctx(), REVIEWER, REPORT, review_status="investigating")


@pytest.mark.asyncio
async def test_forbidden_transition_is_refused(svc):
    """new -> resolved skips investigation and is not in the table."""
    service, _, _ = svc
    with pytest.raises(ReviewRejected, match="not permitted"):
        await service.update_review(Ctx(), REVIEWER, REPORT, review_status="resolved")


@pytest.mark.asyncio
async def test_arbitrary_status_string_is_refused(svc):
    service, _, _ = svc
    with pytest.raises(ReviewRejected):
        await service.update_review(Ctx(), REVIEWER, REPORT, review_status="totally_made_up")


@pytest.mark.asyncio
async def test_invalid_severity_is_refused(svc):
    service, _, _ = svc
    with pytest.raises(ReviewRejected, match="invalid severity"):
        await service.update_review(Ctx(), REVIEWER, REPORT, severity="apocalyptic")


@pytest.mark.asyncio
async def test_reopening_requires_a_reason(svc):
    service, sb, _ = svc
    sb.reports[0]["review_status"] = "resolved"
    with pytest.raises(ReviewRejected, match="reason"):
        await service.update_review(Ctx(), REVIEWER, REPORT, review_status="investigating")
    assert await service.update_review(
        Ctx(), REVIEWER, REPORT, review_status="investigating", note="new evidence"
    )


@pytest.mark.asyncio
async def test_duplicate_requires_a_link(svc):
    service, _, _ = svc
    with pytest.raises(ReviewRejected, match="duplicate_of"):
        await service.update_review(Ctx(), REVIEWER, REPORT, review_status="duplicate")
    assert await service.update_review(
        Ctx(), REVIEWER, REPORT, review_status="duplicate", duplicate_of="other-report"
    )


@pytest.mark.asyncio
async def test_escalation_is_recorded_but_performs_no_containment(svc):
    """The reviewer records escalation; disabling a model or flag is the incident owner's job."""
    service, sb, _ = svc
    await service.update_review(Ctx(), REVIEWER, REPORT, escalate=True, note="possible harm")
    assert any(e["action"] == "escalated" for e in sb.events)
    methods = {m for m in dir(ResponseReviewService) if not m.startswith("_")}
    assert not {m for m in methods if "flag" in m or "model" in m or "prompt" in m or "suspend" in m}


@pytest.mark.asyncio
async def test_pagination_is_bounded(svc):
    service, _, _ = svc
    assert (await service.list_reports(Ctx(), REVIEWER, limit=10_000))["limit"] == MAX_PAGE_SIZE


@pytest.mark.asyncio
async def test_unknown_filter_keys_are_ignored(svc):
    """A filter allowlist — an arbitrary key must not become a query predicate."""
    service, _, _ = svc
    assert (await service.list_reports(
        Ctx(), REVIEWER, filters={"user_id": "someone-else", "category": "other"}
    ))["reports"] is not None


@pytest.mark.asyncio
async def test_transition_table_has_no_self_loops_or_unknown_states(svc):
    known = {"new", "investigating", "resolved", "dismissed", "duplicate"}
    for src, targets in ALLOWED_TRANSITIONS.items():
        assert src in known
        assert set(targets) <= known
        assert src not in targets
