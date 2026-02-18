"""
Enterprise-Grade Circuit Breaker Pattern

Prevents cascading failures by temporarily stopping calls to failing services:
- Three states: CLOSED, OPEN, HALF_OPEN
- Automatic recovery attempts
- Failure threshold detection
- Health monitoring
- Metrics and observability
"""

import asyncio
import time
from typing import Optional, Callable, TypeVar, Any, Dict
from functools import wraps
from enum import Enum
from datetime import datetime
import structlog

from .errors import (
    ExternalServiceError,
    ResourceExhaustedError
)

logger = structlog.get_logger(__name__)

T = TypeVar('T')


# ============================================================================
# Circuit Breaker States
# ============================================================================

class CircuitState(str, Enum):
    """
    Circuit breaker states.

    CLOSED: Normal operation, requests pass through
    OPEN: Circuit is broken, requests fail immediately
    HALF_OPEN: Testing if service recovered, limited requests allowed
    """
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


# ============================================================================
# Circuit Breaker Configuration
# ============================================================================

class CircuitBreakerConfig:
    """
    Configuration for circuit breaker behavior.

    Attributes:
        failure_threshold: Number of failures before opening circuit
        success_threshold: Number of successes in HALF_OPEN before closing
        timeout: Seconds to wait before attempting recovery (OPEN -> HALF_OPEN)
        half_open_max_calls: Max concurrent calls allowed in HALF_OPEN state
        expected_exception: Exception type that counts as failure
        excluded_exceptions: Exceptions that don't count as failures
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: float = 60.0,
        half_open_max_calls: int = 1,
        expected_exceptions: Optional[list] = None,
        excluded_exceptions: Optional[list] = None
    ):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.half_open_max_calls = half_open_max_calls
        self.expected_exceptions = expected_exceptions or [Exception]
        self.excluded_exceptions = excluded_exceptions or []


# ============================================================================
# Circuit Breaker Implementation
# ============================================================================

class CircuitBreaker:
    """
    Circuit breaker for protecting against cascading failures.

    States:
    - CLOSED: Normal operation
    - OPEN: Failing fast, not calling the service
    - HALF_OPEN: Testing recovery with limited calls
    """

    def __init__(
        self,
        name: str,
        config: CircuitBreakerConfig = None
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()

        # State
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._opened_at: Optional[float] = None
        self._half_open_calls = 0

        # Statistics
        self._total_calls = 0
        self._total_failures = 0
        self._total_successes = 0
        self._state_changes: list = []

        # Lock for thread-safety
        self._lock = asyncio.Lock()

        logger.info(
            "circuit_breaker_created",
            name=self.name,
            failure_threshold=self.config.failure_threshold,
            timeout=self.config.timeout
        )

    @property
    def state(self) -> CircuitState:
        """Get current circuit state"""
        return self._state

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed"""
        return self._state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        """Check if circuit is open"""
        return self._state == CircuitState.OPEN

    @property
    def is_half_open(self) -> bool:
        """Check if circuit is half-open"""
        return self._state == CircuitState.HALF_OPEN

    def _change_state(self, new_state: CircuitState, reason: str = ""):
        """Change circuit state with logging"""
        old_state = self._state
        self._state = new_state

        self._state_changes.append({
            "from": old_state.value,
            "to": new_state.value,
            "timestamp": datetime.utcnow().isoformat(),
            "reason": reason
        })

        logger.warning(
            "circuit_breaker_state_changed",
            name=self.name,
            old_state=old_state.value,
            new_state=new_state.value,
            reason=reason,
            failure_count=self._failure_count,
            success_count=self._success_count
        )

        # Reset counters on state change
        if new_state == CircuitState.OPEN:
            self._opened_at = time.time()
            self._success_count = 0
        elif new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0
            self._failure_count = 0
            self._success_count = 0
        elif new_state == CircuitState.CLOSED:
            self._failure_count = 0
            self._success_count = 0
            self._opened_at = None

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self._state != CircuitState.OPEN:
            return False

        if self._opened_at is None:
            return False

        elapsed = time.time() - self._opened_at
        return elapsed >= self.config.timeout

    def _is_excluded_exception(self, error: Exception) -> bool:
        """Check if exception should be excluded from failure counting"""
        return any(
            isinstance(error, exc_type)
            for exc_type in self.config.excluded_exceptions
        )

    def _should_count_failure(self, error: Exception) -> bool:
        """Determine if error should count as failure"""
        if self._is_excluded_exception(error):
            return False

        return any(
            isinstance(error, exc_type)
            for exc_type in self.config.expected_exceptions
        )

    async def call(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            Function result

        Raises:
            ResourceExhaustedError: If circuit is OPEN
            Original exception: If function fails
        """
        async with self._lock:
            self._total_calls += 1

            # Check if should attempt reset
            if self._should_attempt_reset():
                self._change_state(CircuitState.HALF_OPEN, "timeout_expired")

            # OPEN: Fail fast
            if self._state == CircuitState.OPEN:
                time_until_retry = self.config.timeout - (time.time() - self._opened_at)
                raise ResourceExhaustedError(
                    f"Circuit breaker '{self.name}' is OPEN",
                    resource_type="circuit_breaker",
                    context={
                        "circuit_name": self.name,
                        "state": self._state.value,
                        "failure_count": self._failure_count,
                        "retry_after": int(time_until_retry)
                    },
                    retry_after=int(time_until_retry),
                    suggestions=[
                        "Service is temporarily unavailable",
                        f"Circuit will attempt recovery in {int(time_until_retry)}s"
                    ]
                )

            # HALF_OPEN: Limit concurrent calls
            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self.config.half_open_max_calls:
                    raise ResourceExhaustedError(
                        f"Circuit breaker '{self.name}' is HALF_OPEN with max calls reached",
                        resource_type="circuit_breaker",
                        context={
                            "circuit_name": self.name,
                            "state": self._state.value,
                            "max_calls": self.config.half_open_max_calls
                        }
                    )
                self._half_open_calls += 1

        # Execute function
        try:
            result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)

            # Success handling
            async with self._lock:
                self._total_successes += 1
                self._success_count += 1
                self._failure_count = 0  # Reset failure count on success

                # HALF_OPEN -> CLOSED after enough successes
                if self._state == CircuitState.HALF_OPEN:
                    if self._success_count >= self.config.success_threshold:
                        self._change_state(CircuitState.CLOSED, "success_threshold_reached")

            return result

        except Exception as e:
            # Check if this error should count as failure
            if not self._should_count_failure(e):
                raise

            # Failure handling
            async with self._lock:
                self._total_failures += 1
                self._failure_count += 1
                self._success_count = 0  # Reset success count on failure
                self._last_failure_time = time.time()

                # CLOSED -> OPEN after too many failures
                if self._state == CircuitState.CLOSED:
                    if self._failure_count >= self.config.failure_threshold:
                        self._change_state(CircuitState.OPEN, "failure_threshold_exceeded")

                # HALF_OPEN -> OPEN on any failure
                elif self._state == CircuitState.HALF_OPEN:
                    self._change_state(CircuitState.OPEN, "failure_during_recovery")

            raise

    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics"""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "total_calls": self._total_calls,
            "total_failures": self._total_failures,
            "total_successes": self._total_successes,
            "failure_rate": self._total_failures / max(1, self._total_calls),
            "last_failure_time": datetime.fromtimestamp(self._last_failure_time).isoformat() if self._last_failure_time else None,
            "opened_at": datetime.fromtimestamp(self._opened_at).isoformat() if self._opened_at else None,
            "state_changes": self._state_changes[-10:],  # Last 10 changes
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "success_threshold": self.config.success_threshold,
                "timeout": self.config.timeout,
                "half_open_max_calls": self.config.half_open_max_calls
            }
        }

    async def reset(self):
        """Manually reset circuit breaker to CLOSED state"""
        async with self._lock:
            self._change_state(CircuitState.CLOSED, "manual_reset")

    async def open(self):
        """Manually open circuit breaker"""
        async with self._lock:
            self._change_state(CircuitState.OPEN, "manual_open")


