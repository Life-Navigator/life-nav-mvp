"""
User schemas.
Handles user, organization, and tenant schemas.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.user import (
    AuthProvider,
    OrganizationStatus,
    SubscriptionTier,
    TenantStatus,
    TenantType,
    UserStatus,
    UserTenantRole,
    UserTenantStatus,
)
from app.schemas.base import BaseSchema, IDTimestampSchema

# ============================================================================
# Organization Schemas
# ============================================================================


class OrganizationCreate(BaseSchema):
    """Organization creation schema."""

    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=50)
    subscription_tier: SubscriptionTier = Field(default=SubscriptionTier.FREE)
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class OrganizationUpdate(BaseSchema):
    """Organization update schema."""

    name: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    company_size: str | None = Field(default=None, max_length=50)
    status: OrganizationStatus | None = None
    subscription_tier: SubscriptionTier | None = None
    subscription_status: str | None = Field(default=None, max_length=50)
    trial_ends_at: datetime | None = None
    subscription_ends_at: datetime | None = None
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class OrganizationResponse(IDTimestampSchema):
    """Organization response schema."""

    name: str
    slug: str
    email: str
    phone: str | None
    website: str | None
    industry: str | None
    company_size: str | None
    status: OrganizationStatus
    subscription_tier: SubscriptionTier
    subscription_status: str
    trial_ends_at: datetime | None
    subscription_ends_at: datetime | None
    settings: dict[str, Any]
    metadata: dict[str, Any]


# ============================================================================
# Tenant Schemas
# ============================================================================


class TenantCreate(BaseSchema):
    """Tenant creation schema."""

    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100)
    type: TenantType = Field(default=TenantType.WORKSPACE)
    hipaa_enabled: bool = Field(default=True)
    encryption_at_rest: bool = Field(default=True)
    audit_log_enabled: bool = Field(default=True)
    data_retention_days: int = Field(default=2555, ge=0)
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class TenantUpdate(BaseSchema):
    """Tenant update schema."""

    name: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=100)
    type: TenantType | None = None
    status: TenantStatus | None = None
    hipaa_enabled: bool | None = None
    encryption_at_rest: bool | None = None
    audit_log_enabled: bool | None = None
    data_retention_days: int | None = Field(default=None, ge=0)
    settings: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class TenantResponse(IDTimestampSchema):
    """Tenant response schema."""

    organization_id: UUID
    name: str
    slug: str
    type: TenantType
    status: TenantStatus
    hipaa_enabled: bool
    encryption_at_rest: bool
    audit_log_enabled: bool
    data_retention_days: int
    settings: dict[str, Any]
    metadata: dict[str, Any]


# ============================================================================
# User Schemas
# ============================================================================


class UserCreate(BaseSchema):
    """User creation schema."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=255)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="America/New_York", max_length=50)
    locale: str = Field(default="en-US", max_length=10)


class UserUpdate(BaseSchema):
    """User update schema."""

    email: EmailStr | None = None
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=50)
    locale: str | None = Field(default=None, max_length=10)
    status: UserStatus | None = None
    preferences: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class UserResponse(IDTimestampSchema):
    """User response schema."""

    email: str
    email_verified: bool
    phone: str | None
    phone_verified: bool
    first_name: str | None
    last_name: str | None
    display_name: str | None
    avatar_url: str | None
    timezone: str
    locale: str
    auth_provider: str
    auth_provider_id: str | None
    mfa_enabled: bool
    status: str
    last_login_at: datetime | None
    email_verified_at: datetime | None
    preferences: dict[str, Any]
    metadata: dict[str, Any] = Field(validation_alias="metadata_")


# ============================================================================
# UserTenant Schemas
# ============================================================================


class UserTenantCreate(BaseSchema):
    """UserTenant creation schema."""

    user_id: UUID
    tenant_id: UUID
    role: UserTenantRole = Field(default=UserTenantRole.MEMBER)
    permissions: list[str] | None = None


class UserTenantUpdate(BaseSchema):
    """UserTenant update schema."""

    role: UserTenantRole | None = None
    permissions: list[str] | None = None
    status: UserTenantStatus | None = None


class UserTenantResponse(IDTimestampSchema):
    """UserTenant response schema."""

    user_id: UUID
    tenant_id: UUID
    role: UserTenantRole
    permissions: list[str]
    status: UserTenantStatus
    invited_by: UUID | None
    invited_at: datetime | None
    joined_at: datetime | None


# ============================================================================
# Audit Log Schemas
# ============================================================================


class AuditLogCreate(BaseSchema):
    """AuditLog creation schema."""

    event_type: str = Field(min_length=1, max_length=100)
    event_category: str = Field(min_length=1, max_length=50)
    severity: str = Field(default="info", max_length=20)
    resource_type: str | None = Field(default=None, max_length=100)
    resource_id: UUID | None = None
    resource_changes: dict[str, Any] | None = None
    ip_address: str | None = Field(default=None, max_length=45)
    user_agent: str | None = None
    request_id: UUID | None = None
    session_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class AuditLogResponse(IDTimestampSchema):
    """AuditLog response schema (created_at only, no updated_at)."""

    tenant_id: UUID
    user_id: UUID | None
    event_type: str
    event_category: str
    severity: str
    resource_type: str | None
    resource_id: UUID | None
    resource_changes: dict[str, Any] | None
    ip_address: str | None
    user_agent: str | None
    request_id: UUID | None
    session_id: UUID | None
    metadata: dict[str, Any]
    created_at: datetime
