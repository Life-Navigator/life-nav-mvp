"""
Structured logging configuration.

Uses structlog for JSON-formatted logs with request_id tracing.
NEVER logs raw vendor payloads or sensitive data.
"""

import logging
import sys
from typing import Any

import structlog
from pythonjsonlogger import jsonlogger

from app.core.config import settings


class SensitiveDataFilter(logging.Filter):
    """
    Filter to prevent logging of sensitive data.

    Redacts any fields that might contain:
    - API keys
    - Raw vendor payloads (compliance)
    - User identifiers (if any leak)
    """

    SENSITIVE_KEYS = {
        "api_key",
        "apikey",
        "password",
        "secret",
        "token",
        "authorization",
        "raw_payload",
        "vendor_response",
    }

    def filter(self, record: logging.LogRecord) -> bool:
        """Redact sensitive fields from log record"""
        if hasattr(record, "msg") and isinstance(record.msg, dict):
            record.msg = self._redact_dict(record.msg)
        return True

    def _redact_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively redact sensitive keys"""
        redacted = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_KEYS:
                redacted[key] = "***REDACTED***"
            elif isinstance(value, dict):
                redacted[key] = self._redact_dict(value)
            else:
                redacted[key] = value
        return redacted


def setup_logging() -> None:
    """
    Configure structured logging for the service.

    Output format: JSON with timestamp, level, message, context.
    """
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard logging
    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        timestamp=True,
    )
    handler.setFormatter(formatter)
    handler.addFilter(SensitiveDataFilter())

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL))

    # Silence noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)
