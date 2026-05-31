"""Runtime configuration sourced from environment variables.

Settings are read once at process start. Tests construct Settings
directly with overrides so they don't need to manipulate the
environment.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""

    # Gemini
    gemini_api_key: str = ""
    gemini_embedding_model: str = "text-embedding-004"
    gemini_generation_model: str = "gemini-2.0-flash"

    # Qdrant
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_personal_collection: str = "life_navigator"
    qdrant_central_collection: str = "ln_central"

    # Neo4j
    neo4j_uri: str = ""
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""
    neo4j_personal_database: str = "neo4j"
    neo4j_central_database: str = "central"

    # Service config
    port: int = 8080
    log_level: str = "info"
    allowed_origins: str = "*"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
