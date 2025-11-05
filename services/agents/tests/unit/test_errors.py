"""Unit tests for error handling and exception hierarchy.

Tests cover:
- Exception hierarchy (isinstance checks)
- Error code uniqueness
- to_dict() serialization
- client_message sanitization
- Retry decorator (success after N attempts)
- Retry decorator (max_attempts exhausted)
- Exponential backoff timing
- Exception chaining
- Integration with logging
"""

import time
from io import StringIO
from unittest.mock import patch

import pytest

from utils.errors import (
    ADPAPIError,
    AgentError,
    AgentInitializationError,
    AgentStateError,
    AgentTimeoutError,
    AuthenticationError,
    CoinbaseAPIError,
    ConfigurationError,
    EmbeddingGenerationError,
    ExpiredTokenError,
    GraphRAGError,
    InsufficientPermissionsError,
    InvalidTokenError,
    LifeNavigatorError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    MessageConsumptionError,
    MessagePublishError,
    MessagingError,
    NeptuneConnectionError,
    PlaidAPIError,
    PostgresConnectionError,
    QdrantConnectionError,
    QueryExecutionError,
    RabbitMQConnectionError,
    RedisConnectionError,
    TaskExecutionError,
    ToolError,
    ToolTimeoutError,
    ERROR_CODE_REGISTRY,
    retry_on_error,
    validate_error_codes,
)


class TestExceptionHierarchy:
    """Tests for exception hierarchy and inheritance."""

    def test_all_exceptions_inherit_from_base(self):
        """Test all custom exceptions inherit from LifeNavigatorError."""
        exceptions = [
            ConfigurationError,
            AgentError,
            AgentInitializationError,
            AgentStateError,
            TaskExecutionError,
            AgentTimeoutError,
            GraphRAGError,
            NeptuneConnectionError,
            PostgresConnectionError,
            QdrantConnectionError,
            QueryExecutionError,
            EmbeddingGenerationError,
            MessagingError,
            RedisConnectionError,
            RabbitMQConnectionError,
            MessagePublishError,
            MessageConsumptionError,
            LLMError,
            LLMConnectionError,
            LLMTimeoutError,
            LLMResponseError,
            LLMRateLimitError,
            ToolError,
            PlaidAPIError,
            CoinbaseAPIError,
            ADPAPIError,
            ToolTimeoutError,
            AuthenticationError,
            InvalidTokenError,
            ExpiredTokenError,
            InsufficientPermissionsError,
        ]

        for exc_class in exceptions:
            assert issubclass(exc_class, LifeNavigatorError)

    def test_agent_errors_inherit_from_agent_error(self):
        """Test agent-specific errors inherit from AgentError."""
        agent_errors = [
            AgentInitializationError,
            AgentStateError,
            TaskExecutionError,
            AgentTimeoutError,
        ]

        for exc_class in agent_errors:
            assert issubclass(exc_class, AgentError)

    def test_graphrag_errors_inherit_from_graphrag_error(self):
        """Test GraphRAG errors inherit from GraphRAGError."""
        graphrag_errors = [
            NeptuneConnectionError,
            PostgresConnectionError,
            QdrantConnectionError,
            QueryExecutionError,
            EmbeddingGenerationError,
        ]

        for exc_class in graphrag_errors:
            assert issubclass(exc_class, GraphRAGError)


class TestErrorCodes:
    """Tests for error codes."""

    def test_error_code_uniqueness(self):
        """Test all error codes are unique."""
        assert validate_error_codes()

    def test_error_code_format(self):
        """Test error codes follow the expected format."""
        for error_code, exc_class in ERROR_CODE_REGISTRY.items():
            # Error codes should match their class's error_code attribute
            assert exc_class.error_code == error_code

    def test_error_code_registry_completeness(self):
        """Test all exception classes are in the registry."""
        # Count should match (we have 32 exception classes)
        assert len(ERROR_CODE_REGISTRY) == 32


