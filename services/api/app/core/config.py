"""
Application configuration using Pydantic Settings
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings"""

    # App Info
    APP_NAME: str = "Life Navigator API"
    APP_VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False

    # Neo4j
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    NEO4J_DATABASE: str = "neo4j"

    # GraphDB
    GRAPHDB_URL: str
    GRAPHDB_REPOSITORY: str = "lifenavigator"

    # Redis
    REDIS_URL: str
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:19006"]

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Handle both comma-separated and JSON list formats
            if v.startswith("["):
                import json

                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # AI Services
    ANTHROPIC_API_KEY: Optional[str] = None
    VERTEX_AI_PROJECT: Optional[str] = None
    VERTEX_AI_LOCATION: str = "us-central1"

    # GCP
    GCP_PROJECT_ID: Optional[str] = None
    GCP_REGION: str = "us-central1"

    # Multi-tenancy
    TENANT_ISOLATION_ENABLED: bool = True

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


# Global settings instance
settings = Settings()
