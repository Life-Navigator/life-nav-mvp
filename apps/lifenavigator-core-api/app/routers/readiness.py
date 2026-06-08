"""Life Readiness router (`/v1/readiness`) — the executive command center.

One call returns the Life Readiness Index + per-domain readiness (GREEN/YELLOW/ORANGE/RED with
progress / gap / confidence / timeline / recommendations) + cross-domain goal status. Grounded
in the live domain summaries; a domain with no data reads as "get started", never a fake green.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_readiness_engine
from ..models.common import UserContext
from ..services.readiness import LifeReadinessEngine

router = APIRouter(prefix="/v1/readiness", tags=["readiness"])


@router.get("")
async def readiness(
    user: AuthenticatedUser = Depends(authenticated),
    engine: LifeReadinessEngine = Depends(get_readiness_engine),
):
    return await engine.assess(UserContext(user_id=user.user_id))
