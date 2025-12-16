"""
Life Navigator FastAPI Application.
Main application with middleware, routes, and lifecycle management.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from sentry_sdk.integrations.fastapi import FastApiIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import check_db_health, close_db, init_db
from app.core.logging import configure_logging, logger
from app.core.redis import close_redis
from app.core.telemetry import init_telemetry, instrument_fastapi, shutdown_telemetry

# Configure logging at import time
configure_logging()

# Initialize OpenTelemetry (must happen before app creation for some instrumentations)
init_telemetry()


# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])  # Default limit for all endpoints


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for startup and shutdown events.

    Handles:
    - Database initialization
    - Health check
    - Graceful shutdown
    """
    logger.info("Starting Life Navigator API", version=__version__, env=settings.ENVIRONMENT)

    # Initialize database (gracefully handle connection failures)
    try:
        if settings.is_development:
            await init_db()
            logger.info("Database initialized (dev mode)")

        # Check database health (non-blocking)
        if await check_db_health():
            logger.info("Database health check passed")
        else:
            logger.warning("Database health check failed - service will start but DB operations may fail")
    except Exception as e:
        logger.warning("Database initialization failed - service will start but DB operations may fail", error=str(e))

    yield

    # Shutdown
    logger.info("Shutting down Life Navigator API")
    try:
        await close_db()
        logger.info("Database connections closed")
    except Exception:
        pass
    try:
        await close_redis()
        logger.info("Redis connections closed")
    except Exception:
        pass
    shutdown_telemetry()
    logger.info("Telemetry shutdown complete")


# Initialize Sentry if configured
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        integrations=[FastApiIntegration()],
    )
    logger.info("Sentry initialized", dsn=settings.SENTRY_DSN[:20] + "...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=__version__,
    description="Life Navigator - AI-powered platform for managing finances, career, education, goals, health, and relationships",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url=f"{settings.API_PREFIX}/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Instrument FastAPI with OpenTelemetry
instrument_fastapi(app)


# =============================================================================
# Middleware
# =============================================================================


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests."""

    async def dispatch(self, request: Request, call_next):
        """Log request and response."""
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query=str(request.url.query) if request.url.query else None,
        )

        response = await call_next(request)

        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )

        return response


# CORS middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=settings.CORS_CREDENTIALS,
        allow_methods=settings.cors_methods_list,
        allow_headers=settings.cors_headers_list,
    )
    logger.info("CORS middleware enabled", origins=settings.cors_origins_list)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request logging
if not settings.is_production:
    app.add_middleware(RequestLoggingMiddleware)

# Trusted host middleware (production only)
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "*.lifenavigator.ai",
            "lifenavigator.ai",
            "*.run.app",  # Cloud Run URLs
        ],
    )


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
        "version": __version__,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/db", tags=["Health"])
async def database_health_check():
    """
    Database health check endpoint.
    Returns database connectivity status.
    """
    is_healthy = await check_db_health()

    if not is_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "unreachable",
            },
        )

    return {
        "status": "healthy",
        "database": "connected",
    }


# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# =============================================================================
# API Routes
# =============================================================================

# Include API v1 router
app.include_router(api_router, prefix=settings.API_PREFIX)


# =============================================================================
# Root Endpoint
# =============================================================================


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint.
    Returns API information and links.
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": __version__,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs" if not settings.is_production else None,
        "health_url": "/health",
        "api_url": settings.API_PREFIX,
    }


# =============================================================================
# Error Handlers
# =============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler.
    Logs all unhandled exceptions and returns generic error response.
    """
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
        exc_info=exc,
    )

    if settings.is_production:
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
