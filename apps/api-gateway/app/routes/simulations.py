"""Simulation passthrough — kicks off the trajectory engine that lives
in the web app or runs simulations locally if a worker is available.

For the scaffold we provide simple acknowledgement endpoints; the
heavy lifting is delegated to the existing Next.js `/api/simulations/*`
routes. A future iteration can move the projector into this gateway.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user

router = APIRouter()


class CreateBody(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    horizon_years: int = Field(ge=1, le=60)
    stated_goal: str | None = None


class CompareBody(BaseModel):
    scenario_id: str
    version_a_id: str
    version_b_id: str


@router.post("/create")
async def create(body: CreateBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    return {
        "accepted": True,
        "user_id": user.user_id,
        "title": body.title,
        "horizon_years": body.horizon_years,
        "delegated_to": "web /api/simulations/create",
    }


@router.post("/compare")
async def compare(body: CompareBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    return {
        "accepted": True,
        "user_id": user.user_id,
        "scenario_id": body.scenario_id,
        "delegated_to": "web /api/simulations/compare",
    }
