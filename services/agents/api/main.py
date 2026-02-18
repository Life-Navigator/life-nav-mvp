"""
Life Navigator Agents Service - Main Application
Multi-agent system for finance, career, education, goals, health, and relationships
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import structlog
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from ..utils.config import Config
from ..utils.logging import setup_logging

logger = structlog.get_logger()

# Load configuration
config = Config()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup and shutdown events.

    Handles:
    - Agent system initialization
    - Database connections
    - Graceful shutdown
    """
    logger.info("Starting Agents Service", version="1.0.0")

    # Initialize database connections
    try:
        from ..agents.orchestration.orchestrator import get_orchestrator
        orchestrator = await get_orchestrator()
        logger.info("Orchestrator initialized")
    except Exception as e:
        logger.error("Failed to initialize orchestrator", error=str(e), exc_info=True)
        raise

    yield

    # Shutdown
    logger.info("Shutting down Agents Service")
    try:
        # Cleanup orchestrator and agent resources
        if orchestrator:
            await orchestrator.shutdown()
        logger.info("Agent resources cleaned up successfully")
    except Exception as e:
        logger.error("Error during shutdown", error=str(e), exc_info=True)

    logger.info("Agents Service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Life Navigator Agents Service",
    version="1.0.0",
    description="Multi-agent system for managing all life domains (finance, career, education, goals, health, relationships)",
    docs_url="/docs" if config.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if config.ENVIRONMENT != "production" else None,
    openapi_url="/api/openapi.json" if config.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)


# =============================================================================
# Middleware
# =============================================================================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS if hasattr(config, 'CORS_ORIGINS') else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# =============================================================================
# Health Check & Monitoring
# =============================================================================


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    Returns service status and version.
    """
    return {
        "status": "healthy",
        "service": "agents",
        "version": "1.0.0",
        "environment": config.ENVIRONMENT,
    }


@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """
    Kubernetes liveness probe.
    Returns 200 if the service is running.
    """
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"])
async def readiness_probe():
    """
    Kubernetes readiness probe.
    Returns 200 if the service is ready to accept traffic.
    """
    try:
        # Check if orchestrator is ready
        from ..agents.orchestration.orchestrator import get_orchestrator
        orchestrator = await get_orchestrator()

        if not orchestrator:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orchestrator not ready"
            )

        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Not ready: {str(e)}"
        )


# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# =============================================================================
# API Routes
# =============================================================================


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint.
    Returns API information and links.
    """
    return {
        "service": "Life Navigator Agents Service",
        "version": "1.0.0",
        "environment": config.ENVIRONMENT,
        "docs_url": "/docs" if config.ENVIRONMENT != "production" else None,
        "health_url": "/health",
    }


@app.post("/agents/execute", tags=["Agents"])
async def execute_agent_task(request: dict):
    """
    Execute a task with an agent.

    Request body:
    {
        "agent_type": "finance" | "career" | "education" | "goals" | "health" | "relationships",
        "task": "task description",
        "user_id": "user_id",
        "context": {}
    }
    """
    try:
        from ..agents.orchestration.orchestrator import get_orchestrator
        orchestrator = await get_orchestrator()

        result = await orchestrator.execute_task(
            agent_type=request.get("agent_type"),
            task=request.get("task"),
            user_id=request.get("user_id"),
            context=request.get("context", {})
        )

        return {
            "success": True,
            "result": result,
        }
    except Exception as e:
        logger.error("Task execution failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task execution failed: {str(e)}"
        )


@app.get("/agents/status", tags=["Agents"])
async def get_agents_status():
    """Get status of all agents"""
    try:
        from ..agents.orchestration.orchestrator import get_orchestrator
        orchestrator = await get_orchestrator()

        status_info = await orchestrator.get_status()

        return {
            "success": True,
            "agents": status_info,
        }
    except Exception as e:
        logger.error("Failed to get agents status", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get agents status: {str(e)}"
        )


# =============================================================================
# Error Handlers
# =============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """
    Global exception handler.
    Logs all unhandled exceptions and returns generic error response.
    """
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path if hasattr(request, 'url') else None,
        method=request.method if hasattr(request, 'method') else None,
        exc_info=exc,
    )

    if config.ENVIRONMENT == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "error": str(exc),
                "type": type(exc).__name__,
            },
        )


# Setup logging
setup_logging(config.LOG_LEVEL if hasattr(config, 'LOG_LEVEL') else "INFO")
