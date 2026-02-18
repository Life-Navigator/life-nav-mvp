"""Unit tests for configuration management.

Tests cover:
- Config loading from environment variables
- Validation rules (URLs, ports, passwords, etc.)
- Secret masking in repr
- Singleton pattern
- Environment-specific defaults
- DSN/URL generation
"""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from utils.config import (
    AppConfig,
    Config,
    JWTConfig,
    LLMConfig,
    NeptuneConfig,
    PostgresConfig,
    QdrantConfig,
    RabbitMQConfig,
    RedisConfig,
)


class TestLLMConfig:
    """Tests for LLMConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = LLMConfig()
        assert config.instance_1 == "http://localhost:8000"
        assert config.instance_2 == "http://localhost:8001"
        assert config.model_name == "meta-llama/Llama-3.1-70B-Instruct"
        assert config.timeout == 30
        assert config.max_tokens == 4096
        assert config.temperature == 0.7

    def test_env_prefix(self):
        """Test environment variable prefix."""
        with patch.dict(
            os.environ,
            {"VLLM_INSTANCE_1": "http://gpu1.example.com:8000", "VLLM_TIMEOUT": "60"},
        ):
            config = LLMConfig()
            assert config.instance_1 == "http://gpu1.example.com:8000"
            assert config.timeout == 60

    def test_url_validation_success(self):
        """Test valid URLs are accepted."""
        config = LLMConfig(
            instance_1="https://api.example.com", instance_2="http://localhost:9000"
        )
        assert config.instance_1 == "https://api.example.com"
        assert config.instance_2 == "http://localhost:9000"

    def test_url_validation_failure(self):
        """Test invalid URLs are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LLMConfig(instance_1="not-a-url")

        assert "URL must start with http:// or https://" in str(exc_info.value)

    def test_temperature_range_validation(self):
        """Test temperature must be in valid range."""
        # Valid temperatures
        LLMConfig(temperature=0.0)
        LLMConfig(temperature=1.0)
        LLMConfig(temperature=2.0)

        # Invalid temperatures
        with pytest.raises(ValidationError):
            LLMConfig(temperature=-0.1)

        with pytest.raises(ValidationError):
            LLMConfig(temperature=2.1)

    def test_timeout_range_validation(self):
        """Test timeout must be in valid range."""
        # Valid timeouts
        LLMConfig(timeout=1)
        LLMConfig(timeout=300)

        # Invalid timeouts
        with pytest.raises(ValidationError):
            LLMConfig(timeout=0)

        with pytest.raises(ValidationError):
            LLMConfig(timeout=301)


class TestPostgresConfig:
    """Tests for PostgresConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = PostgresConfig()
        assert config.host == "localhost"
        assert config.port == 5432
        assert config.database == "life_navigator_agents"
        assert config.user == "lna_user"
        assert config.pool_size == 10
        assert config.ssl_mode == "prefer"

    def test_env_prefix(self):
        """Test environment variable prefix."""
        with patch.dict(
            os.environ,
            {
                "POSTGRES_HOST": "db.example.com",
                "POSTGRES_PORT": "5433",
                "POSTGRES_DATABASE": "test_db",
            },
        ):
            config = PostgresConfig()
            assert config.host == "db.example.com"
            assert config.port == 5433
            assert config.database == "test_db"

    def test_dsn_generation(self):
        """Test DSN connection string generation."""
        config = PostgresConfig(
            host="db.example.com",
            port=5432,
            database="testdb",
            user="testuser",
            password="testpass",
        )
        expected_dsn = "postgresql://testuser:testpass@db.example.com:5432/testdb"
        assert config.dsn == expected_dsn

    def test_password_strength_warning(self):
        """Test weak password triggers warning."""
        with pytest.warns(UserWarning, match="at least 12 characters"):
            PostgresConfig(password="short")

    def test_port_range_validation(self):
        """Test port must be in valid range."""
        # Valid ports
        PostgresConfig(port=1)
        PostgresConfig(port=5432)
        PostgresConfig(port=65535)

        # Invalid ports
        with pytest.raises(ValidationError):
            PostgresConfig(port=0)

        with pytest.raises(ValidationError):
            PostgresConfig(port=65536)

    def test_ssl_mode_validation(self):
        """Test SSL mode must be valid option."""
        # Valid SSL modes
        valid_modes = [
            "disable",
            "allow",
            "prefer",
            "require",
            "verify-ca",
            "verify-full",
        ]
        for mode in valid_modes:
            config = PostgresConfig(ssl_mode=mode)
            assert config.ssl_mode == mode

        # Invalid SSL mode
        with pytest.raises(ValidationError):
            PostgresConfig(ssl_mode="invalid-mode")


class TestNeptuneConfig:
    """Tests for NeptuneConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = NeptuneConfig()
        assert (
            config.cluster_endpoint == "neptune-cluster.us-west-2.neptune.amazonaws.com"
        )
        assert config.port == 8182
        assert config.use_iam_auth is False
        assert config.region == "us-west-2"

    def test_endpoint_url_generation(self):
        """Test Neptune WebSocket endpoint URL generation."""
        config = NeptuneConfig(cluster_endpoint="neptune.example.com", port=8182)
        assert config.endpoint_url == "wss://neptune.example.com:8182/gremlin"


