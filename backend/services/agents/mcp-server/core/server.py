"""MCP Server - FastAPI Application"""

from contextlib import asynccontextmanager
from typing import List, Optional
import time
from pathlib import Path
import shutil
import secrets

from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
agent_storage = None  # AgentStorage instance
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

    global db_manager, plugin_manager, context_builder, mcp_protocol, ingestion_pipeline, agent_storage

    try:
        # Initialize database connections
        db_manager = DatabaseManager(settings)
        await db_manager.initialize()

        # Initialize agent storage
        import sys
        from pathlib import Path
        mcp_server_path = Path(__file__).parent.parent
        if str(mcp_server_path) not in sys.path:
            sys.path.insert(0, str(mcp_server_path))

        from agents.storage import AgentStorage
        agent_storage = AgentStorage(db_manager._pg_pool)
        await agent_storage.initialize()
        logger.info("agent_storage_initialized")

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

    # OCR Plugin (Tri-Engine)
    if settings.enable_ocr_plugin:
        from ..plugins.ocr.plugin import OCRPlugin
        plugin = OCRPlugin()
        await pm.register_plugin(plugin, {
            "use_paddleocr": True,
            "use_deepseek": True,
            "enable_gpu": True,
            "high_quality_threshold": 0.80,
            "medium_quality_threshold": 0.60,
        })


