"""Arcana lead-package endpoints.

POST /api/arcana/lead-package/preview — returns the package shape so
the UI can show the user what will be shared before they consent.

POST /api/arcana/lead-package/send — requires a granted
``arcana_lead_sharing`` consent in the request body (in practice this
will be looked up from Supabase; the scaffold accepts it as input so
the routes are unit-testable without DB plumbing). Returns 403 if
consent is missing.

Both routes emit an audit-log event the caller is expected to persist.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user
from ..services.arcana_lead_package import (
    AuditEvent,
    block_or_send,
    build_preview,
)

router = APIRouter()


class Snapshot(BaseModel):
    """The user-graph snapshot the route stitches together upstream of
    this endpoint."""

    goals: list[dict] = Field(default_factory=list)
    health_status: dict = Field(default_factory=dict)
    fitness_level: dict = Field(default_factory=dict)
    diet: dict = Field(default_factory=dict)
    sleep: dict = Field(default_factory=dict)
    injuries: list[dict] = Field(default_factory=list)
    recovery: dict = Field(default_factory=dict)
    timeline: dict = Field(default_factory=dict)
    motivation: list[dict] = Field(default_factory=list)
    risk_tolerance: dict = Field(default_factory=dict)
    constraints: list[dict] = Field(default_factory=list)


class PreviewBody(BaseModel):
    snapshot: Snapshot


class SendBody(BaseModel):
    snapshot: Snapshot
    consent_record: dict | None = Field(
        default=None,
        description=(
            "The user's granted arcana_lead_sharing consent row "
            "(integration='arcana_lead_sharing', granted=true, "
            "revoked_at=null, optional expires_at)."
        ),
    )


def _serialize_audit(audit: AuditEvent) -> dict:
    return {
        "user_id": audit.user_id,
        "action": audit.action,
        "occurred_at": audit.occurred_at.isoformat(),
        "metadata": audit.metadata,
    }


@router.post("/lead-package/preview")
async def preview(body: PreviewBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    pkg, audit = build_preview(user.user_id, body.snapshot.model_dump())
    return {"package": pkg.to_payload(), "audit": _serialize_audit(audit)}


@router.post("/lead-package/send")
async def send(body: SendBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    pkg, _ = build_preview(user.user_id, body.snapshot.model_dump())
    authorized, audit = block_or_send(pkg, body.consent_record)
    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "arcana_lead_sharing consent missing or invalid",
                "audit": _serialize_audit(audit),
            },
        )
    # The actual HTTP call to Arcana's intake endpoint is intentionally
    # NOT made in this scaffold — wire it in when the partnership
    # contract is in place. We return the package + audit so the caller
    # can persist both atomically.
    return {
        "sent": True,
        "package": pkg.to_payload(),
        "audit": _serialize_audit(audit),
    }
