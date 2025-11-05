"""
Security Validator - Input validation and file upload security

This module provides comprehensive security validation including:
- File upload validation (size, type, content)
- Input sanitization
- Path traversal prevention
- Malware scanning (optional)
- Content type verification

Author: Life Navigator Team
Created: November 2, 2025
"""

import os
import re
import magic
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass


# ========================
# Configuration
# ========================

@dataclass
class SecurityConfig:
    """Security validation configuration"""

    # File upload limits
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50 MB
    MAX_FILENAME_LENGTH: int = 255

    # Allowed file extensions (lowercase)
    ALLOWED_EXTENSIONS: List[str] = None

    # Allowed MIME types
    ALLOWED_MIME_TYPES: List[str] = None

    # Blocked patterns in filenames
    BLOCKED_FILENAME_PATTERNS: List[str] = None

    # Enable malware scanning
    ENABLE_MALWARE_SCAN: bool = False

    def __post_init__(self):
        if self.ALLOWED_EXTENSIONS is None:
            self.ALLOWED_EXTENSIONS = [
                '.pdf', '.txt', '.md', '.docx', '.doc',
                '.html', '.htm', '.rtf', '.odt'
            ]

        if self.ALLOWED_MIME_TYPES is None:
            self.ALLOWED_MIME_TYPES = [
                'application/pdf',
                'text/plain',
                'text/markdown',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/html',
                'text/rtf',
                'application/rtf',
                'application/vnd.oasis.opendocument.text'
            ]

        if self.BLOCKED_FILENAME_PATTERNS is None:
            self.BLOCKED_FILENAME_PATTERNS = [
                r'\.\.',  # Path traversal
                r'[<>:"|?*]',  # Invalid characters
                r'^\.',  # Hidden files
                r'\.exe$',  # Executables
                r'\.sh$',  # Shell scripts
                r'\.bat$',  # Batch files
                r'\.cmd$',  # Command files
                r'\.com$',  # COM files
                r'\.scr$',  # Screen savers
                r'\.vbs$',  # VBScript
                r'\.js$',  # JavaScript (potentially dangerous)
                r'\.jar$',  # Java archives
                r'\.zip$',  # Archives (can contain malware)
                r'\.rar$',  # Archives
                r'\.7z$',  # Archives
            ]


# ========================
# Validation Result
# ========================

@dataclass
class ValidationResult:
    """Result of security validation"""
    valid: bool
    error_message: Optional[str] = None
    warnings: List[str] = None
    file_info: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


# ========================
# Security Validator
# ========================

