"""DomainService — the contract every domain implements.

This ABC is what keeps the platform from drifting into a mess: a new domain is
one ``DomainService`` subclass conforming to this interface, and the
cross-cutting routers (life-profile, chat, recommendations) iterate registered
services without edits. See CORE_API_ARCHITECTURE.md §3.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..models.common import (
    DomainChatContext,
    DomainViewModel,
    Recommendation,
    UserContext,
)


class DomainService(ABC):
    #: Stable domain key, e.g. "finance".
    domain: str = "base"
    #: Worker EntityType strings this domain owns (drives graph retrieval).
    entity_types: list[str] = []

    @abstractmethod
    async def summary(self, ctx: UserContext) -> DomainViewModel:
        """Complete view-model for the domain's hero/dashboard surface (F)."""

    @abstractmethod
    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        """Grounding block for chat/agents (G): authoritative + missing facts."""

    @abstractmethod
    async def recommendations(self, ctx: UserContext) -> list[Recommendation]:
        """Domain recommendations (H), each with evidence + confidence + governance."""
