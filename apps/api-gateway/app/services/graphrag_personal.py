"""Personal GraphRAG retrieval.

Hybrid (vector + graph) search ALWAYS filtered to the authenticated
user. The function-level signature requires ``user_id`` so a caller
who forgot to pass it gets a static error rather than a silent
cross-tenant search.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .gemini import GeminiClient
from .neo4j_client import Neo4jClient
from .qdrant import QdrantClient


@dataclass
class PersonalRetrievalResult:
    qdrant_hits: list[dict[str, Any]]
    graph_hits: list[dict[str, Any]]
    fused: list[dict[str, Any]]


async def retrieve_personal(
    *,
    user_id: str,
    query: str,
    gemini: GeminiClient,
    qdrant: QdrantClient,
    neo4j: Neo4jClient,
    limit: int = 10,
    domain: Optional[str] = None,
) -> PersonalRetrievalResult:
    if not user_id:
        raise ValueError("retrieve_personal requires user_id")
    if not query or not query.strip():
        raise ValueError("retrieve_personal requires a non-empty query")

    # 1. Embed.
    vector = await gemini.embed(query)

    # 2. Qdrant — tenant-filtered.
    qdrant_hits = await qdrant.search_personal(
        user_id=user_id, vector=vector, limit=limit, domain=domain
    )

    # 3. Neo4j — small Cypher that reads the user's top-N goals + key
    # entities. Cypher includes $tenant_id; helper refuses if it doesn't.
    cypher = (
        "MATCH (n) "
        "WHERE n.tenant_id = $tenant_id "
        "RETURN n.entity_type AS entity_type, n.entity_id AS entity_id, "
        "       n.title AS title, n.summary AS summary, n.domain AS domain "
        "ORDER BY coalesce(n.updated_at, n.created_at) DESC "
        "LIMIT $limit"
    )
    try:
        graph_hits = await neo4j.run_personal(user_id=user_id, cypher=cypher, extra={"limit": limit})
    except Exception:
        graph_hits = []

    fused = rrf_fuse(qdrant_hits, graph_hits, k=limit)
    return PersonalRetrievalResult(qdrant_hits=qdrant_hits, graph_hits=graph_hits, fused=fused)


def rrf_fuse(qdrant_hits: list[dict[str, Any]], graph_hits: list[dict[str, Any]], k: int = 10) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion. Combines two ranked lists into one.

    Each item is keyed by ``(entity_type, entity_id)``. We treat the
    Qdrant ``payload`` as authoritative for metadata.
    """
    scores: dict[tuple[str, str], float] = {}
    payloads: dict[tuple[str, str], dict[str, Any]] = {}

    def keyof(hit: dict[str, Any]) -> Optional[tuple[str, str]]:
        payload = hit.get("payload") or hit
        et = payload.get("entity_type")
        eid = payload.get("entity_id")
        if not et or not eid:
            return None
        return (et, eid)

    for rank, hit in enumerate(qdrant_hits):
        key = keyof(hit)
        if key is None:
            continue
        scores[key] = scores.get(key, 0.0) + 1.0 / (60 + rank)
        if key not in payloads:
            payloads[key] = hit.get("payload") or hit

    for rank, hit in enumerate(graph_hits):
        key = keyof(hit)
        if key is None:
            continue
        scores[key] = scores.get(key, 0.0) + 1.0 / (60 + rank)
        if key not in payloads:
            payloads[key] = hit

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:k]
    out: list[dict[str, Any]] = []
    for (et, eid), score in ranked:
        item = dict(payloads.get((et, eid), {}))
        item["entity_type"] = et
        item["entity_id"] = eid
        item["rrf_score"] = round(score, 6)
        out.append(item)
    return out
