"""Central GraphRAG retrieval — read-only shared knowledge.

The central collection contains no per-user data. We still parameterize
``domain`` so callers can scope to financial / career / etc. concepts.
"""
from __future__ import annotations

from typing import Any, Optional

from .gemini import GeminiClient
from .qdrant import QdrantClient


async def retrieve_central(
    *,
    query: str,
    gemini: GeminiClient,
    qdrant: QdrantClient,
    limit: int = 10,
    domain: Optional[str] = None,
) -> list[dict[str, Any]]:
    if not query or not query.strip():
        raise ValueError("retrieve_central requires a non-empty query")
    vector = await gemini.embed(query)
    return await qdrant.search_central(vector=vector, limit=limit, domain=domain)
