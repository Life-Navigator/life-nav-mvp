"""
Input Validation Security Tests
===========================================================================
Tests for SQL injection, XSS, and healthcare-specific validation.

Coverage:
- SQL injection prevention
- XSS prevention
- Healthcare patterns (MRN, ICD-10, CPT, NPI, SSN)
- Financial validation (account numbers, amounts)
- Search query sanitization
- File upload security
- Date range validation

Run:
    pytest tests/api/test_input_validation.py -v
"""

import pytest
from pydantic import ValidationError
from datetime import date, timedelta

from app.schemas.validation import (
    StrictPatientName,
    StrictEmailAddress,
    StrictPhoneNumber,
    MedicalRecordNumber,
    DiagnosisCode,
    ProcedureCode,
    ProviderIdentifier,
    SocialSecurityNumber,
    SafeSearchQuery,
    SafeFilterQuery,
    BankAccountNumber,
    FinancialAmount,
    SafeDateRange,
    SafeFileUpload,
    SafePagination,
)


# ===========================================================================
# SQL Injection Tests
# ===========================================================================

class TestSQLInjectionPrevention:
    """Test that SQL injection attempts are blocked."""

    def test_sql_injection_in_name_blocked(self):
        """SQL injection in name field should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            StrictPatientName(
                first_name="Robert'; DROP TABLE patients;--",
                last_name="Tables"
            )
        assert 'SQL' in str(exc_info.value) or 'dangerous' in str(exc_info.value).lower()

    def test_sql_union_attack_blocked(self):
        """UNION-based SQL injection should be blocked."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="admin' UNION SELECT * FROM users--")

    def test_sql_comment_attack_blocked(self):
        """SQL comments (--) should be blocked."""
        with pytest.raises(ValidationError):
            StrictPatientName(
                first_name="John--",
                last_name="Doe"
            )

    def test_sql_multiline_comment_blocked(self):
        """SQL multiline comments (/* */) should be blocked."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="test /* comment */ SELECT")

    def test_clean_name_passes(self):
        """Valid names should pass validation."""
        name = StrictPatientName(
            first_name="María",
            last_name="O'Brien-Smith",
            middle_name="José"
        )
        assert name.first_name == "María"
        assert name.last_name == "O'Brien-Smith"

    def test_international_characters_allowed(self):
        """International characters should be allowed in names."""
        name = StrictPatientName(
            first_name="François",
            last_name="Müller"
        )
        assert name.first_name == "François"


# ===========================================================================
# XSS Prevention Tests
# ===========================================================================

class TestXSSPrevention:
    """Test that XSS attacks are blocked."""

    def test_script_tag_blocked(self):
        """<script> tags should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StrictPatientName(
                first_name="<script>alert('XSS')</script>",
                last_name="Hacker"
            )
        assert 'HTML' in str(exc_info.value) or 'JavaScript' in str(exc_info.value)

    def test_javascript_protocol_blocked(self):
        """javascript: protocol should be blocked."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="javascript:alert('XSS')")

    def test_event_handler_blocked(self):
        """HTML event handlers should be blocked."""
        with pytest.raises(ValidationError):
            DiagnosisCode(
                code="E11.9",
                description="<img src=x onerror=alert('XSS')>"
            )

    def test_iframe_blocked(self):
        """<iframe> tags should be rejected."""
        with pytest.raises(ValidationError):
            DiagnosisCode(
                code="E11.9",
                description="<iframe src='evil.com'></iframe>"
            )

    def test_clean_html_encoded_passes(self):
        """Normal text (even with &lt;) should pass."""
        code = DiagnosisCode(
            code="E11.9",
            description="Type 2 diabetes mellitus without complications"
        )
        assert code.description == "Type 2 diabetes mellitus without complications"


# ===========================================================================
# Healthcare Pattern Tests
# ===========================================================================

class TestMedicalRecordNumber:
    """Test MRN validation."""

    def test_valid_mrn_accepted(self):
        """Valid MRN format should pass."""
        mrn = MedicalRecordNumber(mrn="MRN1234567")
        assert mrn.mrn == "MRN1234567"

    def test_invalid_mrn_prefix_rejected(self):
        """MRN without 'MRN' prefix should fail."""
        with pytest.raises(ValidationError):
            MedicalRecordNumber(mrn="1234567")

    def test_mrn_too_short_rejected(self):
        """MRN with < 6 digits should fail."""
        with pytest.raises(ValidationError):
            MedicalRecordNumber(mrn="MRN12345")

    def test_mrn_too_long_rejected(self):
        """MRN with > 10 digits should fail."""
        with pytest.raises(ValidationError):
            MedicalRecordNumber(mrn="MRN12345678901")


class TestDiagnosisCode:
    """Test ICD-10 code validation."""

    def test_valid_icd10_simple_accepted(self):
        """Simple ICD-10 code (E11) should pass."""
        code = DiagnosisCode(
            code="E11",
            description="Type 2 diabetes mellitus"
        )
        assert code.code == "E11"

    def test_valid_icd10_decimal_accepted(self):
        """ICD-10 code with decimal (E11.9) should pass."""
        code = DiagnosisCode(
            code="E11.9",
            description="Type 2 diabetes mellitus without complications"
        )
        assert code.code == "E11.9"

    def test_invalid_icd10_lowercase_rejected(self):
        """Lowercase ICD-10 codes should fail."""
        with pytest.raises(ValidationError):
            DiagnosisCode(code="e11.9", description="Test")

    def test_invalid_icd10_format_rejected(self):
        """Invalid ICD-10 format should fail."""
        with pytest.raises(ValidationError):
            DiagnosisCode(code="123", description="Test")


class TestProcedureCode:
    """Test CPT code validation."""

    def test_valid_cpt_accepted(self):
        """Valid 5-digit CPT code should pass."""
        code = ProcedureCode(
            code="99213",
            description="Office visit, established patient, level 3"
        )
        assert code.code == "99213"

    def test_invalid_cpt_length_rejected(self):
        """CPT code not 5 digits should fail."""
        with pytest.raises(ValidationError):
            ProcedureCode(code="9921", description="Test")


class TestProviderIdentifier:
    """Test NPI validation."""

    def test_valid_npi_accepted(self):
        """Valid 10-digit NPI should pass."""
        npi = ProviderIdentifier(npi="1234567890")
        assert npi.npi == "1234567890"

    def test_invalid_npi_length_rejected(self):
        """NPI not 10 digits should fail."""
        with pytest.raises(ValidationError):
            ProviderIdentifier(npi="123456789")


class TestSocialSecurityNumber:
    """Test SSN validation."""

    def test_valid_ssn_accepted(self):
        """Valid SSN format (XXX-XX-XXXX) should pass."""
        ssn = SocialSecurityNumber(ssn="123-45-6789")
        assert ssn.ssn == "123-45-6789"

    def test_invalid_ssn_format_rejected(self):
        """SSN without hyphens should fail."""
        with pytest.raises(ValidationError):
            SocialSecurityNumber(ssn="123456789")

    def test_ssn_wrong_format_rejected(self):
        """SSN with wrong hyphen positions should fail."""
        with pytest.raises(ValidationError):
            SocialSecurityNumber(ssn="1234-56-789")


# ===========================================================================
# Search Query Tests
# ===========================================================================

class TestSafeSearchQuery:
    """Test search query sanitization."""

    def test_clean_query_accepted(self):
        """Normal search query should pass."""
        query = SafeSearchQuery(query="diabetes treatment", limit=20)
        assert query.query == "diabetes treatment"
        assert query.limit == 20

    def test_sql_injection_in_query_blocked(self):
        """SQL injection in search should be blocked."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="' OR '1'='1")

    def test_whitespace_normalized(self):
        """Multiple spaces should be normalized."""
        query = SafeSearchQuery(query="diabetes    treatment")
        assert query.query == "diabetes treatment"

    def test_limit_enforced(self):
        """Limit > 100 should fail."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="test", limit=101)

    def test_negative_offset_rejected(self):
        """Negative offset should fail."""
        with pytest.raises(ValidationError):
            SafeSearchQuery(query="test", offset=-1)


class TestSafeFilterQuery:
    """Test filter query validation."""

    def test_valid_filter_accepted(self):
        """Valid filter should pass."""
        filter_query = SafeFilterQuery(
            field="patient_name",
            operator="like",
            value="John%"
        )
        assert filter_query.field == "patient_name"
        assert filter_query.operator == "like"

    def test_invalid_field_name_rejected(self):
        """Field name with SQL keywords should fail."""
        with pytest.raises(ValidationError):
            SafeFilterQuery(
                field="SELECT",
                operator="eq",
                value="test"
            )

    def test_sql_injection_in_value_blocked(self):
        """SQL injection in filter value should be blocked."""
        with pytest.raises(ValidationError):
            SafeFilterQuery(
                field="name",
                operator="eq",
                value="'; DROP TABLE users;--"
            )


# ===========================================================================
# Financial Tests
# ===========================================================================

class TestBankAccountNumber:
    """Test bank account validation (PCI compliant)."""

    def test_valid_account_accepted(self):
        """Valid account and routing numbers should pass."""
        account = BankAccountNumber(
            account_number="1234567890",
            routing_number="123456789",
            account_type="checking"
        )
        assert account.account_number == "1234567890"
        assert account.routing_number == "123456789"

    def test_invalid_routing_number_rejected(self):
        """Routing number not 9 digits should fail."""
        with pytest.raises(ValidationError):
            BankAccountNumber(
                account_number="1234567890",
                routing_number="12345678",  # Only 8 digits
                account_type="checking"
            )

    def test_invalid_account_type_rejected(self):
        """Invalid account type should fail."""
        with pytest.raises(ValidationError):
            BankAccountNumber(
                account_number="1234567890",
                routing_number="123456789",
                account_type="investment"  # Not checking/savings
            )


class TestFinancialAmount:
    """Test financial amount validation."""

    def test_valid_amount_accepted(self):
        """Valid positive amount should pass."""
        amount = FinancialAmount(amount=123.45, currency="USD")
        assert amount.amount == 123.45
        assert amount.currency == "USD"

    def test_rounding_to_cents(self):
        """Amount should be rounded to 2 decimal places."""
        amount = FinancialAmount(amount=123.456, currency="USD")
        assert amount.amount == 123.46  # Rounded

    def test_negative_amount_rejected(self):
        """Negative amounts should fail."""
        with pytest.raises(ValidationError):
            FinancialAmount(amount=-10.00, currency="USD")

    def test_zero_amount_rejected(self):
        """Zero amount should fail (minimum $0.01)."""
        with pytest.raises(ValidationError):
            FinancialAmount(amount=0.00, currency="USD")

    def test_excessive_amount_rejected(self):
        """Amount > $999M should fail."""
        with pytest.raises(ValidationError):
            FinancialAmount(amount=1_000_000_000.00, currency="USD")


# ===========================================================================
# Date Range Tests
# ===========================================================================

class TestSafeDateRange:
    """Test date range validation."""

    def test_valid_date_range_accepted(self):
        """Valid date range should pass."""
        today = date.today()
        next_month = today + timedelta(days=30)

        date_range = SafeDateRange(
            start_date=today,
            end_date=next_month
        )
        assert date_range.start_date == today
        assert date_range.end_date == next_month

    def test_reversed_dates_rejected(self):
        """Start date after end date should fail."""
        today = date.today()
        yesterday = today - timedelta(days=1)

        with pytest.raises(ValidationError) as exc_info:
            SafeDateRange(
                start_date=today,
                end_date=yesterday
            )
        assert 'before' in str(exc_info.value).lower()

    def test_large_date_range_rejected(self):
        """Date range > 10 years should fail (DoS protection)."""
        today = date.today()
        far_future = today + timedelta(days=3651)  # 10+ years

        with pytest.raises(ValidationError) as exc_info:
            SafeDateRange(
                start_date=today,
                end_date=far_future
            )
        assert 'too large' in str(exc_info.value).lower()


# ===========================================================================
# File Upload Tests
# ===========================================================================

class TestSafeFileUpload:
    """Test file upload validation."""

    def test_valid_file_accepted(self):
        """Valid file should pass."""
        file_upload = SafeFileUpload(
            filename="patient-report.pdf",
            content_type="application/pdf",
            size_bytes=1024000  # 1MB
        )
        assert file_upload.filename == "patient-report.pdf"

    def test_path_traversal_blocked(self):
        """Path traversal in filename should be blocked."""
        with pytest.raises(ValidationError) as exc_info:
            SafeFileUpload(
                filename="../../../etc/passwd",
                content_type="text/plain",
                size_bytes=1024
            )
        assert 'path' in str(exc_info.value).lower()

    def test_invalid_content_type_rejected(self):
        """Non-whitelisted content type should fail."""
        with pytest.raises(ValidationError):
            SafeFileUpload(
                filename="malware.exe",
                content_type="application/x-msdownload",
                size_bytes=1024
            )

    def test_file_too_large_rejected(self):
        """File > 10MB should fail."""
        with pytest.raises(ValidationError):
            SafeFileUpload(
                filename="large-file.pdf",
                content_type="application/pdf",
                size_bytes=11 * 1024 * 1024  # 11MB
            )

    def test_filename_sanitized(self):
        """Special characters in filename should be replaced."""
        file_upload = SafeFileUpload(
            filename="patient report (final).pdf",
            content_type="application/pdf",
            size_bytes=1024
        )
        # Spaces and parentheses should be replaced with underscores
        assert file_upload.filename == "patient_report__final_.pdf"


# ===========================================================================
# Pagination Tests
# ===========================================================================

class TestSafePagination:
    """Test pagination validation."""

    def test_valid_pagination_accepted(self):
        """Valid pagination should pass."""
        pagination = SafePagination(page=1, page_size=20)
        assert pagination.page == 1
        assert pagination.page_size == 20
        assert pagination.offset == 0
        assert pagination.limit == 20

    def test_offset_calculation(self):
        """Offset should be calculated correctly."""
        pagination = SafePagination(page=3, page_size=25)
        assert pagination.offset == 50  # (3-1) * 25

    def test_negative_page_rejected(self):
        """Page < 1 should fail."""
        with pytest.raises(ValidationError):
            SafePagination(page=0)

    def test_excessive_page_size_rejected(self):
        """Page size > 100 should fail (DoS protection)."""
        with pytest.raises(ValidationError):
            SafePagination(page=1, page_size=101)


# ===========================================================================
# Email Tests
# ===========================================================================

class TestStrictEmailAddress:
    """Test email validation."""

    def test_valid_email_accepted(self):
        """Valid email should pass."""
        email = StrictEmailAddress(email="john.doe@example.com")
        assert email.email == "john.doe@example.com"

    def test_email_lowercased(self):
        """Email should be converted to lowercase."""
        email = StrictEmailAddress(email="John.Doe@EXAMPLE.COM")
        assert email.email == "john.doe@example.com"

    def test_invalid_email_rejected(self):
        """Invalid email format should fail."""
        with pytest.raises(ValidationError):
            StrictEmailAddress(email="not-an-email")


# ===========================================================================
# Phone Number Tests
# ===========================================================================

class TestStrictPhoneNumber:
    """Test phone number validation."""

    def test_valid_phone_accepted(self):
        """Valid 10-digit phone should pass."""
        phone = StrictPhoneNumber(phone="5551234567")
        assert phone.phone == "5551234567"

    def test_phone_with_country_code_accepted(self):
        """Phone with +1 should pass."""
        phone = StrictPhoneNumber(phone="+15551234567")
        assert phone.phone == "+15551234567"

    def test_invalid_phone_rejected(self):
        """Phone with letters should fail."""
        with pytest.raises(ValidationError):
            StrictPhoneNumber(phone="555-CALL-NOW")


# ===========================================================================
# Integration Tests
# ===========================================================================

class TestValidationIntegration:
    """Integration tests combining multiple validators."""

    def test_complete_patient_record_valid(self):
        """Complete valid patient record should pass all validations."""
        # Name
        name = StrictPatientName(
            first_name="John",
            last_name="Doe",
            middle_name="Michael"
        )

        # Contact
        email = StrictEmailAddress(email="john.doe@example.com")
        phone = StrictPhoneNumber(phone="5551234567")

        # Healthcare IDs
        mrn = MedicalRecordNumber(mrn="MRN1234567")
        ssn = SocialSecurityNumber(ssn="123-45-6789")

        # Diagnosis
        diagnosis = DiagnosisCode(
            code="E11.9",
            description="Type 2 diabetes mellitus without complications"
        )

        # All validations should pass
        assert name.first_name == "John"
        assert email.email == "john.doe@example.com"
        assert mrn.mrn == "MRN1234567"
        assert diagnosis.code == "E11.9"

    def test_malicious_input_comprehensive_blocking(self):
        """Comprehensive test of malicious input blocking."""
        malicious_inputs = [
            "'; DROP TABLE patients;--",
            "<script>alert('XSS')</script>",
            "' UNION SELECT * FROM users--",
            "javascript:alert(1)",
            "<img src=x onerror=alert(1)>",
            "../../etc/passwd",
        ]

        for malicious_input in malicious_inputs:
            # Should fail in name field
            with pytest.raises(ValidationError):
                StrictPatientName(
                    first_name=malicious_input,
                    last_name="Test"
                )

            # Should fail in search query
            with pytest.raises(ValidationError):
                SafeSearchQuery(query=malicious_input)

            # Should fail in diagnosis description
            with pytest.raises(ValidationError):
                DiagnosisCode(
                    code="E11.9",
                    description=malicious_input
                )
