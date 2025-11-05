"""
API v1 routing
"""
from fastapi import APIRouter
from app.api.v1.endpoints import users, goals, health, finance, career, education, auth

api_router = APIRouter()

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(goals.router, prefix="/goals", tags=["goals"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(career.router, prefix="/career", tags=["career"])
api_router.include_router(education.router, prefix="/education", tags=["education"])
