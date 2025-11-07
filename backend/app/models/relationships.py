"""
Relationships domain models.
Handles contacts and interactions tracking.
"""

from datetime import date, datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import ARRAY, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import BaseTenantModel


class RelationshipType(str, PyEnum):
    """Relationship type enumeration."""

    FAMILY = "family"
    FRIEND = "friend"
    COLLEAGUE = "colleague"
    PROFESSIONAL = "professional"
    ACQUAINTANCE = "acquaintance"
    OTHER = "other"


class Importance(str, PyEnum):
    """Importance level enumeration."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InteractionType(str, PyEnum):
    """Interaction type enumeration."""

    MEETING = "meeting"
    CALL = "call"
    TEXT = "text"
    EMAIL = "email"
    SOCIAL_MEDIA = "social_media"
    EVENT = "event"
    OTHER = "other"


class Sentiment(str, PyEnum):
    """Interaction sentiment enumeration."""

    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class Contact(BaseTenantModel, Base):
    """
    Contact model.
    Represents people in the user's network.
    """

    __tablename__ = "contacts"

    # Contact details
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    display_name: Mapped[str | None] = mapped_column(String(200))
    nickname: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    company: Mapped[str | None] = mapped_column(String(255))
    job_title: Mapped[str | None] = mapped_column(String(255))

    # Relationship
    relationship_type: Mapped[RelationshipType | None] = mapped_column(
        Enum(RelationshipType), index=True
    )
    relationship_strength: Mapped[int | None] = mapped_column()
    importance: Mapped[Importance] = mapped_column(
        Enum(Importance),
        default=Importance.MEDIUM,
        nullable=False,
    )

    # Dates
    birthday: Mapped[date | None] = mapped_column(Date)
    anniversary: Mapped[date | None] = mapped_column(Date)
    first_met_date: Mapped[date | None] = mapped_column(Date)

    # Contact frequency
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    contact_frequency_days: Mapped[int | None] = mapped_column()
    next_contact_reminder: Mapped[date | None] = mapped_column(Date)

    # Social links
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    twitter_handle: Mapped[str | None] = mapped_column(String(100))
    instagram_handle: Mapped[str | None] = mapped_column(String(100))

    # Metadata
    interests: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)


class ContactInteraction(BaseTenantModel, Base):
    """
    Contact interaction model.
    Tracks interactions with contacts.
    """

    __tablename__ = "contact_interactions"

    # Contact relationship
    contact_id: Mapped[UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Interaction details
    interaction_type: Mapped[InteractionType | None] = mapped_column(Enum(InteractionType))
    interaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int | None] = mapped_column()
    location: Mapped[str | None] = mapped_column(String(255))

    # Content
    subject: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    sentiment: Mapped[Sentiment | None] = mapped_column(Enum(Sentiment))

    # Follow-up
    requires_follow_up: Mapped[bool] = mapped_column(default=False, nullable=False)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    follow_up_completed: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    notes: Mapped[str | None] = mapped_column(Text)
