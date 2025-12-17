"""
SQLAlchemy models for OAuth and third-party integrations.
Stores OAuth tokens and connection status for services like Google, Plaid, etc.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import UUIDMixin, TimestampMixin


class OAuthConnection(Base, UUIDMixin, TimestampMixin):
    """
    Stores OAuth connection information for third-party services.
    Supports Google, Microsoft, Apple, and other OAuth providers.
    """

    __tablename__ = "oauth_connections"

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Provider info
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # google, microsoft, apple, etc.
    provider_user_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    provider_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # OAuth tokens (encrypted at rest in production)
    access_token: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    refresh_token: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    token_type: Mapped[str] = mapped_column(
        String(50),
        default="Bearer",
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Scopes granted
    scope: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    connected_services: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String),
        nullable=True,
        default=list,
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="active",
    )  # active, expired, revoked, error

    # Metadata
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        default=dict,
    )

    def __repr__(self) -> str:
        return f"<OAuthConnection(id={self.id}, provider={self.provider}, user_id={self.user_id})>"


class PlaidConnection(Base, UUIDMixin, TimestampMixin):
    """
    Stores Plaid Item (institution connection) information.
    Each item represents a connection to a financial institution.

    Note: This model maps to the 'plaid_connections' table in the Financial database.
    Foreign keys to users/tenants are logical references only (no actual FK constraints)
    since this table is in an isolated compliance database.
    """

    __tablename__ = "plaid_connections"

    # Logical foreign keys (no FK constraints - different database)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Plaid identifiers
    plaid_item_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    plaid_access_token: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )  # Encrypted in production

    # Institution info
    plaid_institution_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    institution_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="active",
    )  # active, needs_reauth, disconnected, error

    # Error tracking
    error_code: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Sync tracking
    last_successful_sync: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_sync_attempt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sync_cursor: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )  # For transaction sync

    # Products enabled
    products_enabled: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String),
        nullable=True,
        default=list,
    )

    # Consent expiration
    consent_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Metadata
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        default=dict,
    )

    def __repr__(self) -> str:
        return f"<PlaidConnection(id={self.id}, item_id={self.plaid_item_id}, institution={self.institution_name})>"


# Alias for backwards compatibility
PlaidItem = PlaidConnection


class WearableConnection(Base, UUIDMixin, TimestampMixin):
    """
    Stores connections to wearable/health devices and services.
    Supports Fitbit, Garmin, Oura, Whoop, Apple Health, etc.
    """

    __tablename__ = "wearable_connections"

    # Foreign keys
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Provider info
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # fitbit, garmin, oura, whoop, apple_health, google_fit
    provider_user_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # OAuth tokens
    access_token: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    refresh_token: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    scope: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(50),
        default="active",
    )  # active, expired, revoked, error

    # Data types enabled
    enabled_data_types: Mapped[Optional[list[str]]] = mapped_column(
        ARRAY(String),
        nullable=True,
        default=list,
    )  # steps, heart_rate, sleep, etc.

    # Sync tracking
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sync_errors: Mapped[int] = mapped_column(
        default=0,
    )

    # Metadata
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        default=dict,
    )

    def __repr__(self) -> str:
        return f"<WearableConnection(id={self.id}, provider={self.provider}, user_id={self.user_id})>"


class WebhookEvent(Base, UUIDMixin, TimestampMixin):
    """
    Stores webhook events from external services for auditing and replay.
    """

    __tablename__ = "webhook_events"

    # Source
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # stripe, plaid, fitbit, etc.
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    event_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )  # External event ID for deduplication

    # Payload
    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    # Processing status
    processed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    retry_count: Mapped[int] = mapped_column(
        default=0,
    )

    def __repr__(self) -> str:
        return f"<WebhookEvent(id={self.id}, source={self.source}, event_type={self.event_type})>"
