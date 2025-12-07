"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # API Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_WORKERS: int = 4
    API_RELOAD: bool = False
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Life Navigator"
    VERSION: str = "0.1.0"

    # Database (PostgreSQL)
    DATABASE_URL: str  # Accept any string, validation at runtime
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_ECHO: bool = False

    # Redis Cache
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # Security
    SECRET_KEY: str = Field(default="development-secret-key-change-in-production-32chars")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: list[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    )
    CORS_HEADERS: list[str] = Field(
        default_factory=lambda: [
            "Content-Type",
            "Authorization",
            "Accept",
            "Origin",
            "User-Agent",
            "X-Requested-With",
            "X-Tenant-ID",
        ]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # Multi-tenancy
    DEFAULT_TENANT_ID: str | None = None
    ENABLE_TENANT_ISOLATION: bool = True

    # GraphRAG Service (Rust gRPC)
    GRAPHRAG_URL: str = "localhost:50051"
    GRAPHRAG_TIMEOUT: int = 30
    GRAPHRAG_MAX_RETRIES: int = 3

    # Neo4j Knowledge Graph
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str | None = None  # Optional for beta without graph features
    NEO4J_DATABASE: str = "neo4j"

    # Qdrant Vector Database
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION: str = "life_navigator"

    # GraphDB Semantic Store
    GRAPHDB_URL: str = "http://localhost:7200"
    GRAPHDB_REPOSITORY: str = "life-navigator"
    GRAPHDB_USERNAME: str = "admin"
    GRAPHDB_PASSWORD: str | None = None

    # Email (Resend - Modern transactional email API)
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "Life Navigator <noreply@lifenavigator.ai>"
    FRONTEND_URL: str = "http://localhost:3000"  # For email verification links

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM_NUMBER: str | None = None

    # Storage
    STORAGE_PROVIDER: Literal["local", "gcs", "s3"] = "local"
    GCS_BUCKET_NAME: str | None = None
    GCS_PROJECT_ID: str | None = None
    S3_BUCKET_NAME: str | None = None
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    ALLOWED_EXTENSIONS: list[str] = Field(
        default_factory=lambda: ["jpg", "jpeg", "png", "pdf", "doc", "docx"]
    )

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",")]
        return v

    # Plaid (Finance Integration)
    PLAID_CLIENT_ID: str | None = None
    PLAID_SECRET: str | None = None
    PLAID_ENV: Literal["sandbox", "development", "production"] = "sandbox"
    PLAID_PRODUCTS: list[str] = Field(
        default_factory=lambda: ["auth", "transactions", "investments"]
    )
    PLAID_COUNTRY_CODES: list[str] = Field(default_factory=lambda: ["US", "CA"])

    @field_validator("PLAID_PRODUCTS", "PLAID_COUNTRY_CODES", mode="before")
    @classmethod
    def parse_plaid_lists(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",")]
        return v

    # Stripe (Payments)
    STRIPE_API_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_PRICE_ID_BASIC: str | None = None
    STRIPE_PRICE_ID_PRO: str | None = None
    STRIPE_PRICE_ID_ENTERPRISE: str | None = None

    # OAuth Providers
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    MICROSOFT_CLIENT_ID: str | None = None
    MICROSOFT_CLIENT_SECRET: str | None = None
    APPLE_CLIENT_ID: str | None = None
    APPLE_CLIENT_SECRET: str | None = None

    # OpenAI (for embeddings and LLM)
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Monitoring (Sentry)
    SENTRY_DSN: str | None = None
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0

    # OpenTelemetry
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "life-navigator-backend"
    OTEL_TRACES_ENABLED: bool = True
    OTEL_METRICS_ENABLED: bool = True

    # Celery (Background Tasks)
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_ALWAYS_EAGER: bool = False

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # Feature Flags
    ENABLE_PLAID_SYNC: bool = True
    ENABLE_VECTOR_SEARCH: bool = True
    ENABLE_GRAPH_QUERIES: bool = True
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    ENABLE_SMS_NOTIFICATIONS: bool = False

    # HIPAA Compliance
    ENABLE_AUDIT_LOGGING: bool = True
    DATA_RETENTION_DAYS: int = 2555  # 7 years

    # Field-Level Encryption (AES-256-GCM with envelope encryption)
    ENCRYPTION_KEY: str = Field(
        default="0" * 64, min_length=64, max_length=64
    )  # 64-char hex (32 bytes)
    ENCRYPTION_ENABLED: bool = True
    ENABLE_ENCRYPTION_AT_REST: bool = True
    REQUIRE_MFA_FOR_HEALTH_DATA: bool = True

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic migrations)."""
        url = str(self.DATABASE_URL)
        return url.replace("postgresql+asyncpg://", "postgresql://")


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to ensure single instance across app.
    """
    return Settings()


# Convenience export
settings = get_settings()
