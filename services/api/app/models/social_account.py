"""
Social media account integration models
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class SocialPlatform(str, enum.Enum):
    """Social media platforms"""

    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    YOUTUBE = "youtube"


class ConnectionStatus(str, enum.Enum):
    """Account connection status"""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    ERROR = "error"


class SocialAccount(Base):
    """Social media account connection model"""

    __tablename__ = "social_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Platform
    platform = Column(SQLEnum(SocialPlatform), nullable=False)

    # Account details
    platform_user_id = Column(String(255))  # User ID on the platform
    username = Column(String(255))
    display_name = Column(String(255))
    profile_url = Column(String(1000))
    avatar_url = Column(String(1000))

    # OAuth tokens
    access_token = Column(Text)  # Encrypted in production
    refresh_token = Column(Text)  # Encrypted in production
    token_expires_at = Column(DateTime)

    # Status
    status = Column(SQLEnum(ConnectionStatus), default=ConnectionStatus.CONNECTED)

    # Stats (cached from platform)
    followers_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    posts_count = Column(Integer, default=0)
    connections_count = Column(Integer)  # LinkedIn specific

    # Permissions granted
    scopes = Column(JSONB)  # list of granted scopes/permissions

    # Sync
    last_synced_at = Column(DateTime)
    sync_enabled = Column(Boolean, default=True)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    connected_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<SocialAccount {self.platform.value} - {self.username}>"


class SocialPost(Base):
    """Social media post tracking for cross-posting"""

    __tablename__ = "social_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Content
    content = Column(Text, nullable=False)
    media_urls = Column(JSONB)  # list of media URLs
    hashtags = Column(JSONB)  # list of hashtags

    # Scheduling
    scheduled_at = Column(DateTime)
    published_at = Column(DateTime, index=True)
    is_draft = Column(Boolean, default=False)

    # Cross-posting platforms
    platforms = Column(JSONB)  # list of platforms to post to

    # Platform post IDs
    linkedin_post_id = Column(String(255))
    twitter_post_id = Column(String(255))
    instagram_post_id = Column(String(255))
    tiktok_post_id = Column(String(255))
    facebook_post_id = Column(String(255))

    # Engagement stats (aggregated from all platforms)
    total_likes = Column(Integer, default=0)
    total_comments = Column(Integer, default=0)
    total_shares = Column(Integer, default=0)
    total_views = Column(Integer, default=0)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SocialPost {self.id}>"


class NetworkConnection(Base):
    """Professional network connections from LinkedIn"""

    __tablename__ = "network_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Connection details
    platform = Column(SQLEnum(SocialPlatform), default=SocialPlatform.LINKEDIN)
    connection_name = Column(String(255), nullable=False)
    connection_title = Column(String(255))
    connection_company = Column(String(255))
    connection_location = Column(String(255))
    connection_profile_url = Column(String(1000))
    connection_avatar_url = Column(String(1000))

    # Platform IDs
    platform_connection_id = Column(String(255))

    # Relationship
    relationship_note = Column(Text)
    connection_strength = Column(Float)  # 0-100 calculated score

    # Interaction
    last_interaction_date = Column(DateTime)
    interaction_count = Column(Integer, default=0)

    # Tags
    tags = Column(JSONB)  # custom tags for organizing connections

    # Timestamps
    connected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<NetworkConnection {self.connection_name}>"
