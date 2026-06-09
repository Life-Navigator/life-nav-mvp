"""Finance domain routes — full surface.

Reads return complete view-models (DomainViewModel); the frontend renders them
directly and never assembles raw Supabase rows. Writes are service-role only and
stamp ``user_id`` from the verified JWT (never the request body).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Query

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_finance_service, get_financial_planning, get_snapshot_engine, get_trend_analyzer
from ..domains.finance import FinanceService
from ..services.financial_planning import FinancialPlanningEngine
from ..services.snapshots import SnapshotEngine, TrendAnalyzer
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


@router.post("/snapshot")
async def take_snapshot(user: AuthenticatedUser = Depends(authenticated), engine: SnapshotEngine = Depends(get_snapshot_engine)):
    """Capture this period's net-worth / cash-flow / debt snapshot (idempotent per month)."""
    return await engine.take_snapshot(_ctx(user))


@router.get("/trends")
async def trends(user: AuthenticatedUser = Depends(authenticated), analyzer: TrendAnalyzer = Depends(get_trend_analyzer)):
    """Trend direction + change detection ('what changed this month') from snapshot history."""
    return await analyzer.trends(_ctx(user))


@router.get("/plan")
async def financial_plan(
    user: AuthenticatedUser = Depends(authenticated),
    engine: FinancialPlanningEngine = Depends(get_financial_planning),
    current_age: int = Query(default=40),
    retirement_age: int = Query(default=67),
):
    """Advanced financial plan: retirement readiness + Monte Carlo + goal funding + Social
    Security + insurance optimization + withdrawal planning."""
    return await engine.plan(_ctx(user), current_age=current_age, retirement_age=retirement_age)


from ..dependencies import get_financial_resolver, get_tool_runner  # noqa: E402
from ..services.tools import ToolRunner  # noqa: E402
from ..services.financial_resolver import FinancialInputResolver  # noqa: E402


@router.get("/resolved-inputs")
async def resolved_inputs(user: AuthenticatedUser = Depends(authenticated), svc: FinancialInputResolver = Depends(get_financial_resolver)):
    """Canonical financial inputs resolved from Supabase — each with its source + present/missing."""
    return await svc.resolve(UserContext(user_id=user.user_id))


@router.get("/retirement-projection")
async def retirement_projection_card(current_age: int | None = Query(default=None),
                                     user: AuthenticatedUser = Depends(authenticated),
                                     svc: FinancialInputResolver = Depends(get_financial_resolver),
                                     runner: ToolRunner = Depends(get_tool_runner)):
    """Projected retirement assets from the deterministic tool, run on canonical inputs only.
    Missing required inputs -> a named missing state (never a fabricated projection)."""
    return await svc.retirement_projection_card(UserContext(user_id=user.user_id), runner, current_age)
