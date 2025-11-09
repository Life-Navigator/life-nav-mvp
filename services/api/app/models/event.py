"""
Event models for networking and professional development
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
import uuid
import enum

from app.core.database import Base


class EventPlatform(str, enum.Enum):
    """Event platform types"""

    EVENTBRITE = "eventbrite"
    MEETUP = "meetup"
    CHAMBER = "chamber"
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"


class EventCategory(str, enum.Enum):
    """Event categories"""

    NETWORKING = "networking"
    WORKSHOP = "workshop"
    CONFERENCE = "conference"
    SEMINAR = "seminar"
    CAREER_FAIR = "career-fair"
    MEETUP = "meetup"
    WEBINAR = "webinar"
    TRAINING = "training"
    SOCIAL = "social"


class EventStatus(str, enum.Enum):
    """Event status"""

    UPCOMING = "upcoming"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RSVPStatus(str, enum.Enum):
    """RSVP status"""

    GOING = "going"
    INTERESTED = "interested"
    NOT_GOING = "not-going"
    WAITLIST = "waitlist"


class Event(Base):
    """Event model from external platforms"""

    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Event details
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    category = Column(SQLEnum(EventCategory))

    # Organizer
    organizer_name = Column(String(255))
    organizer_logo = Column(String(1000))
    organizer_url = Column(String(1000))

    # Date & Time
    start_date = Column(DateTime, nullable=False, index=True)
    end_date = Column(DateTime)
    timezone = Column(String(100))

    # Location
    is_virtual = Column(Boolean, default=False)
    venue_name = Column(String(255))
    address = Column(String(500))
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))

    # Virtual details
    online_url = Column(String(1000))
    meeting_platform = Column(String(50))  # zoom, teams, etc.

    # Registration
    requires_registration = Column(Boolean, default=True)
    registration_url = Column(String(1000))
    registration_deadline = Column(DateTime)

    # Capacity
    capacity = Column(Integer)
    attendees_count = Column(Integer, default=0)
    waitlist_available = Column(Boolean, default=False)

    # Pricing
    is_free = Column(Boolean, default=True)
    price = Column(Float)
    price_currency = Column(String(3), default="USD")

    # Status
    status = Column(SQLEnum(EventStatus), default=EventStatus.UPCOMING)

    # Platform
    platform = Column(SQLEnum(EventPlatform), nullable=False)
    external_id = Column(String(255), unique=True, index=True)
    external_url = Column(String(1000))

    # Tags & Topics
    tags = Column(JSONB)  # list of tags
    topics = Column(JSONB)  # list of topics

    # Match
    match_score = Column(Float)  # 0-100 based on user interests

    # Tracking
    is_saved = Column(Boolean, default=False)
    rsvp_status = Column(SQLEnum(RSVPStatus))
    rsvp_date = Column(DateTime)
    attended = Column(Boolean)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Event {self.title} on {self.start_date}>"


class EventAttendee(Base):
    """Event attendee tracking for networking"""

    __tablename__ = "event_attendees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Attendee info (from platform)
    attendee_name = Column(String(255))
    attendee_title = Column(String(255))
    attendee_company = Column(String(255))
    attendee_profile_url = Column(String(1000))

    # Connection
    connected = Column(Boolean, default=False)
    connection_date = Column(DateTime)
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<EventAttendee {self.attendee_name}>"
