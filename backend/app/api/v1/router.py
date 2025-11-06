"""
API v1 Router.
Aggregates all domain routers into the main API router.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    career,
    education,
    finance,
    goals,
    graphrag,
    health,
    relationships,
    users,
)

api_router = APIRouter()

# Authentication endpoints (no prefix - /auth)
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)

# User management
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)

# Finance domain
api_router.include_router(
    finance.router,
    prefix="/finance",
    tags=["Finance"],
)

# Career domain
api_router.include_router(
    career.router,
    prefix="/career",
    tags=["Career"],
)

# Education domain
api_router.include_router(
    education.router,
    prefix="/education",
    tags=["Education"],
)

# Goals domain
api_router.include_router(
    goals.router,
    prefix="/goals",
    tags=["Goals"],
)

# Health domain
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"],
)

# Relationships domain
api_router.include_router(
    relationships.router,
    prefix="/relationships",
    tags=["Relationships"],
)

# GraphRAG search
api_router.include_router(
    graphrag.router,
    prefix="/search",
    tags=["GraphRAG Search"],
)
