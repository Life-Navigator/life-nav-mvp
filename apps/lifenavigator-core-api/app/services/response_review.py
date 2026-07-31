"""Advisor-response report review workflow — audit finding R-3 / B-23.

CAPABILITY BOUNDARY
-------------------
Every method here requires `PlatformAccess.can_review_advisor_responses`. That capability is
deliberately narrower than `is_admin`: it authorizes *these* operations and nothing else. Every
other admin endpoint keeps calling `is_admin`, so review access cannot widen into administration.

WHAT A REVIEWER CANNOT DO — enforced by absence, not by a check
---------------------------------------------------------------
There is no delete method. There is no method that writes to the report's evidence columns. There
is no method touching models, prompts, policies, feature flags, cohorts or invitations. A
capability you cannot express is stronger than one you check for.

DATA MINIMIZATION
-----------------
`list_reports` returns queue columns ONLY — no question or response snapshot. A reviewer scanning a
queue has no need to read every reporter's question, and returning them would turn the queue into a
bulk disclosure surface. Snapshots require opening one report deliberately.

`llm_response_raw` is not in the report table at all (ADR-002 / slice 1), so it cannot leak here.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

# Queue columns. Deliberately excludes question_snapshot / response_snapshot / explanation.
LIST_COLUMNS = (
    "report_id,turn_id,category,severity,review_status,assigned_to,created_at,"
    "deployment_version,prompt_version,model_name,duplicate_of"
)

# Detail columns. Adds the preserved evidence a reviewer needs to investigate ONE report.
DETAIL_COLUMNS = LIST_COLUMNS + ",explanation,question_snapshot,response_snapshot,citation_refs,retrieval_channels,model_provider,resolution_notes,conversation_id"

VALID_SEVERITIES = ("unclassified", "low", "medium", "high", "critical")

# Explicit transition table. An arbitrary status string, or a transition not listed here, is
# refused — a review workflow that accepts any string is not a workflow.
ALLOWED_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "new": ("investigating", "dismissed", "duplicate"),
    "investigating": ("resolved", "dismissed", "duplicate"),
    # Reopening is permitted but ONLY back to investigating, and the caller must supply a reason.
    "resolved": ("investigating",),
    "dismissed": ("investigating",),
    "duplicate": ("investigating",),
}
REOPEN_FROM = ("resolved", "dismissed", "duplicate")

MAX_PAGE_SIZE = 100


class ReviewForbidden(Exception):
    """Caller lacks the advisor_response_reviewer capability."""


class ReviewRejected(Exception):
    """The requested change is not permitted by the workflow contract."""


class ResponseReviewService:
    def __init__(self, supabase: Any, access: Any) -> None:
        self._sb = supabase
        self._access = access

    # ── authorization ───────────────────────────────────────────────────────
    async def _authorize(self, ctx: Any, email: Optional[str], endpoint: str) -> str:
        """Authorize and audit. Denials are audited too — a denied attempt is the earliest signal
        that someone is probing an endpoint they should not know about."""
        if not self._access.can_review_advisor_responses(email):
            await self._access.log_admin_access(ctx, email, endpoint, "denied")
            raise ReviewForbidden("reviewer capability required")
        await self._access.log_admin_access(ctx, email, endpoint, "granted")
        return (email or "").lower()

    # ── read ────────────────────────────────────────────────────────────────
    async def list_reports(
        self, ctx: Any, email: Optional[str], *, filters: Optional[dict[str, str]] = None,
        limit: int = 25, offset: int = 0,
    ) -> dict[str, Any]:
        await self._authorize(ctx, email, "/v1/admin/response-reports")
        bounded = max(1, min(int(limit or 25), MAX_PAGE_SIZE))
        allowed = {"category", "review_status", "severity", "deployment_version",
                   "prompt_version", "model_name", "assigned_to"}
        query = {k: f"eq.{v}" for k, v in (filters or {}).items() if k in allowed and v}
        rows = await self._sb.select(
            "advisor_response_reports", columns=LIST_COLUMNS, filters=query,
            limit=bounded, order="created_at.desc", schema="feedback",
        )
        return {"reports": rows or [], "limit": bounded, "offset": max(0, int(offset or 0))}

    async def get_report(self, ctx: Any, email: Optional[str], report_id: str) -> dict[str, Any]:
        await self._authorize(ctx, email, f"/v1/admin/response-reports/{report_id}")
        rows = await self._sb.select(
            "advisor_response_reports", columns=DETAIL_COLUMNS,
            filters={"report_id": f"eq.{report_id}"}, schema="feedback",
        )
        if not rows:
            raise ReviewRejected("not found")
        events = await self._sb.select(
            "advisor_report_events",
            columns="event_id,action,actor_email,previous_value,new_value,note,created_at",
            filters={"report_id": f"eq.{report_id}"}, order="created_at.desc", schema="feedback",
        )
        return {"report": rows[0], "audit_history": events or []}

    # ── write — the ONLY mutable surface ────────────────────────────────────
    async def update_review(
        self, ctx: Any, email: Optional[str], report_id: str, *,
        assigned_to: Optional[str] = None, severity: Optional[str] = None,
        review_status: Optional[str] = None, note: Optional[str] = None,
        duplicate_of: Optional[str] = None, escalate: bool = False,
    ) -> dict[str, Any]:
        actor = await self._authorize(ctx, email, f"/v1/admin/response-reports/{report_id}")

        current = await self._sb.select(
            "advisor_response_reports", columns="report_id,review_status,severity,assigned_to",
            filters={"report_id": f"eq.{report_id}"}, schema="feedback",
        )
        if not current:
            raise ReviewRejected("not found")
        row = current[0]

        # Only these four columns are ever written. Evidence columns are absent from `patch` by
        # construction, so no request shape can reach them.
        patch: dict[str, Any] = {}
        events: list[dict[str, Any]] = []

        if assigned_to is not None:
            patch["assigned_to"] = assigned_to
            events.append(self._event(report_id, actor, "assigned", row.get("assigned_to"), assigned_to, note))

        if severity is not None:
            if severity not in VALID_SEVERITIES:
                raise ReviewRejected("invalid severity")
            patch["severity"] = severity
            events.append(self._event(report_id, actor, "severity_changed", row.get("severity"), severity, note))

        if review_status is not None:
            prior = str(row.get("review_status") or "new")
            allowed = ALLOWED_TRANSITIONS.get(prior, ())
            if review_status not in allowed:
                raise ReviewRejected(f"transition {prior} -> {review_status} is not permitted")
            if prior in REOPEN_FROM and not (note or "").strip():
                raise ReviewRejected("reopening requires a reason")
            patch["review_status"] = review_status
            if review_status == "duplicate":
                if not duplicate_of:
                    raise ReviewRejected("duplicate requires duplicate_of")
                patch["duplicate_of"] = duplicate_of
                events.append(self._event(report_id, actor, "duplicate_linked", None, duplicate_of, note))
            events.append(self._event(report_id, actor, "status_changed", prior, review_status, note))

        if note and not events:
            events.append(self._event(report_id, actor, "note_added", None, None, note))

        if escalate:
            # The reviewer records the escalation; the reviewer capability itself performs NO
            # containment. Disabling a model, changing a prompt or touching a flag is reserved for
            # the beta incident owner / platform administrator.
            events.append(self._event(report_id, actor, "escalated", None, None,
                                      note or "escalated to beta incident owner"))

        if not patch and not events:
            raise ReviewRejected("no change requested")

        if patch:
            await self._sb.update(
                "advisor_response_reports", patch,
                filters={"report_id": f"eq.{report_id}"}, schema="feedback",
            )
        for ev in events:
            await self._sb.insert("advisor_report_events", ev, schema="feedback")
        return {"report_id": report_id, "updated": sorted(patch), "events": len(events)}

    @staticmethod
    def _event(report_id: str, actor: str, action: str, prev: Any, new: Any,
               note: Optional[str]) -> dict[str, Any]:
        return {
            "event_id": str(uuid.uuid4()), "report_id": report_id, "actor_email": actor,
            "action": action,
            "previous_value": None if prev is None else str(prev),
            "new_value": None if new is None else str(new),
            "note": note or None,
        }
