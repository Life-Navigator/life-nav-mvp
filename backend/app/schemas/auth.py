"""
Authentication schemas.
Handles login, registration, and token schemas.
"""

from pydantic import EmailStr, Field

from app.schemas.base import BaseSchema
from app.schemas.user import UserResponse


class LoginRequest(BaseSchema):
    """Login request schema."""

    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=8, max_length=255, description="User password")


class RegisterRequest(BaseSchema):
    """Registration request schema."""

    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=8, max_length=255, description="User password")
    first_name: str = Field(min_length=1, max_length=100, description="User first name")
    last_name: str = Field(min_length=1, max_length=100, description="User last name")
    tenant_name: str = Field(min_length=1, max_length=255, description="Tenant/workspace name")


class TokenResponse(BaseSchema):
    """Token response schema."""

    access_token: str = Field(description="JWT access token")
    refresh_token: str = Field(description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(description="Token expiration time in seconds")


class LoginResponse(BaseSchema):
    """Login response schema with user and tokens."""

    user: UserResponse = Field(description="User information")
    tokens: TokenResponse = Field(description="Authentication tokens")


class RefreshTokenRequest(BaseSchema):
    """Refresh token request schema."""

    refresh_token: str = Field(description="JWT refresh token")


class PasswordResetRequest(BaseSchema):
    """Password reset request schema."""

    email: EmailStr = Field(description="User email address")


class PasswordResetConfirm(BaseSchema):
    """Password reset confirmation schema."""

    token: str = Field(description="Password reset token")
    new_password: str = Field(min_length=8, max_length=255, description="New password")


class ChangePasswordRequest(BaseSchema):
    """Change password request schema."""

    current_password: str = Field(min_length=8, max_length=255, description="Current password")
    new_password: str = Field(min_length=8, max_length=255, description="New password")


class VerifyEmailRequest(BaseSchema):
    """Email verification request schema."""

    token: str = Field(description="Email verification token")
