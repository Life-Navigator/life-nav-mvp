"""Career domain router (`/v1/career`).

Career is NOT unlocked as a live domain in the registry until 15/15 gates + explicit
approval — these endpoints back the foundation + smoke. Every compensation figure is a
cited band (no fantasy salaries); recommendations carry a career_guidance boundary.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_career_service
from ..domains.career import CareerService
from ..models.common import DomainViewModel, UserContext

router = APIRouter(prefix="/v1/career", tags=["career"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.get("/summary", response_model=DomainViewModel)
async def summary(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    return await svc.summary(_ctx(user))


@router.get("/recommendations", response_model=DomainViewModel)
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    ctx = _ctx(user)
    vm = await svc.summary(ctx)
    vm.recommendations = await svc.recommendations(ctx)
    return vm


@router.post("/recommendations/generate")
async def generate(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    rows = await svc.persist_recommendations(_ctx(user))
    return {
        "count": len(rows),
        "recommendation_ids": [r.get("id") for r in rows],
        "recommendation_types": [r.get("recommendation_type") for r in rows],
    }


@router.get("/compensation")
async def compensation(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    """Current + target estimated market value (cited bands) + before/during/after scenario."""
    ctx = _ctx(user)
    vm = await svc.summary(ctx)
    return vm.data.get("compensation", {})


@router.get("/market-position")
async def market_position(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    vm = await svc.summary(_ctx(user))
    return vm.data.get("market_position", {})


@router.get("/report")
async def report(user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)) -> dict[str, Any]:
    """CareerReportViewModel (structured; PDF renderer is a later sprint)."""
    return await svc.report_model(_ctx(user))


# ---- generic owner-scoped list reads ----
_LISTS = {
    "profiles": ("career_profiles", "profiles"),
    "goals": ("career_goals", "goals"),
    "skills": ("user_skills", "skills"),
    "skill-gaps": ("skill_gaps", "skill_gaps"),
    "credentials": ("credentials", "credentials"),
    "certifications": ("certifications", "certifications"),
    "degrees": ("degrees", "degrees"),
    "job-targets": ("job_targets", "job_targets"),
    "compensation-records": ("compensation_records", "compensation_records"),
}


@router.get("/{collection}", response_model=DomainViewModel)
async def list_collection(collection: str, user: AuthenticatedUser = Depends(authenticated), svc: CareerService = Depends(get_career_service)):
    entry = _LISTS.get(collection)
    if entry is None:
        return await svc.summary(_ctx(user))
    table, key = entry
    return await svc.list_view(_ctx(user), table, key)
