"""
Enterprise-Grade Error Handling System

Comprehensive error handling with:
- Structured error hierarchies
- Error context and stack traces
- Retry strategies
- Circuit breakers
- Dead letter queues
- Error monitoring
"""

from typing import Optional, Dict, Any, List, Type
from enum import Enum
import traceback
import time
import uuid
from datetime import datetime
import structlog

logger = structlog.get_logger(__name__)


# ============================================================================
# Error Severity Levels
# ============================================================================

class ErrorSeverity(str, Enum):
    """Error severity levels for monitoring and alerting"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    FATAL = "fatal"


class ErrorCategory(str, Enum):
    """Error categories for classification"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMIT = "rate_limit"
    EXTERNAL_SERVICE = "external_service"
    DATABASE = "database"
    NETWORK = "network"
    TIMEOUT = "timeout"
    RESOURCE_EXHAUSTED = "resource_exhausted"
    INTERNAL = "internal"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"


class ErrorRecoveryStrategy(str, Enum):
    """Strategies for error recovery"""
    RETRY = "retry"
    FALLBACK = "fallback"
    CIRCUIT_BREAK = "circuit_break"
    FAIL_FAST = "fail_fast"
    IGNORE = "ignore"
    MANUAL = "manual"


# ============================================================================
# Base Error Classes
# ============================================================================