# ============================================================================
# Circuit Breaker Manager
# ============================================================================

class CircuitBreakerManager:
    """
    Global circuit breaker manager.

    Manages multiple circuit breakers by name.
    """

    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()

    async def get_breaker(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ) -> CircuitBreaker:
        """
        Get or create circuit breaker by name.

        Args:
            name: Circuit breaker name
            config: Configuration (only used when creating new breaker)

        Returns:
            CircuitBreaker instance
        """
        async with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(name, config)
            return self._breakers[name]

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all circuit breakers"""
        return {
            name: breaker.get_stats()
            for name, breaker in self._breakers.items()
        }

    async def reset_all(self):
        """Reset all circuit breakers"""
        async with self._lock:
            for breaker in self._breakers.values():
                await breaker.reset()


# Global circuit breaker manager
circuit_breaker_manager = CircuitBreakerManager()


# ============================================================================
# Decorator
# ============================================================================

def circuit_breaker(
    name: str,
    config: Optional[CircuitBreakerConfig] = None
):
    """
    Decorator to protect function with circuit breaker.

    Args:
        name: Circuit breaker name
        config: Circuit breaker configuration

    Example:
        @circuit_breaker("external_api", config=CircuitBreakerConfig(failure_threshold=3))
        async def call_external_api():
            async with httpx.AsyncClient() as client:
                return await client.get("https://api.example.com")
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            breaker = await circuit_breaker_manager.get_breaker(name, config)
            return await breaker.call(func, *args, **kwargs)

        return wrapper
    return decorator


