"""
Structured logging configuration using structlog.
Provides JSON logging for production and pretty-printed logs for development.
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, Processor

from app.core.config import settings


# Sensitive headers that should be redacted from logs
REDACTED_HEADERS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-stripe-signature",
    "x-plaid-secret",
    "x-plaid-client-id",
    "x-twilio-signature",
    "proxy-authorization",
}


def redact_sensitive_data(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """
    Redact sensitive data from log events.

    Prevents accidental leakage of:
    - Authentication headers
    - API keys
    - Request bodies (which may contain PHI/PCI)
    - Sensitive header values
    """
    # Redact headers
    if "headers" in event_dict and isinstance(event_dict["headers"], dict):
        event_dict["headers"] = {
            k: "***REDACTED***" if k.lower() in REDACTED_HEADERS else v
            for k, v in event_dict["headers"].items()
        }

    # Never log request bodies on errors (might contain PHI/PCI)
    if "request_body" in event_dict:
        event_dict["request_body"] = "***REDACTED***"

    if "body" in event_dict:
        event_dict["body"] = "***REDACTED***"

    # Redact password fields
    if "password" in event_dict:
        event_dict["password"] = "***REDACTED***"

    return event_dict


def add_app_context(logger: Any, method_name: str, event_dict: EventDict) -> EventDict:
    """Add application context to log events."""
    event_dict["app"] = settings.PROJECT_NAME
    event_dict["environment"] = settings.ENVIRONMENT
    event_dict["version"] = settings.VERSION
    return event_dict


def configure_logging() -> None:
    """
    Configure structured logging for the application.
    Uses JSON format in production, pretty format in development.
    """
    # Determine log level
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Silence noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    # Determine processors based on environment
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        redact_sensitive_data,  # SECURITY: Redact sensitive data before logging
        add_app_context,
    ]

    if settings.is_production:
        # Production: JSON logs
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: Pretty console logs
        processors = shared_processors + [
            structlog.processors.ExceptionPrettyPrinter(),
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


# Create logger instance
logger = structlog.get_logger()


def get_logger(name: str | None = None) -> Any:
    """
    Get a logger instance.

    Args:
        name: Logger name (usually __name__ of the module)

    Returns:
        Bound logger instance
    """
    if name:
        return structlog.get_logger(name)
    return logger
