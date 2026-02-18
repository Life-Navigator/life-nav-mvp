"""
Market Data Service - FastAPI Application

Entry point for the market-data microservice.
Provides normalized market snapshots to risk-engine.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from app.api.v1 import routes
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.http import close_http_client
from app.core.metrics import registry

# Setup logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.

    Handles startup and shutdown tasks.
    """
    # Startup
    logger.info(
        "market_data_service_starting",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )

    yield

    # Shutdown
    logger.info("market_data_service_shutting_down")
    await close_http_client()


# Create FastAPI app
app = FastAPI(
    title="Market Data Service",
    description="Normalized market data feed for LifeNavigator risk-engine",
    version=settings.VERSION,
    lifespan=lifespan,
)


# Include API routes
app.include_router(routes.router)


@app.get("/healthz", response_class=PlainTextResponse)
async def healthz() -> str:
    """
    Health check endpoint.

    Used by Kubernetes liveness probe.
    """
    return "OK"


@app.get("/readyz", response_class=PlainTextResponse)
async def readyz() -> str:
    """
    Readiness check endpoint.

    Used by Kubernetes readiness probe.
    Could check GCS connectivity, etc.
    """
    # TODO: Add actual readiness checks (GCS connection, etc.)
    return "OK"


@app.get("/metrics")
async def metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Exposes all service metrics.
    """
    metrics_output = generate_latest(registry)
    return Response(content=metrics_output, media_type=CONTENT_TYPE_LATEST)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global exception handler.

    Logs all unhandled exceptions and returns generic error response.
    """
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": request.headers.get("X-Request-ID", "unknown"),
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
    )
