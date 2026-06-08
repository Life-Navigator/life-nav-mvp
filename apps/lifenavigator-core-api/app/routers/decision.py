"""Cross-domain Decision Engine router (`/v1/decision`).

Resolves a life question across Finance/Health/Career/Education/Family into worst/expected/
best scenarios + cited evidence + tradeoffs, persisted as a decision graph. Decision support
only (decision_guidance boundary) — not financial/legal/tax advice.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service, get_decision_engine
from ..models.common import UserContext
from ..services.analytics import AnalyticsService
from ..services.decision_engine import DecisionEngine

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