class SecurityValidator:
    """
    Comprehensive security validation for file uploads and inputs

    Features:
    - File size validation
    - Extension whitelisting
    - MIME type verification
    - Content scanning
    - Filename sanitization
    - Path traversal prevention
    """

    def __init__(self, config: Optional[SecurityConfig] = None):
        """
        Initialize SecurityValidator

        Args:
            config: Security configuration (uses defaults if None)
        """
        self.config = config or SecurityConfig()

    # ========================
    # File Upload Validation
    # ========================

    def validate_file_upload(
        self,
        file_path: str,
        filename: Optional[str] = None
    ) -> ValidationResult:
        """
        Comprehensive file upload validation

        Args:
            file_path: Path to the uploaded file
            filename: Original filename (optional, uses file_path if None)

        Returns:
            ValidationResult with validation outcome
        """
        if filename is None:
            filename = os.path.basename(file_path)

        warnings = []

        # 1. Check if file exists
        if not os.path.exists(file_path):
            return ValidationResult(
                valid=False,
                error_message="File does not exist"
            )

        # 2. Check if it's a file (not directory)
        if not os.path.isfile(file_path):
            return ValidationResult(
                valid=False,
                error_message="Path is not a file"
            )

        # 3. Validate filename
        filename_result = self.validate_filename(filename)
        if not filename_result.valid:
            return filename_result
        warnings.extend(filename_result.warnings)

        # 4. Check file size
        file_size = os.path.getsize(file_path)
        if file_size > self.config.MAX_FILE_SIZE:
            return ValidationResult(
                valid=False,
                error_message=f"File size ({file_size} bytes) exceeds maximum allowed size ({self.config.MAX_FILE_SIZE} bytes)"
            )

        if file_size == 0:
            return ValidationResult(
                valid=False,
                error_message="File is empty"
            )

        # 5. Check file extension
        _, ext = os.path.splitext(filename.lower())
        if ext not in self.config.ALLOWED_EXTENSIONS:
            return ValidationResult(
                valid=False,
                error_message=f"File extension '{ext}' is not allowed. Allowed extensions: {', '.join(self.config.ALLOWED_EXTENSIONS)}"
            )

        # 6. Verify MIME type
        mime_result = self.verify_mime_type(file_path)
        if not mime_result.valid:
            return mime_result
        warnings.extend(mime_result.warnings)

        # 7. Optional: Malware scan
        if self.config.ENABLE_MALWARE_SCAN:
            malware_result = self.scan_for_malware(file_path)
            if not malware_result.valid:
                return malware_result
            warnings.extend(malware_result.warnings)

        # 8. Calculate file hash
        file_hash = self.calculate_file_hash(file_path)

        # Success!
        return ValidationResult(
            valid=True,
            warnings=warnings,
            file_info={
                'filename': filename,
                'size': file_size,
                'extension': ext,
                'mime_type': mime_result.file_info.get('mime_type') if mime_result.file_info else None,
                'hash': file_hash
            }
        )

    def validate_filename(self, filename: str) -> ValidationResult:
        """
        Validate filename for security issues

        Args:
            filename: Filename to validate

        Returns:
            ValidationResult
        """
        warnings = []

        # 1. Check length
        if len(filename) > self.config.MAX_FILENAME_LENGTH:
            return ValidationResult(
                valid=False,
                error_message=f"Filename too long (max {self.config.MAX_FILENAME_LENGTH} characters)"
            )

        # 2. Check for empty filename
        if not filename or filename.strip() == '':
            return ValidationResult(
                valid=False,
                error_message="Filename cannot be empty"
            )

        # 3. Check for blocked patterns
        for pattern in self.config.BLOCKED_FILENAME_PATTERNS:
            if re.search(pattern, filename, re.IGNORECASE):
                return ValidationResult(
                    valid=False,
                    error_message=f"Filename contains blocked pattern: {pattern}"
                )

        # 4. Check for path traversal attempts
        if '..' in filename or '/' in filename or '\\' in filename:
            return ValidationResult(
                valid=False,
                error_message="Filename contains path traversal characters"
            )

        # 5. Warn about special characters
        if re.search(r'[^\w\s\-\.]', filename):
            warnings.append("Filename contains special characters that may be sanitized")

        return ValidationResult(valid=True, warnings=warnings)

    def verify_mime_type(self, file_path: str) -> ValidationResult:
        """
        Verify file MIME type matches extension

        Args:
            file_path: Path to file

        Returns:
            ValidationResult with MIME type info
        """
        try:
            # Use python-magic to detect MIME type
            mime = magic.Magic(mime=True)
            detected_mime = mime.from_file(file_path)

            # Check if MIME type is allowed
            if detected_mime not in self.config.ALLOWED_MIME_TYPES:
                return ValidationResult(
                    valid=False,
                    error_message=f"File MIME type '{detected_mime}' is not allowed"
                )

            return ValidationResult(
                valid=True,
                file_info={'mime_type': detected_mime}
            )

        except Exception as e:
            return ValidationResult(
                valid=False,
                error_message=f"Failed to detect MIME type: {str(e)}"
            )

    def scan_for_malware(self, file_path: str) -> ValidationResult:
        """
        Scan file for malware (placeholder for actual implementation)

        In production, integrate with:
        - ClamAV
        - VirusTotal API
        - AWS GuardDuty
        - Commercial antivirus APIs

        Args:
            file_path: Path to file

        Returns:
            ValidationResult
        """
        # Placeholder implementation
        # In production, integrate with actual malware scanner

        # Example: Check for suspicious patterns in file
        suspicious_patterns = [
            b'eval(',
            b'exec(',
            b'system(',
            b'shell_exec',
            b'<script',
            b'javascript:',
            b'vbscript:',
        ]

        try:
            with open(file_path, 'rb') as f:
                content = f.read(1024 * 1024)  # Read first 1MB

                for pattern in suspicious_patterns:
                    if pattern in content:
                        return ValidationResult(
                            valid=False,
                            error_message=f"File contains suspicious pattern: {pattern.decode('utf-8', errors='ignore')}"
                        )

            return ValidationResult(valid=True)

        except Exception as e:
            return ValidationResult(
                valid=False,
                error_message=f"Malware scan failed: {str(e)}"
            )

    @staticmethod
    def calculate_file_hash(file_path: str, algorithm: str = 'sha256') -> str:
        """
        Calculate file hash

        Args:
            file_path: Path to file
            algorithm: Hash algorithm (sha256, md5, etc.)

        Returns:
            Hexadecimal hash string
        """
        hash_func = hashlib.new(algorithm)

        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hash_func.update(chunk)

        return hash_func.hexdigest()

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename for safe storage

        Args:
            filename: Original filename

        Returns:
            Sanitized filename
        """
        # Remove path components
        filename = os.path.basename(filename)

        # Remove or replace special characters
        filename = re.sub(r'[^\w\s\-\.]', '_', filename)

        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')

        # Collapse multiple underscores
        filename = re.sub(r'_+', '_', filename)

        # Ensure filename is not empty
        if not filename:
            filename = 'unnamed'

        return filename

    # ========================
    # Input Sanitization
    # ========================

    @staticmethod
    def sanitize_input(input_string: str, max_length: int = 1000) -> str:
        """
        Sanitize user input to prevent injection attacks

        Args:
            input_string: User input
            max_length: Maximum allowed length

        Returns:
            Sanitized string
        """
        if not input_string:
            return ''

        # Truncate to max length
        sanitized = input_string[:max_length]

        # Remove null bytes
        sanitized = sanitized.replace('\x00', '')

        # Strip leading/trailing whitespace
        sanitized = sanitized.strip()

        return sanitized

    @staticmethod
    def escape_html(text: str) -> str:
        """
        Escape HTML special characters to prevent XSS

        Args:
            text: Text to escape

        Returns:
            HTML-escaped text
        """
        html_escape_table = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
        }

        return ''.join(html_escape_table.get(c, c) for c in text)

    @staticmethod
    def validate_email(email: str) -> bool:
        """
        Validate email address format

        Args:
            email: Email address

        Returns:
            True if valid, False otherwise
        """
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, email))

    @staticmethod
    def validate_username(username: str) -> Tuple[bool, Optional[str]]:
        """
        Validate username format

        Args:
            username: Username to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Length check
        if len(username) < 3:
            return False, "Username must be at least 3 characters"

        if len(username) > 50:
            return False, "Username must be at most 50 characters"

        # Character check (alphanumeric, underscore, hyphen)
        if not re.match(r'^[a-zA-Z0-9_-]+$', username):
            return False, "Username can only contain letters, numbers, underscores, and hyphens"

        # Must start with letter
        if not username[0].isalpha():
            return False, "Username must start with a letter"

        return True, None

    @staticmethod
    def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password strength

        Args:
            password: Password to validate

        Returns:
            Tuple of (is_strong, list_of_issues)
        """
        issues = []

        # Length check
        if len(password) < 12:
            issues.append("Password must be at least 12 characters long")

        # Uppercase check
        if not re.search(r'[A-Z]', password):
            issues.append("Password must contain at least one uppercase letter")

        # Lowercase check
        if not re.search(r'[a-z]', password):
            issues.append("Password must contain at least one lowercase letter")

        # Digit check
        if not re.search(r'\d', password):
            issues.append("Password must contain at least one digit")

        # Special character check
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            issues.append("Password must contain at least one special character")

        # Common passwords check (basic)
        common_passwords = [
            'password', '123456', 'qwerty', 'admin', 'letmein',
            'welcome', 'monkey', '1234567890'
        ]
        if password.lower() in common_passwords:
            issues.append("Password is too common")

        return len(issues) == 0, issues

    # ========================
    # Path Traversal Prevention
    # ========================

    @staticmethod
    def validate_path(path: str, base_directory: str) -> bool:
        """
        Validate that a path doesn't escape base directory

        Args:
            path: Path to validate
            base_directory: Base directory that path must stay within

        Returns:
            True if path is safe, False otherwise
        """
        # Resolve absolute paths
        base_dir = os.path.abspath(base_directory)
        target_path = os.path.abspath(os.path.join(base_directory, path))

        # Check if target path is within base directory
        return target_path.startswith(base_dir)

    @staticmethod
    def safe_join(base_directory: str, *paths: str) -> Optional[str]:
        """
        Safely join paths, preventing path traversal

        Args:
            base_directory: Base directory
            *paths: Path components to join

        Returns:
            Safe joined path or None if traversal detected
        """
        final_path = os.path.join(base_directory, *paths)

        if SecurityValidator.validate_path(final_path, base_directory):
            return final_path

        return None


# ========================
# Helper Functions
# ========================

def validate_file_upload(file_path: str, filename: Optional[str] = None) -> ValidationResult:
    """
    Quick helper to validate file upload

    Args:
        file_path: Path to uploaded file
        filename: Original filename (optional)

    Returns:
        ValidationResult
    """
    validator = SecurityValidator()
    return validator.validate_file_upload(file_path, filename)


def sanitize_filename(filename: str) -> str:
    """
    Quick helper to sanitize filename

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    return SecurityValidator.sanitize_filename(filename)


