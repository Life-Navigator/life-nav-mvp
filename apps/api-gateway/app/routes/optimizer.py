"""Optimizer passthrough.

Same passthrough pattern as simulations — the deterministic optimizer
lives in the Next.js app today. The gateway acknowledges the request
and stamps the authenticated user_id from the JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user

router = APIRouter()


class RunBody(BaseModel):
    monthly_surplus: float = Field(ge=0, le=1_000_000)
    stated_goal: str | None = None
    goal_id: str | None = None


@router.post("/run")
async def run(body: RunBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    return {
        "accepted": True,
        "user_id": user.user_id,
        "monthly_surplus": body.monthly_surplus,
        "stated_goal": body.stated_goal,
        "delegated_to": "web /api/optimizer/run",
    }
