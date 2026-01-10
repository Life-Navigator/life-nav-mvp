"""
Data Boundary Enforcement Middleware.

Blocks requests containing forbidden PHI/PCI fields at the gateway level.
Ensures only derived numeric features cross service boundaries.
"""

import re
import json
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger()

# ===========================================================================
# FORBIDDEN FIELDS - PHI/PCI Data
# ===========================================================================
# These fields must NEVER be sent to downstream services (risk-engine, agents)
# Only derived numeric features are allowed across boundaries

FORBIDDEN_FIELD_NAMES = {
    # PHI (Health Information)
    "ssn",
    "social_security_number",
    "diagnosis",
    "diagnoses",
    "medical_diagnosis",
    "condition",
    "medical_condition",
    "health_condition",
    "medication",
    "medications",
    "prescription",
    "prescriptions",
    "treatment",
    "treatments",
    "doctor_name",
    "physician_name",
    "provider_name",
    "medical_record_number",
    "mrn",
    "health_insurance",
    "insurance_id",
    # PCI (Financial Information)
    "credit_card",
    "credit_card_number",
    "card_number",
    "cvv",
    "cvc",
    "card_verification",
    "account_number",
    "routing_number",
    "bank_account",
    "bank_account_number",
    "iban",
    "swift",
    "swift_code",
    # PII (Additional Sensitive)
    "passport",
    "passport_number",
    "drivers_license",
    "license_number",
    "date_of_birth",
    "dob",
}

# Regex patterns for detecting sensitive data in text
FORBIDDEN_PATTERNS = [
    # SSN patterns
    (r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b", "SSN"),
    # Credit card patterns (basic)
    (r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", "credit_card"),
    # Account numbers (8-17 digits)
    (r"\baccount[_\s]?number[:\s]+\d{8,17}\b", "account_number"),
    # Routing numbers (9 digits)
    (r"\brouting[_\s]?number[:\s]+\d{9}\b", "routing_number"),
]


class DataBoundaryViolationError(Exception):
    """Raised when a request violates data boundary rules."""

    pass


async def data_boundary_validator_middleware(
    request: Request,
    call_next: Callable,
) -> Response:
    """
    Middleware to enforce data boundary rules.

    Validates request bodies for:
    1. Forbidden field names (ssn, diagnosis, medications, etc.)
    2. Forbidden patterns (SSN-like, CC-like strings)

    Args:
        request: FastAPI request
        call_next: Next middleware/handler

    Returns:
        Response (or 400 if boundary violation detected)
    """
    # Only validate routes that proxy to internal services
    path = request.url.path

    # Routes to validate
    internal_service_routes = [
        "/api/v1/internal/risk-engine",
        "/api/v1/internal/agents",
        "/api/v1/risk",  # Public risk endpoint
    ]

    should_validate = any(path.startswith(route) for route in internal_service_routes)

    if not should_validate:
        # Skip validation for non-internal routes
        return await call_next(request)

    # Get request body (if exists)
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            body_bytes = await request.body()

            if not body_bytes:
                # No body to validate
                return await call_next(request)

            # Try to parse as JSON
            try:
                body_json = json.loads(body_bytes)
                body_str = json.dumps(body_json, indent=None)
            except json.JSONDecodeError:
                # Not JSON, treat as plain text
                body_str = body_bytes.decode("utf-8", errors="ignore")

            # Validate
            violation = _check_boundary_violation(body_json if isinstance(body_json, dict) else {}, body_str)

            if violation:
                logger.error(
                    "data_boundary_violation",
                    path=path,
                    method=request.method,
                    violation_type=violation["type"],
                    violation_field=violation.get("field"),
                    user_id=request.headers.get("x-user-id", "unknown"),
                )

                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "error": "data_boundary_violation",
                        "message": "Request contains forbidden sensitive data fields",
                        "detail": f"Field '{violation.get('field')}' is not allowed across service boundaries",
                        "allowed": "Only derived numeric features are permitted (e.g., age, bmi, chronic_conditions_count)",
                    },
                )

            # Reconstruct request with body
            # FastAPI allows re-reading body via custom middleware
            async def receive():
                return {"type": "http.request", "body": body_bytes}

            request._receive = receive

        except Exception as e:
            logger.error(
                "data_boundary_validation_error",
                error=str(e),
                path=path,
            )
            # On validation error, reject request for safety
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "error": "validation_error",
                    "message": "Could not validate request data boundaries",
                },
            )

    # Pass through
    return await call_next(request)


def _check_boundary_violation(data: dict, body_str: str) -> dict | None:
    """
    Check if data violates boundary rules.

    Args:
        data: Parsed JSON body
        body_str: String representation of body

    Returns:
        Violation dict if found, None otherwise
    """
    # Check 1: Forbidden field names
    violation = _check_forbidden_fields(data)
    if violation:
        return violation

    # Check 2: Forbidden patterns in text
    violation = _check_forbidden_patterns(body_str)
    if violation:
        return violation

    return None


def _check_forbidden_fields(data: dict, path: str = "") -> dict | None:
    """
    Recursively check for forbidden field names.

    Args:
        data: Dict to check
        path: Current path (for nested objects)

    Returns:
        Violation dict if found, None otherwise
    """
    if not isinstance(data, dict):
        return None

    for key, value in data.items():
        current_path = f"{path}.{key}" if path else key

        # Check if key is forbidden
        if key.lower() in FORBIDDEN_FIELD_NAMES:
            return {
                "type": "forbidden_field",
                "field": current_path,
                "key": key,
            }

        # Recursively check nested dicts
        if isinstance(value, dict):
            nested_violation = _check_forbidden_fields(value, current_path)
            if nested_violation:
                return nested_violation

        # Check lists of dicts
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    nested_violation = _check_forbidden_fields(item, f"{current_path}[{i}]")
                    if nested_violation:
                        return nested_violation

    return None


def _check_forbidden_patterns(text: str) -> dict | None:
    """
    Check for forbidden patterns (SSN, credit card, etc.) in text.

    Args:
        text: Text to check

    Returns:
        Violation dict if found, None otherwise
    """
    for pattern, pattern_name in FORBIDDEN_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return {
                "type": "forbidden_pattern",
                "pattern": pattern_name,
                "field": f"text_content({pattern_name})",
            }

    return None
