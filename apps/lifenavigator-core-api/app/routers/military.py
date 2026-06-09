"""Military / VA Pack router (`/v1/military`).

Service / transition / GI Bill / VA-benefits readiness from uploaded DD214, VA award letters,
LES, and military retirement statements. Informational — the VA / a VSO makes the official call.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_military_service
from ..models.common import UserContext
from ..services.military import MilitaryService

router = APIRouter(prefix="/v1/military", tags=["military"])


@router.get("/pack")
async def military_pack(user: AuthenticatedUser = Depends(authenticated), svc: MilitaryService = Depends(get_military_service)):
    return await svc.assess(UserContext(user_id=user.user_id))
