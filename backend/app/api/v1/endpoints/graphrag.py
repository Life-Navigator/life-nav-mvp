"""
GraphRAG endpoints.
Handles semantic search and RAG queries via gRPC to the GraphRAG service.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, TenantID
from app.clients.graphrag import get_graphrag_client
from app.core.logging import logger

router = APIRouter()


class GraphRAGQueryRequest(BaseModel):
    """GraphRAG query request schema."""

    query: str = Field(min_length=1, description="Natural language query")
    max_results: int = Field(default=10, ge=1, le=100, description="Maximum number of results")
    domains: list[str] = Field(default_factory=list, description="Filter by domains (finance, health, etc.)")
    include_sources: bool = Field(default=True, description="Include source attribution")
    include_reasoning: bool = Field(default=False, description="Include reasoning steps for explainability")


class EntityResponse(BaseModel):
    """Entity from knowledge graph."""

    uri: str = Field(description="Entity URI")
    type: str = Field(description="Entity type (ln:Goal, ln:Transaction, etc.)")
    label: str = Field(description="Human-readable label")
    properties: dict[str, Any] = Field(default_factory=dict, description="Entity properties")
    tenant_id: str = Field(description="Tenant ID")
    created_at: str = Field(description="Creation timestamp")
    updated_at: str = Field(description="Update timestamp")


class SourceResponse(BaseModel):
    """Knowledge source."""

    source_type: str = Field(description="Source type (knowledge_graph, vector_db, llm)")
    source_uri: str = Field(description="Entity URI or document ID")
    content: str = Field(description="Source content snippet")
    relevance: float = Field(description="Relevance score (0.0-1.0)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ReasoningStepResponse(BaseModel):
    """Reasoning step for explainability."""

    step: int = Field(description="Step number")
    description: str = Field(description="Step description")
    action: str = Field(description="Action taken")
    result: str = Field(description="Step result")


class GraphRAGQueryResponse(BaseModel):
    """GraphRAG query response schema."""

    answer: str = Field(description="Generated answer from RAG")
    sources: list[SourceResponse] = Field(default_factory=list, description="Knowledge sources used")
    reasoning: list[ReasoningStepResponse] = Field(default_factory=list, description="Reasoning steps")
    confidence: float = Field(description="Confidence score (0.0-1.0)")
    entities: list[EntityResponse] = Field(default_factory=list, description="Related entities")
    duration_ms: int = Field(description="Query processing time in milliseconds")


@router.post("/query", response_model=GraphRAGQueryResponse)
async def search_knowledge_graph(
    request: GraphRAGQueryRequest,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Query the knowledge graph using natural language with RAG.

    Uses the GraphRAG gRPC service to perform hybrid knowledge graph + vector RAG queries
    with Row-Level Security filtering for multi-tenant data isolation.

    Args:
        request: Query parameters including query text, max results, domains, etc.
        current_user: Authenticated user (for RLS filtering)
        tenant_id: Current tenant context (for multi-tenancy)

    Returns:
        RAG response with generated answer, sources, entities, and reasoning

    Raises:
        HTTPException: If the GraphRAG service is unavailable or returns an error
    """
    logger.info(
        "GraphRAG personalized query",
        query=request.query,
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
        max_results=request.max_results,
        domains=request.domains,
    )

    try:
        # Get GraphRAG client
        client = get_graphrag_client()

        # Execute personalized query with RLS filtering
        response = await client.query_personalized(
            query=request.query,
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            max_results=request.max_results,
            domains=request.domains,
            include_sources=request.include_sources,
            include_reasoning=request.include_reasoning,
        )

        logger.info(
            "GraphRAG query completed",
            user_id=str(current_user.id),
            confidence=response["confidence"],
            entity_count=len(response["entities"]),
            duration_ms=response["duration_ms"],
        )

        return GraphRAGQueryResponse(**response)

    except Exception as e:
        logger.error(
            "GraphRAG query failed",
            error=str(e),
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GraphRAG service error: {str(e)}",
        )


@router.get("/status")
async def get_graphrag_status(
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Get the health status of the GraphRAG service.

    Returns connection status, service health, and version information.

    Args:
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Health status including service availability, version, and component health
    """
    logger.info(
        "GraphRAG health check",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    try:
        # Get GraphRAG client
        client = get_graphrag_client()

        # Execute health check
        health = await client.health_check()

        logger.info(
            "GraphRAG health check completed",
            status=health.get("status"),
            connected=health.get("connected"),
        )

        return health

    except Exception as e:
        logger.error(
            "GraphRAG health check failed",
            error=str(e),
        )
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(e),
            "services": {},
            "version": "unknown",
        }


@router.post("/index/rebuild", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def rebuild_knowledge_graph_index(
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Trigger a rebuild of the knowledge graph index for the current tenant.

    Note: This endpoint is not yet implemented in the GraphRAG service.
    Index rebuilding will be added in a future version of the GraphRAG service.

    Args:
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Not implemented response

    TODO:
        - Add RebuildIndex RPC to GraphRAG protobuf
        - Implement index rebuild in GraphRAG service
        - Add progress tracking
        - Implement webhook/callback for completion notification
    """
    logger.warning(
        "GraphRAG index rebuild requested but not implemented",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Index rebuild is not yet available in the GraphRAG service. "
        "Index rebuilding will be added in a future version.",
    )


@router.get("/index/status", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def get_index_status(
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Get the status of the knowledge graph index for the current tenant.

    Note: This endpoint is not yet implemented in the GraphRAG service.
    Index status tracking will be added in a future version of the GraphRAG service.

    Args:
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Not implemented response

    TODO:
        - Add GetIndexStatus RPC to GraphRAG protobuf
        - Implement index status in GraphRAG service
        - Add entity counts by type
        - Include last update timestamp
        - Add indexing progress tracking
    """
    logger.warning(
        "GraphRAG index status check requested but not implemented",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Index status tracking is not yet available in the GraphRAG service. "
        "This will be added in a future version.",
    )