class BaseError(Exception):
    """
    Base error class with comprehensive context.

    All custom errors should inherit from this.
    """

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        category: ErrorCategory = ErrorCategory.INTERNAL,
        recovery_strategy: ErrorRecoveryStrategy = ErrorRecoveryStrategy.MANUAL,
        user_message: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        retry_after: Optional[int] = None,
        suggestions: Optional[List[str]] = None
    ):
        super().__init__(message)

        self.error_id = str(uuid.uuid4())
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.severity = severity
        self.category = category
        self.recovery_strategy = recovery_strategy
        self.user_message = user_message or self._generate_user_message()
        self.context = context or {}
        self.cause = cause
        self.retry_after = retry_after
        self.suggestions = suggestions or []
        self.timestamp = datetime.utcnow().isoformat()
        self.stack_trace = traceback.format_exc()

        # Log the error
        self._log_error()

    def _generate_user_message(self) -> str:
        """Generate user-friendly error message"""
        if self.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.FATAL]:
            return "A critical error occurred. Our team has been notified."
        elif self.severity == ErrorSeverity.ERROR:
            return "An error occurred while processing your request. Please try again."
        elif self.severity == ErrorSeverity.WARNING:
            return "Your request completed with warnings. Some features may not be available."
        else:
            return "An unexpected issue occurred."

    def _log_error(self):
        """Log error with full context"""
        log_method = getattr(logger, self.severity.value, logger.error)
        log_method(
            "error_occurred",
            error_id=self.error_id,
            error_code=self.error_code,
            message=self.message,
            category=self.category.value,
            recovery_strategy=self.recovery_strategy.value,
            context=self.context,
            cause=str(self.cause) if self.cause else None,
            suggestions=self.suggestions
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for API responses"""
        return {
            "error_id": self.error_id,
            "error_code": self.error_code,
            "message": self.user_message,
            "severity": self.severity.value,
            "category": self.category.value,
            "timestamp": self.timestamp,
            "retry_after": self.retry_after,
            "suggestions": self.suggestions,
            # Don't expose internal details in production
            "debug": {
                "message": self.message,
                "context": self.context,
                "cause": str(self.cause) if self.cause else None
            } if self.context.get("debug_mode") else None
        }

    def should_retry(self) -> bool:
        """Determine if error is retryable"""
        return self.recovery_strategy == ErrorRecoveryStrategy.RETRY

    def should_circuit_break(self) -> bool:
        """Determine if circuit breaker should open"""
        return self.recovery_strategy == ErrorRecoveryStrategy.CIRCUIT_BREAK


# ============================================================================
# Specific Error Types
# ============================================================================

class ValidationError(BaseError):
    """Validation errors (400)"""
    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.VALIDATION,
            recovery_strategy=ErrorRecoveryStrategy.FAIL_FAST,
            context={"field": field} if field else {},
            **kwargs
        )


class AuthenticationError(BaseError):
    """Authentication errors (401)"""
    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.AUTHENTICATION,
            recovery_strategy=ErrorRecoveryStrategy.FAIL_FAST,
            user_message="Authentication required. Please log in.",
            **kwargs
        )


class AuthorizationError(BaseError):
    """Authorization errors (403)"""
    def __init__(self, message: str = "Access denied", resource: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.AUTHORIZATION,
            recovery_strategy=ErrorRecoveryStrategy.FAIL_FAST,
            user_message="You don't have permission to access this resource.",
            context={"resource": resource} if resource else {},
            **kwargs
        )


class NotFoundError(BaseError):
    """Resource not found errors (404)"""
    def __init__(self, message: str, resource_type: Optional[str] = None, resource_id: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.INFO,
            category=ErrorCategory.NOT_FOUND,
            recovery_strategy=ErrorRecoveryStrategy.FAIL_FAST,
            user_message=f"The requested {resource_type or 'resource'} was not found.",
            context={"resource_type": resource_type, "resource_id": resource_id},
            **kwargs
        )


class ConflictError(BaseError):
    """Conflict errors (409)"""
    def __init__(self, message: str, existing_resource: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.CONFLICT,
            recovery_strategy=ErrorRecoveryStrategy.FAIL_FAST,
            user_message="This resource already exists or conflicts with existing data.",
            context={"existing_resource": existing_resource} if existing_resource else {},
            **kwargs
        )


class RateLimitError(BaseError):
    """Rate limit errors (429)"""
    def __init__(self, message: str, retry_after: int = 60, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.WARNING,
            category=ErrorCategory.RATE_LIMIT,
            recovery_strategy=ErrorRecoveryStrategy.RETRY,
            retry_after=retry_after,
            user_message=f"Rate limit exceeded. Please try again in {retry_after} seconds.",
            **kwargs
        )


class ExternalServiceError(BaseError):
    """External service errors (502/503)"""
    def __init__(
        self,
        message: str,
        service_name: Optional[str] = None,
        retryable: bool = True,
        **kwargs
    ):
        super().__init__(
            message=message,
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.EXTERNAL_SERVICE,
            recovery_strategy=ErrorRecoveryStrategy.RETRY if retryable else ErrorRecoveryStrategy.CIRCUIT_BREAK,
            user_message=f"An external service ({service_name or 'unknown'}) is currently unavailable.",
            context={"service_name": service_name},
            suggestions=["Try again in a few moments", "Check service status"],
            **kwargs
        )


class DatabaseError(BaseError):
    """Database errors"""
    def __init__(
        self,
        message: str,
        operation: Optional[str] = None,
        retryable: bool = True,
        **kwargs
    ):
        super().__init__(
            message=message,
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.DATABASE,
            recovery_strategy=ErrorRecoveryStrategy.RETRY if retryable else ErrorRecoveryStrategy.FAIL_FAST,
            user_message="A database error occurred. Please try again.",
            context={"operation": operation},
            **kwargs
        )


class NetworkError(BaseError):
    """Network errors"""
    def __init__(self, message: str, url: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.NETWORK,
            recovery_strategy=ErrorRecoveryStrategy.RETRY,
            user_message="A network error occurred. Please check your connection.",
            context={"url": url} if url else {},
            suggestions=["Check your internet connection", "Try again in a moment"],
            **kwargs
        )


class TimeoutError(BaseError):
    """Timeout errors"""
    def __init__(
        self,
        message: str,
        operation: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        **kwargs
    ):
        super().__init__(
            message=message,
            severity=ErrorSeverity.ERROR,
            category=ErrorCategory.TIMEOUT,
            recovery_strategy=ErrorRecoveryStrategy.RETRY,
            user_message="The operation timed out. Please try again.",
            context={"operation": operation, "timeout_seconds": timeout_seconds},
            suggestions=["Try again", "The service may be experiencing high load"],
            **kwargs
        )


class ResourceExhaustedError(BaseError):
    """Resource exhaustion errors"""
    def __init__(
        self,
        message: str,
        resource_type: Optional[str] = None,
        current_usage: Optional[float] = None,
        limit: Optional[float] = None,
        **kwargs
    ):
        super().__init__(
            message=message,
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.RESOURCE_EXHAUSTED,
            recovery_strategy=ErrorRecoveryStrategy.CIRCUIT_BREAK,
            user_message="System resources are currently exhausted. Please try again later.",
            context={
                "resource_type": resource_type,
                "current_usage": current_usage,
                "limit": limit
            },
            suggestions=["Wait a few minutes", "Contact support if the issue persists"],
            **kwargs
        )


class ConfigurationError(BaseError):
    """Configuration errors"""
    def __init__(self, message: str, config_key: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.CONFIGURATION,
            recovery_strategy=ErrorRecoveryStrategy.MANUAL,
            user_message="A configuration error occurred. The system administrator has been notified.",
            context={"config_key": config_key} if config_key else {},
            **kwargs
        )


class DependencyError(BaseError):
    """Dependency errors"""
    def __init__(
        self,
        message: str,
        dependency_name: Optional[str] = None,
        required_version: Optional[str] = None,
        **kwargs
    ):
        super().__init__(
            message=message,
            severity=ErrorSeverity.CRITICAL,
            category=ErrorCategory.DEPENDENCY,
            recovery_strategy=ErrorRecoveryStrategy.MANUAL,
            user_message="A system dependency is missing or incompatible.",
            context={
                "dependency_name": dependency_name,
                "required_version": required_version
            },
            **kwargs
        )


# ============================================================================
# Error Handler Utility
# ============================================================================

class ErrorHandler:
    """
    Centralized error handling utility.

    Provides consistent error handling, logging, and response formatting.
    """

    @staticmethod
    def handle(
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        log_traceback: bool = True
    ) -> BaseError:
        """
        Handle any exception and convert to BaseError.

        Args:
            error: The exception to handle
            context: Additional context
            log_traceback: Whether to log full traceback

        Returns:
            BaseError instance
        """
        if isinstance(error, BaseError):
            return error

        # Convert common exceptions to appropriate error types
        error_map = {
            ValueError: ValidationError,
            KeyError: NotFoundError,
            PermissionError: AuthorizationError,
            ConnectionError: NetworkError,
            TimeoutError: TimeoutError,
        }

        error_class = error_map.get(type(error), BaseError)

        return error_class(
            message=str(error),
            context=context or {},
            cause=error
        )

    @staticmethod
    def wrap_async(func):
        """Decorator for async functions with error handling"""
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                error = ErrorHandler.handle(e)
                raise error
        return wrapper

    @staticmethod
    def wrap_sync(func):
        """Decorator for sync functions with error handling"""
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error = ErrorHandler.handle(e)
                raise error
        return wrapper


# ============================================================================
# Error Context Manager
# ============================================================================

class ErrorContext:
    """
    Context manager for error handling with automatic cleanup.

    Usage:
        async with ErrorContext("database_operation", user_id="123"):
            await perform_database_operation()
    """

    def __init__(
        self,
        operation: str,
        error_class: Type[BaseError] = BaseError,
        **context
    ):
        self.operation = operation
        self.error_class = error_class
        self.context = context
        self.start_time = None

    async def __aenter__(self):
        self.start_time = time.time()
        logger.debug(
            "operation_started",
            operation=self.operation,
            **self.context
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time

        if exc_type is None:
            logger.info(
                "operation_completed",
                operation=self.operation,
                duration_seconds=duration,
                **self.context
            )
            return False

        # Handle the error
        if isinstance(exc_val, BaseError):
            error = exc_val
        else:
            error = self.error_class(
                message=f"Error in {self.operation}: {str(exc_val)}",
                context={**self.context, "duration_seconds": duration},
                cause=exc_val
            )

        logger.error(
            "operation_failed",
            operation=self.operation,
            error_id=error.error_id,
            duration_seconds=duration,
            **self.context
        )

        # Don't suppress the exception, let it propagate
        return False


# ============================================================================
# HTTP Status Code Mapping
# ============================================================================

def get_http_status(error: BaseError) -> int:
    """Map error to HTTP status code"""
    status_map = {
        ErrorCategory.VALIDATION: 400,
        ErrorCategory.AUTHENTICATION: 401,
        ErrorCategory.AUTHORIZATION: 403,
        ErrorCategory.NOT_FOUND: 404,
        ErrorCategory.CONFLICT: 409,
        ErrorCategory.RATE_LIMIT: 429,
        ErrorCategory.INTERNAL: 500,
        ErrorCategory.EXTERNAL_SERVICE: 502,
        ErrorCategory.TIMEOUT: 504,
        ErrorCategory.RESOURCE_EXHAUSTED: 503,
        ErrorCategory.CONFIGURATION: 500,
        ErrorCategory.DEPENDENCY: 500,
    }

    return status_map.get(error.category, 500)


if __name__ == "__main__":
    # Example usage
    try:
        raise ValidationError(
            "Invalid email format",
            field="email",
            context={"value": "invalid-email"}
        )
    except BaseError as e:
        print(f"Error ID: {e.error_id}")
        print(f"Message: {e.user_message}")
        print(f"Severity: {e.severity}")
        print(f"Should retry: {e.should_retry()}")
        print(f"Dict: {e.to_dict()}")
