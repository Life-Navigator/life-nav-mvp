"""Structured logging for Life Navigator Agents.

This module provides JSON-based structured logging with PII redaction,
correlation ID tracking, and context management for multi-tenant environments.

Example usage:
    >>> from utils.logging import get_logger, LogContext
    >>> logger = get_logger(__name__)
    >>> with LogContext(user_id="123", agent_type="BudgetSpecialist"):
    ...     logger.info("Processing task", metadata={"task_id": "456"})
"""

import contextvars
import json
import logging
import re
import sys
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any

from utils.config import Config

# Context variables for correlation tracking
_correlation_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "correlation_id", default=None
)
_log_context_var: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar(
    "log_context", default={}
)


class PIIRedactor:
    """Detects and redacts personally identifiable information (PII) from logs.

    This class uses regex patterns to identify and mask sensitive information
    including credit cards, SSNs, emails, phone numbers, and account numbers.
    """

    # Regex patterns for PII detection
    CREDIT_CARD_PATTERN = re.compile(
        r"\b(?:\d{4}[-\s]?){3}\d{4}\b"  # 4444-4444-4444-4444 or 4444444444444444
    )
    SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")  # 123-45-6789
    EMAIL_PATTERN = re.compile(
        r"\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b"
    )
    PHONE_PATTERN = re.compile(
        r"(?<!\d)(?:\+?1[-.\s]?)?(?:\(\d{3}\)\s*|\d{3}[-.\s])\d{3}[-.\s]?\d{4}\b|(?<!\d)\d{10}\b"
    )
    # 8-9 or 11+ digits (exclude 10-digit phone numbers)
    ACCOUNT_NUMBER_PATTERN = re.compile(r"\b(?:\d{8,9}|\d{11,})\b")

    @classmethod
    def redact(cls, text: str) -> str:
        """Redact PII from text.

        Args:
            text: Text that may contain PII.

        Returns:
            Text with PII redacted.
        """
        if not text:
            return text

        # Redact credit cards
        text = cls.CREDIT_CARD_PATTERN.sub("REDACTED_CC", text)

        # Redact SSNs
        text = cls.SSN_PATTERN.sub("REDACTED_SSN", text)

        # Redact emails (keep domain)
        text = cls.EMAIL_PATTERN.sub(r"***@\2", text)

        # Redact account numbers first (show last 4 digits) - before phone to avoid conflicts
        def redact_account(match: re.Match[str]) -> str:
            number = match.group(0)
            if len(number) >= 8:
                return f"****{number[-4:]}"
            return number

        text = cls.ACCOUNT_NUMBER_PATTERN.sub(redact_account, text)

        # Redact phone numbers (after account numbers to avoid conflicts)
        text = cls.PHONE_PATTERN.sub("REDACTED_PHONE", text)

        return text


class CorrelationID:
    """Manages correlation IDs for request tracking across agents."""

    @staticmethod
    def get() -> str:
        """Get current correlation ID or generate a new one.

        Returns:
            Current correlation ID or newly generated UUID.
        """
        correlation_id = _correlation_id_var.get()
        if correlation_id is None or correlation_id == "":
            correlation_id = str(uuid.uuid4())
            _correlation_id_var.set(correlation_id)
        return correlation_id

    @staticmethod
    def set(correlation_id: str) -> None:
        """Set correlation ID for current context.

        Args:
            correlation_id: Correlation ID to set.
        """
        _correlation_id_var.set(correlation_id)


class LogContext:
    """Context manager for adding scoped context to logs.

    This adds fields to all log messages within the context scope.

    Example:
        >>> with LogContext(user_id="123", agent_type="BudgetSpecialist"):
        ...     logger.info("Processing")  # Includes user_id and agent_type
    """

    def __init__(self, **kwargs: Any) -> None:
        """Initialize log context.

        Args:
            **kwargs: Context fields to add to logs.
        """
        self.context = kwargs
        self.token: contextvars.Token[dict[str, Any]] | None = None

    def __enter__(self) -> "LogContext":
        """Enter context and set context variables."""
        current_context = _log_context_var.get().copy()
        current_context.update(self.context)
        self.token = _log_context_var.set(current_context)
        return self

    def __exit__(self, *args: Any) -> None:
        """Exit context and reset context variables."""
        if self.token is not None:
            _log_context_var.reset(self.token)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging.

    Formats log records as JSON objects with standardized fields.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON.

        Args:
            record: Log record to format.

        Returns:
            JSON-formatted log string.
        """
        # Base log structure
        log_data: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "correlation_id": CorrelationID.get(),
            "message": PIIRedactor.redact(record.getMessage()),
        }

        # Add context fields
        context = _log_context_var.get()
        log_data.update(context)

        # Add extra fields from record
        if hasattr(record, "metadata") and getattr(record, "metadata", None):
            log_data["metadata"] = getattr(record, "metadata")

        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = getattr(record, "duration_ms")

        # Add stack trace for errors
        if record.exc_info:
            log_data["stack_trace"] = self._format_exception(record.exc_info)

        # Add source location in debug mode
        config = Config.get()
        if config.app.debug:
            log_data["source"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }

        return json.dumps(log_data)

    def _format_exception(self, exc_info: Any) -> str:
        """Format exception information.

        Args:
            exc_info: Exception info tuple.

        Returns:
            Formatted exception string.
        """
        return PIIRedactor.redact("".join(traceback.format_exception(*exc_info)))


class HumanReadableFormatter(logging.Formatter):
    """Human-readable formatter for development.

    Formats logs in a more readable format for local development.
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record for human reading.

        Args:
            record: Log record to format.

        Returns:
            Human-readable log string.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        level = record.levelname
        message = PIIRedactor.redact(record.getMessage())

        # Build context string
        context = _log_context_var.get()
        context_parts = []
        if "user_id" in context:
            context_parts.append(f"user={context['user_id']}")
        if "agent_type" in context:
            context_parts.append(f"agent={context['agent_type']}")
        if "task_id" in context:
            context_parts.append(f"task={context['task_id']}")

        context_str = f" [{', '.join(context_parts)}]" if context_parts else ""

        # Base message
        log_line = f"{timestamp} | {level:8s} | {message}{context_str}"

        # Add metadata if present
        if hasattr(record, "metadata") and getattr(record, "metadata", None):
            log_line += f" | {getattr(record, 'metadata')}"

        # Add stack trace for errors
        if record.exc_info:
            exc_text = self._format_exception(record.exc_info)
            log_line += f"\n{exc_text}"

        return log_line

    def _format_exception(self, exc_info: Any) -> str:
        """Format exception information.

        Args:
            exc_info: Exception info tuple.

        Returns:
            Formatted exception string.
        """
        return PIIRedactor.redact("".join(traceback.format_exception(*exc_info)))


