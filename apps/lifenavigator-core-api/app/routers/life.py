"""Life Discovery router (`/v1/life`) — vision, goal discovery (need behind the need), snapshot, graph."""
from __future__ import annotations

import json as _json

from fastapi import APIRouter, Body, Depends
from fastapi.responses import StreamingResponse

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_advisor_orchestrator, get_discovery_coverage, get_life_bridge, get_life_discovery, get_my_life, get_relationship_manager
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
async def discovery_chat(user: AuthenticatedUser = Depends(authenticated), svc=Depends(get_advisor_orchestrator),
                         message: str = Body(default="", embed=True), pending_key: str = Body(default="", embed=True),
                         conversation_id: str = Body(default="", embed=True), trace: bool = Body(default=False, embed=True)):
    """Chat-native hybrid advisor: one turn. The deterministic engine handles persistence + safety and
    guarantees a fallback; the LLM leads the conversation within those guardrails (one strong question,
    why it matters), gated by the output validator. The advisor IS the onboarding.

    `trace=true` returns the full per-turn diagnostic trace, but ONLY when ADVISOR_TRACE_ENABLED is set
    (developer-only — never exposed to end users in production)."""
    import os
    trace_ok = trace and os.environ.get("ADVISOR_TRACE_ENABLED", "").lower() in ("1", "true", "yes")
    return await svc.converse(_ctx(user), message, pending_key or None,
                              conversation_id=conversation_id or None, trace=trace_ok)


@router.post("/discovery/chat/stream")
async def discovery_chat_stream(user: AuthenticatedUser = Depends(authenticated), svc=Depends(get_advisor_orchestrator),
                                message: str = Body(default="", embed=True), pending_key: str = Body(default="", embed=True),
                                conversation_id: str = Body(default="", embed=True), trace: bool = Body(default=False, embed=True)):
    """Progressive (SSE) variant of the advisor turn — emits a fast deterministic `ack` event (~1s) so the
    user sees useful text immediately, then the fully validated `final` event when the LLM-enhanced answer
    is ready. Same trust gates and telemetry as the non-streaming endpoint. Each SSE frame is
    `data: <json>\\n\\n` with an `{"type": "ack"|"final"}` payload."""
    import os
    trace_ok = trace and os.environ.get("ADVISOR_TRACE_ENABLED", "").lower() in ("1", "true", "yes")

    async def event_stream():
        async for evt in svc.converse_stream(_ctx(user), message, pending_key or None,
                                             conversation_id=conversation_id or None, trace=trace_ok):
            yield f"data: {_json.dumps(evt, default=str)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