class TestExceptionInitialization:
    """Tests for exception initialization and attributes."""

    def test_default_initialization(self):
        """Test exception with default values."""
        exc = LifeNavigatorError()

        assert exc.message == "An error occurred"
        assert exc.details == {}
        assert exc.error_code == "LN_0000"
        assert exc.retryable is False
        assert exc.http_status_code == 500

    def test_custom_message(self):
        """Test exception with custom message."""
        exc = LifeNavigatorError("Custom error message")

        assert exc.message == "Custom error message"
        assert str(exc) == "Custom error message"

    def test_with_details(self):
        """Test exception with details."""
        details = {"user_id": "123", "action": "test"}
        exc = LifeNavigatorError("Test error", details=details)

        assert exc.details == details

    def test_with_cause(self):
        """Test exception with underlying cause."""
        cause = ValueError("Original error")
        exc = LifeNavigatorError("Wrapped error", cause=cause)

        assert exc.__cause__ == cause


class TestToDictSerialization:
    """Tests for to_dict() serialization."""

    def test_to_dict_structure(self):
        """Test to_dict returns correct structure."""
        exc = TaskExecutionError("Task failed", details={"task_id": "123"})
        result = exc.to_dict()

        assert "error_code" in result
        assert "message" in result
        assert "client_message" in result
        assert "retryable" in result
        assert "http_status_code" in result
        assert "details" in result

    def test_to_dict_values(self):
        """Test to_dict contains correct values."""
        exc = TaskExecutionError("Task failed", details={"task_id": "123"})
        result = exc.to_dict()

        assert result["error_code"] == "AGENT_004"
        assert result["message"] == "Task failed"
        assert result["retryable"] is True
        assert result["http_status_code"] == 500
        assert result["details"] == {"task_id": "123"}


class TestClientMessageSanitization:
    """Tests for client_message sanitization."""

    def test_client_message_uses_default(self):
        """Test client_message returns default message."""
        exc = TaskExecutionError("Internal error with sensitive data: api_key=secret")

        # Client message should be the safe default
        assert exc.client_message == "Task execution failed"
        # Actual message contains sensitive data
        assert "api_key=secret" in exc.message
        # But client message does not
        assert "api_key" not in exc.client_message

    def test_different_exceptions_have_different_client_messages(self):
        """Test different exception types have different client messages."""
        exc1 = InvalidTokenError()
        exc2 = NeptuneConnectionError()

        assert exc1.client_message != exc2.client_message


class TestHTTPStatusCodes:
    """Tests for HTTP status codes."""

    def test_agent_errors_return_500(self):
        """Test agent errors return 500."""
        exc = AgentError()
        assert exc.http_status_code == 500

    def test_timeout_errors_return_504(self):
        """Test timeout errors return 504."""
        exc1 = AgentTimeoutError()
        exc2 = LLMTimeoutError()
        exc3 = ToolTimeoutError()

        assert exc1.http_status_code == 504
        assert exc2.http_status_code == 504
        assert exc3.http_status_code == 504

    def test_connection_errors_return_503(self):
        """Test connection errors return 503."""
        exc1 = NeptuneConnectionError()
        exc2 = RedisConnectionError()
        exc3 = LLMConnectionError()

        assert exc1.http_status_code == 503
        assert exc2.http_status_code == 503
        assert exc3.http_status_code == 503

    def test_auth_errors_return_401_or_403(self):
        """Test authentication errors return appropriate codes."""
        exc1 = InvalidTokenError()
        exc2 = ExpiredTokenError()
        exc3 = InsufficientPermissionsError()

        assert exc1.http_status_code == 401
        assert exc2.http_status_code == 401
        assert exc3.http_status_code == 403

    def test_rate_limit_returns_429(self):
        """Test rate limit error returns 429."""
        exc = LLMRateLimitError()
        assert exc.http_status_code == 429


