"""Error hierarchy and exception handling for Life Navigator Agents.

This module provides a comprehensive exception hierarchy with error codes,
retry logic, and integration with the logging system.

Example usage:
    >>> from utils.errors import TaskExecutionError, retry_on_error
    >>>
    >>> @retry_on_error(max_attempts=3)
    >>> async def risky_operation():
    ...     if random.random() < 0.5:
    ...         raise TaskExecutionError("Operation failed", retryable=True)
    ...     return "Success"
"""

import asyncio
import time
from functools import wraps
from typing import Any, Callable, TypeVar, cast

F = TypeVar("F", bound=Callable[..., Any])


class LifeNavigatorError(Exception):
    """Base exception for all Life Navigator errors.

    All exceptions in the system inherit from this base class to provide
    consistent error handling, logging, and client messaging.

    Attributes:
        error_code: Unique error code for this error type.
        default_message: Default human-readable error message.
        retryable: Whether this error can be retried.
        http_status_code: Suggested HTTP status code for API responses.
    """

    error_code: str = "LN_0000"
    default_message: str = "An error occurred"
    retryable: bool = False
    http_status_code: int = 500

    def __init__(
        self,
        message: str | None = None,
        details: dict[str, Any] | None = None,
        cause: Exception | None = None,
    ) -> None:
        """Initialize the exception.

        Args:
            message: Custom error message. If None, uses default_message.
            details: Additional error details for debugging (not shown to clients).
            cause: The underlying exception that caused this error.
        """
        self.message = message or self.default_message
        self.details = details or {}
        self.__cause__ = cause
        super().__init__(self.message)

    @property
    def client_message(self) -> str:
        """Get sanitized message safe for API responses.

        Returns:
            Sanitized error message without sensitive details.
        """
        return self.default_message

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for logging/API responses.

        Returns:
            Dictionary representation of the error.
        """
        return {
            "error_code": self.error_code,
            "message": self.message,
            "client_message": self.client_message,
            "retryable": self.retryable,
            "http_status_code": self.http_status_code,
            "details": self.details,
        }


# =============================================================================
# Configuration Errors
# =============================================================================


class ConfigurationError(LifeNavigatorError):
    """Configuration or startup error."""

    error_code = "CONFIG_001"
    default_message = "Configuration error"
    http_status_code = 500


# =============================================================================
# Agent Errors
# =============================================================================


class AgentError(LifeNavigatorError):
    """Base class for agent-related errors."""

    error_code = "AGENT_001"
    default_message = "Agent error occurred"
    http_status_code = 500


class AgentInitializationError(AgentError):
    """Agent failed to initialize."""

    error_code = "AGENT_002"
    default_message = "Failed to initialize agent"
    http_status_code = 500


class AgentStateError(AgentError):
    """Invalid agent state transition."""

    error_code = "AGENT_003"
    default_message = "Invalid agent state transition"
    http_status_code = 500


class TaskExecutionError(AgentError):
    """Task execution failed."""

    error_code = "AGENT_004"
    default_message = "Task execution failed"
    retryable = True
    http_status_code = 500


class AgentTimeoutError(AgentError):
    """Agent task exceeded deadline."""

    error_code = "AGENT_005"
    default_message = "Agent task timed out"
    retryable = True
    http_status_code = 504


# =============================================================================
# GraphRAG Errors
# =============================================================================


class GraphRAGError(LifeNavigatorError):
    """Base class for GraphRAG data layer errors."""

    error_code = "GRAPHRAG_100"
    default_message = "GraphRAG error occurred"
    http_status_code = 500


class NeptuneConnectionError(GraphRAGError):
    """Failed to connect to Neptune."""

    error_code = "GRAPHRAG_101"
    default_message = "Failed to connect to Neptune database"
    retryable = True
    http_status_code = 503


class PostgresConnectionError(GraphRAGError):
    """Failed to connect to PostgreSQL."""

    error_code = "GRAPHRAG_102"
    default_message = "Failed to connect to PostgreSQL database"
    retryable = True
    http_status_code = 503


class QdrantConnectionError(GraphRAGError):
    """Failed to connect to Qdrant."""

    error_code = "GRAPHRAG_103"
    default_message = "Failed to connect to Qdrant vector database"
    retryable = True
    http_status_code = 503


class QueryExecutionError(GraphRAGError):
    """Query execution failed."""

    error_code = "GRAPHRAG_104"
    default_message = "Database query execution failed"
    retryable = True
    http_status_code = 500


class EmbeddingGenerationError(GraphRAGError):
    """Failed to generate embeddings."""

    error_code = "GRAPHRAG_105"
    default_message = "Failed to generate text embeddings"
    retryable = True
    http_status_code = 500


# =============================================================================
# Messaging Errors
# =============================================================================


class MessagingError(LifeNavigatorError):
    """Base class for message bus errors."""

    error_code = "MESSAGING_200"
    default_message = "Messaging error occurred"
    http_status_code = 500


class RedisConnectionError(MessagingError):
    """Failed to connect to Redis."""

    error_code = "MESSAGING_201"
    default_message = "Failed to connect to Redis"
    retryable = True
    http_status_code = 503


class RabbitMQConnectionError(MessagingError):
    """Failed to connect to RabbitMQ."""

    error_code = "MESSAGING_202"
    default_message = "Failed to connect to RabbitMQ"
    retryable = True
    http_status_code = 503


class MessagePublishError(MessagingError):
    """Failed to publish message."""

    error_code = "MESSAGING_203"
    default_message = "Failed to publish message to queue"
    retryable = True
    http_status_code = 500


class MessageConsumptionError(MessagingError):
    """Failed to consume message."""

    error_code = "MESSAGING_204"
    default_message = "Failed to consume message from queue"
    retryable = True
    http_status_code = 500


# Aliases for convenience
MessageBusError = MessagingError
MessageBusConnectionError = MessagingError


# =============================================================================
# LLM Errors
# =============================================================================


class LLMError(LifeNavigatorError):
    """Base class for LLM inference errors."""

    error_code = "LLM_300"
    default_message = "LLM error occurred"
    http_status_code = 500


class LLMConnectionError(LLMError):
    """Failed to connect to LLM service."""

    error_code = "LLM_301"
    default_message = "Failed to connect to LLM service"
    retryable = True
    http_status_code = 503


class LLMTimeoutError(LLMError):
    """LLM request timed out."""

    error_code = "LLM_302"
    default_message = "LLM request timed out"
    retryable = True
    http_status_code = 504


class LLMResponseError(LLMError):
    """Invalid LLM response format."""

    error_code = "LLM_303"
    default_message = "Invalid response format from LLM"
    retryable = False
    http_status_code = 500


class LLMRateLimitError(LLMError):
    """LLM rate limit exceeded."""

    error_code = "LLM_304"
    default_message = "LLM rate limit exceeded"
    retryable = True
    http_status_code = 429


# =============================================================================
# Tool Errors
# =============================================================================


class ToolError(LifeNavigatorError):
    """Base class for external tool/API errors."""

    error_code = "TOOL_400"
    default_message = "External tool error occurred"
    http_status_code = 502


class PlaidAPIError(ToolError):
    """Plaid API error."""

    error_code = "TOOL_401"
    default_message = "Plaid API error"
    retryable = True
    http_status_code = 502


class CoinbaseAPIError(ToolError):
    """Coinbase API error."""

    error_code = "TOOL_402"
    default_message = "Coinbase API error"
    retryable = True
    http_status_code = 502


class ADPAPIError(ToolError):
    """ADP API error."""

    error_code = "TOOL_403"
    default_message = "ADP API error"
    retryable = True
    http_status_code = 502


class ToolTimeoutError(ToolError):
    """External tool request timed out."""

    error_code = "TOOL_404"
    default_message = "External tool request timed out"
    retryable = True
    http_status_code = 504


# =============================================================================
# Authentication Errors
# =============================================================================


class AuthenticationError(LifeNavigatorError):
    """Base class for authentication/authorization errors."""

    error_code = "AUTH_500"
    default_message = "Authentication error"
    http_status_code = 401


class InvalidTokenError(AuthenticationError):
    """Invalid JWT token."""

    error_code = "AUTH_501"
    default_message = "Invalid authentication token"
    http_status_code = 401


class ExpiredTokenError(AuthenticationError):
    """Expired JWT token."""

    error_code = "AUTH_502"
    default_message = "Authentication token has expired"
    http_status_code = 401


class InsufficientPermissionsError(AuthenticationError):
    """Insufficient permissions for operation."""

    error_code = "AUTH_503"
    default_message = "Insufficient permissions"
    http_status_code = 403


# =============================================================================
# Retry Decorator
# =============================================================================


def retry_on_error(
    max_attempts: int = 3,
    initial_delay: float = 0.1,
    max_delay: float = 10.0,
    exponential_base: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (LifeNavigatorError,),
) -> Callable[[F], F]:
    """Retry async function on specified exceptions with exponential backoff.

    This decorator implements exponential backoff retry logic for async functions.
    Only exceptions marked as retryable will be retried.

    Args:
        max_attempts: Maximum number of retry attempts.
        initial_delay: Initial delay in seconds before first retry.
        max_delay: Maximum delay between retries.
        exponential_base: Base for exponential backoff calculation.
        exceptions: Tuple of exception types to catch and retry.

    Returns:
        Decorated function with retry logic.

    Example:
        >>> @retry_on_error(max_attempts=3, initial_delay=0.5)
        >>> async def fetch_data():
        ...     # This will retry up to 3 times on retryable errors
        ...     return await api.get_data()
    """

    def decorator(func: F) -> F:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    # Check if error is retryable
                    if isinstance(e, LifeNavigatorError) and not e.retryable:
                        # Non-retryable error, raise immediately
                        raise

                    if attempt < max_attempts - 1:
                        # Calculate delay with exponential backoff
                        delay = min(
                            initial_delay * (exponential_base**attempt), max_delay
                        )

                        # Log retry attempt
                        from utils.logging import get_logger

                        logger = get_logger(__name__)
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_attempts} failed, retrying in {delay:.2f}s",
                            metadata={
                                "error": str(e),
                                "error_code": getattr(e, "error_code", "UNKNOWN"),
                                "attempt": attempt + 1,
                                "max_attempts": max_attempts,
                                "delay": delay,
                            },
                        )

                        await asyncio.sleep(delay)
                    else:
                        # Max attempts reached
                        from utils.logging import get_logger

                        logger = get_logger(__name__)
                        logger.error(
                            f"All {max_attempts} retry attempts exhausted",
                            error=e,
                            metadata={
                                "error_code": getattr(e, "error_code", "UNKNOWN"),
                                "max_attempts": max_attempts,
                            },
                        )

            # Raise the last exception if all retries failed
            if last_exception:
                raise last_exception

            # This should never happen, but makes mypy happy
            raise RuntimeError("Unexpected state in retry logic")

        # For sync functions, provide a sync wrapper
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None

            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    # Check if error is retryable
                    if isinstance(e, LifeNavigatorError) and not e.retryable:
                        raise

                    if attempt < max_attempts - 1:
                        delay = min(
                            initial_delay * (exponential_base**attempt), max_delay
                        )

                        from utils.logging import get_logger

                        logger = get_logger(__name__)
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_attempts} failed, retrying in {delay:.2f}s",
                            metadata={
                                "error": str(e),
                                "error_code": getattr(e, "error_code", "UNKNOWN"),
                                "attempt": attempt + 1,
                                "max_attempts": max_attempts,
                                "delay": delay,
                            },
                        )

                        time.sleep(delay)

            if last_exception:
                raise last_exception

            raise RuntimeError("Unexpected state in retry logic")

        # Return appropriate wrapper based on whether function is async
        if asyncio.iscoroutinefunction(func):
            return cast(F, async_wrapper)
        else:
            return cast(F, sync_wrapper)

    return decorator


# =============================================================================
# Error Code Registry
# =============================================================================

ERROR_CODE_REGISTRY: dict[str, type[LifeNavigatorError]] = {
    "LN_0000": LifeNavigatorError,
    "CONFIG_001": ConfigurationError,
    "AGENT_001": AgentError,
    "AGENT_002": AgentInitializationError,
    "AGENT_003": AgentStateError,
    "AGENT_004": TaskExecutionError,
    "AGENT_005": AgentTimeoutError,
    "GRAPHRAG_100": GraphRAGError,
    "GRAPHRAG_101": NeptuneConnectionError,
    "GRAPHRAG_102": PostgresConnectionError,
    "GRAPHRAG_103": QdrantConnectionError,
    "GRAPHRAG_104": QueryExecutionError,
    "GRAPHRAG_105": EmbeddingGenerationError,
    "MESSAGING_200": MessagingError,
    "MESSAGING_201": RedisConnectionError,
    "MESSAGING_202": RabbitMQConnectionError,
    "MESSAGING_203": MessagePublishError,
    "MESSAGING_204": MessageConsumptionError,
    "LLM_300": LLMError,
    "LLM_301": LLMConnectionError,
    "LLM_302": LLMTimeoutError,
    "LLM_303": LLMResponseError,
    "LLM_304": LLMRateLimitError,
    "TOOL_400": ToolError,
    "TOOL_401": PlaidAPIError,
    "TOOL_402": CoinbaseAPIError,
    "TOOL_403": ADPAPIError,
    "TOOL_404": ToolTimeoutError,
    "AUTH_500": AuthenticationError,
    "AUTH_501": InvalidTokenError,
    "AUTH_502": ExpiredTokenError,
    "AUTH_503": InsufficientPermissionsError,
}


def validate_error_codes() -> bool:
    """Validate that all error codes are unique.

    Returns:
        True if all error codes are unique, False otherwise.
    """
    codes = [exc.error_code for exc in ERROR_CODE_REGISTRY.values()]
    return len(codes) == len(set(codes))
