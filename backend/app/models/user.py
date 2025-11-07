"""
User, Organization, and Tenant models.
Core multi-tenant architecture models.
"""

from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import BaseSoftDeleteModel, TimestampMixin, UUIDMixin


class SubscriptionTier(str, PyEnum):
    """Subscription tier enumeration."""

    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class OrganizationStatus(str, PyEnum):
    """Organization status enumeration."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    CHURNED = "churned"


class TenantType(str, PyEnum):
    """Tenant type enumeration."""

    WORKSPACE = "workspace"
    TEAM = "team"
    DEPARTMENT = "department"


class TenantStatus(str, PyEnum):
    """Tenant status enumeration."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class UserStatus(str, PyEnum):
    """User status enumeration."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"
    DELETED = "deleted"


class AuthProvider(str, PyEnum):
    """Authentication provider enumeration."""

    EMAIL = "email"
    GOOGLE = "google"
    MICROSOFT = "microsoft"
    APPLE = "apple"


class UserTenantRole(str, PyEnum):
    """User role within a tenant."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class UserTenantStatus(str, PyEnum):
    """User-tenant membership status."""

    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class Organization(BaseSoftDeleteModel, Base):
    """
    Organization model (top-level entity for B2B SaaS).
    Represents a company or organization using the platform.
    """

    __tablename__ = "organizations"

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    website: Mapped[str | None] = mapped_column(String(255))
    industry: Mapped[str | None] = mapped_column(String(100))
    company_size: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[OrganizationStatus] = mapped_column(
        Enum(OrganizationStatus),
        default=OrganizationStatus.ACTIVE,
        nullable=False,
    )

    # Subscription & billing
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier),
        default=SubscriptionTier.FREE,
        nullable=False,
    )
    subscription_status: Mapped[str] = mapped_column(String(50), default="active")
    trial_ends_at: Mapped[datetime | None] = mapped_column()
    subscription_ends_at: Mapped[datetime | None] = mapped_column()

    # Metadata
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")

    # Relationships
    tenants: Mapped[list["Tenant"]] = relationship(back_populates="organization", lazy="selectin")


class Tenant(BaseSoftDeleteModel, Base):
    """
    Tenant model (workspace within organization).
    Provides multi-tenant isolation for data security.
    """

    __tablename__ = "tenants"
    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_tenant_org_slug"),)

    # Organization relationship
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[TenantType] = mapped_column(
        Enum(TenantType),
        default=TenantType.WORKSPACE,
        nullable=False,
    )
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus),
        default=TenantStatus.ACTIVE,
        nullable=False,
    )

    # HIPAA compliance settings
    hipaa_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    encryption_at_rest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    audit_log_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    data_retention_days: Mapped[int] = mapped_column(Integer, default=2555, nullable=False)

    # Metadata
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="tenants")
    user_tenants: Mapped[list["UserTenant"]] = relationship(
        back_populates="tenant", lazy="selectin"
    )


class User(BaseSoftDeleteModel, Base):
    """
    User model.
    Represents an individual user account with authentication.
    """

    __tablename__ = "users"

    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Profile
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    display_name: Mapped[str | None] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York", nullable=False)
    locale: Mapped[str] = mapped_column(String(10), default="en-US", nullable=False)

    # Authentication
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider),
        default=AuthProvider.EMAIL,
        nullable=False,
    )
    auth_provider_id: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255))

    # Status
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus),
        default=UserStatus.ACTIVE,
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column()
    email_verified_at: Mapped[datetime | None] = mapped_column()

    # Metadata
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")

    # Relationships
    user_tenants: Mapped[list["UserTenant"]] = relationship(back_populates="user", lazy="selectin")


class UserTenant(UUIDMixin, TimestampMixin, Base):
    """
    User-Tenant membership model.
    Represents a user's membership in a tenant with role-based access control.
    """

    __tablename__ = "user_tenants"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_user_tenant"),)

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role & permissions
    role: Mapped[UserTenantRole] = mapped_column(
        Enum(UserTenantRole),
        default=UserTenantRole.MEMBER,
        nullable=False,
    )
    permissions: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")

    # Status
    status: Mapped[UserTenantStatus] = mapped_column(
        Enum(UserTenantStatus),
        default=UserTenantStatus.ACTIVE,
        nullable=False,
    )
    invited_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    invited_at: Mapped[datetime | None] = mapped_column()
    joined_at: Mapped[datetime | None] = mapped_column()

    # Relationships
    user: Mapped["User"] = relationship(back_populates="user_tenants", foreign_keys=[user_id])
    tenant: Mapped["Tenant"] = relationship(back_populates="user_tenants")


class AuditLog(UUIDMixin, Base):
    """
    Audit log model for HIPAA compliance.
    Immutable log of all data access and modifications.
    """

    __tablename__ = "audit_logs"

    # Tenant & user context
    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )

    # Event details
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_category: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="info", nullable=False)

    # Resource information
    resource_type: Mapped[str | None] = mapped_column(String(100))
    resource_id: Mapped[UUID | None] = mapped_column()
    resource_changes: Mapped[dict | None] = mapped_column(JSONB)

    # Request context
    ip_address: Mapped[str | None] = mapped_column(String(45))  # IPv6 max length
    user_agent: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[UUID | None] = mapped_column()
    session_id: Mapped[UUID | None] = mapped_column()

    # Additional metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")

    # Timestamp (immutable - no updated_at)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
