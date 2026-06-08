"""Family domain router (`/v1/family`).

Family is NOT unlocked as a live domain until its gates pass + approval — these endpoints
back the Family Decision Engine + smoke. Recommendations carry legal (attorney) or
family_planning (licensed advisor) governance boundaries; estimates are planning guidance.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_family_service
from ..domains.family import FamilyService
from ..models.common import DomainViewModel, UserContext

router = APIRouter(prefix="/v1/family", tags=["family"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.get("/summary", response_model=DomainViewModel)
async def summary(user: AuthenticatedUser = Depends(authenticated), svc: FamilyService = Depends(get_family_service)):
    return await svc.summary(_ctx(user))


@router.get("/recommendations", response_model=DomainViewModel)
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: FamilyService = Depends(get_family_service)):
    ctx = _ctx(user)
    vm = await svc.summary(ctx)
    vm.recommendations = await svc.recommendations(ctx)
    return vm


@router.post("/recommendations/generate")
async def generate(user: AuthenticatedUser = Depends(authenticated), svc: FamilyService = Depends(get_family_service)):
    rows = await svc.persist_recommendations(_ctx(user))
    return {
        "count": len(rows),
        "recommendation_ids": [r.get("id") for r in rows],
        "recommendation_types": [r.get("recommendation_type") for r in rows],
    }
