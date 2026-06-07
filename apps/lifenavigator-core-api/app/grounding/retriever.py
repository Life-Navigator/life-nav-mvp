"""Personal GraphRAG retrieval (port of the graphrag-query Edge function).

Embeds the query (Gemini, server-side), runs a user-scoped Qdrant vector search
and a user-scoped Neo4j graph lookup, and returns fused graph evidence. Every
call is scoped to ``tenant_id == user_id``. All failures degrade to empty
evidence — retrieval never raises into the chat path, and it never returns
another user's data.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from ..clients.gemini import GeminiClient
from ..clients.neo4j import Neo4jClient
from ..clients.qdrant import QdrantClient
from ..models.common import UserContext

log = logging.getLogger("core.retriever")


class Retriever:
    def __init__(self, gemini: GeminiClient, qdrant: QdrantClient, neo4j: Neo4jClient) -> None:
        self._gemini = gemini
        self._qdrant = qdrant
        self._neo4j = neo4j

    async def retrieve_personal(
        self,
        query: str,
        ctx: UserContext,
        *,
        domain: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Return fused, user-scoped graph evidence. [] if nothing configured/found."""
        if not query or not query.strip():
            return []

        evidence: list[dict[str, Any]] = []

        # --- vector (Qdrant), if Gemini + Qdrant are configured ---
        if self._gemini.configured and self._qdrant.configured:
            try:
                vector = await self._gemini.embed(query)
                hits = await self._qdrant.search_personal(
                    vector, user_id=ctx.user_id, limit=limit, domain=domain
                )
                for h in hits:
                    payload = h.get("payload", {}) if isinstance(h, dict) else {}
                    evidence.append(
                        {
                            "source": "qdrant",
                            "entity_type": payload.get("entity_type"),
                            "entity_id": payload.get("entity_id"),
                            "title": payload.get("title"),
                            "score": h.get("score") if isinstance(h, dict) else None,
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                log.warning("vector retrieval degraded: %s", exc)

        # --- graph (Neo4j) scaffold: user-scoped node neighbourhood ---
        if self._neo4j.configured:
            try:
                rows = await self._neo4j.query_personal(
                    "MATCH (n {tenant_id: $user_id}) "
                    "RETURN labels(n) AS labels, n.entity_id AS entity_id LIMIT $k",
                    user_id=ctx.user_id,
                    parameters={"k": limit},
                )
                for row in rows:
                    labels = row[0] if len(row) > 0 else None
                    entity_id = row[1] if len(row) > 1 else None
                    evidence.append(
                        {"source": "neo4j", "label": labels, "entity_id": entity_id, "score": None}
                    )
            except Exception as exc:  # noqa: BLE001
                log.warning("graph retrieval degraded: %s", exc)

        return evidence