def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> bool:
    """
    Verify internal service API key.

    This ensures only authenticated internal services (like Next.js backend)
    can access the agent endpoints.
    """
    settings = get_settings()
    expected_key = getattr(settings, 'internal_api_key', None)

    # If no key is configured, allow access (dev mode fallback)
    if not expected_key:
        logger.warning("internal_api_key_not_configured", message="Agent service is running without API key protection!")
        return True

    if not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    return True


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # CORS middleware - Only allow specific internal services
    # Agent service should NOT be publicly accessible - only via backend proxy
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",      # Next.js dev server (for local dev only)
            "http://127.0.0.1:3000",
            "http://localhost:8000",      # FastAPI backend
            "http://backend:8000",        # Docker internal backend
            "http://ln-backend:8000",     # Docker Compose backend service
        ],
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
    async def request_context(
        request: ContextRequest,
        authenticated: bool = Depends(verify_api_key)
    ) -> ContextResponse:
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
    async def invoke_tool(
        request: ToolInvocationRequest,
        authenticated: bool = Depends(verify_api_key)
    ) -> ToolInvocationResponse:
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

    # ==========================================================================
    # Agent Management Endpoints
    # ==========================================================================

    @app.get("/agents/templates", response_model=List[dict])
    async def get_agent_templates():
        """Get available agent templates"""
        from agents.storage import AgentTemplate
        return AgentTemplate.get_templates()

    @app.post("/agents", response_model=dict)
    async def create_agent(request: dict, user_id: str = "default_user"):
        """Create a new agent"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)

            agent = await agent_storage.create_agent(
                user_id=user_id,
                name=request["name"],
                description=request["description"],
                agent_type=request["agent_type"],
                capabilities=request.get("capabilities", []),
                system_prompt=request["system_prompt"],
                tools=request.get("tools", []),
                max_concurrent_tasks=request.get("max_concurrent_tasks", 5),
                task_timeout_seconds=request.get("task_timeout_seconds", 300),
                custom_config=request.get("custom_config", {})
            )

            return agent
        except Exception as e:
            logger.error("agent_creation_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create agent: {str(e)}"
            )

    @app.get("/agents", response_model=dict)
    async def list_agents(
        user_id: str = "default_user",
        include_inactive: bool = False
    ):
        """List all agents for a user"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)
            agents = await agent_storage.list_agents(user_id, include_inactive)
            return {
                "agents": agents,
                "total": len(agents)
            }
        except Exception as e:
            logger.error("agent_list_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list agents: {str(e)}"
            )

    @app.get("/agents/{agent_id}", response_model=dict)
    async def get_agent(agent_id: str, user_id: str = "default_user"):
        """Get agent by ID"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)
            agent = await agent_storage.get_agent(agent_id, user_id)

            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )

            return agent
        except HTTPException:
            raise
        except Exception as e:
            logger.error("agent_get_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get agent: {str(e)}"
            )

    @app.put("/agents/{agent_id}", response_model=dict)
    async def update_agent(
        agent_id: str,
        request: dict,
        user_id: str = "default_user"
    ):
        """Update an agent"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)
            agent = await agent_storage.update_agent(agent_id, user_id, **request)

            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )

            return agent
        except HTTPException:
            raise
        except Exception as e:
            logger.error("agent_update_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update agent: {str(e)}"
            )

    @app.delete("/agents/{agent_id}")
    async def delete_agent(agent_id: str, user_id: str = "default_user"):
        """Delete an agent (soft delete)"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)
            deleted = await agent_storage.delete_agent(agent_id, user_id)

            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )

            return {"success": True, "message": "Agent deleted"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("agent_delete_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete agent: {str(e)}"
            )

    @app.get("/agents/stats/summary", response_model=dict)
    async def get_agent_stats(user_id: str = "default_user"):
        """Get agent statistics"""
        from agents.storage import AgentStorage

        try:
            agent_storage = AgentStorage(db_manager._pg_pool)
            stats = await agent_storage.get_agent_stats(user_id)
            return stats
        except Exception as e:
            logger.error("agent_stats_failed", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get agent stats: {str(e)}"
            )

    # =============================================================================
    # TASK EXECUTION & MODEL INTEGRATION ENDPOINTS
    # =============================================================================

    from ..schemas.tasks import (
        TaskRequest as TaskReq, TaskResponse as TaskResp,
        ChatRequest, ChatResponse, ModelInferenceRequest, ModelInferenceResponse,
        TaskStatusResponse, TaskListResponse
    )

    # In-memory task storage (replace with database in production)
    tasks_storage = {}

    @app.post("/tasks", response_model=TaskResp)
    async def execute_task(
        request: TaskReq,
        user_id: str = "default_user",
        authenticated: bool = Depends(verify_api_key)
    ):
        """Execute a task with an agent (requires API key authentication)"""
        try:
            import uuid
            from datetime import datetime

            task_id = str(uuid.uuid4())

            # Get agent configuration
            agent = await agent_storage.get_agent(request.agent_id, user_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")

            # Create task record
            task = {
                "task_id": task_id,
                "agent_id": request.agent_id,
                "status": "pending",
                "result": None,
                "metadata": {
                    "task_type": request.task_type,
                    "input_text": request.input_text,
                    "context": request.context
                },
                "created_at": datetime.utcnow(),
                "completed_at": None,
                "error": None
            }

            tasks_storage[task_id] = task

            # Execute task asynchronously (simulated for now)
            # In production, this would dispatch to agent framework
            task["status"] = "running"

            # Simulate task execution with MCP tools
            try:
                # Get available tools for the agent
                available_tools = agent.get("tools", [])

                # Simple task routing based on type
                result_text = f"Task '{request.task_type}' executed by agent '{agent['name']}' with input: {request.input_text[:100]}..."

                # If it's a query task, use MCP tools
                if request.task_type in ["query", "research", "search"]:
                    # Simulate tool invocation (in production, use actual MCP tools)
                    result_text = f"Executed research task using tools: {', '.join(available_tools[:3])}"

                task["status"] = "completed"
                task["result"] = result_text
                task["completed_at"] = datetime.utcnow()

            except Exception as e:
                task["status"] = "failed"
                task["error"] = str(e)
                task["completed_at"] = datetime.utcnow()

            return TaskResp(**task)

        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to execute task: {str(e)}"
            )

    @app.get("/tasks/{task_id}", response_model=TaskStatusResponse)
    async def get_task_status(task_id: str):
        """Get status of a running task"""
        task = tasks_storage.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        return TaskStatusResponse(
            task_id=task["task_id"],
            agent_id=task["agent_id"],
            status=task["status"],
            result=task.get("result"),
            error=task.get("error"),
            created_at=task["created_at"],
            updated_at=task.get("completed_at") or task["created_at"]
        )

    @app.get("/tasks", response_model=TaskListResponse)
    async def list_tasks(agent_id: Optional[str] = None, limit: int = 50):
        """List tasks, optionally filtered by agent"""
        task_list = []
        for task in tasks_storage.values():
            if agent_id is None or task["agent_id"] == agent_id:
                task_list.append(TaskStatusResponse(
                    task_id=task["task_id"],
                    agent_id=task["agent_id"],
                    status=task["status"],
                    result=task.get("result"),
                    error=task.get("error"),
                    created_at=task["created_at"],
                    updated_at=task.get("completed_at") or task["created_at"]
                ))

        return TaskListResponse(
            tasks=task_list[:limit],
            total=len(task_list)
        )

    @app.post("/chat", response_model=ChatResponse)
    async def chat_with_agent(
        request: ChatRequest,
        user_id: str = "default_user",
        authenticated: bool = Depends(verify_api_key)
    ):
        """Chat with an agent using Maverick model (requires API key authentication)"""
        try:
            import uuid
            import requests as req
            from datetime import datetime

            # Get agent configuration
            agent = await agent_storage.get_agent(request.agent_id, user_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")

            conversation_id = request.conversation_id or str(uuid.uuid4())

            # Get system prompt from agent or override
            system_prompt = request.system_prompt_override or agent.get("system_prompt", "You are a helpful AI assistant.")

            # Call Maverick model
            try:
                maverick_response = req.post(
                    "http://localhost:8090/completion",
                    json={
                        "prompt": f"{system_prompt}\n\nUser: {request.message}\n\nAssistant:",
                        "n_predict": 500,
                        "temperature": 0.7,
                        "stop": ["\nUser:", "\n\n"],
                        "stream": False
                    },
                    timeout=60
                )
                data = maverick_response.json()
                agent_response = data.get("content", "").strip()
            except req.exceptions.ConnectionError:
                raise HTTPException(
                    status_code=503,
                    detail="Maverick server not running. Start it with: ./START_MAVERICK_QUICKSTART.sh"
                )

            return ChatResponse(
                conversation_id=conversation_id,
                agent_id=request.agent_id,
                message=agent_response,
                metadata={
                    "agent_name": agent["name"],
                    "agent_type": agent["agent_type"],
                    "model": "maverick-q4",
                    "tokens": data.get("tokens_predicted", 0) + data.get("tokens_evaluated", 0)
                },
                timestamp=datetime.utcnow()
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Chat failed: {str(e)}"
            )

    @app.post("/inference", response_model=ModelInferenceResponse)
    async def model_inference(request: ModelInferenceRequest):
        """Direct model inference endpoint - Using LOCAL Maverick Model"""
        try:
            import requests as req
            from datetime import datetime

            # Call your local Maverick llama.cpp server
            maverick_response = req.post(
                "http://localhost:8090/completion",
                json={
                    "prompt": f"{request.system_prompt or 'You are a helpful AI assistant.'}\n\nUser: {request.prompt}\n\nAssistant:",
                    "n_predict": request.max_tokens,
                    "temperature": request.temperature,
                    "stop": ["\nUser:", "\n\n"],
                    "stream": False
                },
                timeout=60
            )

            data = maverick_response.json()
            response_text = data.get("content", "")

            return ModelInferenceResponse(
                response=response_text,
                model="maverick-q4",
                tokens_used=data.get("tokens_predicted", 0) + data.get("tokens_evaluated", 0),
                metadata={
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "timestamp": datetime.utcnow().isoformat(),
                    "model_path": "maverick-q4_k_m.gguf"
                }
            )

        except req.exceptions.ConnectionError:
            raise HTTPException(
                status_code=503,
                detail="Maverick server not running. Start it with: ./START_MAVERICK_QUICKSTART.sh"
            )
        except Exception as e:
            logger.error(f"Inference failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Inference failed: {str(e)}"
            )

    # Prometheus metrics endpoint
    from prometheus_client import make_asgi_app
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

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
