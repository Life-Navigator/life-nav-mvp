"""
Enterprise-Grade Retry Logic with Exponential Backoff

Provides intelligent retry strategies for transient failures:
- Exponential backoff with jitter
- Configurable retry policies
- Integration with error categorization
- Metrics and monitoring
"""

import asyncio
import time
import random
from typing import Optional, Callable, TypeVar, Any, Dict, List
from functools import wraps
import structlog

from .errors import (
    BaseError,
    ErrorRecoveryStrategy,
    ErrorCategory
)

logger = structlog.get_logger(__name__)

T = TypeVar('T')


# ============================================================================
# Retry Policy Configuration
# ============================================================================

class RetryPolicy:
    """
    Configuration for retry behavior.

    Attributes:
        max_attempts: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        max_delay: Maximum delay between retries
        exponential_base: Exponential backoff base (2.0 = doubling)
        jitter: Add random jitter to prevent thundering herd (0.0-1.0)
        retryable_errors: Specific error types that should trigger retry
        retryable_categories: Error categories that should trigger retry
    """

    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: float = 0.1,
        retryable_errors: Optional[List[type]] = None,
        retryable_categories: Optional[List[ErrorCategory]] = None,
        timeout: Optional[float] = None
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.retryable_errors = retryable_errors or []
        self.retryable_categories = retryable_categories or [
            ErrorCategory.NETWORK,
            ErrorCategory.TIMEOUT,
            ErrorCategory.EXTERNAL_SERVICE,
            ErrorCategory.DATABASE,
        ]
        self.timeout = timeout

    def calculate_delay(self, attempt: int) -> float:
        """
        Calculate delay for given attempt with exponential backoff and jitter.

        Args:
            attempt: Current attempt number (0-indexed)

        Returns:
            Delay in seconds
        """
        # Exponential backoff
        delay = min(
            self.initial_delay * (self.exponential_base ** attempt),
            self.max_delay
        )

        # Add jitter to prevent thundering herd
        if self.jitter > 0:
            jitter_amount = delay * self.jitter
            delay += random.uniform(-jitter_amount, jitter_amount)

        return max(0.0, delay)

    def should_retry(self, error: Exception, attempt: int) -> bool:
        """
        Determine if error should trigger a retry.

        Args:
            error: The exception that occurred
            attempt: Current attempt number (0-indexed)

        Returns:
            True if should retry, False otherwise
        """
        # Check attempt limit
        if attempt >= self.max_attempts - 1:
            return False

        # Check if it's a BaseError with retry strategy
        if isinstance(error, BaseError):
            if error.recovery_strategy == ErrorRecoveryStrategy.RETRY:
                return True
            if error.recovery_strategy == ErrorRecoveryStrategy.FAIL_FAST:
                return False
            if error.category in self.retryable_categories:
                return True

        # Check specific error types
        if self.retryable_errors:
            return any(isinstance(error, err_type) for err_type in self.retryable_errors)

        return False


# ============================================================================
# Default Retry Policies
# ============================================================================

DEFAULT_POLICY = RetryPolicy(
    max_attempts=3,
    initial_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0,
    jitter=0.1
)

AGGRESSIVE_POLICY = RetryPolicy(
    max_attempts=5,
    initial_delay=0.5,
    max_delay=10.0,
    exponential_base=1.5,
    jitter=0.2
)

CONSERVATIVE_POLICY = RetryPolicy(
    max_attempts=2,
    initial_delay=2.0,
    max_delay=60.0,
    exponential_base=3.0,
    jitter=0.0
)

NETWORK_POLICY = RetryPolicy(
    max_attempts=5,
    initial_delay=1.0,
    max_delay=30.0,
    exponential_base=2.0,
    jitter=0.3,
    retryable_categories=[ErrorCategory.NETWORK, ErrorCategory.TIMEOUT]
)

DATABASE_POLICY = RetryPolicy(
    max_attempts=3,
    initial_delay=0.5,
    max_delay=5.0,
    exponential_base=2.0,
    jitter=0.2,
    retryable_categories=[ErrorCategory.DATABASE]
)


# ============================================================================
# Retry Statistics
# ============================================================================

