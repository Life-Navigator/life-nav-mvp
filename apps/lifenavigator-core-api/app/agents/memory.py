"""Memory Agent (F2 scaffold).

Loads prior conversation context and persists turns to ``chat.*``. F2 reads
history best-effort (degrades to empty) and treats persistence as a no-op
placeholder; the service-role INSERT path is wired with the chat.* persistence
work. Never raises into the chat flow.
"""
from __future__ import annotations

from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext


class MemoryAgent:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._supabase = supabase

    async def load_history(
        self, ctx: UserContext, conversation_id: Optional[str], *, limit: int = 20
    ) -> list[dict[str, Any]]:
        if not conversation_id:
            return []
        return await self._supabase.select(
            "chat_messages",
            columns="role,content,created_at",
            filters={
                "conversation_id": f"eq.{conversation_id}",
                "user_id": f"eq.{ctx.user_id}",
            },
            limit=limit,
        )

    async def persist_turn(
        self,
        ctx: UserContext,
        conversation_id: Optional[str],
        user_message: str,
        assistant_message: str,
    ) -> None:
        # F2 scaffold: best-effort, no-op. Real service-role INSERT into chat.*
        # lands with the persistence wiring (mirrors lib/chat/persistence.ts).
        return None
