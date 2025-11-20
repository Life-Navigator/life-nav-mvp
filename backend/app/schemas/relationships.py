"""
Relationships domain schemas.
Handles contacts and interactions tracking.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.relationships import (
    Importance,
    InteractionType,
    RelationshipType,
    Sentiment,
)
from app.schemas.base import BaseSchema, IDTimestampSchema

# ============================================================================
# Contact Schemas
# ============================================================================


class ContactCreate(BaseSchema):
    """Contact creation schema."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=200)
    nickname: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    relationship_type: RelationshipType | None = None
    relationship_strength: int | None = Field(default=None, ge=1, le=10)
    importance: Importance = Field(default=Importance.MEDIUM)
    birthday: date | None = None
    anniversary: date | None = None
    first_met_date: date | None = None
    contact_frequency_days: int | None = Field(default=None, ge=1)
    next_contact_reminder: date | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    twitter_handle: str | None = Field(default=None, max_length=100)
    instagram_handle: str | None = Field(default=None, max_length=100)
    interests: list[str] | None = None
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class ContactUpdate(BaseSchema):
    """Contact update schema."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=200)
    nickname: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    relationship_type: RelationshipType | None = None
    relationship_strength: int | None = Field(default=None, ge=1, le=10)
    importance: Importance | None = None
    birthday: date | None = None
    anniversary: date | None = None
    first_met_date: date | None = None
    last_contacted_at: datetime | None = None
    contact_frequency_days: int | None = Field(default=None, ge=1)
    next_contact_reminder: date | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    twitter_handle: str | None = Field(default=None, max_length=100)
    instagram_handle: str | None = Field(default=None, max_length=100)
    interests: list[str] | None = None
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class ContactResponse(IDTimestampSchema):
    """Contact response schema."""

    first_name: str | None
    last_name: str | None
    display_name: str | None
    nickname: str | None
    email: str | None
    phone: str | None
    company: str | None
    job_title: str | None
    relationship_type: RelationshipType | None
    relationship_strength: int | None
    importance: Importance
    birthday: date | None
    anniversary: date | None
    first_met_date: date | None
    last_contacted_at: datetime | None
    contact_frequency_days: int | None
    next_contact_reminder: date | None
    linkedin_url: str | None
    twitter_handle: str | None
    instagram_handle: str | None
    interests: list[str] | None
    tags: list[str] | None
    metadata: dict[str, Any]
    notes: str | None


# ============================================================================
# ContactInteraction Schemas
# ============================================================================


class ContactInteractionCreate(BaseSchema):
    """ContactInteraction creation schema."""

    contact_id: UUID
    interaction_type: InteractionType | None = None
    interaction_date: datetime
    duration_minutes: int | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    sentiment: Sentiment | None = None
    requires_follow_up: bool = Field(default=False)
    follow_up_date: date | None = None
    follow_up_completed: bool = Field(default=False)
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class ContactInteractionUpdate(BaseSchema):
    """ContactInteraction update schema."""

    contact_id: UUID | None = None
    interaction_type: InteractionType | None = None
    interaction_date: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    sentiment: Sentiment | None = None
    requires_follow_up: bool | None = None
    follow_up_date: date | None = None
    follow_up_completed: bool | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class ContactInteractionResponse(IDTimestampSchema):
    """ContactInteraction response schema."""

    contact_id: UUID
    interaction_type: InteractionType | None
    interaction_date: datetime
    duration_minutes: int | None
    location: str | None
    subject: str | None
    summary: str | None
    sentiment: Sentiment | None
    requires_follow_up: bool
    follow_up_date: date | None
    follow_up_completed: bool
    metadata: dict[str, Any]
    tags: list[str] | None
    notes: str | None