class RetryStats:
    """Track retry statistics for monitoring"""

    def __init__(self):
        self.total_attempts: int = 0
        self.total_retries: int = 0
        self.successful_retries: int = 0
        self.failed_retries: int = 0
        self.total_delay: float = 0.0
        self.errors_by_type: Dict[str, int] = {}

    def record_attempt(self, attempt: int, delay: float, error_type: Optional[str] = None):
        """Record a retry attempt"""
        self.total_attempts += 1
        if attempt > 0:
            self.total_retries += 1
            self.total_delay += delay

        if error_type:
            self.errors_by_type[error_type] = self.errors_by_type.get(error_type, 0) + 1

    def record_success(self, had_retries: bool):
        """Record successful operation"""
        if had_retries:
            self.successful_retries += 1

    def record_failure(self):
        """Record final failure after retries"""
        self.failed_retries += 1

    def to_dict(self) -> Dict[str, Any]:
        """Export stats as dictionary"""
        return {
            "total_attempts": self.total_attempts,
            "total_retries": self.total_retries,
            "successful_retries": self.successful_retries,
            "failed_retries": self.failed_retries,
            "total_delay_seconds": self.total_delay,
            "average_delay": self.total_delay / max(1, self.total_retries),
            "errors_by_type": self.errors_by_type
        }


# Global stats instance
retry_stats = RetryStats()


# ============================================================================
# Async Retry Decorator
# ============================================================================

def retry_async(
    policy: RetryPolicy = DEFAULT_POLICY,
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
    log_retries: bool = True
):
    """
    Decorator for async functions with retry logic.

    Args:
        policy: Retry policy configuration
        on_retry: Optional callback called on each retry (error, attempt, delay)
        log_retries: Whether to log retry attempts

    Example:
        @retry_async(policy=NETWORK_POLICY)
        async def fetch_data(url: str) -> dict:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                return response.json()
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_error = None
            start_time = time.time()

            for attempt in range(policy.max_attempts):
                try:
                    # Check timeout
                    if policy.timeout:
                        elapsed = time.time() - start_time
                        if elapsed >= policy.timeout:
                            raise TimeoutError(
                                f"Operation timed out after {elapsed:.2f}s",
                                operation=func.__name__,
                                timeout_seconds=policy.timeout
                            )

                    # Execute function
                    result = await func(*args, **kwargs)

                    # Record success
                    retry_stats.record_success(attempt > 0)

                    if attempt > 0 and log_retries:
                        logger.info(
                            "retry_succeeded",
                            function=func.__name__,
                            attempt=attempt + 1,
                            total_attempts=policy.max_attempts
                        )

                    return result

                except Exception as e:
                    last_error = e
                    error_type = type(e).__name__

                    # Record attempt
                    delay = policy.calculate_delay(attempt)
                    retry_stats.record_attempt(attempt, delay, error_type)

                    # Check if should retry
                    should_retry = policy.should_retry(e, attempt)

                    if not should_retry:
                        if log_retries:
                            logger.warning(
                                "retry_not_applicable",
                                function=func.__name__,
                                error_type=error_type,
                                error_message=str(e),
                                attempt=attempt + 1
                            )
                        retry_stats.record_failure()
                        raise

                    # This is the last attempt
                    if attempt >= policy.max_attempts - 1:
                        if log_retries:
                            logger.error(
                                "retry_exhausted",
                                function=func.__name__,
                                max_attempts=policy.max_attempts,
                                error_type=error_type,
                                error_message=str(e)
                            )
                        retry_stats.record_failure()
                        raise

                    # Log retry
                    if log_retries:
                        logger.warning(
                            "retrying_operation",
                            function=func.__name__,
                            attempt=attempt + 1,
                            max_attempts=policy.max_attempts,
                            delay_seconds=delay,
                            error_type=error_type,
                            error_message=str(e)
                        )

                    # Call retry callback
                    if on_retry:
                        try:
                            on_retry(e, attempt, delay)
                        except Exception as callback_error:
                            logger.error(
                                "retry_callback_failed",
                                error=str(callback_error)
                            )

                    # Wait before retry
                    await asyncio.sleep(delay)

            # Should never reach here, but just in case
            retry_stats.record_failure()
            raise last_error

        return wrapper
    return decorator


# ============================================================================
# Sync Retry Decorator
# ============================================================================

def retry_sync(
    policy: RetryPolicy = DEFAULT_POLICY,
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
    log_retries: bool = True
):
    """
    Decorator for sync functions with retry logic.

    Args:
        policy: Retry policy configuration
        on_retry: Optional callback called on each retry (error, attempt, delay)
        log_retries: Whether to log retry attempts

    Example:
        @retry_sync(policy=DATABASE_POLICY)
        def save_to_database(data: dict) -> bool:
            db.insert(data)
            return True
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_error = None
            start_time = time.time()

            for attempt in range(policy.max_attempts):
                try:
                    # Check timeout
                    if policy.timeout:
                        elapsed = time.time() - start_time
                        if elapsed >= policy.timeout:
                            raise TimeoutError(
                                f"Operation timed out after {elapsed:.2f}s",
                                operation=func.__name__,
                                timeout_seconds=policy.timeout
                            )

                    # Execute function
                    result = func(*args, **kwargs)

                    # Record success
                    retry_stats.record_success(attempt > 0)

                    if attempt > 0 and log_retries:
                        logger.info(
                            "retry_succeeded",
                            function=func.__name__,
                            attempt=attempt + 1,
                            total_attempts=policy.max_attempts
                        )

                    return result

                except Exception as e:
                    last_error = e
                    error_type = type(e).__name__

                    # Record attempt
                    delay = policy.calculate_delay(attempt)
                    retry_stats.record_attempt(attempt, delay, error_type)

                    # Check if should retry
                    should_retry = policy.should_retry(e, attempt)

                    if not should_retry:
                        if log_retries:
                            logger.warning(
                                "retry_not_applicable",
                                function=func.__name__,
                                error_type=error_type,
                                error_message=str(e),
                                attempt=attempt + 1
                            )
                        retry_stats.record_failure()
                        raise

                    # This is the last attempt
                    if attempt >= policy.max_attempts - 1:
                        if log_retries:
                            logger.error(
                                "retry_exhausted",
                                function=func.__name__,
                                max_attempts=policy.max_attempts,
                                error_type=error_type,
                                error_message=str(e)
                            )
                        retry_stats.record_failure()
                        raise

                    # Log retry
                    if log_retries:
                        logger.warning(
                            "retrying_operation",
                            function=func.__name__,
                            attempt=attempt + 1,
                            max_attempts=policy.max_attempts,
                            delay_seconds=delay,
                            error_type=error_type,
                            error_message=str(e)
                        )

                    # Call retry callback
                    if on_retry:
                        try:
                            on_retry(e, attempt, delay)
                        except Exception as callback_error:
                            logger.error(
                                "retry_callback_failed",
                                error=str(callback_error)
                            )

                    # Wait before retry
                    time.sleep(delay)

            # Should never reach here, but just in case
            retry_stats.record_failure()
            raise last_error

        return wrapper
    return decorator


