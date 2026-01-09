"""
Application configuration using Pydantic Settings
"""

from typing import List, Optional, Union
from pydantic_settings import BaseSettings
from pydantic import validator, field_validator


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
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://localhost:19006"

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Handle empty string
            if not v or v.strip() == "":
                return ["http://localhost:3000", "http://localhost:19006"]
            # Handle both comma-separated and JSON list formats
            if v.startswith("["):
                import json

                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return v
        return ["http://localhost:3000", "http://localhost:19006"]

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

    # OAuth 2.0 Configuration
    OAUTH_REDIRECT_URI: str = "http://localhost:3002/auth/callback"  # Frontend callback URL

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Facebook OAuth
    FACEBOOK_CLIENT_ID: Optional[str] = None
    FACEBOOK_CLIENT_SECRET: Optional[str] = None

    # LinkedIn OAuth
    LINKEDIN_CLIENT_ID: Optional[str] = None
    LINKEDIN_CLIENT_SECRET: Optional[str] = None
    LINKEDIN_API_KEY: Optional[str] = None

    # Indeed
    INDEED_API_KEY: Optional[str] = None
    INDEED_PUBLISHER_ID: Optional[str] = None

    # Upwork
    UPWORK_API_KEY: Optional[str] = None
    UPWORK_API_SECRET: Optional[str] = None

    # Fiverr
    FIVERR_API_KEY: Optional[str] = None

    # Freelancer
    FREELANCER_API_KEY: Optional[str] = None

    # Twitter
    TWITTER_API_KEY: Optional[str] = None
    TWITTER_API_SECRET: Optional[str] = None
    TWITTER_BEARER_TOKEN: Optional[str] = None

    # Instagram
    INSTAGRAM_CLIENT_ID: Optional[str] = None
    INSTAGRAM_CLIENT_SECRET: Optional[str] = None

    # TikTok
    TIKTOK_CLIENT_KEY: Optional[str] = None
    TIKTOK_CLIENT_SECRET: Optional[str] = None

    # Eventbrite
    EVENTBRITE_API_KEY: Optional[str] = None

    # Meetup
    MEETUP_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


# Global settings instance
settings = Settings()
