"""
Base Pydantic schemas with common patterns.
Provides reusable base classes for all domain schemas.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """
    Base schema with Pydantic v2 configuration.
    Enables ORM mode for SQLAlchemy model conversion.
    """

    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    """Schema for models with timestamp fields."""

    created_at: datetime
    updated_at: datetime


class IDSchema(BaseSchema):
    """Schema for models with UUID primary key."""

    id: UUID


class IDTimestampSchema(IDSchema, TimestampSchema):
    """Schema combining ID and timestamps - use for response schemas."""

    pass


class MetadataSchema(BaseSchema):
    """Schema for models with metadata field."""

    metadata: dict[str, Any] | None = None
