"""
Enterprise-Grade Error Middleware for FastAPI

Provides centralized error handling for FastAPI applications:
- Exception handlers for all error types
- Request/response logging
- Error tracking and monitoring
- Graceful error responses
- Integration with DLQ and alerting
"""

from typing import Optional, Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
import time
import structlog
import traceback

from utils.errors import (
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    DatabaseError,
    NetworkError,
    TimeoutError,
    ResourceExhaustedError,
    ConfigurationError,
    ErrorSeverity,
    get_http_status
)
from utils.dead_letter_queue import add_to_dlq

logger = structlog.get_logger(__name__)


# ============================================================================
# Error Response Formatter
# ============================================================================

def format_error_response(
    error: BaseError,
    request_id: Optional[str] = None,
    include_debug: bool = False
) -> dict:
    """
    Format error for API response.

    Args:
        error: BaseError instance
        request_id: Request ID for tracing
        include_debug: Include debug information

    Returns:
        Error response dictionary
    """
    response = {
        "error": {
            "id": error.error_id,
            "code": error.error_code,
            "message": error.user_message,
            "severity": error.severity.value,
            "category": error.category.value,
            "timestamp": error.timestamp,
        }
    }

    # Add request ID if available
    if request_id:
        response["error"]["request_id"] = request_id

    # Add retry info if applicable
    if error.retry_after:
        response["error"]["retry_after"] = error.retry_after

    # Add suggestions if available
    if error.suggestions:
        response["error"]["suggestions"] = error.suggestions

    # Add debug info in development
    if include_debug:
        response["error"]["debug"] = {
            "message": error.message,
            "context": error.context,
            "stack_trace": error.stack_trace,
            "cause": str(error.cause) if error.cause else None
        }

    return response


# ============================================================================
# Error Tracking Middleware
# ============================================================================

class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for error tracking and logging.

    Tracks:
    - Request/response timing
    - Error rates
    - Request metadata
    """

    def __init__(
        self,
        app,
        include_debug: bool = False,
        track_to_dlq: bool = True
    ):
        super().__init__(app)
        self.include_debug = include_debug
        self.track_to_dlq = track_to_dlq

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and track errors"""
        request_id = request.headers.get("X-Request-ID", f"req_{time.time()}")
        start_time = time.time()

        # Add request ID to request state
        request.state.request_id = request_id

        # Log request
        logger.info(
            "request_started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else None
        )

        try:
            # Process request
            response = await call_next(request)

            # Log response
            duration = time.time() - start_time
            logger.info(
                "request_completed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_seconds=duration
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            # Log error
            duration = time.time() - start_time
            logger.error(
                "request_failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error_type=type(e).__name__,
                error_message=str(e),
                duration_seconds=duration
            )

            # Track critical errors to DLQ
            if self.track_to_dlq and isinstance(e, BaseError):
                if e.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.FATAL]:
                    await add_to_dlq(
                        job_name=f"request_{request.method}_{request.url.path}",
                        payload={
                            "method": request.method,
                            "path": str(request.url.path),
                            "headers": dict(request.headers),
                            "client": request.client.host if request.client else None
                        },
                        error=e,
                        metadata={"request_id": request_id}
                    )

            # Re-raise to be handled by exception handlers
            raise


# ============================================================================
# Exception Handlers
# ============================================================================

