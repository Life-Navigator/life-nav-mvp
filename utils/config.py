"""Configuration management for Life Navigator Agents.

This module provides type-safe configuration management using Pydantic Settings.
All configuration is loaded from environment variables with validation at startup.

Example usage:
    >>> from utils.config import Config
    >>> config = Config.get()
    >>> print(config.llm.instance_1)
    http://localhost:8000
"""

from functools import lru_cache
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMConfig(BaseSettings):
    """Configuration for vLLM instances.

    Attributes:
        instance_1: URL of first vLLM instance (load balancing).
        instance_2: URL of second vLLM instance (load balancing).
        model_name: Name of the LLM model to use.
        timeout: Request timeout in seconds.
        max_tokens: Maximum tokens per generation.
        temperature: Sampling temperature (0.0-2.0).
    """

    instance_1: str = Field(
        default="http://localhost:8000", description="First vLLM instance URL"
    )
    instance_2: str = Field(
        default="http://localhost:8001", description="Second vLLM instance URL"
    )
    model_name: str = Field(
        default="meta-llama/Llama-3.1-70B-Instruct", description="LLM model name"
    )
    timeout: int = Field(
        default=30, ge=1, le=300, description="Request timeout in seconds"
    )
    max_tokens: int = Field(
        default=4096, ge=1, le=32768, description="Maximum tokens per generation"
    )
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Sampling temperature"
    )

    model_config = SettingsConfigDict(env_prefix="VLLM_", case_sensitive=False)

    @field_validator("instance_1", "instance_2")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate URL format."""
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"URL must start with http:// or https://, got: {v}")
        return v


class PostgresConfig(BaseSettings):
    """Configuration for PostgreSQL database.

    Attributes:
        host: Database hostname.
        port: Database port.
        database: Database name.
        user: Database user.
        password: Database password.
        pool_size: Connection pool size.
        ssl_mode: SSL mode (disable, allow, prefer, require, verify-ca, verify-full).
    """

    host: str = Field(default="localhost", description="PostgreSQL hostname")
    port: int = Field(default=5432, ge=1, le=65535, description="PostgreSQL port")
    database: str = Field(default="life_navigator_agents", description="Database name")
    user: str = Field(default="lna_user", description="Database user")
    password: str = Field(
        default="change-this-password", description="Database password"
    )
    pool_size: int = Field(default=10, ge=1, le=100, description="Connection pool size")
    ssl_mode: Literal[
        "disable", "allow", "prefer", "require", "verify-ca", "verify-full"
    ] = Field(default="prefer", description="SSL mode")

    model_config = SettingsConfigDict(env_prefix="POSTGRES_", case_sensitive=False)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str, info: Any) -> str:
        """Validate password strength in production."""
        # Get environment from context if available
        if len(v) < 12:
            # In production, enforce strong passwords
            # For dev, just warn
            import warnings

            warnings.warn(
                "Postgres password should be at least 12 characters for production",
                UserWarning,
            )
        return v

    @property
    def dsn(self) -> str:
        """Get PostgreSQL DSN connection string."""
        return (
            f"postgresql://{self.user}:{self.password}@"
            f"{self.host}:{self.port}/{self.database}"
        )


class NeptuneConfig(BaseSettings):
    """Configuration for AWS Neptune graph database.

    Attributes:
        cluster_endpoint: Neptune cluster endpoint.
        port: Neptune port.
        use_iam_auth: Use IAM authentication.
        region: AWS region.
    """

    cluster_endpoint: str = Field(
        default="neptune-cluster.us-west-2.neptune.amazonaws.com",
        description="Neptune cluster endpoint",
    )
    port: int = Field(default=8182, ge=1, le=65535, description="Neptune port")
    use_iam_auth: bool = Field(default=False, description="Use IAM authentication")
    region: str = Field(default="us-west-2", description="AWS region")

    model_config = SettingsConfigDict(env_prefix="NEPTUNE_", case_sensitive=False)

    @property
    def endpoint_url(self) -> str:
        """Get Neptune WebSocket endpoint URL."""
        return f"wss://{self.cluster_endpoint}:{self.port}/gremlin"


class RedisConfig(BaseSettings):
    """Configuration for Redis.

    Attributes:
        host: Redis hostname.
        port: Redis port.
        password: Redis password (optional).
        db: Redis database number.
        ssl: Use SSL/TLS.
        pool_size: Connection pool size.
    """

    host: str = Field(default="localhost", description="Redis hostname")
    port: int = Field(default=6379, ge=1, le=65535, description="Redis port")
    password: str | None = Field(default=None, description="Redis password")
    db: int = Field(default=0, ge=0, le=15, description="Redis database number")
    ssl: bool = Field(default=False, description="Use SSL/TLS")
    pool_size: int = Field(default=10, ge=1, le=100, description="Connection pool size")

    model_config = SettingsConfigDict(env_prefix="REDIS_", case_sensitive=False)


class RabbitMQConfig(BaseSettings):
    """Configuration for RabbitMQ message broker.

    Attributes:
        host: RabbitMQ hostname.
        port: RabbitMQ port.
        user: RabbitMQ user.
        password: RabbitMQ password.
        vhost: RabbitMQ virtual host.
        prefetch_count: Consumer prefetch count.
    """

    host: str = Field(default="localhost", description="RabbitMQ hostname")
    port: int = Field(default=5672, ge=1, le=65535, description="RabbitMQ port")
    user: str = Field(default="lna_user", description="RabbitMQ user")
    password: str = Field(
        default="change-this-password", description="RabbitMQ password"
    )
    vhost: str = Field(default="/", description="RabbitMQ virtual host")
    prefetch_count: int = Field(
        default=10, ge=1, le=1000, description="Consumer prefetch count"
    )

    model_config = SettingsConfigDict(env_prefix="RABBITMQ_", case_sensitive=False)

    @property
    def url(self) -> str:
        """Get RabbitMQ AMQP URL."""
        return f"amqp://{self.user}:{self.password}@{self.host}:{self.port}{self.vhost}"


class QdrantConfig(BaseSettings):
    """Configuration for Qdrant vector database.

    Attributes:
        url: Qdrant server URL.
        api_key: Qdrant API key (optional).
        collection_name: Default collection name.
        vector_size: Vector dimension size.
    """

    url: str = Field(default="http://localhost:6333", description="Qdrant server URL")
    api_key: str | None = Field(default=None, description="Qdrant API key")
    collection_name: str = Field(
        default="life_navigator", description="Default collection name"
    )
    vector_size: int = Field(
        default=384,
        ge=1,
        le=4096,
        description="Vector dimension size (sentence-transformers: 384)",
    )

    model_config = SettingsConfigDict(env_prefix="QDRANT_", case_sensitive=False)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Validate URL format."""
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"URL must start with http:// or https://, got: {v}")
        return v


