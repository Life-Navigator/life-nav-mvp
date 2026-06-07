"""Chat-context routes (F1 scaffold).

POST /v1/chat/context assembles per-domain grounding (G contract). F1 wires the
finance domain only; F2 adds vector+graph fusion and the full domain set, then
POST /v1/chat (Gemini behind the Trust/Safety gate).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_finance_service
from ..domains.finance import FinanceService
from ..models.common import DomainChatContext, UserContext

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class ChatContextRequest(BaseModel):
    query: Optional[str] = None
    domains: Optional[list[str]] = None  # None → all relevant (F1: finance only)


class ChatContextResponse(BaseModel):
    contexts: list[DomainChatContext]


@router.post("/context", response_model=ChatContextResponse)
async def chat_context(
    body: ChatContextRequest,
    user: AuthenticatedUser = Depends(authenticated),
    finance: FinanceService = Depends(get_finance_service),
) -> ChatContextResponse:
    ctx = UserContext.from_auth(user)
    wanted = body.domains or ["finance"]
    contexts: list[DomainChatContext] = []
    if "finance" in wanted:
        contexts.append(await finance.chat_context(ctx))
    return ChatContextResponse(contexts=contexts)
