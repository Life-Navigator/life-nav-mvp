"""Analytics router — beta instrumentation (`/v1/events` emit) + Executive Dashboard (`/v1/admin/metrics`).

The dashboard returns platform-wide COUNTS only (no PII, no user content). emit records funnel
events (onboarding/login/domain views) for the authenticated user.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service, get_platform_access
from ..models.common import UserContext
from ..services.analytics import EVENT_TYPES, AnalyticsService
from ..services.platform_access import PlatformAccess

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
    access: PlatformAccess = Depends(get_platform_access),
):
    """Executive Dashboard — admin-only. Authenticated alone is INSUFFICIENT."""
    ctx = UserContext(user_id=user.user_id)
    if not access.is_admin(user.email):
        await access.log_admin_access(ctx, user.email, "/v1/admin/metrics", "denied")
        raise HTTPException(status_code=403, detail="Admin access required")
    await access.log_admin_access(ctx, user.email, "/v1/admin/metrics", "granted")
    return await svc.dashboard()


@router.get("/admin/advisor-metrics")
async def advisor_metrics(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
    access: PlatformAccess = Depends(get_platform_access),
):
    """Advisor observability dashboard (P0.1) — admin-only. Fallback rate, latency p95, validator
    failure rate, avg confidence/edges/tokens over the last 30 days. Counts/rates only — no PII."""
    ctx = UserContext(user_id=user.user_id)
    if not access.is_admin(user.email):
        await access.log_admin_access(ctx, user.email, "/v1/admin/advisor-metrics", "denied")
        raise HTTPException(status_code=403, detail="Admin access required")
    await access.log_admin_access(ctx, user.email, "/v1/admin/advisor-metrics", "granted")
    return await svc.advisor_metrics()