class JWTConfig(BaseSettings):
    """Configuration for JWT authentication.

    Attributes:
        secret_key: JWT signing secret.
        algorithm: JWT signing algorithm.
        expiration_minutes: Token expiration time in minutes.
    """

    secret_key: str = Field(
        default="change-this-to-a-secure-random-secret-key-at-least-32-chars",
        description="JWT signing secret",
    )
    algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    expiration_minutes: int = Field(
        default=60,
        ge=1,
        le=43200,  # 30 days max
        description="Token expiration in minutes",
    )

    model_config = SettingsConfigDict(env_prefix="JWT_", case_sensitive=False)

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key strength."""
        if len(v) < 32:
            raise ValueError("JWT secret key must be at least 32 characters")
        return v


class AppConfig(BaseSettings):
    """General application configuration.

    Attributes:
        environment: Deployment environment.
        debug: Enable debug mode.
        log_level: Logging level.
        api_host: API server host.
        api_port: API server port.
    """

    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Deployment environment"
    )
    debug: bool = Field(default=True, description="Enable debug mode")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", description="Logging level"
    )
    api_host: str = Field(default="0.0.0.0", description="API server host")
    api_port: int = Field(default=8080, ge=1, le=65535, description="API server port")

    model_config = SettingsConfigDict(env_prefix="APP_", case_sensitive=False)


class Config(BaseSettings):
    """Main configuration class combining all config sections.

    This class provides a singleton interface to access all configuration.

    Example:
        >>> config = Config.get()
        >>> print(config.llm.instance_1)
        >>> print(config.postgres.dsn)
    """

    llm: LLMConfig = Field(default_factory=LLMConfig)
    postgres: PostgresConfig = Field(default_factory=PostgresConfig)
    neptune: NeptuneConfig = Field(default_factory=NeptuneConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    rabbitmq: RabbitMQConfig = Field(default_factory=RabbitMQConfig)
    qdrant: QdrantConfig = Field(default_factory=QdrantConfig)
    jwt: JWTConfig = Field(default_factory=JWTConfig)
    app: AppConfig = Field(default_factory=AppConfig)

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    @classmethod
    @lru_cache(maxsize=1)
    def get(cls) -> "Config":
        """Get singleton Config instance.

        Returns:
            Config: Singleton configuration instance.
        """
        return cls()

    def __repr__(self) -> str:
        """Return string representation with masked secrets."""

        def mask_secret(value: str) -> str:
            """Mask secret showing only first 4 characters."""
            if len(value) <= 4:
                return "****"
            return f"{value[:4]}{'*' * (len(value) - 4)}"

        sections = []
        sections.append(f"environment={self.app.environment}")
        sections.append(f"debug={self.app.debug}")
        sections.append(f"postgres_host={self.postgres.host}")
        sections.append(f"postgres_password={mask_secret(self.postgres.password)}")
        sections.append(f"redis_host={self.redis.host}")
        sections.append(f"rabbitmq_host={self.rabbitmq.host}")
        sections.append(f"jwt_secret={mask_secret(self.jwt.secret_key)}")

        return f"Config({', '.join(sections)})"

    async def validate_all(self) -> dict[str, bool]:
        """Validate all service connections.

        This is a future-proof method for validating connections at startup.
        Currently returns mock results.

        Returns:
            dict: Service name to connection status mapping.
        """
        # TODO: Implement actual connection tests
        # This is a placeholder for Phase 2 when we have actual clients
        return {
            "postgres": True,
            "redis": True,
            "rabbitmq": True,
            "qdrant": True,
            "vllm_1": True,
            "vllm_2": True,
        }
