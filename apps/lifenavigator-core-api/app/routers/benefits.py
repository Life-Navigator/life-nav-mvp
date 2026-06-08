"""Compensation & Benefits Intelligence router (`/v1/benefits`).

Synthesizes the user's uploaded documents into total comp / five-year value / benefit valuation /
retirement impact / insurance impact / FSA-HSA optimization tied to their own healthcare spend.
Cited to the source documents; not tax advice.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_comp_benefits_engine
from ..models.common import UserContext
from ..services.comp_benefits import CompensationBenefitsEngine

router = APIRouter(prefix="/v1/benefits", tags=["benefits"])


@router.get("/analysis")
async def analysis(
    user: AuthenticatedUser = Depends(authenticated),
    engine: CompensationBenefitsEngine = Depends(get_comp_benefits_engine),
    annual_healthcare_spend: float | None = Query(default=None),
):
    return await engine.analyze(UserContext(user_id=user.user_id), healthcare_spend=annual_healthcare_spend)
