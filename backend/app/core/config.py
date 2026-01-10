"""
Production-Safe Configuration Loader.

This module provides a strict configuration system for production deployments:
- NO .env files in production runtime
- GCP Secret Manager integration (optional)
- Fail-fast validation
- Never logs secrets

Usage:
    from app.core.config_production import get_settings
    settings = get_settings()
"""

import os
import sys
from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(Exception):
    """Raised when configuration is invalid for the current environment."""

    pass


class GCPSecretManagerAdapter:
    """
    Adapter for fetching secrets from GCP Secret Manager.

    Only used in GCP runtime (Cloud Run, GKE).
    Local development does NOT fetch from GCP.
    """

    def __init__(self):
        self.client = None
        self.project_id = os.getenv("GCP_PROJECT_ID")

    def get_secret(self, secret_name: str, version: str = "latest") -> Optional[str]:
        """
        Fetch secret from GCP Secret Manager.

        Args:
            secret_name: Name of the secret
            version: Version ID (default: "latest")

        Returns:
            Secret value or None if not found
        """
        if not self.project_id:
            return None

        try:
            if self.client is None:
                from google.cloud import secretmanager

                self.client = secretmanager.SecretManagerServiceClient()

            name = f"projects/{self.project_id}/secrets/{secret_name}/versions/{version}"
            response = self.client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            # Don't fail startup if secret is optional
            import structlog

            logger = structlog.get_logger()
            logger.warning(
                "gcp_secret_fetch_failed",
                secret=secret_name,
                error=str(e),
            )
            return None


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Production behavior:
    - NEVER reads .env files
    - Fetches from environment variables (set by Cloud Run, Vercel, etc.)
    - Optionally fetches from GCP Secret Manager if USE_GCP_SECRET_MANAGER=true
    - Fails fast if critical secrets are missing or insecure
    """

    model_config = SettingsConfigDict(
        # CRITICAL: Do NOT load .env in production
        env_file=".env.local" if os.getenv("ENVIRONMENT", "development") == "development" else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="forbid",  # Reject unknown environment variables
    )

    # Environment
    ENVIRONMENT: Literal["development", "staging", "beta", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # GCP Secret Manager (optional)
    USE_GCP_SECRET_MANAGER: bool = Field(
        default=False,
        description="Fetch secrets from GCP Secret Manager instead of environment variables",
    )
    GCP_PROJECT_ID: Optional[str] = None

    # API Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_WORKERS: int = 4
    API_RELOAD: bool = False
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Life Navigator"
    VERSION: str = "0.1.0"

    # ===========================================================================
    # Database Configuration - Three-Database Isolated Architecture
    # ===========================================================================

    # Supabase - Primary Database
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # CloudSQL HIPAA - Isolated Health Data
    DATABASE_HIPAA_URL: Optional[str] = None
    DATABASE_HIPAA_POOL_SIZE: int = 10
    DATABASE_HIPAA_MAX_OVERFLOW: int = 5

    # CloudSQL Financial - Isolated Financial Data
    DATABASE_FINANCIAL_URL: Optional[str] = None
    DATABASE_FINANCIAL_POOL_SIZE: int = 10
    DATABASE_FINANCIAL_MAX_OVERFLOW: int = 5

    # Legacy DATABASE_URL (migration compatibility)
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/lifenavigator"

    # Shared pool settings
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_ECHO: bool = False

    # Redis Cache
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # Security (CRITICAL)
    SECRET_KEY: str = Field(
        default="INSECURE-CHANGE-IN-PRODUCTION",
        min_length=32,
        description="JWT signing key (64-char hex recommended)",
    )
    ENCRYPTION_KEY: str = Field(
        default="0" * 64,
        min_length=64,
        max_length=64,
        description="Field-level encryption key (64-char hex)",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: str = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    CORS_HEADERS: str = "Content-Type,Authorization,Accept,Origin,User-Agent,X-Requested-With,X-Tenant-ID"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into list."""
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000"]
        if self.CORS_ORIGINS.startswith("["):
            import json

            try:
                return json.loads(self.CORS_ORIGINS)
            except json.JSONDecodeError:
                pass
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def cors_methods_list(self) -> list[str]:
        return [m.strip() for m in self.CORS_METHODS.split(",") if m.strip()]

    @property
    def cors_headers_list(self) -> list[str]:
        return [h.strip() for h in self.CORS_HEADERS.split(",") if h.strip()]

    # Multi-tenancy
    DEFAULT_TENANT_ID: Optional[str] = None
    ENABLE_TENANT_ISOLATION: bool = True

    # External Services
    LN_CORE_URL: Optional[str] = None
    LN_CORE_TIMEOUT: int = 60
    LN_CORE_MAX_RETRIES: int = 3

    GRAPHRAG_URL: str = "localhost:50051"
    GRAPHRAG_TIMEOUT: int = 30
    GRAPHRAG_MAX_RETRIES: int = 3

    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: Optional[str] = None
    NEO4J_DATABASE: str = "neo4j"

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "life_navigator"

    GRAPHDB_URL: str = "http://localhost:7200"
    GRAPHDB_REPOSITORY: str = "life-navigator"
    GRAPHDB_USERNAME: str = "admin"
    GRAPHDB_PASSWORD: Optional[str] = None

    # Email & SMS
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "Life Navigator <noreply@lifenavigator.ai>"
    FRONTEND_URL: str = "http://localhost:3000"

    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None

    # Storage
    STORAGE_PROVIDER: Literal["local", "gcs", "s3"] = "local"
    GCS_BUCKET_NAME: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    ALLOWED_EXTENSIONS: str = "jpg,jpeg,png,pdf,doc,docx"

    @property
    def allowed_extensions_list(self) -> list[str]:
        return [e.strip() for e in self.ALLOWED_EXTENSIONS.split(",") if e.strip()]

    # Plaid
    PLAID_CLIENT_ID: Optional[str] = None
    PLAID_SECRET: Optional[str] = None
    PLAID_ENV: Literal["sandbox", "development", "production"] = "sandbox"
    PLAID_PRODUCTS: str = "auth,transactions,investments"
    PLAID_COUNTRY_CODES: str = "US,CA"
    PLAID_WEBHOOK_SECRET: Optional[str] = None

    @property
    def plaid_products_list(self) -> list[str]:
        return [p.strip() for p in self.PLAID_PRODUCTS.split(",") if p.strip()]

    @property
    def plaid_country_codes_list(self) -> list[str]:
        return [c.strip() for c in self.PLAID_COUNTRY_CODES.split(",") if c.strip()]

    # Stripe
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID_BASIC: Optional[str] = None
    STRIPE_PRICE_ID_PRO: Optional[str] = None
    STRIPE_PRICE_ID_ENTERPRISE: Optional[str] = None

    # OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    APPLE_CLIENT_ID: Optional[str] = None
    APPLE_CLIENT_SECRET: Optional[str] = None

    # Embeddings Provider (NO OPENAI in production)
    EMBEDDINGS_PROVIDER: Literal["graphrag", "null"] = "graphrag"

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0

    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "life-navigator-backend"
    OTEL_TRACES_ENABLED: bool = True
    OTEL_METRICS_ENABLED: bool = True

    # Celery
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
    ENABLE_ENCRYPTION_AT_REST: bool = True
    REQUIRE_MFA_FOR_HEALTH_DATA: bool = True
    ENCRYPTION_ENABLED: bool = True

    # Computed properties
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_beta(self) -> bool:
        return self.ENVIRONMENT == "beta"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_deployed(self) -> bool:
        return self.ENVIRONMENT in ("beta", "staging", "production")

    @property
    def database_url_sync(self) -> str:
        return str(self.DATABASE_URL).replace("postgresql+asyncpg://", "postgresql://")

    @property
    def database_hipaa_url_sync(self) -> Optional[str]:
        if not self.DATABASE_HIPAA_URL:
            return None
        return self.DATABASE_HIPAA_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def database_financial_url_sync(self) -> Optional[str]:
        if not self.DATABASE_FINANCIAL_URL:
            return None
        return self.DATABASE_FINANCIAL_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def has_three_database_architecture(self) -> bool:
        return all(
            [
                self.SUPABASE_URL,
                self.SUPABASE_SERVICE_KEY,
                self.DATABASE_HIPAA_URL,
                self.DATABASE_FINANCIAL_URL,
            ]
        )

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """
        Validate production/deployed environments have secure configuration.

        FAILS FAST: Prevents application startup if critical settings are insecure.
        """
        if not self.is_deployed:
            return self

        errors: list[str] = []

        # =================================================================
        # CRITICAL: Must be changed from defaults
        # =================================================================

        # Secret Key
        if self.SECRET_KEY == "INSECURE-CHANGE-IN-PRODUCTION" or len(self.SECRET_KEY) < 32:
            errors.append(
                "SECRET_KEY: Using default or too short. "
                "Generate with: openssl rand -hex 32"
            )

        # Encryption Key
        if self.ENCRYPTION_KEY == "0" * 64:
            errors.append("ENCRYPTION_KEY: Using default. Generate with: openssl rand -hex 32")

        # Database URL
        if "localhost" in self.DATABASE_URL or "password" in self.DATABASE_URL:
            errors.append("DATABASE_URL: Contains localhost or default credentials.")

        # Production-only validations
        if self.is_production:
            # Supabase
            if not self.SUPABASE_URL:
                errors.append("SUPABASE_URL: Required for production.")
            if not self.SUPABASE_SERVICE_KEY:
                errors.append("SUPABASE_SERVICE_KEY: Required for production.")
            if not self.SUPABASE_JWT_SECRET:
                errors.append("SUPABASE_JWT_SECRET: Required for production.")

            # CloudSQL HIPAA
            if not self.DATABASE_HIPAA_URL:
                errors.append("DATABASE_HIPAA_URL: Required for production.")
            elif "localhost" in self.DATABASE_HIPAA_URL:
                errors.append("DATABASE_HIPAA_URL: Must use CloudSQL private IP.")

            # CloudSQL Financial
            if not self.DATABASE_FINANCIAL_URL:
                errors.append("DATABASE_FINANCIAL_URL: Required for production.")
            elif "localhost" in self.DATABASE_FINANCIAL_URL:
                errors.append("DATABASE_FINANCIAL_URL: Must use CloudSQL private IP.")

            # Redis
            if "localhost" in self.REDIS_URL:
                errors.append("REDIS_URL: Must use cloud Redis in production.")

            # CORS
            if "*" in self.cors_origins_list:
                errors.append("CORS_ORIGINS: Wildcard (*) not allowed in production.")

            # Debug mode
            if self.DEBUG:
                errors.append("DEBUG: Must be false in production.")

        # Fail fast
        if errors:
            error_msg = (
                f"\n{'='*70}\n"
                f"CONFIGURATION ERROR: {self.ENVIRONMENT} environment detected\n"
                f"{'='*70}\n"
                + "\n".join(f"  ❌ {e}" for e in errors)
                + f"\n{'='*70}\n"
                f"Application startup BLOCKED for security.\n"
                f"{'='*70}\n"
            )
            raise ConfigurationError(error_msg)

        return self

    @model_validator(mode="after")
    def fetch_gcp_secrets(self) -> "Settings":
        """
        Optionally fetch secrets from GCP Secret Manager.

        Only runs if USE_GCP_SECRET_MANAGER=true.
        Local development should NOT use this.
        """
        if not self.USE_GCP_SECRET_MANAGER or self.is_development:
            return self

        adapter = GCPSecretManagerAdapter()

        # Fetch critical secrets from GCP SM if not already set
        secret_mappings = {
            "SECRET_KEY": "SECRET_KEY",
            "ENCRYPTION_KEY": "ENCRYPTION_KEY",
            "DATABASE_HIPAA_URL": "DATABASE_HIPAA_URL",
            "DATABASE_FINANCIAL_URL": "DATABASE_FINANCIAL_URL",
            "SUPABASE_SERVICE_KEY": "SUPABASE_SERVICE_KEY",
            "SUPABASE_JWT_SECRET": "SUPABASE_JWT_SECRET",
            "PLAID_SECRET": "PLAID_SECRET",
            "STRIPE_API_KEY": "STRIPE_API_KEY",
        }

        for attr_name, secret_name in secret_mappings.items():
            current_value = getattr(self, attr_name, None)
            # Only fetch if not already set via environment variable
            if not current_value or current_value in ["INSECURE-CHANGE-IN-PRODUCTION", "0" * 64]:
                secret_value = adapter.get_secret(secret_name)
                if secret_value:
                    setattr(self, attr_name, secret_value)

        return self


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Validates configuration and fails fast on startup if invalid.
    """
    return Settings()


# Convenience export
settings = get_settings()
