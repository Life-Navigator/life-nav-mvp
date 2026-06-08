"""Education domain router (`/v1/education`).

Education is NOT unlocked as a live domain until its gates pass + approval — these
endpoints back the flagship comparison/ROI engine + smoke. Every ROI figure is cited
(Scorecard earnings + OEWS market value); recommendations carry an education_guidance boundary.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_education_service
from ..domains.education import EducationService
from ..models.common import DomainViewModel, UserContext

router = APIRouter(prefix="/v1/education", tags=["education"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.get("/summary", response_model=DomainViewModel)
async def summary(user: AuthenticatedUser = Depends(authenticated), svc: EducationService = Depends(get_education_service)):
    return await svc.summary(_ctx(user))


@router.get("/recommendations", response_model=DomainViewModel)
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: EducationService = Depends(get_education_service)):
    ctx = _ctx(user)
    vm = await svc.summary(ctx)
    vm.recommendations = await svc.recommendations(ctx)
    return vm


@router.post("/recommendations/generate")
async def generate(user: AuthenticatedUser = Depends(authenticated), svc: EducationService = Depends(get_education_service)):
    rows = await svc.persist_recommendations(_ctx(user))
    return {
        "count": len(rows),
        "recommendation_ids": [r.get("id") for r in rows],
        "recommendation_types": [r.get("recommendation_type") for r in rows],
    }


@router.get("/comparison")
async def comparison(user: AuthenticatedUser = Depends(authenticated), svc: EducationService = Depends(get_education_service)):
    """Ranked program comparison with cited scores + worst/expected/best scenarios."""
    vm = await svc.summary(_ctx(user))
    return {"programs": vm.data.get("programs"), "best_program": vm.data.get("best_program"), "comparison": vm.data.get("comparison")}
