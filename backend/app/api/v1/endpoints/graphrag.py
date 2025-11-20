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
    domains: list[str] = Field(
        default_factory=list, description="Filter by domains (finance, health, etc.)"
    )
    include_sources: bool = Field(default=True, description="Include source attribution")
    include_reasoning: bool = Field(
        default=False, description="Include reasoning steps for explainability"
    )


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
    sources: list[SourceResponse] = Field(
        default_factory=list, description="Knowledge sources used"
    )
    reasoning: list[ReasoningStepResponse] = Field(
        default_factory=list, description="Reasoning steps"
    )
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


class IndexRebuildRequest(BaseModel):
    """Index rebuild request schema."""

    index_type: str = Field(
        default="full",
        description="Type of rebuild: full, incremental, delta_sync",
        pattern="^(full|incremental|delta_sync)$",
    )
    config: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional rebuild configuration overrides",
    )


class IndexRebuildResponse(BaseModel):
    """Index rebuild response schema."""

    job_id: str = Field(description="Background job ID for tracking")
    status: str = Field(description="Job status")
    message: str = Field(description="Human-readable message")
    estimated_duration_minutes: int = Field(description="Estimated completion time")


@router.post("/index/rebuild", response_model=IndexRebuildResponse)
async def rebuild_knowledge_graph_index(
    request: IndexRebuildRequest,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Trigger a rebuild of the knowledge graph index for the current tenant.

    Starts a background job to rebuild the knowledge graph, which includes:
    - Extracting entities from PostgreSQL
    - Generating vector embeddings
    - Loading into Neo4j (property graph)
    - Loading into Qdrant (vector database)
    - Generating RDF triples for GraphDB

    The rebuild runs asynchronously. Use the returned job_id to track progress
    via the /index/status/{job_id} endpoint.

    Args:
        request: Rebuild configuration
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Job information with tracking ID
    """
    from app.services.graphrag_index_service import GraphRAGIndexService
    from app.models.graphrag_index import IndexType
    from app.tasks.graphrag_tasks import rebuild_index_task

    logger.info(
        "GraphRAG index rebuild requested",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
        index_type=request.index_type,
    )

    try:
        # Validate index type
        try:
            index_type = IndexType(request.index_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid index_type: {request.index_type}. "
                f"Must be one of: full, incremental, delta_sync",
            )

        # Create job via service
        from app.api.deps import get_db

        async with get_db() as db:
            index_service = GraphRAGIndexService(db)

            job = await index_service.create_rebuild_job(
                tenant_id=tenant_id,
                user_id=current_user.id,
                index_type=index_type,
                config=request.config,
            )

        # Enqueue background task
        task = rebuild_index_task.delay(
            job_id=str(job.id),
            tenant_id=str(tenant_id),
            index_type=request.index_type,
        )

        # Estimate duration based on index type
        estimated_duration = {
            "full": 30,  # 30 minutes for full rebuild
            "incremental": 5,  # 5 minutes for incremental
            "delta_sync": 1,  # 1 minute for delta sync
        }.get(request.index_type, 10)

        logger.info(
            "GraphRAG index rebuild job created",
            job_id=str(job.id),
            celery_task_id=task.id,
            tenant_id=str(tenant_id),
        )

        return IndexRebuildResponse(
            job_id=str(job.id),
            status="pending",
            message=f"Index rebuild job created. Type: {request.index_type}",
            estimated_duration_minutes=estimated_duration,
        )

    except ValueError as e:
        # Job already running for tenant
        logger.warning(
            "GraphRAG index rebuild failed",
            error=str(e),
            tenant_id=str(tenant_id),
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            "GraphRAG index rebuild failed",
            error=str(e),
            tenant_id=str(tenant_id),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start index rebuild: {str(e)}",
        )


class IndexStatusResponse(BaseModel):
    """Index status response schema."""

    tenant_id: str = Field(description="Tenant ID")
    entities: dict[str, Any] = Field(description="Entity statistics")
    relationships: dict[str, Any] = Field(description="Relationship statistics")
    vectors: dict[str, Any] = Field(description="Vector index statistics")
    health: dict[str, Any] = Field(description="Index health metrics")
    performance: dict[str, Any] = Field(description="Performance metrics")
    storage: dict[str, Any] = Field(description="Storage usage")
    last_rebuild: dict[str, Any] = Field(description="Last rebuild information")
    active_jobs: list[dict[str, Any]] = Field(
        default_factory=list, description="Active rebuild jobs"
    )


@router.get("/index/status", response_model=IndexStatusResponse)
async def get_index_status(
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Get the status of the knowledge graph index for the current tenant.

    Returns comprehensive index statistics including:
    - Entity and relationship counts by type
    - Vector index statistics
    - Health and quality metrics
    - Performance metrics
    - Storage usage
    - Last rebuild information
    - Active rebuild jobs

    Args:
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Detailed index status and metrics
    """
    from app.services.graphrag_index_service import GraphRAGIndexService

    logger.info(
        "GraphRAG index status requested",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    try:
        from app.api.deps import get_db

        async with get_db() as db:
            index_service = GraphRAGIndexService(db)

            # Get index metrics
            metrics = await index_service.get_index_metrics(tenant_id)

            # Get active jobs
            active_jobs = await index_service.list_rebuild_jobs(
                tenant_id=tenant_id, limit=5, include_completed=False
            )

            logger.info(
                "GraphRAG index status retrieved",
                tenant_id=str(tenant_id),
                total_entities=metrics["entities"]["total"],
                active_jobs_count=len(active_jobs),
            )

            return IndexStatusResponse(**metrics, active_jobs=active_jobs)

    except Exception as e:
        logger.error(
            "GraphRAG index status failed",
            error=str(e),
            tenant_id=str(tenant_id),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get index status: {str(e)}",
        )


class JobStatusResponse(BaseModel):
    """Job status response schema."""

    job_id: str = Field(description="Job ID")
    tenant_id: str = Field(description="Tenant ID")
    user_id: str | None = Field(description="User who started the job")
    status: str = Field(description="Job status")
    index_type: str = Field(description="Type of rebuild")
    progress: dict[str, Any] = Field(description="Progress information")
    entity_counts: dict[str, int] = Field(description="Entity counts by type")
    timing: dict[str, Any] = Field(description="Timing information")
    performance: dict[str, Any] = Field(description="Performance metrics")
    error: dict[str, str] | None = Field(description="Error information if failed")
    celery_task_id: str | None = Field(description="Celery task ID")


@router.get("/index/status/{job_id}", response_model=JobStatusResponse)
async def get_rebuild_job_status(
    job_id: str,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Get the status of a specific index rebuild job.

    Use this endpoint to track the progress of a rebuild job started
    via the /index/rebuild endpoint.

    Args:
        job_id: Job ID returned from /index/rebuild
        current_user: Authenticated user
        tenant_id: Current tenant context

    Returns:
        Detailed job status with progress information
    """
    from app.services.graphrag_index_service import GraphRAGIndexService

    logger.info(
        "GraphRAG job status requested",
        job_id=job_id,
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    try:
        from app.api.deps import get_db
        from uuid import UUID

        async with get_db() as db:
            index_service = GraphRAGIndexService(db)

            # Get job status
            job_status = await index_service.get_job_status(UUID(job_id))

            # Verify tenant access
            if job_status["tenant_id"] != str(tenant_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this job",
                )

            logger.info(
                "GraphRAG job status retrieved",
                job_id=job_id,
                status=job_status["status"],
                progress=job_status["progress"]["percentage"],
            )

            return JobStatusResponse(**job_status)

    except ValueError as e:
        logger.warning("GraphRAG job not found", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}",
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            "GraphRAG job status failed",
            job_id=job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}",
        )