# ============================================================================
# Context Manager
# ============================================================================

class CircuitBreakerContext:
    """
    Context manager for circuit breaker.

    Usage:
        async with CircuitBreakerContext("my_service"):
            await call_external_service()
    """

    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ):
        self.name = name
        self.config = config
        self.breaker: Optional[CircuitBreaker] = None

    async def __aenter__(self):
        self.breaker = await circuit_breaker_manager.get_breaker(self.name, self.config)
        return self.breaker

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Circuit breaker handles errors internally
        return False


if __name__ == "__main__":
    # Example usage
    import asyncio

    async def flaky_service(fail: bool = False):
        """Simulates a service that can fail"""
        if fail:
            raise ExternalServiceError("Service is down", service_name="flaky_service")
        return "Success!"

    async def main():
        # Create circuit breaker
        config = CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            timeout=5.0
        )
        breaker = CircuitBreaker("test_service", config)

        # Simulate failures
        print("Simulating failures...")
        for i in range(5):
            try:
                result = await breaker.call(flaky_service, fail=True)
                print(f"Call {i+1}: {result}")
            except Exception as e:
                print(f"Call {i+1}: Failed - {type(e).__name__}")

        print(f"\nCircuit state: {breaker.state}")
        print(f"Stats: {breaker.get_stats()}")

        # Try calling with open circuit
        print("\nTrying to call with open circuit...")
        try:
            result = await breaker.call(flaky_service, fail=False)
        except ResourceExhaustedError as e:
            print(f"Circuit is open: {e.user_message}")

        # Wait for timeout
        print(f"\nWaiting {config.timeout}s for circuit to attempt recovery...")
        await asyncio.sleep(config.timeout + 0.1)

        # Should transition to HALF_OPEN and succeed
        print("Calling after timeout...")
        try:
            result = await breaker.call(flaky_service, fail=False)
            print(f"Success: {result}")
            print(f"Circuit state: {breaker.state}")
        except Exception as e:
            print(f"Failed: {e}")

    asyncio.run(main())
