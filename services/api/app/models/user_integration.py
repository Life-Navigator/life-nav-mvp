from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base


class UserIntegration(Base):
    """Track which integrations each user has connected - uses string IDs to match Prisma"""
    __tablename__ = "user_integrations"

    id = Column(String(255), primary_key=True)
    user_id = Column(String(255), ForeignKey("users.id"), nullable=False)
    platform_id = Column(String(255), ForeignKey("integration_platforms.id"), nullable=False)

    # Connection status
    status = Column(String, default="active")  # active, needs_attention, expired, disconnected

    # OAuth tokens (encrypted in production)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    scopes = Column(JSONB, nullable=True)  # ["read:transactions", "read:accounts", etc]

    # Connection metadata
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_sync_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)

    # Platform-specific data (e.g., account IDs, user info from the platform)
    platform_metadata = Column(JSONB, nullable=True)

    # Relationships
    user = relationship("User", back_populates="integrations")
