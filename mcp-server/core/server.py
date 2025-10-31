"""MCP Server - FastAPI Application"""

from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
import time
from pathlib import Path
import shutil

from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from ..utils.config import get_settings, Settings
from ..utils.logging import setup_logging, get_logger
from ..utils.database import DatabaseManager
from ..schemas.protocol import (
    ContextRequest,
    ContextResponse,
    ToolInvocationRequest,
    ToolInvocationResponse,
)
from ..schemas.ingestion import (
    DocumentUploadResponse,
    JobStatusResponse,
    JobListResponse,
    IngestionStatsResponse,
)
from .plugin_manager import PluginManager
from .context_builder import ContextBuilder
from .protocol import MCPProtocol
from ..ingestion.pipeline import IngestionPipeline

logger = get_logger(__name__)


# Global instances
db_manager: DatabaseManager = None
plugin_manager: PluginManager = None
context_builder: ContextBuilder = None
mcp_protocol: MCPProtocol = None
ingestion_pipeline: IngestionPipeline = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for the FastAPI application.
    Handles startup and shutdown events.
    """
    settings = get_settings()
    setup_logging(settings.log_level)

    logger.info(
        "starting_mcp_server",
        app_name=settings.app_name,
        version=settings.app_version
    )

    global db_manager, plugin_manager, context_builder, mcp_protocol, ingestion_pipeline

    try:
        # Initialize database connections
        db_manager = DatabaseManager(settings)
        await db_manager.initialize()

        # Initialize plugin manager
        plugin_manager = PluginManager()

        # Load built-in plugins
        await _load_plugins(plugin_manager, db_manager, settings)

        # Initialize context builder
        context_builder = ContextBuilder(plugin_manager, db_manager)

        # Initialize MCP protocol handler
        mcp_protocol = MCPProtocol(plugin_manager, context_builder)

        # Initialize ingestion pipeline
        ingestion_pipeline = IngestionPipeline(
            db_manager=db_manager,
            config={
                "llm_endpoint": settings.llm_endpoint if hasattr(settings, 'llm_endpoint') else "http://localhost:8090/v1/chat/completions",
                "use_local_embeddings": True,
            }
        )

        logger.info("mcp_server_started")

        yield

    except Exception as e:
        logger.error("startup_failed", error=str(e), exc_info=True)
        raise
    finally:
        # Cleanup
        logger.info("shutting_down_mcp_server")

        if ingestion_pipeline:
            await ingestion_pipeline.cleanup()

        if plugin_manager:
            await plugin_manager.cleanup_all()

        if db_manager:
            await db_manager.cleanup()

        logger.info("mcp_server_shutdown_complete")


async def _load_plugins(
    pm: PluginManager,
    db: DatabaseManager,
    settings: Settings
) -> None:
    """Load and initialize built-in plugins"""

    # GraphRAG Plugin
    if settings.enable_graphrag_plugin:
        from ..plugins.graphrag.plugin import GraphRAGPlugin
        plugin = GraphRAGPlugin(db)
        await pm.register_plugin(plugin, {
            "max_results": 10,
            "include_relationships": True,
        })

    # Memory Plugin
    if settings.enable_memory_plugin:
        from ..plugins.memory.plugin import MemoryPlugin
        plugin = MemoryPlugin(db)
        await pm.register_plugin(plugin, {
            "short_term_ttl": 3600,
            "working_memory_size": 50,
        })

    # Web Search Plugin
    if settings.enable_websearch_plugin and settings.serper_api_key:
        from ..plugins.websearch.plugin import WebSearchPlugin
        plugin = WebSearchPlugin()
        await pm.register_plugin(plugin, {
            "api_key": settings.serper_api_key,
            "max_results": 5,
        })

    # Files Plugin
    if settings.enable_files_plugin:
        from ..plugins.files.plugin import FilesPlugin
        plugin = FilesPlugin()
        await pm.register_plugin(plugin, {})


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    @app.get("/")
    async def root():
        """Root endpoint"""
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "status": "running",
        }

    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        try:
            # Check database health
            db_health = await db_manager.health_check()

            # Check plugin health
            plugin_health = await plugin_manager.health_check_all()

            all_healthy = (
                all(v == "ok" for v in db_health.values())
                and all(p["status"] == "ok" for p in plugin_health.values())
            )

            status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

            return JSONResponse(
                status_code=status_code,
                content={
                    "status": "healthy" if all_healthy else "unhealthy",
                    "databases": db_health,
                    "plugins": plugin_health,
                }
            )

        except Exception as e:
            logger.error("health_check_failed", error=str(e))
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "unhealthy",
                    "error": str(e),
                }
            )

    @app.get("/health/live")
    async def liveness():
        """Kubernetes liveness probe"""
        return {"status": "alive"}

    @app.get("/health/ready")
    async def readiness():
        """Kubernetes readiness probe"""
        try:
            await db_manager.postgres.fetchval("SELECT 1")
            return {"status": "ready"}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Not ready"
            )

    @app.post("/mcp/context", response_model=ContextResponse)
    async def request_context(request: ContextRequest) -> ContextResponse:
        """
        Request context aggregation from plugins.

        This endpoint collects context from multiple sources (GraphRAG, memory, etc.)
        and returns aggregated context for LLM consumption.
        """
        start_time = time.time()

        try:
            logger.info(
                "context_request",
                user_id=request.user_id,
                query=request.query[:100],
                context_types=request.context_types
            )

            # Get aggregated context
            context_data = await plugin_manager.get_aggregated_context(
                query=request.query,
                user_id=request.user_id,
                context_types=request.context_types,
                conversation_id=request.conversation_id,
                filters=request.filters,
            )

            latency_ms = (time.time() - start_time) * 1000

            response = ContextResponse(
                request_id=request.request_id,
                success=True,
                context=context_data["context"],
                sources=context_data["metadata"]["sources"],
                tokens_used=context_data["metadata"]["tokens_total"],
                latency_ms=latency_ms,
            )

            logger.info(
                "context_response",
                request_id=request.request_id,
                sources_count=len(response.sources),
                tokens=response.tokens_used,
                latency_ms=latency_ms
            )

            return response

        except Exception as e:
            logger.error(
                "context_request_failed",
                request_id=request.request_id,
                error=str(e),
                exc_info=True
            )

            return ContextResponse(
                request_id=request.request_id,
                success=False,
                error=str(e),
                context={},
                sources=[],
                tokens_used=0,
                latency_ms=(time.time() - start_time) * 1000,
            )

    @app.post("/mcp/tool/invoke", response_model=ToolInvocationResponse)
    async def invoke_tool(request: ToolInvocationRequest) -> ToolInvocationResponse:
        """
        Invoke a registered tool.

        Tools are functions provided by plugins that LLMs can call to perform actions.
        """
        start_time = time.time()

        try:
            logger.info(
                "tool_invocation",
                tool_name=request.tool_name,
                user_id=request.user_id
            )

            # Invoke tool
            result = await plugin_manager.invoke_tool(
                tool_name=request.tool_name,
                parameters=request.parameters,
                user_id=request.user_id,
            )

            execution_time_ms = (time.time() - start_time) * 1000

            response = ToolInvocationResponse(
                request_id=request.request_id,
                success=True,
                tool_name=request.tool_name,
                result=result,
                execution_time_ms=execution_time_ms,
            )

            logger.info(
                "tool_invocation_complete",
                request_id=request.request_id,
                tool=request.tool_name,
                execution_time_ms=execution_time_ms
            )

            return response

        except ValueError as e:
            # Tool not found
            logger.warning(
                "tool_not_found",
                request_id=request.request_id,
                tool=request.tool_name
            )

            return ToolInvocationResponse(
                request_id=request.request_id,
                success=False,
                tool_name=request.tool_name,
                error=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            logger.error(
                "tool_invocation_failed",
                request_id=request.request_id,
                tool=request.tool_name,
                error=str(e),
                exc_info=True
            )

            return ToolInvocationResponse(
                request_id=request.request_id,
                success=False,
                tool_name=request.tool_name,
                error=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )

    @app.get("/mcp/plugins")
    async def list_plugins():
        """List all registered plugins"""
        return {
            "plugins": plugin_manager.list_plugins(),
        }

    @app.get("/mcp/tools")
    async def list_tools():
        """List all registered tools"""
        return {
            "tools": plugin_manager.list_tools(),
        }

    # ========== Ingestion Endpoints ==========

    @app.post("/ingest/upload", response_model=DocumentUploadResponse)
    async def upload_document(
        file: UploadFile = File(...),
        user_id: str = Form(...),
        is_centralized: bool = Form(default=False),
    ) -> DocumentUploadResponse:
        """
        Upload and ingest a document.

        Supports multiple formats: TXT, MD, PDF, DOCX, HTML, CSV, JSON

        The document will be:
        1. Parsed (extract text and metadata)
        2. Analyzed for entities and concepts (using Maverick)
        3. Embedded (vector generation)
        4. Loaded into Neo4j (knowledge graph) and Qdrant (vector store)
        """
        try:
            logger.info(
                "document_upload_request",
                filename=file.filename,
                user_id=user_id,
                centralized=is_centralized
            )

            # Create uploads directory if needed
            upload_dir = Path("./uploads")
            upload_dir.mkdir(exist_ok=True)

            # Save uploaded file
            file_path = upload_dir / file.filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            file_size = file_path.stat().st_size

            # Start ingestion job
            job_id = await ingestion_pipeline.ingest_document(
                file_path=str(file_path),
                user_id=user_id,
                is_centralized=is_centralized,
                metadata={
                    "original_filename": file.filename,
                    "content_type": file.content_type,
                }
            )

            logger.info(
                "ingestion_job_created",
                job_id=job_id,
                filename=file.filename
            )

            return DocumentUploadResponse(
                job_id=job_id,
                file_name=file.filename,
                file_size=file_size,
                status="pending",
                message=f"Document upload successful. Ingestion job {job_id} created."
            )

        except Exception as e:
            logger.error(
                "document_upload_failed",
                filename=file.filename,
                error=str(e),
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document upload failed: {str(e)}"
            )

    @app.get("/ingest/jobs/{job_id}", response_model=JobStatusResponse)
    async def get_job_status(job_id: str) -> JobStatusResponse:
        """
        Get the status of an ingestion job.

        Returns progress, status, and results (when completed).
        """
        try:
            job_status = ingestion_pipeline.get_job_status(job_id)

            if not job_status:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Job {job_id} not found"
                )

            return JobStatusResponse(**job_status)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "get_job_status_failed",
                job_id=job_id,
                error=str(e),
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get job status: {str(e)}"
            )

    @app.get("/ingest/jobs", response_model=JobListResponse)
    async def list_jobs(
        page: int = 1,
        page_size: int = 20,
        status_filter: Optional[str] = None
    ) -> JobListResponse:
        """
        List ingestion jobs.

        Supports pagination and filtering by status.
        """
        try:
            all_jobs = ingestion_pipeline.list_jobs(limit=1000)

            # Filter by status if specified
            if status_filter:
                all_jobs = [j for j in all_jobs if j["status"] == status_filter]

            # Pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_jobs = all_jobs[start_idx:end_idx]

            return JobListResponse(
                jobs=[JobStatusResponse(**job) for job in paginated_jobs],
                total=len(all_jobs),
                page=page,
                page_size=page_size
            )

        except Exception as e:
            logger.error(
                "list_jobs_failed",
                error=str(e),
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list jobs: {str(e)}"
            )

    @app.get("/ingest/stats", response_model=IngestionStatsResponse)
    async def get_ingestion_stats() -> IngestionStatsResponse:
        """
        Get ingestion system statistics.

        Returns counts for jobs, documents, entities, and concepts.
        """
        try:
            all_jobs = ingestion_pipeline.list_jobs(limit=10000)

            active_jobs = sum(1 for j in all_jobs if j["status"] == "processing")
            completed_jobs = sum(1 for j in all_jobs if j["status"] == "completed")
            failed_jobs = sum(1 for j in all_jobs if j["status"] == "failed")

            # Aggregate results from completed jobs
            total_entities = 0
            total_concepts = 0
            total_embeddings = 0

            for job in all_jobs:
                if job["status"] == "completed" and job.get("result"):
                    result = job["result"]
                    total_entities += result.get("entities", 0)
                    total_concepts += result.get("concepts", 0)
                    total_embeddings += result.get("chunks", 0)

            return IngestionStatsResponse(
                total_jobs=len(all_jobs),
                active_jobs=active_jobs,
                completed_jobs=completed_jobs,
                failed_jobs=failed_jobs,
                total_documents_processed=completed_jobs,
                total_entities_extracted=total_entities,
                total_concepts_extracted=total_concepts,
                total_embeddings_generated=total_embeddings
            )

        except Exception as e:
            logger.error(
                "get_ingestion_stats_failed",
                error=str(e),
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get statistics: {str(e)}"
            )

    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint (placeholder)"""
        # TODO: Implement Prometheus metrics
        return {"message": "Metrics endpoint"}

    return app


# For running with uvicorn
app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()

    uvicorn.run(
        "mcp_server.core.server:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers if not settings.reload else 1,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
