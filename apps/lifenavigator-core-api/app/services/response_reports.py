"""Categorized advisor-response reporting — audit finding R-3.

The beta launch audit (`4416211f`) found five feedback surfaces and none that reports a *specific*
advisor response. That is automatic no-go condition #4. This service closes it.

THE SECURITY PROPERTY THIS MODULE EXISTS TO ENFORCE
---------------------------------------------------
A caller holding another user's `turn_id` must learn **nothing** — not even whether it exists.
`submit()` therefore returns the SAME `ReportRejected` for "no such turn" and "not your turn". Any
future change that distinguishes them turns this endpoint into an enumeration oracle over every
advisor conversation on the platform.

TRUST BOUNDARY
--------------
`user_id` and `tenant_id` are resolved from the verified JWT and the stored turn. Nothing
identity-, model-, evidence- or policy-shaped is ever read from the request body. The body carries
exactly three things: `turn_id`, `category`, `explanation`.

Tenancy resolves as `tenant_id = user_id` — the platform's established convention
(`advisor_orchestrator.py:998`, `traversal.py` binding `{tenant_id: $user_id}`). `advisor_turns`
has no `tenant_id` column and this module deliberately does not add one; that is a separate
data-contract decision.

NEVER PERSISTED: `llm_response_raw`, or anything else resembling chain-of-thought.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Optional

# The seven categories the audit requires. Enforced here AND by a CHECK constraint — the constraint
# is the real gate; this list gives a clean 400 instead of a database error.
CATEGORIES: tuple[str, ...] = (
    "wrong_or_unsupported",
    "inappropriate_or_harmful",
    "incorrect_or_irrelevant_citation",
    "outdated_information",
    "misunderstood_my_situation",
    "privacy_concern",
    "other",
)

# Categories that are triaged high on arrival. A user calling a response harmful should not wait in
# an undifferentiated queue.
_ELEVATED = {"inappropriate_or_harmful": "high", "privacy_concern": "high"}

MAX_EXPLANATION = 4000

# Columns copied from the turn as the investigation snapshot. `llm_response_raw` is ABSENT by
# design and a test asserts it stays absent.
_TURN_SNAPSHOT_COLUMNS = (
    "turn_id", "conversation_id", "user_id", "prompt_version",
    "user_message", "advisor_response", "relationships_referenced", "sources",
)


class ReportRejected(Exception):
    """Submission refused. Deliberately carries no detail about WHY at the API boundary."""


@dataclass(frozen=True)
class ReportResult:
    report_id: str
    duplicate: bool


class ResponseReportService:
    """Owner-scoped reporting against `analytics.advisor_turns`."""

    def __init__(self, supabase: Any) -> None:
        self._sb = supabase

    async def submit(
        self,
        *,
        authenticated_user_id: str,
        turn_id: str,
        category: str,
        explanation: Optional[str] = None,
    ) -> ReportResult:
        if not authenticated_user_id:
            raise ReportRejected("unauthenticated")
        if category not in CATEGORIES:
            raise ReportRejected("invalid category")
        if explanation is not None and len(explanation) > MAX_EXPLANATION:
            raise ReportRejected("explanation too long")
        if not turn_id:
            raise ReportRejected("not found")

        turn = await self._owned_turn(turn_id, authenticated_user_id)

        # tenant is resolved from the trusted identity, never the body (tenant_id = user_id).
        tenant_id = authenticated_user_id

        row: dict[str, Any] = {
            "turn_id": turn_id,
            "conversation_id": turn.get("conversation_id"),
            "user_id": authenticated_user_id,
            "tenant_id": tenant_id,
            "category": category,
            "explanation": explanation or None,
            # Snapshot, because advisor_turns is service_role-writable and so not provably immutable.
            "question_snapshot": turn.get("user_message"),
            "response_snapshot": turn.get("advisor_response"),
            "prompt_version": turn.get("prompt_version"),
            "retrieval_channels": turn.get("relationships_referenced"),
            "citation_refs": turn.get("sources"),
            "deployment_version": self._deployment_version(),
            "model_provider": self._model_provider(),
            "model_name": self._model_name(),
            "severity": _ELEVATED.get(category, "unclassified"),
            "review_status": "new",
        }
        # routing_result, policy_outcomes and feature_flags are intentionally omitted: no
        # authoritative per-turn source exists today. Recording the gap beats fabricating the value.

        # SupabaseClient.insert returns the inserted row(s), or [] on ANY failure — it does not
        # raise. So an empty result is ambiguous between "duplicate" and "write failed", and the
        # only honest way to tell them apart is to look.
        created = await self._sb.insert("advisor_response_reports", row, schema="feedback")
        if created:
            return ReportResult(report_id=str(created[0].get("report_id") or ""), duplicate=False)

        existing = await self._existing_open_report(turn_id, authenticated_user_id, category)
        if existing:
            return ReportResult(report_id=existing, duplicate=True)
        raise ReportRejected("write failed")

    async def _existing_open_report(self, turn_id: str, user_id: str, category: str) -> str:
        """The open report this submission duplicates, if any. Mirrors the partial unique index."""
        rows = await self._sb.select(
            "advisor_response_reports",
            columns="report_id,review_status",
            filters={"turn_id": f"eq.{turn_id}", "user_id": f"eq.{user_id}",
                     "category": f"eq.{category}"},
            schema="feedback",
        )
        for r in rows or []:
            if r.get("review_status") in ("new", "investigating"):
                return str(r.get("report_id") or "")
        return ""

    async def _owned_turn(self, turn_id: str, user_id: str) -> dict[str, Any]:
        """Fetch the turn ONLY if it belongs to the caller.

        Both filters are applied in the query, so a turn belonging to someone else is
        indistinguishable from one that does not exist — by construction, not by a later `if`.
        """
        rows = await self._sb.select(
            "advisor_turns",
            columns=",".join(_TURN_SNAPSHOT_COLUMNS),
            filters={"turn_id": f"eq.{turn_id}", "user_id": f"eq.{user_id}"},
            schema="analytics",
        )
        if not rows:
            # Same error for "absent" and "not yours" — no enumeration oracle.
            raise ReportRejected("not found")
        return rows[0]

    # ── server-resolved metadata ────────────────────────────────────────────
    @staticmethod
    def _deployment_version() -> Optional[str]:
        for var in ("RELEASE_SHA", "GIT_COMMIT_SHA", "FLY_MACHINE_VERSION", "VERCEL_GIT_COMMIT_SHA"):
            val = os.environ.get(var)
            if val:
                return val
        return None

    @staticmethod
    def _model_provider() -> Optional[str]:
        return os.environ.get("MODEL_PROVIDER") or None

    @staticmethod
    def _model_name() -> Optional[str]:
        return (
            os.environ.get("CLAUDE_MODEL")
            or os.environ.get("VERTEX_MODEL")
            or os.environ.get("GEMINI_GENERATION_MODEL")
            or None
        )
