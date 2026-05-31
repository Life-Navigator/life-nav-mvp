"""GraphRAG retrieval endpoints.

POST /api/graphrag/query — hybrid personal + central retrieval. The
``user_id`` is taken ONLY from the JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user
from ..deps import get_gemini, get_neo4j, get_qdrant
from ..schemas.common import QueryRequest
from ..services.gemini import GeminiClient
from ..services.graphrag_central import retrieve_central
from ..services.graphrag_personal import retrieve_personal
from ..services.neo4j_client import Neo4jClient
from ..services.qdrant import QdrantClient

router = APIRouter()


class QueryBody(QueryRequest):
    include_central: bool = True


class QueryResponse(BaseModel):
    user_id: str = Field(description="The authenticated user — echoed for clarity. Never read from request body.")
    personal_hits: list[dict] = Field(default_factory=list)
    central_hits: list[dict] = Field(default_factory=list)
    fused: list[dict] = Field(default_factory=list)


@router.post("/query", response_model=QueryResponse)
async def query(
    body: QueryBody,
    user: AuthenticatedUser = Depends(current_user),
    gemini: GeminiClient = Depends(get_gemini),
    qdrant: QdrantClient = Depends(get_qdrant),
    neo4j: Neo4jClient = Depends(get_neo4j),
) -> QueryResponse:
    personal = await retrieve_personal(
        user_id=user.user_id,
        query=body.query,
        gemini=gemini,
        qdrant=qdrant,
        neo4j=neo4j,
        limit=body.limit,
        domain=body.domain,
    )
    central: list[dict] = []
    if body.include_central:
        try:
            central = await retrieve_central(
                query=body.query, gemini=gemini, qdrant=qdrant, limit=body.limit, domain=body.domain
            )
        except Exception:
            central = []
    return QueryResponse(
        user_id=user.user_id,
        personal_hits=personal.qdrant_hits,
        central_hits=central,
        fused=personal.fused,
    )
