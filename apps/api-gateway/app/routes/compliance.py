"""Compliance check endpoint.

POST /api/compliance/check — vet arbitrary text. Used internally by
the web app or any future agent before surfacing model output to the
user.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user
from ..services.compliance import check_recommendation

router = APIRouter()


class CheckBody(BaseModel):
    text: str = Field(min_length=0, max_length=20_000)


@router.post("/check")
async def check(body: CheckBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    result = check_recommendation(body.text)
    return {
        "ok": result.ok,
        "compliance_notes": result.compliance_notes,
        "violations": [
            {
                "category": v.category,
                "matched_phrase": v.matched_phrase,
                "context": v.context,
            }
            for v in result.violations
        ],
        "checked_by_user_id": user.user_id,
    }
