"""Platform identity + visibility router (`/v1/platform`).

The client asks this for what it may show; the server is the authority. Military identity is a
first-class attribute; visibility is resolved from the central module registry.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_platform_access
from ..models.common import UserContext
from ..services.platform_access import VALID_STATUSES, PlatformAccess

router = APIRouter(prefix="/v1/platform", tags=["platform"])


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


@router.get("/modules")
async def modules(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    """Resolved module visibility + maturity for the current user (server-authoritative)."""
    return await svc.visibility(_ctx(user), user.email)


@router.get("/profile")
async def profile(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    return await svc.context(_ctx(user), user.email)


@router.put("/military")
async def set_military(
    user: AuthenticatedUser = Depends(authenticated),
    svc: PlatformAccess = Depends(get_platform_access),
    military_status: str = Body(..., embed=True),
):
    if military_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"military_status must be one of {sorted(VALID_STATUSES)}")
    return await svc.set_military_status(_ctx(user), military_status)


@router.post("/military/skip")
async def skip_military(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    """User dismissed the one-time military onboarding question without answering."""
    await svc.mark_onboarding_asked(_ctx(user))
    return {"ok": True}
