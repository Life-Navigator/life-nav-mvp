"""Analytics router — beta instrumentation (`/v1/events` emit) + Executive Dashboard (`/v1/admin/metrics`).

The dashboard returns platform-wide COUNTS only (no PII, no user content). emit records funnel
events (onboarding/login/domain views) for the authenticated user.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service
from ..models.common import UserContext
from ..services.analytics import EVENT_TYPES, AnalyticsService

router = APIRouter(prefix="/v1", tags=["analytics"])


@router.post("/events")
async def emit_event(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
    event_type: str = Body(..., embed=True),
    domain: str = Body("", embed=True),
    props: dict = Body({}, embed=True),
):
    if event_type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"event_type must be one of {EVENT_TYPES}")
    await svc.emit(UserContext(user_id=user.user_id), event_type, domain=domain or None, props=props)
    return {"ok": True}


@router.get("/admin/metrics")
async def metrics(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
):
    """Executive Dashboard — Users / Reports / Shares / Goals / Domain Usage / funnel. Counts only."""
    return await svc.dashboard()
