"""
Financial Services API - Main Application
Built with FastAPI for high-performance financial calculations and analysis
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import structlog
from prometheus_client import make_asgi_app

from app.core.config import settings
from app.core.database import init_db
from app.core.redis import init_redis
from app.api.v1.api import api_router
from app.middleware.auth import AuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import LoggingMiddleware

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown"""
    # Startup
    logger.info("Starting Financial Services API", version=settings.VERSION)
    await init_db()
    await init_redis()
    yield
    # Shutdown
    logger.info("Shutting down Financial Services API")

app = FastAPI(
    title="LifeNavigator Financial Services API",
    description="Advanced financial planning and analysis microservice",
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)

# API Routes
app.include_router(api_router, prefix="/api/v1")

# Metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "finance-api",
        "version": settings.VERSION
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "LifeNavigator Financial Services API",
        "version": settings.VERSION,
        "docs": "/api/docs"
    }