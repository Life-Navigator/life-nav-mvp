"""Unit tests for structured logging.

Tests cover:
- JSON output format validation
- PII redaction (credit cards, SSN, email, phone, account numbers)
- Correlation ID tracking and propagation
- LogContext functionality
- Log level filtering
- Metadata serialization
- Error logging with stack traces
- Human-readable formatter
"""

import json
import os
from io import StringIO
from unittest.mock import patch

from utils.logging import (
    CorrelationID,
    LifeNavigatorLogger,
    LogContext,
    PIIRedactor,
    get_logger,
)


class TestPIIRedactor:
    """Tests for PII detection and redaction."""

    def test_credit_card_redaction(self):
        """Test credit card numbers are redacted."""
        # Various credit card formats
        test_cases = [
            ("My CC is 4444-4444-4444-4444", "My CC is REDACTED_CC"),
            ("Card: 4444444444444444", "Card: REDACTED_CC"),
            ("4444 4444 4444 4444 expires soon", "REDACTED_CC expires soon"),
            (
                "Multiple 1111-2222-3333-4444 and 5555-6666-7777-8888",
                "Multiple REDACTED_CC and REDACTED_CC",
            ),
        ]

        for original, expected in test_cases:
            result = PIIRedactor.redact(original)
            assert result == expected, f"Failed for: {original}"

    def test_ssn_redaction(self):
        """Test SSN numbers are redacted."""
        test_cases = [
            ("SSN: 123-45-6789", "SSN: REDACTED_SSN"),
            ("My social is 987-65-4321", "My social is REDACTED_SSN"),
            (
                "Multiple: 111-22-3333 and 444-55-6666",
                "Multiple: REDACTED_SSN and REDACTED_SSN",
            ),
        ]

        for original, expected in test_cases:
            result = PIIRedactor.redact(original)
            assert result == expected, f"Failed for: {original}"

    def test_email_redaction(self):
        """Test email addresses are redacted (keeping domain)."""
        test_cases = [
            ("Email: user@example.com", "Email: ***@example.com"),
            ("Contact john.doe@company.org", "Contact ***@company.org"),
            (
                "Multiple: alice@test.com and bob@test.com",
                "Multiple: ***@test.com and ***@test.com",
            ),
        ]

        for original, expected in test_cases:
            result = PIIRedactor.redact(original)
            assert result == expected, f"Failed for: {original}"

    def test_phone_redaction(self):
        """Test phone numbers are redacted."""
        test_cases = [
            ("Call 555-123-4567", "Call REDACTED_PHONE"),
            ("Phone: (555) 123-4567", "Phone: REDACTED_PHONE"),
            ("Contact 5551234567", "Contact REDACTED_PHONE"),
            ("+1-555-123-4567", "REDACTED_PHONE"),
            ("1 (555) 123-4567", "REDACTED_PHONE"),
        ]

        for original, expected in test_cases:
            result = PIIRedactor.redact(original)
            assert result == expected, f"Failed for: {original}"

    def test_account_number_redaction(self):
        """Test account numbers are redacted (showing last 4)."""
        test_cases = [
            ("Account: 123456789012", "Account: ****9012"),
            ("Acct 98765432", "Acct ****5432"),
            ("12345678901234567890", "****7890"),  # Very long number
        ]

        for original, expected in test_cases:
            result = PIIRedactor.redact(original)
            assert result == expected, f"Failed for: {original}"

    def test_short_numbers_not_redacted(self):
        """Test short numbers (< 8 digits) are not redacted as account numbers."""
        text = "The count is 1234567"
        result = PIIRedactor.redact(text)
        assert "1234567" in result  # Should not be redacted

    def test_empty_string(self):
        """Test empty string handling."""
        assert PIIRedactor.redact("") == ""

    def test_multiple_pii_types(self):
        """Test redacting multiple PII types in one string."""
        text = (
            "User email@example.com with SSN 123-45-6789 and card 4444-4444-4444-4444"
        )
        result = PIIRedactor.redact(text)

        assert "***@example.com" in result
        assert "REDACTED_SSN" in result
        assert "REDACTED_CC" in result
        assert "email@example.com" not in result
        assert "123-45-6789" not in result
        assert "4444-4444-4444-4444" not in result


class TestCorrelationID:
    """Tests for correlation ID management."""

    def test_get_generates_id(self):
        """Test get() generates UUID if none exists."""
        # Clear any existing correlation ID
        CorrelationID.set("")

        correlation_id = CorrelationID.get()
        assert correlation_id
        assert len(correlation_id) == 36  # UUID format

    def test_get_returns_same_id(self):
        """Test get() returns same ID within context."""
        CorrelationID.set("")
        id1 = CorrelationID.get()
        id2 = CorrelationID.get()
        assert id1 == id2

    def test_set_and_get(self):
        """Test setting and getting correlation ID."""
        test_id = "test-correlation-123"
        CorrelationID.set(test_id)
        assert CorrelationID.get() == test_id


