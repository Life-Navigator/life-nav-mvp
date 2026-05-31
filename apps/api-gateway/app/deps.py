"""FastAPI dependency factories.

Each service client is built lazily and cached so the same instance is
reused across requests. Tests override these via
``app.dependency_overrides``.
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from .auth import AuthenticatedUser, current_user
from .config import Settings, get_settings
from .services.gemini import GeminiClient
from .services.neo4j_client import Neo4jClient
from .services.qdrant import QdrantClient


@lru_cache(maxsize=1)
def _gemini_singleton(settings_id: int) -> GeminiClient:
    # settings_id is just a cache key — Settings is hashable but lru_cache
    # rejects unhashable args; the int id keeps it simple.
    s = get_settings()
    return GeminiClient(
        api_key=s.gemini_api_key,
        embedding_model=s.gemini_embedding_model,
        generation_model=s.gemini_generation_model,
    )


@lru_cache(maxsize=1)
def _qdrant_singleton(settings_id: int) -> QdrantClient:
    s = get_settings()
    return QdrantClient(
        base_url=s.qdrant_url,
        api_key=s.qdrant_api_key,
        personal_collection=s.qdrant_personal_collection,
        central_collection=s.qdrant_central_collection,
    )


@lru_cache(maxsize=1)
def _neo4j_singleton(settings_id: int) -> Neo4jClient:
    s = get_settings()
    return Neo4jClient(
        base_url=s.neo4j_uri,
        username=s.neo4j_username,
        password=s.neo4j_password,
        personal_database=s.neo4j_personal_database,
        central_database=s.neo4j_central_database,
    )


def get_gemini(settings: Settings = Depends(get_settings)) -> GeminiClient:
    return _gemini_singleton(id(settings))


def get_qdrant(settings: Settings = Depends(get_settings)) -> QdrantClient:
    return _qdrant_singleton(id(settings))


def get_neo4j(settings: Settings = Depends(get_settings)) -> Neo4jClient:
    return _neo4j_singleton(id(settings))


def authenticated(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
    """Sugar — composes nicely in route signatures."""
    return user