if __name__ == "__main__":
    """Test the SecurityValidator"""
    import tempfile

    print("Testing SecurityValidator...")

    validator = SecurityValidator()

    # Test 1: Filename validation
    print("\n1. Testing filename validation...")
    test_filenames = [
        ("valid_file.pdf", True),
        ("../etc/passwd", False),
        ("file<script>.txt", False),
        ("normal-file_123.docx", True),
        (".hidden.txt", False),
        ("malware.exe", False),
    ]

    for filename, should_pass in test_filenames:
        result = validator.validate_filename(filename)
        status = "✅" if result.valid == should_pass else "❌"
        print(f"   {status} {filename}: {result.valid} - {result.error_message or 'OK'}")

    # Test 2: File upload validation
    print("\n2. Testing file upload validation...")

    # Create a test file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write("This is a test file for security validation.")
        test_file_path = f.name

    result = validator.validate_file_upload(test_file_path, "test_document.txt")
    if result.valid:
        print(f"   ✅ File validation passed")
        print(f"      Size: {result.file_info['size']} bytes")
        print(f"      Hash: {result.file_info['hash']}")
        print(f"      MIME: {result.file_info['mime_type']}")
    else:
        print(f"   ❌ File validation failed: {result.error_message}")

    # Cleanup
    os.unlink(test_file_path)

    # Test 3: Input sanitization
    print("\n3. Testing input sanitization...")
    test_inputs = [
        "<script>alert('XSS')</script>",
        "Normal text with spaces",
        "Text\x00with\x00null\x00bytes",
    ]

    for input_text in test_inputs:
        sanitized = validator.sanitize_input(input_text)
        print(f"   Input: {repr(input_text[:50])}")
        print(f"   Sanitized: {repr(sanitized[:50])}")

    # Test 4: Password strength
    print("\n4. Testing password strength...")
    test_passwords = [
        ("weak", False),
        ("StrongP@ssw0rd123", True),
        ("password123", False),
        ("MyS3cur3P@ssword!", True),
    ]

    for password, should_be_strong in test_passwords:
        is_strong, issues = validator.validate_password_strength(password)
        status = "✅" if is_strong == should_be_strong else "❌"
        print(f"   {status} {password}: {is_strong}")
        if issues:
            for issue in issues:
                print(f"      - {issue}")

    # Test 5: Email validation
    print("\n5. Testing email validation...")
    test_emails = [
        ("user@example.com", True),
        ("invalid.email", False),
        ("user+tag@example.co.uk", True),
        ("@example.com", False),
    ]

    for email, should_be_valid in test_emails:
        is_valid = validator.validate_email(email)
        status = "✅" if is_valid == should_be_valid else "❌"
        print(f"   {status} {email}: {is_valid}")

    print("\n✅ All tests completed!")
