"""Cross-domain Decision Engine router (`/v1/decision`).

Resolves a life question across Finance/Health/Career/Education/Family into worst/expected/
best scenarios + cited evidence + tradeoffs, persisted as a decision graph. Decision support
only (decision_guidance boundary) — not financial/legal/tax advice.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service, get_decision_engine, get_decision_graph, get_decision_workspace, get_scenario_tree
from ..models.common import UserContext
from ..services.analytics import AnalyticsService
from ..services.decision_engine import DecisionEngine
from ..services.decision_graph import DecisionGraphService
from ..services.decision_workspace import WORKSPACE_TYPES, DecisionWorkspaceService
from ..services.scenario_tree import ScenarioTreeService

router = APIRouter(prefix="/v1/decision", tags=["decision"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.post("")
async def decide(
    user: AuthenticatedUser = Depends(authenticated),
    engine: DecisionEngine = Depends(get_decision_engine),
    analytics: AnalyticsService = Depends(get_analytics_service),
    question: str = Body(..., embed=True),
):
    """Resolve + persist a cross-domain decision graph for the question."""
    ctx = _ctx(user)
    result = await engine.persist(ctx, question)
    await analytics.emit(ctx, "decision_generated", domain="decision",
                         props={"decision_type": (result.get("decision") or {}).get("decision_type"), "stored": result.get("stored")})
    return result


@router.post("/preview")
async def preview(
    user: AuthenticatedUser = Depends(authenticated),
    engine: DecisionEngine = Depends(get_decision_engine),
    question: str = Body(..., embed=True),
):
    """Build the decision without persisting (worst/expected/best + evidence)."""
    return await engine.decide(_ctx(user), question)


@router.get("/workspace/types")
async def workspace_types(user: AuthenticatedUser = Depends(authenticated)):
    """The preset life decisions a workspace can be created for."""
    return {"types": DecisionWorkspaceService.types()}


@router.post("/workspace")
async def create_workspace(
    user: AuthenticatedUser = Depends(authenticated),
    svc: DecisionWorkspaceService = Depends(get_decision_workspace),
    analytics: AnalyticsService = Depends(get_analytics_service),
    decision_type: str = Body(..., embed=True),
):
    if decision_type not in WORKSPACE_TYPES:
        raise HTTPException(status_code=400, detail=f"decision_type must be one of {tuple(WORKSPACE_TYPES)}")
    ctx = _ctx(user)
    ws = await svc.create(ctx, decision_type)
    await analytics.emit(ctx, "decision_generated", domain="decision", props={"decision_type": decision_type, "workspace": True})
    return ws


@router.post("/workspace/graph")
async def workspace_graph(
    user: AuthenticatedUser = Depends(authenticated),
    svc: DecisionGraphService = Depends(get_decision_graph),
    decision_type: str = Body(..., embed=True),
):
    """The Decision Intelligence Graph — documents → analyses → impacts → tradeoffs →
    recommendation → readiness, as clickable colored nodes + edges (the reasoning, visible)."""
    if decision_type not in WORKSPACE_TYPES:
        raise HTTPException(status_code=400, detail=f"decision_type must be one of {tuple(WORKSPACE_TYPES)}")
    return await svc.build(_ctx(user), decision_type)


@router.get("/scenarios/decisions")
async def scenario_decisions(user: AuthenticatedUser = Depends(authenticated)):
    """The decision points a scenario tree can branch on."""
    return {"decisions": ScenarioTreeService.available_decisions()}


@router.post("/scenarios")
async def scenario_tree(
    user: AuthenticatedUser = Depends(authenticated),
    svc: ScenarioTreeService = Depends(get_scenario_tree),
    decisions: list[str] = Body(default=["mba", "new_job"], embed=True),
):
    """Build a multi-scenario decision tree; each path returns readiness / net worth /
    retirement / confidence."""
    return await svc.build(_ctx(user), decisions)
