"""
Security utilities for authentication and authorization.
Handles JWT tokens, password hashing, and token validation.
"""

from datetime import datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings
from app.core.logging import logger


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: Plain text password
        hashed_password: BCrypt hashed password

    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    """
    Hash a password using BCrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(
    subject: str,
    tenant_id: str | None = None,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        subject: Subject of the token (usually user ID)
        tenant_id: Tenant ID for multi-tenancy
        expires_delta: Token expiration time
        additional_claims: Additional JWT claims

    Returns:
        Encoded JWT token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "type": "access",
    }

    if tenant_id:
        to_encode["tenant_id"] = tenant_id

    if additional_claims:
        to_encode.update(additional_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: str,
    tenant_id: str | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT refresh token.

    Args:
        subject: Subject of the token (usually user ID)
        tenant_id: Tenant ID for multi-tenancy
        expires_delta: Token expiration time

    Returns:
        Encoded JWT token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }

    if tenant_id:
        to_encode["tenant_id"] = tenant_id

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict[str, Any] | None:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload, or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning("JWT decode failed", error=str(e))
        return None


def verify_token(token: str, token_type: str = "access") -> dict[str, Any] | None:
    """
    Verify a JWT token and check its type.

    Args:
        token: JWT token string
        token_type: Expected token type ('access' or 'refresh')

    Returns:
        Decoded token payload if valid, None otherwise
    """
    payload = decode_token(token)

    if payload is None:
        return None

    # Check token type
    if payload.get("type") != token_type:
        logger.warning(
            "Token type mismatch",
            expected=token_type,
            actual=payload.get("type"),
        )
        return None

    # Check expiration
    exp = payload.get("exp")
    if exp is None or datetime.fromtimestamp(exp) < datetime.utcnow():
        logger.warning("Token expired")
        return None

    return payload


def generate_password_reset_token(email: str) -> str:
    """
    Generate a password reset token.

    Args:
        email: User email address

    Returns:
        JWT token for password reset
    """
    delta = timedelta(hours=24)  # Reset tokens valid for 24 hours
    expire = datetime.utcnow() + delta

    to_encode = {
        "sub": email,
        "exp": expire,
        "type": "password_reset",
    }

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    """
    Verify a password reset token.

    Args:
        token: Password reset token

    Returns:
        Email address if valid, None otherwise
    """
    payload = verify_token(token, token_type="password_reset")
    if payload is None:
        return None

    return payload.get("sub")


def generate_email_verification_token(email: str) -> str:
    """
    Generate an email verification token.

    Args:
        email: User email address

    Returns:
        JWT token for email verification
    """
    delta = timedelta(days=7)  # Verification tokens valid for 7 days
    expire = datetime.utcnow() + delta

    to_encode = {
        "sub": email,
        "exp": expire,
        "type": "email_verification",
    }

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_email_verification_token(token: str) -> str | None:
    """
    Verify an email verification token.

    Args:
        token: Email verification token

    Returns:
        Email address if valid, None otherwise
    """
    payload = verify_token(token, token_type="email_verification")
    if payload is None:
        return None

    return payload.get("sub")
