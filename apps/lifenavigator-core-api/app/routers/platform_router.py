"""Platform identity + visibility router (`/v1/platform`).

The client asks this for what it may show; the server is the authority. Military identity is a
first-class attribute; visibility is resolved from the central module registry.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_guidance, get_platform_access
from ..models.common import UserContext
from ..services import assumptions as A
from ..services.guidance import GuidanceEngine
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


@router.get("/dashboard")
async def dashboard(user: AuthenticatedUser = Depends(authenticated), svc: GuidanceEngine = Depends(get_guidance)):
    """Mission control: status + next-best-action + top gaps + missing documents + journey."""
    return await svc.dashboard(_ctx(user))


@router.put("/onboarding")
async def set_onboarding(
    user: AuthenticatedUser = Depends(authenticated),
    svc: PlatformAccess = Depends(get_platform_access),
    focus_decision: str = Body("", embed=True),
    completed: bool = Body(False, embed=True),
    step: int = Body(0, embed=True),
):
    return await svc.set_onboarding(_ctx(user), focus_decision=focus_decision or None,
                                    completed=completed if completed else None, step=step or None)


@router.get("/assumptions")
async def assumptions(user: AuthenticatedUser = Depends(authenticated), mode: str = "consumer"):
    """Every planning assumption + its cited basis. mode=advisor shows all; consumer groups them."""
    if mode == "advisor":
        return {"mode": "advisor", "assumptions": A.all_assumptions()}
    return {"mode": "consumer", "by_category": A.by_category()}