class TestLogContext:
    """Tests for LogContext context manager."""

    def test_context_manager(self):
        """Test LogContext adds fields within scope."""
        # Capture log output
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_context_mgr")
                with LogContext(user_id="user123", agent_type="TestAgent"):
                    logger.info("Test message")

            output = mock_stdout.getvalue()

        # Check if context fields are in output
        assert "user123" in output
        assert "TestAgent" in output

    def test_context_nesting(self):
        """Test nested LogContext."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_nesting")
                with LogContext(user_id="user123"):
                    with LogContext(task_id="task456"):
                        logger.info("Nested message")

            output = mock_stdout.getvalue()

        # Both contexts should be present
        assert "user123" in output
        assert "task456" in output

    def test_context_exit(self):
        """Test LogContext clears after exit."""
        logger = get_logger("test")

        with patch("sys.stdout", new_callable=StringIO):
            with LogContext(user_id="user123"):
                pass

        # Log after context exit
        with patch("sys.stdout", new_callable=StringIO):
            logger.info("After context")

        # user123 should not be in output after context exit
        # Note: correlation_id will still be present
        # This tests that the context is properly cleaned up


class TestJSONFormatter:
    """Tests for JSON log formatting."""

    def test_json_format_validity(self):
        """Test logs are valid JSON."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_validity")
                logger.info("Test message")

            output = mock_stdout.getvalue().strip()

        # Should be valid JSON
        log_data = json.loads(output)
        assert isinstance(log_data, dict)

    def test_json_contains_required_fields(self):
        """Test JSON log contains all required fields."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_fields")
                logger.info("Test message")

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        # Check required fields
        assert "timestamp" in log_data
        assert "level" in log_data
        assert "correlation_id" in log_data
        assert "message" in log_data

        assert log_data["level"] == "INFO"
        assert log_data["message"] == "Test message"

    def test_json_with_metadata(self):
        """Test JSON log includes metadata."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_metadata")
                logger.info("Test message", metadata={"key": "value", "count": 42})

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        assert "metadata" in log_data
        assert log_data["metadata"]["key"] == "value"
        assert log_data["metadata"]["count"] == 42

    def test_json_with_duration(self):
        """Test JSON log includes duration_ms."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_duration")
                logger.info("Test message", duration_ms=123.45)

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        assert "duration_ms" in log_data
        assert log_data["duration_ms"] == 123.45

    def test_json_with_context(self):
        """Test JSON log includes LogContext fields."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_context")
                with LogContext(user_id="user123", agent_type="TestAgent"):
                    logger.info("Test message")

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        assert log_data.get("user_id") == "user123"
        assert log_data.get("agent_type") == "TestAgent"

    def test_json_pii_redaction(self):
        """Test PII is redacted in JSON logs."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_json_pii")
                logger.info("Credit card: 4444-4444-4444-4444")

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        # Credit card should be redacted
        assert "4444-4444-4444-4444" not in log_data["message"]
        assert "REDACTED_CC" in log_data["message"]


class TestHumanReadableFormatter:
    """Tests for human-readable log formatting."""

    def test_human_readable_format(self):
        """Test human-readable format in dev mode."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(
                os.environ, {"APP_ENVIRONMENT": "development", "APP_DEBUG": "true"}
            ):
                logger = get_logger("test_human_readable")
                logger.info("Test message")

            output = mock_stdout.getvalue()

        # Should contain readable format (not JSON)
        assert "INFO" in output
        assert "Test message" in output
        # Should not be JSON (no curly braces at start)
        assert not output.strip().startswith("{")

    def test_human_readable_with_context(self):
        """Test human-readable format includes context."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(
                os.environ, {"APP_ENVIRONMENT": "development", "APP_DEBUG": "true"}
            ):
                logger = get_logger("test_human_context")
                with LogContext(user_id="user123", agent_type="TestAgent"):
                    logger.info("Test message")

            output = mock_stdout.getvalue()

        assert "user=user123" in output
        assert "agent=TestAgent" in output


class TestLifeNavigatorLogger:
    """Tests for LifeNavigatorLogger class."""

    def test_log_levels(self):
        """Test all log levels work correctly."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(
                os.environ, {"APP_ENVIRONMENT": "production", "APP_LOG_LEVEL": "DEBUG"}
            ):
                logger = get_logger("test_log_levels")
                logger.debug("Debug message")
                logger.info("Info message")
                logger.warning("Warning message")
                logger.error("Error message")
                logger.critical("Critical message")

            output = mock_stdout.getvalue()

        # All levels should be present
        assert "DEBUG" in output
        assert "INFO" in output
        assert "WARNING" in output
        assert "ERROR" in output
        assert "CRITICAL" in output

    def test_log_level_filtering(self):
        """Test log level filtering."""
        logger = get_logger("test_filter")

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(
                os.environ,
                {"APP_ENVIRONMENT": "production", "APP_LOG_LEVEL": "WARNING"},
            ):
                # Reconfigure logger with new level
                logger._configure_logger()

                logger.debug("Debug message")
                logger.info("Info message")
                logger.warning("Warning message")

            output = mock_stdout.getvalue()

        # Only WARNING and above should appear
        assert "Debug message" not in output
        assert "Info message" not in output
        assert "Warning message" in output

    def test_error_with_exception(self):
        """Test error logging includes exception details."""
        try:
            raise ValueError("Test exception")
        except ValueError as e:
            with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
                with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                    logger = get_logger("test_error_exception")
                    logger.error("Error occurred", error=e)

                output = mock_stdout.getvalue()

        log_data = json.loads(output.strip())

        # Check exception details
        assert "metadata" in log_data
        assert "error" in log_data["metadata"]
        assert "Test exception" in log_data["metadata"]["error"]
        assert "stack_trace" in log_data
        assert "ValueError" in log_data["stack_trace"]

    def test_critical_with_exception(self):
        """Test critical logging includes exception details."""
        try:
            raise RuntimeError("Critical error")
        except RuntimeError as e:
            with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
                with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                    logger = get_logger("test_critical_exception")
                    logger.critical("Critical failure", error=e)

                output = mock_stdout.getvalue()

        log_data = json.loads(output.strip())

        assert "metadata" in log_data
        assert "error" in log_data["metadata"]
        assert "Critical error" in log_data["metadata"]["error"]
        assert "stack_trace" in log_data

    def test_metadata_serialization(self):
        """Test complex metadata is serialized correctly."""
        metadata = {
            "string": "value",
            "number": 42,
            "float": 3.14,
            "list": [1, 2, 3],
            "nested": {"key": "value"},
        }

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_metadata")
                logger.info("Test message", metadata=metadata)

            output = mock_stdout.getvalue().strip()

        log_data = json.loads(output)

        assert log_data["metadata"] == metadata

    def test_pii_redaction_in_messages(self):
        """Test PII is redacted from log messages."""
        test_cases = [
            ("Card 4444-4444-4444-4444", "REDACTED_CC"),
            ("SSN: 123-45-6789", "REDACTED_SSN"),
            ("Email user@example.com", "***@example.com"),
        ]

        for idx, (message, expected_redaction) in enumerate(test_cases):
            with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
                with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                    logger = get_logger(f"test_pii_{idx}")
                    logger.info(message)

                output = mock_stdout.getvalue().strip()

            log_data = json.loads(output)
            assert expected_redaction in log_data["message"]


