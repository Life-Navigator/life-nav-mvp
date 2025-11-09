"""
Event schemas
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponseSchema
from app.models.event import (
    EventPlatform,
    EventCategory,
    EventStatus,
    RSVPStatus,
)


# Event Schemas
class EventBase(BaseModel):
    """Base event schema"""

    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    category: Optional[EventCategory] = None
    organizer_name: Optional[str] = None
    organizer_logo: Optional[str] = None
    organizer_url: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    timezone: Optional[str] = None
    is_virtual: bool = False
    venue_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    online_url: Optional[str] = None
    meeting_platform: Optional[str] = None
    requires_registration: bool = True
    registration_url: Optional[str] = None
    registration_deadline: Optional[datetime] = None
    capacity: Optional[int] = None
    attendees_count: int = 0
    waitlist_available: bool = False
    is_free: bool = True
    price: Optional[float] = None
    price_currency: str = "USD"
    tags: Optional[List[str]] = None
    topics: Optional[List[str]] = None


class EventCreate(EventBase):
    """Create event schema"""

    platform: EventPlatform
    external_id: str = Field(..., max_length=255)
    external_url: Optional[str] = None
    status: EventStatus = EventStatus.UPCOMING


class EventUpdate(BaseModel):
    """Update event schema"""

    is_saved: Optional[bool] = None
    rsvp_status: Optional[RSVPStatus] = None
    attended: Optional[bool] = None
    match_score: Optional[float] = Field(None, ge=0, le=100)


class EventResponse(BaseResponseSchema):
    """Event response schema"""

    user_id: UUID
    title: str
    description: Optional[str]
    category: Optional[EventCategory]
    organizer_name: Optional[str]
    organizer_logo: Optional[str]
    organizer_url: Optional[str]
    start_date: datetime
    end_date: Optional[datetime]
    timezone: Optional[str]
    is_virtual: bool
    venue_name: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: Optional[str]
    postal_code: Optional[str]
    online_url: Optional[str]
    meeting_platform: Optional[str]
    requires_registration: bool
    registration_url: Optional[str]
    registration_deadline: Optional[datetime]
    capacity: Optional[int]
    attendees_count: int
    waitlist_available: bool
    is_free: bool
    price: Optional[float]
    price_currency: str
    status: EventStatus
    platform: EventPlatform
    external_id: str
    external_url: Optional[str]
    tags: Optional[List[str]]
    topics: Optional[List[str]]
    match_score: Optional[float]
    is_saved: bool
    rsvp_status: Optional[RSVPStatus]
    rsvp_date: Optional[datetime]
    attended: Optional[bool]

    class Config:
        from_attributes = True


class EventList(BaseModel):
    """Event list response"""

    items: List[EventResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class EventSearchFilters(BaseModel):
    """Event search filters"""

    keywords: Optional[str] = None
    category: Optional[EventCategory] = None
    location: Optional[str] = None
    is_virtual: Optional[bool] = None
    is_free: Optional[bool] = None
    start_date_from: Optional[datetime] = None
    start_date_to: Optional[datetime] = None
    platform: Optional[EventPlatform] = None
    tags: Optional[List[str]] = None


class SaveEventRequest(BaseModel):
    """Request to save an event"""

    event_id: UUID


class RSVPEventRequest(BaseModel):
    """Request to RSVP to an event"""

    event_id: UUID
    rsvp_status: RSVPStatus
    notes: Optional[str] = None


# Event Attendee Schemas
class EventAttendeeCreate(BaseModel):
    """Create event attendee schema"""

    event_id: UUID
    attendee_name: str
    attendee_title: Optional[str] = None
    attendee_company: Optional[str] = None
    attendee_profile_url: Optional[str] = None


class EventAttendeeResponse(BaseResponseSchema):
    """Event attendee response schema"""

    event_id: UUID
    user_id: UUID
    attendee_name: str
    attendee_title: Optional[str]
    attendee_company: Optional[str]
    attendee_profile_url: Optional[str]
    connected: bool
    connection_date: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True