async def base_error_handler(request: Request, exc: BaseError) -> JSONResponse:
    """
    Handle BaseError exceptions.

    Args:
        request: FastAPI request
        exc: BaseError instance

    Returns:
        JSON error response
    """
    request_id = getattr(request.state, "request_id", None)
    status_code = get_http_status(exc)

    # Check if we should include debug info
    include_debug = request.query_params.get("debug") == "true"

    response_data = format_error_response(exc, request_id, include_debug)

    return JSONResponse(
        status_code=status_code,
        content=response_data,
        headers={"X-Request-ID": request_id} if request_id else {}
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic validation errors.

    Args:
        request: FastAPI request
        exc: RequestValidationError

    Returns:
        JSON error response
    """
    request_id = getattr(request.state, "request_id", None)

    # Convert to ValidationError
    validation_error = ValidationError(
        message="Request validation failed",
        context={
            "errors": exc.errors(),
            "body": exc.body
        },
        user_message="Invalid request data. Please check your input."
    )

    response_data = format_error_response(validation_error, request_id, include_debug=False)

    return JSONResponse(
        status_code=400,
        content=response_data,
        headers={"X-Request-ID": request_id} if request_id else {}
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle Starlette HTTP exceptions.

    Args:
        request: FastAPI request
        exc: StarletteHTTPException

    Returns:
        JSON error response
    """
    request_id = getattr(request.state, "request_id", None)

    # Map to appropriate BaseError
    error_map = {
        401: AuthenticationError,
        403: AuthorizationError,
        404: NotFoundError,
        409: ConflictError,
        429: RateLimitError,
    }

    error_class = error_map.get(exc.status_code, BaseError)
    error = error_class(message=str(exc.detail))

    response_data = format_error_response(error, request_id, include_debug=False)

    return JSONResponse(
        status_code=exc.status_code,
        content=response_data,
        headers={"X-Request-ID": request_id} if request_id else {}
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle all other exceptions.

    Args:
        request: FastAPI request
        exc: Exception

    Returns:
        JSON error response
    """
    request_id = getattr(request.state, "request_id", None)

    # Convert to BaseError
    error = BaseError(
        message=str(exc),
        user_message="An internal server error occurred. Our team has been notified.",
        severity=ErrorSeverity.ERROR,
        context={
            "exception_type": type(exc).__name__,
            "traceback": traceback.format_exc()
        }
    )

    logger.error(
        "unhandled_exception",
        request_id=request_id,
        error_type=type(exc).__name__,
        error_message=str(exc),
        traceback=traceback.format_exc()
    )

    response_data = format_error_response(error, request_id, include_debug=False)

    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_data,
        headers={"X-Request-ID": request_id} if request_id else {}
    )


# ============================================================================
# FastAPI Setup
# ============================================================================

def setup_error_handling(
    app: FastAPI,
    include_debug: bool = False,
    track_to_dlq: bool = True
):
    """
    Setup error handling for FastAPI application.

    Args:
        app: FastAPI application
        include_debug: Include debug info in responses
        track_to_dlq: Track critical errors to DLQ

    Example:
        from fastapi import FastAPI
        from core.error_middleware import setup_error_handling

        app = FastAPI()
        setup_error_handling(app, include_debug=True)
    """

    # Add middleware
    app.add_middleware(
        ErrorTrackingMiddleware,
        include_debug=include_debug,
        track_to_dlq=track_to_dlq
    )

    # Register exception handlers
    app.add_exception_handler(BaseError, base_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

    # Add specific error type handlers
    app.add_exception_handler(ValidationError, base_error_handler)
    app.add_exception_handler(AuthenticationError, base_error_handler)
    app.add_exception_handler(AuthorizationError, base_error_handler)
    app.add_exception_handler(NotFoundError, base_error_handler)
    app.add_exception_handler(ConflictError, base_error_handler)
    app.add_exception_handler(RateLimitError, base_error_handler)
    app.add_exception_handler(ExternalServiceError, base_error_handler)
    app.add_exception_handler(DatabaseError, base_error_handler)
    app.add_exception_handler(NetworkError, base_error_handler)
    app.add_exception_handler(TimeoutError, base_error_handler)
    app.add_exception_handler(ResourceExhaustedError, base_error_handler)
    app.add_exception_handler(ConfigurationError, base_error_handler)

    logger.info(
        "error_handling_configured",
        include_debug=include_debug,
        track_to_dlq=track_to_dlq
    )


# ============================================================================
# Health Check Endpoint
# ============================================================================

def add_health_endpoints(app: FastAPI):
    """
    Add health check endpoints.

    Args:
        app: FastAPI application
    """

    @app.get("/health")
    async def health_check():
        """Basic health check"""
        return {
            "status": "healthy",
            "timestamp": time.time()
        }

    @app.get("/health/ready")
    async def readiness_check():
        """Readiness check (includes dependencies)"""
        # TODO: Add dependency checks (database, cache, etc.)
        return {
            "status": "ready",
            "timestamp": time.time()
        }

    @app.get("/health/live")
    async def liveness_check():
        """Liveness check (basic alive check)"""
        return {
            "status": "alive",
            "timestamp": time.time()
        }


# ============================================================================
# Error Monitoring Endpoints
# ============================================================================

def add_monitoring_endpoints(app: FastAPI):
    """
    Add error monitoring endpoints.

    Args:
        app: FastAPI application
    """
    from utils.retry import get_retry_stats
    from utils.circuit_breaker import circuit_breaker_manager
    from utils.dead_letter_queue import get_dlq_stats

    @app.get("/monitoring/errors")
    async def get_error_stats():
        """Get error statistics"""
        return {
            "retry": get_retry_stats(),
            "circuit_breakers": circuit_breaker_manager.get_all_stats(),
            "dlq": get_dlq_stats()
        }

    @app.get("/monitoring/circuit-breakers")
    async def get_circuit_breaker_stats():
        """Get circuit breaker statistics"""
        return circuit_breaker_manager.get_all_stats()

    @app.get("/monitoring/dlq")
    async def get_dlq_statistics():
        """Get dead letter queue statistics"""
        return get_dlq_stats()


if __name__ == "__main__":
    # Example usage
    from fastapi import FastAPI

    app = FastAPI(title="Error Handling Example")

    # Setup error handling
    setup_error_handling(app, include_debug=True)

    # Add health endpoints
    add_health_endpoints(app)

    # Add monitoring endpoints
    add_monitoring_endpoints(app)

    # Example endpoint that raises error
    @app.get("/test/error")
    async def test_error():
        raise ValidationError("Test validation error", field="test_field")

    @app.get("/test/not-found")
    async def test_not_found():
        raise NotFoundError("Resource not found", resource_type="test", resource_id="123")

    print("Example app configured with error handling")
    print("Run with: uvicorn error_middleware:app --reload")
