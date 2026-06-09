"""Recommendation OS router (`/v1/recommendations`) — the platform's one recommendation layer."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_recommendation_os
from ..models.common import UserContext
from ..services.recommendations_os import LIFECYCLE, RecommendationOS

router = APIRouter(prefix="/v1/recommendations", tags=["recommendations"])


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


@router.post("/sync")
async def sync(user: AuthenticatedUser = Depends(authenticated), os: RecommendationOS = Depends(get_recommendation_os)):
    """Collect every module's recommendations into the one registry."""
    return await os.sync(_ctx(user))


@router.get("")
async def list_recos(user: AuthenticatedUser = Depends(authenticated), os: RecommendationOS = Depends(get_recommendation_os)):
    return {"recommendations": await os.active(_ctx(user))}


@router.get("/prioritize")
async def prioritize(user: AuthenticatedUser = Depends(authenticated), os: RecommendationOS = Depends(get_recommendation_os), top: int = 3):
    """The single 'what should I do first?' answer (dashboard + chat read this)."""
    return await os.prioritize(_ctx(user), top=top)


@router.get("/conflicts")
async def conflicts(user: AuthenticatedUser = Depends(authenticated), os: RecommendationOS = Depends(get_recommendation_os)):
    return {"conflicts": await os.conflicts(_ctx(user))}


@router.post("/{rid}/status")
async def set_status(rid: str, user: AuthenticatedUser = Depends(authenticated), os: RecommendationOS = Depends(get_recommendation_os), status: str = Body(..., embed=True)):
    if status not in LIFECYCLE:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(LIFECYCLE)}")
    return await os.set_status(_ctx(user), rid, status)