class TestRedisConfig:
    """Tests for RedisConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = RedisConfig()
        assert config.host == "localhost"
        assert config.port == 6379
        assert config.password is None
        assert config.db == 0
        assert config.ssl is False
        assert config.pool_size == 10

    def test_optional_password(self):
        """Test password is optional."""
        config = RedisConfig(password=None)
        assert config.password is None

        config = RedisConfig(password="secret")
        assert config.password == "secret"

    def test_db_range_validation(self):
        """Test database number must be in valid range."""
        # Valid DB numbers
        RedisConfig(db=0)
        RedisConfig(db=15)

        # Invalid DB numbers
        with pytest.raises(ValidationError):
            RedisConfig(db=-1)

        with pytest.raises(ValidationError):
            RedisConfig(db=16)


class TestRabbitMQConfig:
    """Tests for RabbitMQConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = RabbitMQConfig()
        assert config.host == "localhost"
        assert config.port == 5672
        assert config.user == "lna_user"
        assert config.vhost == "/"
        assert config.prefetch_count == 10

    def test_url_generation(self):
        """Test AMQP URL generation."""
        config = RabbitMQConfig(
            host="rabbitmq.example.com",
            port=5672,
            user="testuser",
            password="testpass",
            vhost="/lna",
        )
        expected_url = "amqp://testuser:testpass@rabbitmq.example.com:5672/lna"
        assert config.url == expected_url

    def test_url_generation_default_vhost(self):
        """Test AMQP URL generation with default vhost."""
        config = RabbitMQConfig(user="user", password="pass")
        assert config.url == "amqp://user:pass@localhost:5672/"


class TestQdrantConfig:
    """Tests for QdrantConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = QdrantConfig()
        assert config.url == "http://localhost:6333"
        assert config.api_key is None
        assert config.collection_name == "life_navigator"
        assert config.vector_size == 384

    def test_url_validation_success(self):
        """Test valid URLs are accepted."""
        config = QdrantConfig(url="https://qdrant.example.com:6333")
        assert config.url == "https://qdrant.example.com:6333"

    def test_url_validation_failure(self):
        """Test invalid URLs are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            QdrantConfig(url="invalid-url")

        assert "URL must start with http:// or https://" in str(exc_info.value)

    def test_vector_size_range(self):
        """Test vector size must be in valid range."""
        # Valid sizes
        QdrantConfig(vector_size=1)
        QdrantConfig(vector_size=384)
        QdrantConfig(vector_size=4096)

        # Invalid sizes
        with pytest.raises(ValidationError):
            QdrantConfig(vector_size=0)

        with pytest.raises(ValidationError):
            QdrantConfig(vector_size=4097)