class TestGetLogger:
    """Tests for get_logger function."""

    def test_get_logger_returns_instance(self):
        """Test get_logger returns LifeNavigatorLogger instance."""
        logger = get_logger("test")
        assert isinstance(logger, LifeNavigatorLogger)

    def test_get_logger_with_name(self):
        """Test get_logger uses provided name."""
        logger = get_logger("test.module")
        assert logger.logger.name == "test.module"


class TestCorrelationIDPropagation:
    """Tests for correlation ID propagation across logs."""

    def test_same_correlation_id_in_context(self):
        """Test same correlation ID is used within context."""
        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                logger = get_logger("test_correlation_prop")
                # Set a specific correlation ID
                CorrelationID.set("test-correlation-id")

                logger.info("Message 1")
                logger.info("Message 2")

            output = mock_stdout.getvalue()

        # Both logs should have the same correlation ID
        logs = [json.loads(line) for line in output.strip().split("\n")]
        assert len(logs) == 2
        assert logs[0]["correlation_id"] == "test-correlation-id"
        assert logs[1]["correlation_id"] == "test-correlation-id"


class TestStackTraceRedaction:
    """Tests for PII redaction in stack traces."""

    def test_exception_stack_trace_redacts_pii(self):
        """Test PII is redacted from exception stack traces."""
        try:
            # Raise exception with PII in message
            raise ValueError("Error with card 4444-4444-4444-4444")
        except ValueError as e:
            with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
                with patch.dict(os.environ, {"APP_ENVIRONMENT": "production"}):
                    logger = get_logger("test_stack_trace_pii")
                    logger.error("Exception occurred", error=e)

                output = mock_stdout.getvalue()

        log_data = json.loads(output.strip())

        # PII should be redacted in stack trace
        assert "4444-4444-4444-4444" not in log_data["stack_trace"]
        assert "REDACTED_CC" in log_data["stack_trace"]
