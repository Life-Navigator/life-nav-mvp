"""Finance domain routes (F1: summary only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_finance_service
from ..domains.finance import FinanceService
from ..models.common import DomainViewModel, UserContext

router = APIRouter(prefix="/v1/finance", tags=["finance"])


@router.get("/summary", response_model=DomainViewModel)
async def finance_summary(
    user: AuthenticatedUser = Depends(authenticated),
    service: FinanceService = Depends(get_finance_service),
) -> DomainViewModel:
    """Complete finance view-model for the hero screen.

    Identity comes ONLY from the verified JWT (never the request body).
    """
    return await service.summary(UserContext.from_auth(user))
