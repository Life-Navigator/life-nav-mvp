"""
API Key models for secure service-to-service authentication.
Enterprise-grade API key management with rate limiting, permissions, and audit trails.
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class APIKeyStatus(str, PyEnum):
    """API key status enumeration."""

    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class APIKeyScope(str, PyEnum):
    """API key permission scopes."""

    # Finance API scopes
    READ_ACCOUNTS = "finance:accounts:read"
    WRITE_ACCOUNTS = "finance:accounts:write"
    READ_TRANSACTIONS = "finance:transactions:read"
    WRITE_TRANSACTIONS = "finance:transactions:write"
    READ_INVESTMENTS = "finance:investments:read"
    WRITE_INVESTMENTS = "finance:investments:write"
    READ_DOCUMENTS = "finance:documents:read"
    WRITE_DOCUMENTS = "finance:documents:write"
    OCR_PROCESS = "finance:ocr:process"
    MARKET_DATA = "finance:market:read"

    # Admin scopes
    ADMIN_ALL = "admin:*"
    MANAGE_KEYS = "admin:keys:manage"


class APIKey(Base):
    """
    API Key model for service-to-service authentication.

    Features:
    - Secure hashed storage (never store plain text keys)
    - Rate limiting per key
    - Scoped permissions
    - Usage tracking and analytics
    - Automatic expiration
    - IP whitelisting
    - Audit logging
    """

    __tablename__ = "api_keys"
    __table_args__ = (
        Index("idx_api_key_hash", "key_hash"),
        Index("idx_api_key_user_status", "user_id", "status"),
        Index("idx_api_key_created", "created_at"),
    )

    # Primary key
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Owner (user who created the key)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Key identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Hashed key (SHA-256) - NEVER store plaintext!
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    # First 8 chars for display/logging only
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)

    # Status
    status: Mapped[APIKeyStatus] = mapped_column(
        Enum(APIKeyStatus),
        default=APIKeyStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Permissions (array of scopes)
    scopes: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)),
        nullable=False,
        default=list,
    )

    # Rate limiting (requests per minute)
    rate_limit_per_minute: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )
    rate_limit_per_hour: Mapped[int] = mapped_column(
        Integer,
        default=5000,
        nullable=False,
    )

    # IP whitelist (null = allow all)
    allowed_ips: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String(45)))

    # Expiration
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Usage tracking
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_used_ip: Mapped[Optional[str]] = mapped_column(String(45))
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        default=dict,
        server_default="{}",
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    revoked_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"))
    revocation_reason: Mapped[Optional[str]] = mapped_column(Text)

    def is_valid(self) -> bool:
        """Check if API key is currently valid."""
        if self.status != APIKeyStatus.ACTIVE:
            return False

        if self.expires_at and self.expires_at < datetime.utcnow():
            return False

        return True

    def has_scope(self, scope: str) -> bool:
        """Check if key has a specific scope."""
        if APIKeyScope.ADMIN_ALL.value in self.scopes:
            return True
        return scope in self.scopes

    def is_ip_allowed(self, ip: str) -> bool:
        """Check if IP is whitelisted (null = all IPs allowed)."""
        if not self.allowed_ips:
            return True
        return ip in self.allowed_ips


class APIKeyUsage(Base):
    """
    API Key usage tracking for analytics and rate limiting.
    Stores detailed usage metrics per key.
    """

    __tablename__ = "api_key_usage"
    __table_args__ = (
        Index("idx_usage_key_timestamp", "api_key_id", "timestamp"),
        Index("idx_usage_timestamp", "timestamp"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    # Foreign key to API key
    api_key_id: Mapped[UUID] = mapped_column(
        ForeignKey("api_keys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Request details
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Request context
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    # Error details (if any)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        default=dict,
        server_default="{}",
    )


class APIKeyRateLimit(Base):
    """
    Rate limit tracking for API keys.
    Tracks requests per minute/hour windows.
    """

    __tablename__ = "api_key_rate_limits"
    __table_args__ = (
        Index("idx_rate_limit_key_window", "api_key_id", "window_start"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    api_key_id: Mapped[UUID] = mapped_column(
        ForeignKey("api_keys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Time window (minute or hour)
    window_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'minute' or 'hour'
    window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Request count in this window
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Last updated
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
