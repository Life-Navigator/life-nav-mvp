"""Finance domain routes — full surface.

Reads return complete view-models (DomainViewModel); the frontend renders them
directly and never assembles raw Supabase rows. Writes are service-role only and
stamp ``user_id`` from the verified JWT (never the request body).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Query

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_finance_service
from ..domains.finance import FinanceService
from ..models.common import DomainViewModel, UserContext, WriteResult

router = APIRouter(prefix="/v1/finance", tags=["finance"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext.from_auth(user)


# ------------------------------------------------------------------- reads
@router.get("/summary", response_model=DomainViewModel)
async def summary(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.summary(_ctx(user))


@router.get("/accounts", response_model=DomainViewModel)
async def accounts(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.accounts(_ctx(user))


@router.get("/transactions", response_model=DomainViewModel)
async def transactions(
    limit: int = Query(default=100, ge=1, le=500),
    user: AuthenticatedUser = Depends(authenticated),
    svc: FinanceService = Depends(get_finance_service),
):
    return await svc.transactions(_ctx(user), limit=limit)


@router.get("/cash-flow", response_model=DomainViewModel)
async def cash_flow(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.cash_flow(_ctx(user))


@router.get("/net-worth", response_model=DomainViewModel)
async def net_worth(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.net_worth(_ctx(user))


@router.get("/debt", response_model=DomainViewModel)
async def debt(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.debt(_ctx(user))


@router.get("/investments", response_model=DomainViewModel)
async def investments(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.investments(_ctx(user))


@router.get("/retirement", response_model=DomainViewModel)
async def retirement(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.retirement(_ctx(user))


@router.get("/recommendations", response_model=DomainViewModel)
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.recommendations_view(_ctx(user))


@router.post("/recommendations/generate")
async def generate_recommendations(
    user: AuthenticatedUser = Depends(authenticated),
    svc: FinanceService = Depends(get_finance_service),
) -> dict[str, Any]:
    """Compute + idempotently persist grounded recommendations (with evidence) for the
    signed-in user. Repeated calls upsert the same rows. The worker fans each persisted
    recommendation into its Neo4j evidence subgraph."""
    persisted = await svc.persist_recommendations(_ctx(user))
    return {
        "count": len(persisted),
        "recommendation_ids": [r.get("id") for r in persisted],
        "recommendation_types": [r.get("recommendation_type") for r in persisted],
    }


# ------------------------------------------------------------------ writes
@router.post("/goals", response_model=WriteResult)
async def create_goal(
    payload: dict[str, Any] = Body(default_factory=dict),
    user: AuthenticatedUser = Depends(authenticated),
    svc: FinanceService = Depends(get_finance_service),
):
    return await svc.create_goal(_ctx(user), payload)


@router.post("/manual-asset", response_model=WriteResult)
async def manual_asset(
    payload: dict[str, Any] = Body(default_factory=dict),
    user: AuthenticatedUser = Depends(authenticated),
    svc: FinanceService = Depends(get_finance_service),
):
    return await svc.manual_asset(_ctx(user), payload)


@router.post("/manual-liability", response_model=WriteResult)
async def manual_liability(
    payload: dict[str, Any] = Body(default_factory=dict),
    user: AuthenticatedUser = Depends(authenticated),
    svc: FinanceService = Depends(get_finance_service),
):
    return await svc.manual_liability(_ctx(user), payload)


@router.post("/refresh", response_model=WriteResult)
async def refresh(user: AuthenticatedUser = Depends(authenticated), svc: FinanceService = Depends(get_finance_service)):
    return await svc.refresh(_ctx(user))