class TestJWTConfig:
    """Tests for JWTConfig."""

    def test_default_algorithm(self):
        """Test default JWT algorithm."""
        config = JWTConfig(secret_key="a" * 32)  # Valid secret key
        assert config.algorithm == "HS256"

    def test_secret_key_validation_success(self):
        """Test valid secret keys are accepted."""
        config = JWTConfig(secret_key="a" * 32)
        assert len(config.secret_key) >= 32

    def test_secret_key_validation_failure(self):
        """Test short secret keys are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            JWTConfig(secret_key="short")

        assert "at least 32 characters" in str(exc_info.value)

    def test_expiration_range(self):
        """Test expiration must be in valid range."""
        # Valid expirations
        JWTConfig(secret_key="a" * 32, expiration_minutes=1)
        JWTConfig(secret_key="a" * 32, expiration_minutes=60)
        JWTConfig(secret_key="a" * 32, expiration_minutes=43200)

        # Invalid expirations
        with pytest.raises(ValidationError):
            JWTConfig(secret_key="a" * 32, expiration_minutes=0)

        with pytest.raises(ValidationError):
            JWTConfig(secret_key="a" * 32, expiration_minutes=43201)


class TestAppConfig:
    """Tests for AppConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = AppConfig()
        assert config.environment == "development"
        assert config.debug is True
        assert config.log_level == "INFO"
        assert config.api_host == "0.0.0.0"
        assert config.api_port == 8080

    def test_environment_validation(self):
        """Test environment must be valid option."""
        # Valid environments
        for env in ["development", "staging", "production"]:
            config = AppConfig(environment=env)
            assert config.environment == env

        # Invalid environment
        with pytest.raises(ValidationError):
            AppConfig(environment="invalid")

    def test_log_level_validation(self):
        """Test log level must be valid option."""
        # Valid log levels
        for level in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            config = AppConfig(log_level=level)
            assert config.log_level == level

        # Invalid log level
        with pytest.raises(ValidationError):
            AppConfig(log_level="INVALID")


class TestConfig:
    """Tests for main Config class."""

    def test_singleton_pattern(self):
        """Test Config.get() returns same instance."""
        # Clear the cache first
        Config.get.cache_clear()

        config1 = Config.get()
        config2 = Config.get()

        assert config1 is config2

    def test_config_sections_initialized(self):
        """Test all config sections are initialized."""
        Config.get.cache_clear()
        config = Config.get()

        assert isinstance(config.llm, LLMConfig)
        assert isinstance(config.postgres, PostgresConfig)
        assert isinstance(config.neptune, NeptuneConfig)
        assert isinstance(config.redis, RedisConfig)
        assert isinstance(config.rabbitmq, RabbitMQConfig)
        assert isinstance(config.qdrant, QdrantConfig)
        assert isinstance(config.jwt, JWTConfig)
        assert isinstance(config.app, AppConfig)

    def test_secret_masking_in_repr(self):
        """Test secrets are masked in repr."""
        Config.get.cache_clear()

        with patch.dict(
            os.environ,
            {"POSTGRES_PASSWORD": "supersecretpassword123", "JWT_SECRET_KEY": "a" * 40},
        ):
            config = Config.get()
            repr_str = repr(config)

            # Should not contain full secrets
            assert "supersecretpassword123" not in repr_str
            assert "a" * 40 not in repr_str

            # Should contain masked versions (first 4 chars + asterisks)
            assert "supe****" in repr_str or "****" in repr_str
            assert "aaaa****" in repr_str or "****" in repr_str

    def test_env_file_loading(self):
        """Test configuration loads from .env file."""
        Config.get.cache_clear()

        # Mock the .env file reading
        with patch.dict(
            os.environ,
            {
                "VLLM_INSTANCE_1": "http://test.example.com:8000",
                "POSTGRES_DATABASE": "test_db",
                "APP_ENVIRONMENT": "staging",
            },
        ):
            config = Config.get()

            # These values should come from environment
            assert "test" in config.llm.instance_1.lower()
            assert config.postgres.database == "test_db"
            assert config.app.environment == "staging"

    @pytest.mark.asyncio
    async def test_validate_all(self):
        """Test validate_all returns status dict."""
        Config.get.cache_clear()
        config = Config.get()

        result = await config.validate_all()

        assert isinstance(result, dict)
        assert "postgres" in result
        assert "redis" in result
        assert "rabbitmq" in result
        assert "qdrant" in result
        assert "vllm_1" in result
        assert "vllm_2" in result

    def test_environment_specific_defaults(self):
        """Test defaults are appropriate for development."""
        Config.get.cache_clear()
        config = Config.get()

        # Development defaults
        assert config.llm.instance_1.startswith("http://localhost")
        assert config.postgres.host == "localhost"
        assert config.redis.host == "localhost"
        assert config.rabbitmq.host == "localhost"
        assert config.app.environment == "development"
        assert config.app.debug is True

    def test_production_config_override(self):
        """Test production environment can override defaults."""
        Config.get.cache_clear()

        with patch.dict(
            os.environ,
            {
                "APP_ENVIRONMENT": "production",
                "APP_DEBUG": "false",
                "POSTGRES_HOST": "prod-db.example.com",
                "POSTGRES_SSL_MODE": "require",
            },
        ):
            config = Config.get()

            assert config.app.environment == "production"
            assert config.app.debug is False
            assert config.postgres.host == "prod-db.example.com"
            assert config.postgres.ssl_mode == "require"