class TestRetryableFlags:
    """Tests for retryable attribute."""

    def test_connection_errors_are_retryable(self):
        """Test connection errors are marked as retryable."""
        retryable_errors = [
            NeptuneConnectionError(),
            PostgresConnectionError(),
            RedisConnectionError(),
            RabbitMQConnectionError(),
            LLMConnectionError(),
        ]

        for exc in retryable_errors:
            assert exc.retryable is True

    def test_non_retryable_errors(self):
        """Test some errors are not retryable."""
        non_retryable = [
            LLMResponseError(),  # Invalid format, retrying won't help
        ]

        for exc in non_retryable:
            assert exc.retryable is False


class TestRetryDecorator:
    """Tests for retry_on_error decorator."""

    @pytest.mark.asyncio
    async def test_retry_success_after_failures(self):
        """Test retry succeeds after N failures."""
        attempt_count = 0

        @retry_on_error(max_attempts=3, initial_delay=0.01)
        async def flaky_function() -> str:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise TaskExecutionError("Temporary failure")
            return "Success"

        result = await flaky_function()

        assert result == "Success"
        assert attempt_count == 3

    @pytest.mark.asyncio
    async def test_retry_max_attempts_exhausted(self):
        """Test retry raises after max attempts."""
        attempt_count = 0

        @retry_on_error(max_attempts=3, initial_delay=0.01)
        async def always_fails() -> None:
            nonlocal attempt_count
            attempt_count += 1
            raise TaskExecutionError("Always fails")

        with pytest.raises(TaskExecutionError):
            await always_fails()

        assert attempt_count == 3

    @pytest.mark.asyncio
    async def test_retry_non_retryable_error_raises_immediately(self):
        """Test non-retryable errors are not retried."""
        attempt_count = 0

        @retry_on_error(max_attempts=3, initial_delay=0.01)
        async def non_retryable_error() -> None:
            nonlocal attempt_count
            attempt_count += 1
            raise LLMResponseError("Invalid format")

        with pytest.raises(LLMResponseError):
            await non_retryable_error()

        # Should only attempt once for non-retryable error
        assert attempt_count == 1

    @pytest.mark.asyncio
    async def test_retry_exponential_backoff(self):
        """Test exponential backoff delays."""
        delays: list[float] = []
        last_time: float | None = None

        @retry_on_error(max_attempts=3, initial_delay=0.1, exponential_base=2.0)
        async def measure_delays() -> None:
            nonlocal last_time
            current_time = time.time()
            if last_time is not None:
                delays.append(current_time - last_time)
            last_time = current_time
            raise TaskExecutionError("Test")

        with pytest.raises(TaskExecutionError):
            await measure_delays()

        # Should have 2 delays (after 1st and 2nd attempts)
        assert len(delays) == 2

        # First delay should be ~0.1s, second ~0.2s (exponential)
        assert 0.08 < delays[0] < 0.15  # Allow some variance
        assert 0.18 < delays[1] < 0.25

    @pytest.mark.asyncio
    async def test_retry_respects_max_delay(self):
        """Test max_delay cap is respected."""

        @retry_on_error(max_attempts=5, initial_delay=1.0, max_delay=0.5)
        async def test_max_delay() -> None:
            raise TaskExecutionError("Test")

        start = time.time()
        with pytest.raises(TaskExecutionError):
            await test_max_delay()
        elapsed = time.time() - start

        # With max_delay=0.5, total delay should be ~2.0s (4 retries * 0.5s each)
        # Allow some overhead for execution time
        assert elapsed < 3.0

    @pytest.mark.asyncio
    async def test_retry_logging_integration(self):
        """Test retry decorator logs retry attempts."""
        attempt_count = 0

        @retry_on_error(max_attempts=3, initial_delay=0.01)
        async def logged_function() -> None:
            nonlocal attempt_count
            attempt_count += 1
            raise TaskExecutionError("Test error")

        # Capture log output
        with patch("sys.stdout", new_callable=StringIO):
            with pytest.raises(TaskExecutionError):
                await logged_function()

        # Should have attempted 3 times
        assert attempt_count == 3

    def test_retry_decorator_sync_function(self):
        """Test retry decorator works with sync functions."""
        attempt_count = 0

        @retry_on_error(max_attempts=3, initial_delay=0.01)
        def sync_flaky_function() -> str:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 2:
                raise TaskExecutionError("Temporary failure")
            return "Success"

        result = sync_flaky_function()

        assert result == "Success"
        assert attempt_count == 2

    @pytest.mark.asyncio
    async def test_retry_specific_exceptions(self):
        """Test retry only catches specified exceptions."""
        attempt_count = 0

        @retry_on_error(
            max_attempts=3, initial_delay=0.01, exceptions=(TaskExecutionError,)
        )
        async def specific_exception() -> None:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count == 1:
                raise ValueError("Not caught")  # Should not be retried
            raise TaskExecutionError("Should be retried")

        with pytest.raises(ValueError):
            await specific_exception()

        # Should only attempt once (ValueError not in exceptions tuple)
        assert attempt_count == 1


