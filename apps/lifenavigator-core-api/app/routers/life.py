"""Life Discovery router (`/v1/life`) — vision, goal discovery (need behind the need), snapshot, graph."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_discovery_coverage, get_life_bridge, get_life_discovery, get_my_life, get_relationship_manager
from ..models.common import UserContext
from ..services.life_discovery import LifeDiscoveryService

router = APIRouter(prefix="/v1/life", tags=["life"])


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


@router.put("/vision")
async def vision(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery),
                 vision_text: str = Body(..., embed=True), prompts: dict = Body(default={}, embed=True)):
    return await svc.save_vision(_ctx(user), vision_text=vision_text, prompts=prompts)


@router.post("/goal")
async def goal(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery),
               surface_goal: str = Body(..., embed=True), why_chain: list = Body(default=[], embed=True),
               root_override: str = Body(default="", embed=True)):
    """Discover the ROOT objective behind a surface goal + decompose it into the Life Graph."""
    return await svc.discover_goal(_ctx(user), surface_goal=surface_goal, why_chain=why_chain, root_override=root_override or None)


@router.get("/snapshot")
async def snapshot(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery)):
    return await svc.snapshot(_ctx(user))


@router.get("/graph")
async def graph(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery)):
    return await svc.personal_graph(_ctx(user))


@router.get("/plan")
async def plan(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery)):
    """Multi-objective plan: ranked objectives + conflict/tradeoff analysis."""
    return await svc.objectives_plan(_ctx(user))


@router.get("/health")
async def health(user: AuthenticatedUser = Depends(authenticated), svc: LifeDiscoveryService = Depends(get_life_discovery)):
    """Discovery health: coverage, confidence, gaps + prompts to improve the life model."""
    return await svc.discovery_health(_ctx(user))


from ..services.life_bridge import LifeBridgeService  # noqa: E402
from ..services.relationship_manager import RelationshipManager  # noqa: E402


@router.post("/bridge")
async def bridge(user: AuthenticatedUser = Depends(authenticated), svc: LifeBridgeService = Depends(get_life_bridge)):
    """Fold setup-wizard / persona onboarding data into the canonical Life Model."""
    return await svc.sync(_ctx(user))


@router.get("/discovery/next")
async def discovery_next(user: AuthenticatedUser = Depends(authenticated), svc: RelationshipManager = Depends(get_relationship_manager)):
    """Relationship Manager: the next discovery question (primary, conversational onboarding)."""
    return await svc.state(_ctx(user))


@router.post("/discovery/answer")
async def discovery_answer(user: AuthenticatedUser = Depends(authenticated), svc: RelationshipManager = Depends(get_relationship_manager),
                           key: str = Body(..., embed=True), answer: str = Body(..., embed=True)):
    """Record one answer → write it to the canonical Life Model immediately, then advance."""
    from fastapi import HTTPException
    try:
        return await svc.answer(_ctx(user), key, answer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/discovery/chat")
async def discovery_chat(user: AuthenticatedUser = Depends(authenticated), svc: RelationshipManager = Depends(get_relationship_manager),
                         message: str = Body(default="", embed=True), pending_key: str = Body(default="", embed=True)):
    """Chat-native Relationship Manager: one advisor turn — answer the pending question (if any),
    show what updated, reflect, and ask the next. The advisor IS the onboarding."""
    return await svc.converse(_ctx(user), message, pending_key or None)


from ..services.my_life import MyLifeService  # noqa: E402


@router.get("/my-life")
async def my_life(user: AuthenticatedUser = Depends(authenticated), svc: MyLifeService = Depends(get_my_life)):
    """The flagship Life-OS aggregate: vision, what-matters-most, readiness, next action, constraints, recent intelligence."""
    return await svc.my_life(_ctx(user))


@router.get("/attention")
async def attention(user: AuthenticatedUser = Depends(authenticated), svc: MyLifeService = Depends(get_my_life)):
    """Disciplined dashboard feed: one next best action + up to 3 attention alerts (not the full list)."""
    return await svc.attention(_ctx(user))


from ..services.discovery_coverage import DiscoveryCoverageService  # noqa: E402


@router.get("/discovery/coverage")
async def discovery_coverage(user: AuthenticatedUser = Depends(authenticated), svc: DiscoveryCoverageService = Depends(get_discovery_coverage)):
    """Per-domain discovery coverage (started/partial/complete + %, missing, unlocks) — never blank."""
    return await svc.coverage(_ctx(user))
