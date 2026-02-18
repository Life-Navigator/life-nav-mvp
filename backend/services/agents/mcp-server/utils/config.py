"""Configuration Management"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Server
    app_name: str = "Life Navigator MCP Server"
    app_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8080
    workers: int = 4
    reload: bool = False
    log_level: str = "INFO"

    # Database - PostgreSQL
    database_url: str = "postgresql://localhost:5432/lifenavigator"
    database_pool_size: int = 20
    database_max_overflow: int = 10
    database_pool_timeout: int = 30

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_pool_size: int = 10
    redis_socket_timeout: int = 5

    # Neo4j
    neo4j_uri: str = "neo4j://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"
    neo4j_database: str = "neo4j"
    neo4j_max_connection_lifetime: int = 3600
    neo4j_max_connection_pool_size: int = 50

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: Optional[str] = None
    qdrant_collection: str = "life_navigator_embeddings"
    qdrant_timeout: int = 30

    # Maverick LLM
    maverick_url: str = "http://localhost:8090"
    maverick_timeout: int = 300
    maverick_max_retries: int = 3

    # Authentication
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60

    # Internal Service Authentication
    # API key for backend-to-agent service communication
    # This prevents public access to the agent service
    internal_api_key: Optional[str] = None

    # Plugins
    enable_graphrag_plugin: bool = True
    enable_memory_plugin: bool = True
    enable_websearch_plugin: bool = False
    enable_files_plugin: bool = True
    enable_ocr_plugin: bool = True

    # External APIs
    serper_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None

    # Performance
    context_max_tokens: int = 4000
    enable_caching: bool = True
    cache_ttl: int = 3600

    # Monitoring
    enable_metrics: bool = True
    enable_tracing: bool = False
    sentry_dsn: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
