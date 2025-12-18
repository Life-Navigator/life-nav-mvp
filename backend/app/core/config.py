"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.

Security:
- Production validation ensures no insecure defaults
- Fails fast on startup if critical settings are missing
- Sensitive values are never logged
"""

from functools import lru_cache
from typing import Literal
import sys

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationError(Exception):
    """Raised when configuration is invalid for the current environment."""
    pass


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: Literal["development", "staging", "beta", "production"] = "development"
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

    # ===========================================================================
    # Database Configuration - Three-Database Isolated Architecture
    # ===========================================================================
    # Architecture:
    #   - Supabase (Primary): All non-compliance data (auth, career, education, etc.)
    #   - CloudSQL HIPAA: Isolated health/medical data (HIPAA compliant)
    #   - CloudSQL Financial: Isolated financial data (PCI-DSS/SOX compliant)
    # ===========================================================================

    # Supabase - Primary Database (us-east-1 North Virginia)
    # Compute: Small (2-core ARM, 4GB RAM) - scale up as needed
    # Handles: Auth, Users, Career, Education, Goals, Relationships, Preferences
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None  # anon/public key
    SUPABASE_SERVICE_KEY: str | None = None  # service_role key (admin)
    SUPABASE_JWT_SECRET: str | None = None  # For verifying Supabase JWTs

    # CloudSQL HIPAA - Isolated Health Data (us-central1)
    # Handles: health_conditions, medications, diagnoses, treatments, health_records
    DATABASE_HIPAA_URL: str | None = None
    DATABASE_HIPAA_POOL_SIZE: int = 10
    DATABASE_HIPAA_MAX_OVERFLOW: int = 5

    # CloudSQL Financial - Isolated Financial Data (us-central1)
    # Handles: financial_accounts, transactions, investments, tax_documents, plaid_connections
    DATABASE_FINANCIAL_URL: str | None = None
    DATABASE_FINANCIAL_POOL_SIZE: int = 10
    DATABASE_FINANCIAL_MAX_OVERFLOW: int = 5

    # Legacy DATABASE_URL - kept for backwards compatibility during migration
    # Will be deprecated once three-database architecture is fully deployed
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/lifenavigator"

    # Shared pool settings (applied to all databases)
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

    # CORS - Use str type to avoid pydantic-settings JSON parsing issues
    CORS_ORIGINS: str = "http://localhost:3000"
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: str = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    CORS_HEADERS: str = "Content-Type,Authorization,Accept,Origin,User-Agent,X-Requested-With,X-Tenant-ID"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into list."""
        if not self.CORS_ORIGINS:
            return ["http://localhost:3000"]
        # Handle JSON array format
        if self.CORS_ORIGINS.startswith("["):
            import json
            try:
                return json.loads(self.CORS_ORIGINS)
            except json.JSONDecodeError:
                pass
        # Handle comma-separated format
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def cors_methods_list(self) -> list[str]:
        """Parse CORS_METHODS string into list."""
        if not self.CORS_METHODS:
            return ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        return [method.strip() for method in self.CORS_METHODS.split(",") if method.strip()]

    @property
    def cors_headers_list(self) -> list[str]:
        """Parse CORS_HEADERS string into list."""
        if not self.CORS_HEADERS:
            return ["Content-Type", "Authorization", "Accept", "Origin", "User-Agent", "X-Requested-With", "X-Tenant-ID"]
        return [header.strip() for header in self.CORS_HEADERS.split(",") if header.strip()]

    # Multi-tenancy
    DEFAULT_TENANT_ID: str | None = None
    ENABLE_TENANT_ISOLATION: bool = True

    # LN-Core Multi-Agent System (ln-core-prod)
    LN_CORE_URL: str | None = None  # e.g., https://ln-core-700579030748.us-central1.run.app
    LN_CORE_TIMEOUT: int = 60
    LN_CORE_MAX_RETRIES: int = 3

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
    ALLOWED_EXTENSIONS: str = "jpg,jpeg,png,pdf,doc,docx"

    @property
    def allowed_extensions_list(self) -> list[str]:
        """Parse ALLOWED_EXTENSIONS string into list."""
        if not self.ALLOWED_EXTENSIONS:
            return ["jpg", "jpeg", "png", "pdf", "doc", "docx"]
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()]

    # Plaid (Finance Integration)
    PLAID_CLIENT_ID: str | None = None
    PLAID_SECRET: str | None = None
    PLAID_ENV: Literal["sandbox", "development", "production"] = "sandbox"
    PLAID_PRODUCTS: str = "auth,transactions,investments"
    PLAID_COUNTRY_CODES: str = "US,CA"
    PLAID_WEBHOOK_SECRET: str | None = None

    @property
    def plaid_products_list(self) -> list[str]:
        """Parse PLAID_PRODUCTS string into list."""
        if not self.PLAID_PRODUCTS:
            return ["auth", "transactions", "investments"]
        return [p.strip() for p in self.PLAID_PRODUCTS.split(",") if p.strip()]

    @property
    def plaid_country_codes_list(self) -> list[str]:
        """Parse PLAID_COUNTRY_CODES string into list."""
        if not self.PLAID_COUNTRY_CODES:
            return ["US", "CA"]
        return [c.strip() for c in self.PLAID_COUNTRY_CODES.split(",") if c.strip()]

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
    def is_beta(self) -> bool:
        """Check if running in beta environment."""
        return self.ENVIRONMENT == "beta"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    @property
    def is_deployed(self) -> bool:
        """Check if running in a deployed environment (beta or production)."""
        return self.ENVIRONMENT in ("beta", "staging", "production")

    @property
    def database_url_sync(self) -> str:
        """Get synchronous legacy database URL (for Alembic migrations)."""
        url = str(self.DATABASE_URL)
        return url.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def database_hipaa_url_sync(self) -> str | None:
        """Get synchronous HIPAA database URL (for Alembic migrations)."""
        if not self.DATABASE_HIPAA_URL:
            return None
        return self.DATABASE_HIPAA_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def database_financial_url_sync(self) -> str | None:
        """Get synchronous Financial database URL (for Alembic migrations)."""
        if not self.DATABASE_FINANCIAL_URL:
            return None
        return self.DATABASE_FINANCIAL_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def has_three_database_architecture(self) -> bool:
        """Check if all three databases are configured."""
        return all([
            self.SUPABASE_URL,
            self.SUPABASE_SERVICE_KEY,
            self.DATABASE_HIPAA_URL,
            self.DATABASE_FINANCIAL_URL,
        ])

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """
        Validate that production/deployed environments have secure configuration.

        FAILS FAST: This validator will raise ConfigurationError and prevent
        the application from starting if critical security settings are insecure.
        """
        if not self.is_deployed:
            return self

        errors: list[str] = []

        # =================================================================
        # CRITICAL: These MUST be changed from defaults in production
        # =================================================================

        # Secret Key - NEVER use default in production
        if self.SECRET_KEY == "development-secret-key-change-in-production-32chars":
            errors.append(
                "SECRET_KEY: Using default development key. "
                "Set a secure random key (32+ characters) for production."
            )

        # Encryption Key - NEVER use default in production
        if self.ENCRYPTION_KEY == "0" * 64:
            errors.append(
                "ENCRYPTION_KEY: Using default null key. "
                "Generate a secure 64-character hex key for production."
            )

        # Database URL - Must not use default localhost
        if "localhost" in self.DATABASE_URL or "password" in self.DATABASE_URL:
            errors.append(
                "DATABASE_URL: Contains localhost or default credentials. "
                "Use proper cloud database URL for production."
            )

        # =================================================================
        # THREE-DATABASE ARCHITECTURE VALIDATION (Production Only)
        # =================================================================
        if self.is_production:
            # Supabase (Primary Database) - Required
            if not self.SUPABASE_URL:
                errors.append(
                    "SUPABASE_URL: Not configured. "
                    "Required for production (primary database)."
                )
            if not self.SUPABASE_SERVICE_KEY:
                errors.append(
                    "SUPABASE_SERVICE_KEY: Not configured. "
                    "Required for production (admin operations)."
                )
            if not self.SUPABASE_JWT_SECRET:
                errors.append(
                    "SUPABASE_JWT_SECRET: Not configured. "
                    "Required for production (JWT verification)."
                )

            # CloudSQL HIPAA Database - Required
            if not self.DATABASE_HIPAA_URL:
                errors.append(
                    "DATABASE_HIPAA_URL: Not configured. "
                    "Required for production (HIPAA-compliant health data)."
                )
            elif "localhost" in self.DATABASE_HIPAA_URL:
                errors.append(
                    "DATABASE_HIPAA_URL: Contains localhost. "
                    "Must use CloudSQL private IP for production."
                )

            # CloudSQL Financial Database - Required
            if not self.DATABASE_FINANCIAL_URL:
                errors.append(
                    "DATABASE_FINANCIAL_URL: Not configured. "
                    "Required for production (PCI-DSS compliant financial data)."
                )
            elif "localhost" in self.DATABASE_FINANCIAL_URL:
                errors.append(
                    "DATABASE_FINANCIAL_URL: Contains localhost. "
                    "Must use CloudSQL private IP for production."
                )

        # Redis URL - Must not use default localhost in prod
        if self.is_production and "localhost" in self.REDIS_URL:
            errors.append(
                "REDIS_URL: Contains localhost. "
                "Use proper cloud Redis URL for production."
            )

        # =================================================================
        # WARNING: These are recommended but not strictly required
        # =================================================================

        warnings: list[str] = []

        # Sentry DSN - Highly recommended for production monitoring
        if self.is_production and not self.SENTRY_DSN:
            warnings.append(
                "SENTRY_DSN: Not configured. "
                "Sentry is highly recommended for production error tracking."
            )

        # CORS Origins - Should not be wildcard in production
        if self.is_production and "*" in self.cors_origins_list:
            errors.append(
                "CORS_ORIGINS: Contains wildcard (*). "
                "Specify explicit origins for production security."
            )

        # Debug mode - Must be disabled in production
        if self.is_production and self.DEBUG:
            errors.append(
                "DEBUG: Enabled in production. "
                "Set DEBUG=false for production security."
            )

        # Email provider - Recommended for production
        if self.is_production and not self.RESEND_API_KEY:
            warnings.append(
                "RESEND_API_KEY: Not configured. "
                "Email notifications will not work."
            )

        # Log warnings (these don't prevent startup)
        if warnings:
            import logging
            logger = logging.getLogger(__name__)
            for warning in warnings:
                logger.warning(f"[CONFIG WARNING] {warning}")

        # Fail fast on critical errors
        if errors:
            error_msg = (
                f"\n{'='*60}\n"
                f"CONFIGURATION ERROR: Production environment detected\n"
                f"The following critical settings must be fixed:\n"
                f"{'='*60}\n"
                + "\n".join(f"  - {e}" for e in errors)
                + f"\n{'='*60}\n"
                f"Application startup BLOCKED for security.\n"
                f"{'='*60}"
            )
            raise ConfigurationError(error_msg)

        return self


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to ensure single instance across app.
    """
    return Settings()


# Convenience export
settings = get_settings()
