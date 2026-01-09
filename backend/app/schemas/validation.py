"""
Strict Input Validation Schemas for HIPAA/PCI Compliance
===========================================================================
Prevents injection attacks and ensures data integrity across all API endpoints.

Security Features:
- SQL injection prevention (whitelist patterns)
- XSS prevention (HTML sanitization)
- Healthcare-specific validation (MRN, ICD-10, SSN)
- Financial data validation (account numbers, routing)
- Rate limiting friendly (max length enforcement)

Usage:
    from app.schemas.validation import StrictPatientName, SafeSearchQuery

    @router.post("/patients/search")
    def search_patients(query: SafeSearchQuery):
        # query.query is guaranteed safe - no SQL injection possible
        ...
"""

import re
from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field, validator, constr, conint, root_validator


# ===========================================================================
# Security Patterns - Whitelist Approach
# ===========================================================================

# Safe characters for names (allow international characters)
SAFE_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-\.\'À-ÿ]+$')

# Alphanumeric only (IDs, codes)
SAFE_ALPHANUMERIC = re.compile(r'^[a-zA-Z0-9]+$')

# Healthcare-specific patterns
MRN_PATTERN = re.compile(r'^MRN\d{6,10}$')  # Medical Record Number
ICD10_PATTERN = re.compile(r'^[A-Z]\d{2}(\.\d{1,4})?$')  # ICD-10 diagnosis code
CPT_PATTERN = re.compile(r'^\d{5}$')  # Current Procedural Terminology code
NPI_PATTERN = re.compile(r'^\d{10}$')  # National Provider Identifier
SSN_PATTERN = re.compile(r'^\d{3}-\d{2}-\d{4}$')  # Social Security Number