class LifeNavigatorLogger:
    """Main logger class for Life Navigator Agents.

    Provides structured logging with automatic PII redaction and context tracking.
    """

    def __init__(self, name: str) -> None:
        """Initialize logger.

        Args:
            name: Logger name (typically __name__).
        """
        self.logger = logging.getLogger(name)
        self._configure_logger()

    def _configure_logger(self) -> None:
        """Configure logger with appropriate handlers and formatters."""
        # Clear config cache to pick up environment changes
        Config.get.cache_clear()
        config = Config.get()

        # Set log level
        self.logger.setLevel(getattr(logging, config.app.log_level))

        # Remove existing handlers
        self.logger.handlers.clear()

        # Add stdout handler
        handler = logging.StreamHandler(sys.stdout)

        # Use JSON formatter in production, human-readable in dev
        if config.app.environment == "production":
            formatter: logging.Formatter = JSONFormatter()
        else:
            formatter = (
                HumanReadableFormatter() if config.app.debug else JSONFormatter()
            )

        handler.setFormatter(formatter)
        self.logger.addHandler(handler)

        # Prevent propagation to root logger
        self.logger.propagate = False

    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message.

        Args:
            message: Log message.
            **kwargs: Additional fields (metadata, duration_ms, etc.).
        """
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message.

        Args:
            message: Log message.
            **kwargs: Additional fields (metadata, duration_ms, etc.).
        """
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message.

        Args:
            message: Log message.
            **kwargs: Additional fields (metadata, duration_ms, etc.).
        """
        self._log(logging.WARNING, message, **kwargs)

    def error(
        self, message: str, error: Exception | None = None, **kwargs: Any
    ) -> None:
        """Log error message.

        Args:
            message: Log message.
            error: Exception object (optional).
            **kwargs: Additional fields (metadata, duration_ms, etc.).
        """
        if error:
            kwargs["error"] = str(error)
            exc_info = (type(error), error, error.__traceback__)
        else:
            exc_info = None

        self._log(logging.ERROR, message, exc_info=exc_info, **kwargs)

    def critical(
        self, message: str, error: Exception | None = None, **kwargs: Any
    ) -> None:
        """Log critical message.

        Args:
            message: Log message.
            error: Exception object (optional).
            **kwargs: Additional fields (metadata, duration_ms, etc.).
        """
        if error:
            kwargs["error"] = str(error)
            exc_info = (type(error), error, error.__traceback__)
        else:
            exc_info = None

        self._log(logging.CRITICAL, message, exc_info=exc_info, **kwargs)

    def _log(
        self,
        level: int,
        message: str,
        exc_info: Any = None,
        **kwargs: Any,
    ) -> None:
        """Internal logging method.

        Args:
            level: Log level.
            message: Log message.
            exc_info: Exception info tuple.
            **kwargs: Additional fields.
        """
        # Extract special fields
        metadata = kwargs.pop("metadata", None)
        duration_ms = kwargs.pop("duration_ms", None)

        # Create log record with extra fields
        extra: dict[str, Any] = {}
        if metadata:
            extra["metadata"] = metadata
        if duration_ms is not None:
            extra["duration_ms"] = duration_ms

        # Add any remaining kwargs to metadata
        if kwargs:
            if "metadata" not in extra:
                extra["metadata"] = {}
            extra["metadata"].update(kwargs)

        # Log with extra fields
        self.logger.log(level, message, exc_info=exc_info, extra=extra)


def get_logger(name: str) -> LifeNavigatorLogger:
    """Get a logger instance.

    Args:
        name: Logger name (typically __name__).

    Returns:
        Configured LifeNavigatorLogger instance.
    """
    return LifeNavigatorLogger(name)


# Capture Python warnings as log messages
logging.captureWarnings(True)
warnings_logger = logging.getLogger("py.warnings")
warnings_logger.addHandler(logging.StreamHandler(sys.stdout))
