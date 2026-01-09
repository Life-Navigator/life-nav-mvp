"""
Configuration management for market-data service.

Uses Pydantic Settings for environment variable validation.
"""

from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Service metadata
    SERVICE_NAME: str = "market-data"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")

    # Server
    PORT: int = 8002
    HOST: str = "0.0.0.0"
    WORKERS: int = 2
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # Security - JWT validation
    JWT_SECRET: str = Field(..., min_length=32, description="JWT secret for S2S auth")
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: str = "market-data"
    JWT_ISSUER: str = "life-navigator-backend"

    # Data sources
    FRED_API_KEY: Optional[str] = Field(
        default=None, description="FRED API key (optional, rate-limited without)"
    )
    YAHOO_TIMEOUT_SECONDS: int = 30
    FRED_TIMEOUT_SECONDS: int = 30

    # Storage - GCS
    GCS_BUCKET_NAME: str = Field(..., description="GCS bucket for market snapshots")
    GCS_PROJECT_ID: str = Field(..., description="GCP project ID")
    GCS_SNAPSHOT_PREFIX: str = "snapshots/"

    # Storage - Cloud SQL (optional)
    ENABLE_SQL_STORAGE: bool = False
    CLOUD_SQL_CONNECTION_NAME: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = "lifenavigator"

    # Redis (for caching and rate limiting)
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    REDIS_TIMEOUT_SECONDS: int = 5

    # Snapshot build configuration
    SNAPSHOT_BUILD_TIMEOUT_SECONDS: int = 300  # 5 minutes max
    SNAPSHOT_ROLLING_WINDOW_DAYS: int = 20  # For vol calculations
    SNAPSHOT_MAX_STALENESS_SECONDS: int = 86400 * 2  # 2 days

    # HTTP client
    HTTP_MAX_RETRIES: int = 3
    HTTP_RETRY_BACKOFF_FACTOR: float = 2.0
    HTTP_TIMEOUT_SECONDS: int = 30

    # Observability
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090

    # Feature flags
    ENABLE_ECB_COLLECTOR: bool = False
    ENABLE_ALPHAVANTAGE_COLLECTOR: bool = False
    ENABLE_SCHEDULER: bool = False  # Set true for standalone mode with internal cron

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Ensure JWT secret is strong"""
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v


# Global settings instance
settings = Settings()
