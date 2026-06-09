"""Military / VA Pack router (`/v1/military`).

Service / transition / GI Bill / VA-benefits readiness from uploaded DD214, VA award letters,
LES, and military retirement statements. Informational — the VA / a VSO makes the official call.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_military_service, get_platform_access
from ..models.common import UserContext
from ..services.military import MilitaryService
from ..services.platform_access import PlatformAccess

router = APIRouter(prefix="/v1/military", tags=["military"])


@router.get("/pack")
async def military_pack(
    user: AuthenticatedUser = Depends(authenticated),
    svc: MilitaryService = Depends(get_military_service),
    access: PlatformAccess = Depends(get_platform_access),
):
    # Server-side gate: civilians never learn the module exists (404, not 403).
    if not await access.require_military(UserContext(user_id=user.user_id), user.email):
        raise HTTPException(status_code=404, detail="Not found")
    return await svc.assess(UserContext(user_id=user.user_id))
