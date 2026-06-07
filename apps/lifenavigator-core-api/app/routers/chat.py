"""Chat routes (F2).

POST /v1/chat/context — per-domain grounding (G contract), assembled by the
                        ContextBuilder. No model call.
POST /v1/chat         — full grounded turn through the Life Orchestrator:
                        Supabase facts → Personal GraphRAG → (anti-hallucination
                        gate) → Gemini (server-side) → Trust/Safety → response.

Identity comes only from the verified JWT. Gemini is never exposed to the frontend.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..agents.orchestrator import LifeOrchestratorAgent
from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_context_builder, get_orchestrator
from ..grounding.context_builder import ContextBuilder
from ..models.common import ChatTurnResponse, DomainChatContext, UserContext

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class ChatContextRequest(BaseModel):
    query: Optional[str] = None
    domains: Optional[list[str]] = None  # None → all relevant (F2: finance)


class ChatContextResponse(BaseModel):
    contexts: list[DomainChatContext]


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


@router.post("/context", response_model=ChatContextResponse)
async def chat_context(
    body: ChatContextRequest,
    user: AuthenticatedUser = Depends(authenticated),
    builder: ContextBuilder = Depends(get_context_builder),
) -> ChatContextResponse:
    ctx = UserContext.from_auth(user)
    wanted = body.domains or ["finance"]
    contexts: list[DomainChatContext] = []
    for domain in wanted:
        try:
            contexts.append(await builder.build_domain_context(ctx, domain))
        except KeyError:
            continue  # unknown/not-yet-wired domain → skip (no fabrication)
    return ChatContextResponse(contexts=contexts)


@router.post("", response_model=ChatTurnResponse)
async def chat(
    body: ChatRequest,
    user: AuthenticatedUser = Depends(authenticated),
    orchestrator: LifeOrchestratorAgent = Depends(get_orchestrator),
) -> ChatTurnResponse:
    return await orchestrator.handle(
        UserContext.from_auth(user), body.message, conversation_id=body.conversation_id
    )