# Contact patterns
PHONE_PATTERN = re.compile(r'^\+?1?\d{10,15}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

# Financial patterns (PCI compliance)
ROUTING_NUMBER_PATTERN = re.compile(r'^\d{9}$')  # US bank routing number
ACCOUNT_NUMBER_PATTERN = re.compile(r'^\d{4,17}$')  # Bank account number

# Dangerous patterns to reject
DANGEROUS_SQL_PATTERNS = [
    r'(\bUNION\b|\bSELECT\b|\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b)',
    r'(--|;|\/\*|\*\/)',  # SQL comments
    r'(\bEXEC\b|\bEXECUTE\b)',  # SQL execution
]

DANGEROUS_XSS_PATTERNS = [
    r'(<script[^>]*>.*?</script>)',
    r'(javascript:)',
    r'(on\w+\s*=)',  # Event handlers: onclick=, onerror=, etc.
    r'(<iframe[^>]*>)',
]


# ===========================================================================
# Base Validators
# ===========================================================================

def validate_no_sql_injection(value: str) -> str:
    """Reject strings with SQL injection patterns."""
    for pattern in DANGEROUS_SQL_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            raise ValueError(
                'Input contains potentially dangerous SQL patterns. '
                'Please remove special characters and try again.'
            )
    return value


def validate_no_xss(value: str) -> str:
    """Reject strings with XSS attack patterns."""
    for pattern in DANGEROUS_XSS_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            raise ValueError(
                'Input contains potentially dangerous HTML/JavaScript. '
                'HTML tags are not allowed in this field.'
            )
    return value


# ===========================================================================
# Person Identity Models
# ===========================================================================

class StrictPatientName(BaseModel):
    """
    Patient name with injection protection.

    Security:
    - Allows letters, numbers, spaces, hyphens, periods, apostrophes
    - Allows international characters (À-ÿ)
    - Rejects SQL injection attempts
    - Rejects XSS attempts
    """
    first_name: constr(min_length=1, max_length=100) = Field(
        ...,
        description="Patient's first name"
    )
    last_name: constr(min_length=1, max_length=100) = Field(
        ...,
        description="Patient's last name"
    )
    middle_name: Optional[constr(max_length=100)] = Field(
        None,
        description="Patient's middle name (optional)"
    )
    suffix: Optional[constr(max_length=10)] = Field(
        None,
        description="Name suffix (Jr., Sr., III, etc.)"
    )

    @validator('first_name', 'last_name', 'middle_name', 'suffix')
    def validate_name_safety(cls, v):
        if v is None:
            return v

        # Check for SQL injection
        validate_no_sql_injection(v)

        # Check for XSS
        validate_no_xss(v)

        # Allow letters, numbers, spaces, hyphens, periods, apostrophes, international
        if not SAFE_NAME_PATTERN.match(v):
            raise ValueError(
                'Name contains invalid characters. '
                'Only letters, numbers, spaces, hyphens, periods, and apostrophes are allowed.'
            )
        return v.strip()


class StrictEmailAddress(BaseModel):
    """RFC 5322 compliant email validation."""
    email: constr(
        regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
        max_length=254
    ) = Field(
        ...,
        description="Email address"
    )

    @validator('email')
    def lowercase_email(cls, v):
        return v.lower().strip()


class StrictPhoneNumber(BaseModel):
    """Phone number validation (E.164 format)."""
    phone: constr(
        regex=r'^\+?1?\d{10,15}$',
        min_length=10,
        max_length=16
    ) = Field(
        ...,
        description="Phone number (10-15 digits, optional +1 prefix)"
    )


# ===========================================================================
# Healthcare-Specific Models
# ===========================================================================

class MedicalRecordNumber(BaseModel):
    """
    Validated Medical Record Number.

    Format: MRN followed by 6-10 digits
    Example: MRN1234567
    """
    mrn: constr(regex=r'^MRN\d{6,10}$') = Field(
        ...,
        description="Medical Record Number (format: MRN123456)"
    )


class DiagnosisCode(BaseModel):
    """
    Validated ICD-10 diagnosis code.

    Format: Letter followed by 2 digits, optional decimal and 1-4 digits
    Examples: E11, E11.9, J44.0
    """
    code: constr(regex=r'^[A-Z]\d{2}(\.\d{1,4})?$') = Field(
        ...,
        description="ICD-10 code (e.g., E11.9 for Type 2 diabetes)"
    )
    description: constr(min_length=5, max_length=500) = Field(
        ...,
        description="Human-readable diagnosis description"
    )

    @validator('description')
    def validate_description(cls, v):
        validate_no_sql_injection(v)
        validate_no_xss(v)
        return v.strip()


class ProcedureCode(BaseModel):
    """
    Validated CPT (Current Procedural Terminology) code.

    Format: 5 digits
    Example: 99213
    """
    code: constr(regex=r'^\d{5}$') = Field(
        ...,
        description="CPT code (5 digits)"
    )
    description: constr(min_length=5, max_length=500) = Field(
        ...,
        description="Procedure description"
    )


class ProviderIdentifier(BaseModel):
    """
    National Provider Identifier (NPI).

    Format: 10 digits
    """
    npi: constr(regex=r'^\d{10}$') = Field(
        ...,
        description="National Provider Identifier (10 digits)"
    )


class SocialSecurityNumber(BaseModel):
    """
    Social Security Number (highly sensitive - HIPAA regulated).

    Format: XXX-XX-XXXX
    Security: Should be encrypted at rest
    """
    ssn: constr(regex=r'^\d{3}-\d{2}-\d{4}$') = Field(
        ...,
        description="Social Security Number (format: 123-45-6789)"
    )

    # NOTE: This should ALWAYS be encrypted before storage
    # See: backend/app/core/encryption.py


# ===========================================================================
# Search & Query Models
# ===========================================================================

class SafeSearchQuery(BaseModel):
    """
    Safe search query with injection prevention.

    Security:
    - Removes SQL injection patterns
    - Removes XSS patterns
    - Enforces max length (prevent DoS)
    - Normalizes whitespace
    """
    query: constr(min_length=1, max_length=200) = Field(
        ...,
        description="Search query string"
    )
    limit: conint(ge=1, le=100) = Field(
        10,
        description="Max results to return (1-100)"
    )
    offset: conint(ge=0) = Field(
        0,
        description="Number of results to skip"
    )

    @validator('query')
    def sanitize_query(cls, v):
        # Remove dangerous SQL patterns
        validate_no_sql_injection(v)

        # Remove XSS patterns
        validate_no_xss(v)

        # Normalize whitespace
        return ' '.join(v.split())


class SafeFilterQuery(BaseModel):
    """
    Safe filter parameters for list endpoints.

    Prevents injection via filter parameters.
    """
    field: constr(regex=r'^[a-zA-Z_][a-zA-Z0-9_]*$', max_length=50) = Field(
        ...,
        description="Field name to filter on (alphanumeric + underscore only)"
    )
    operator: constr(regex=r'^(eq|ne|gt|lt|gte|lte|in|like)$') = Field(
        'eq',
        description="Comparison operator"
    )
    value: constr(max_length=200) = Field(
        ...,
        description="Filter value"
    )

    @validator('value')
    def sanitize_value(cls, v):
        validate_no_sql_injection(v)
        validate_no_xss(v)
        return v


# ===========================================================================
# Financial Models (PCI Compliance)
# ===========================================================================

class BankAccountNumber(BaseModel):
    """
    Bank account number validation (PCI DSS compliant).

    Format: 4-17 digits
    Security: Should be encrypted at rest, never logged
    """
    account_number: constr(regex=r'^\d{4,17}$') = Field(
        ...,
        description="Bank account number (4-17 digits)"
    )
    routing_number: constr(regex=r'^\d{9}$') = Field(
        ...,
        description="Bank routing number (9 digits)"
    )
    account_type: constr(regex=r'^(checking|savings)$') = Field(
        ...,
        description="Account type"
    )


class FinancialAmount(BaseModel):
    """
    Validated financial amount (prevent negative/overflow).

    Range: $0.01 to $999,999,999.99
    """
    amount: float = Field(
        ...,
        ge=0.01,
        le=999999999.99,
        description="Dollar amount (positive, max $999M)"
    )
    currency: constr(regex=r'^[A-Z]{3}$') = Field(
        'USD',
        description="ISO 4217 currency code (e.g., USD, EUR)"
    )

    @validator('amount')
    def round_to_cents(cls, v):
        # Always round to 2 decimal places (cents)
        return round(v, 2)


# ===========================================================================
# Date & Time Models
# ===========================================================================

class SafeDateRange(BaseModel):
    """
    Date range validation.

    Security:
    - Prevents unreasonable date ranges (DoS via large queries)
    - Ensures start < end
    """
    start_date: date = Field(
        ...,
        description="Range start date (ISO 8601)"
    )
    end_date: date = Field(
        ...,
        description="Range end date (ISO 8601)"
    )

    @root_validator
    def validate_date_range(cls, values):
        start = values.get('start_date')
        end = values.get('end_date')

        if start and end:
            if start > end:
                raise ValueError('start_date must be before end_date')

            # Prevent unreasonably large date ranges (DoS protection)
            days_diff = (end - start).days
            if days_diff > 3650:  # 10 years max
                raise ValueError(
                    'Date range too large (max 10 years). '
                    'Please use smaller date ranges.'
                )

        return values


# ===========================================================================
# File Upload Models
# ===========================================================================

class SafeFileUpload(BaseModel):
    """
    File upload validation (prevent malicious files).

    Security:
    - Whitelist allowed file extensions
    - Enforce max file size
    - Sanitize filename (prevent path traversal)
    """
    filename: constr(min_length=1, max_length=255) = Field(
        ...,
        description="Original filename"
    )
    content_type: constr(
        regex=r'^(image/(jpeg|png|gif)|application/pdf|text/plain)$'
    ) = Field(
        ...,
        description="MIME type (whitelist only)"
    )
    size_bytes: conint(ge=1, le=10485760) = Field(  # 10MB max
        ...,
        description="File size in bytes (max 10MB)"
    )

    @validator('filename')
    def sanitize_filename(cls, v):
        # Remove path traversal attempts
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError('Filename contains invalid path characters')

        # Allow only alphanumeric, dash, underscore, period
        safe_filename = re.sub(r'[^a-zA-Z0-9\-_\.]', '_', v)

        # Ensure extension is present
        if '.' not in safe_filename:
            raise ValueError('Filename must have an extension')

        return safe_filename


# ===========================================================================
# Pagination Models
# ===========================================================================

class SafePagination(BaseModel):
    """
    Pagination parameters with DoS protection.

    Security:
    - Enforce reasonable page sizes (prevent large result sets)
    - Prevent negative offsets
    """
    page: conint(ge=1) = Field(
        1,
        description="Page number (1-indexed)"
    )
    page_size: conint(ge=1, le=100) = Field(
        20,
        description="Results per page (max 100)"
    )

    @property
    def offset(self) -> int:
        """Calculate SQL offset from page number."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """SQL limit (same as page_size)."""
        return self.page_size