# ============================================================================
# Context Manager for Retry
# ============================================================================

class RetryContext:
    """
    Context manager for retry logic.

    Usage:
        retry_ctx = RetryContext(policy=NETWORK_POLICY)
        async with retry_ctx:
            await perform_network_operation()
    """

    def __init__(self, policy: RetryPolicy = DEFAULT_POLICY, operation: str = "operation"):
        self.policy = policy
        self.operation = operation
        self.attempt = 0
        self.start_time = None

    async def __aenter__(self):
        self.start_time = time.time()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            retry_stats.record_success(self.attempt > 0)
            return False

        # Record attempt
        delay = self.policy.calculate_delay(self.attempt)
        retry_stats.record_attempt(self.attempt, delay, exc_type.__name__)

        # Check if should retry
        if not self.policy.should_retry(exc_val, self.attempt):
            retry_stats.record_failure()
            return False

        # Check if exhausted attempts
        if self.attempt >= self.policy.max_attempts - 1:
            logger.error(
                "retry_exhausted",
                operation=self.operation,
                max_attempts=self.policy.max_attempts
            )
            retry_stats.record_failure()
            return False

        # Log and wait
        logger.warning(
            "retrying_operation",
            operation=self.operation,
            attempt=self.attempt + 1,
            delay_seconds=delay
        )

        await asyncio.sleep(delay)
        self.attempt += 1

        return True  # Suppress exception to retry


# ============================================================================
# Utility Functions
# ============================================================================

def get_retry_stats() -> Dict[str, Any]:
    """Get current retry statistics"""
    return retry_stats.to_dict()


def reset_retry_stats():
    """Reset retry statistics"""
    global retry_stats
    retry_stats = RetryStats()


if __name__ == "__main__":
    # Example usage
    import asyncio

    @retry_async(policy=NETWORK_POLICY)
    async def flaky_function(fail_count: int = 2):
        """Simulates a function that fails a few times then succeeds"""
        if flaky_function.call_count < fail_count:
            flaky_function.call_count += 1
            from .errors import NetworkError
            raise NetworkError("Simulated network failure")
        return "Success!"

    flaky_function.call_count = 0

    async def main():
        try:
            result = await flaky_function(fail_count=2)
            print(f"Result: {result}")
            print(f"Stats: {get_retry_stats()}")
        except Exception as e:
            print(f"Failed: {e}")

    asyncio.run(main())
