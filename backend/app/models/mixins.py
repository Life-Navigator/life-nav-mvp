"""
SQLAlchemy model mixins for common patterns.
Provides reusable functionality like timestamps, soft deletes, and tenant isolation.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class UUIDMixin:
    """Mixin for UUID primary key."""

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=None,
    )


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    @property
    def is_deleted(self) -> bool:
        """Check if the record is soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark the record as deleted."""
        self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.deleted_at = None


class TenantMixin:
    """
    Mixin for multi-tenant isolation.
    Automatically includes tenant_id foreign key.
    """

    @declared_attr
    def tenant_id(cls) -> Mapped[UUID]:
        """Foreign key to tenants table."""
        return mapped_column(
            PGUUID(as_uuid=True),
            nullable=False,
            index=True,
        )


class UserOwnedMixin:
    """
    Mixin for user-owned resources.
    Includes both tenant_id and user_id foreign keys.
    """

    @declared_attr
    def tenant_id(cls) -> Mapped[UUID]:
        """Foreign key to tenants table."""
        return mapped_column(
            PGUUID(as_uuid=True),
            nullable=False,
            index=True,
        )

    @declared_attr
    def user_id(cls) -> Mapped[UUID]:
        """Foreign key to users table."""
        return mapped_column(
            PGUUID(as_uuid=True),
            nullable=False,
            index=True,
        )


class MetadataMixin:
    """Mixin for JSONB metadata field."""

    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        type_=String,  # Will be JSONB in PostgreSQL
        default=dict,
        server_default="{}",
    )


class BaseModel(UUIDMixin, TimestampMixin):
    """
    Base model with UUID primary key and timestamps.
    Use this as the base for all models that don't need soft delete.
    """

    pass


class BaseSoftDeleteModel(UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Base model with UUID primary key, timestamps, and soft delete.
    Use this as the base for most application models.
    """

    pass


class BaseTenantModel(UUIDMixin, TimestampMixin, SoftDeleteMixin, UserOwnedMixin):
    """
    Base model for tenant-isolated, user-owned resources.
    Includes UUID, timestamps, soft delete, tenant_id, and user_id.
    """

    pass