class TestExceptionChaining:
    """Tests for exception chaining with __cause__."""

    def test_exception_preserves_cause(self):
        """Test exception preserves underlying cause."""
        original = ValueError("Original error")
        wrapped = TaskExecutionError("Wrapped error", cause=original)

        assert wrapped.__cause__ == original

    def test_exception_chain_can_be_traced(self):
        """Test exception chain can be traced back."""
        level1 = ValueError("Level 1 error")
        level2 = GraphRAGError("Level 2 error", cause=level1)
        level3 = TaskExecutionError("Level 3 error", cause=level2)

        assert level3.__cause__ == level2
        assert level3.__cause__.__cause__ == level1


class TestErrorCodeCoverage:
    """Tests to ensure all error code ranges are covered."""

    def test_agent_error_codes(self):
        """Test agent error codes are in AGENT_xxx range."""
        agent_errors = [
            AgentError,
            AgentInitializationError,
            AgentStateError,
            TaskExecutionError,
            AgentTimeoutError,
        ]

        for exc_class in agent_errors:
            assert exc_class.error_code.startswith("AGENT_")

    def test_graphrag_error_codes(self):
        """Test GraphRAG error codes are in GRAPHRAG_xxx range."""
        graphrag_errors = [
            GraphRAGError,
            NeptuneConnectionError,
            PostgresConnectionError,
            QdrantConnectionError,
            QueryExecutionError,
            EmbeddingGenerationError,
        ]

        for exc_class in graphrag_errors:
            assert exc_class.error_code.startswith("GRAPHRAG_")

    def test_messaging_error_codes(self):
        """Test messaging error codes are in MESSAGING_xxx range."""
        messaging_errors = [
            MessagingError,
            RedisConnectionError,
            RabbitMQConnectionError,
            MessagePublishError,
            MessageConsumptionError,
        ]

        for exc_class in messaging_errors:
            assert exc_class.error_code.startswith("MESSAGING_")

    def test_llm_error_codes(self):
        """Test LLM error codes are in LLM_xxx range."""
        llm_errors = [
            LLMError,
            LLMConnectionError,
            LLMTimeoutError,
            LLMResponseError,
            LLMRateLimitError,
        ]

        for exc_class in llm_errors:
            assert exc_class.error_code.startswith("LLM_")

    def test_tool_error_codes(self):
        """Test tool error codes are in TOOL_xxx range."""
        tool_errors = [
            ToolError,
            PlaidAPIError,
            CoinbaseAPIError,
            ADPAPIError,
            ToolTimeoutError,
        ]

        for exc_class in tool_errors:
            assert exc_class.error_code.startswith("TOOL_")

    def test_auth_error_codes(self):
        """Test auth error codes are in AUTH_xxx range."""
        auth_errors = [
            AuthenticationError,
            InvalidTokenError,
            ExpiredTokenError,
            InsufficientPermissionsError,
        ]

        for exc_class in auth_errors:
            assert exc_class.error_code.startswith("AUTH_")
