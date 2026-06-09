"""Life Discovery router (`/v1/life`) — vision, goal discovery (need behind the need), snapshot, graph."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_life_discovery
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
