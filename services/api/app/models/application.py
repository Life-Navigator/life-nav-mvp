"""
Job and gig application tracking models
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
    Float,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    """Application status tracking"""

    APPLIED = "applied"
    VIEWED = "viewed"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"


class InterviewType(str, enum.Enum):
    """Interview types"""

    PHONE = "phone"
    VIDEO = "video"
    ONSITE = "onsite"
    TECHNICAL = "technical"
    HR = "hr"
    PANEL = "panel"


class JobApplication(Base):
    """Job application tracking model"""

    __tablename__ = "job_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Job reference (can reference external or internal job)
    job_listing_id = Column(UUID(as_uuid=True), ForeignKey("job_listings.id"))
    external_job_id = Column(String(255))  # External platform job ID
    job_title = Column(String(500), nullable=False)
    company = Column(String(255), nullable=False)
    platform = Column(String(50), nullable=False)

    # Application details
    status = Column(
        SQLEnum(ApplicationStatus), default=ApplicationStatus.APPLIED, nullable=False
    )
    applied_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Documents
    resume_version = Column(String(255))  # Version or filename
    resume_url = Column(String(1000))
    cover_letter = Column(Text)
    portfolio_url = Column(String(1000))

    # Communication
    notes = Column(Text)
    follow_up_date = Column(DateTime)
    contact_person = Column(String(255))
    contact_email = Column(String(255))

    # Timeline events
    viewed_date = Column(DateTime)
    screening_date = Column(DateTime)
    interview_dates = Column(JSONB)  # list of interview objects with dates and types
    offer_date = Column(DateTime)
    response_deadline = Column(DateTime)
    decision_date = Column(DateTime)

    # Offer details
    offer_salary = Column(Float)
    offer_currency = Column(String(3), default="USD")
    offer_benefits = Column(JSONB)

    # Rejection/Decline
    rejection_reason = Column(Text)
    feedback_received = Column(Text)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<JobApplication {self.job_title} at {self.company} - {self.status.value}>"


class GigProposal(Base):
    """Freelance gig proposal tracking model"""

    __tablename__ = "gig_proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Gig reference
    gig_listing_id = Column(UUID(as_uuid=True), ForeignKey("gig_listings.id"))
    external_gig_id = Column(String(255))
    gig_title = Column(String(500), nullable=False)
    platform = Column(String(50), nullable=False)

    # Proposal details
    status = Column(
        SQLEnum(ApplicationStatus), default=ApplicationStatus.APPLIED, nullable=False
    )
    submitted_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Bid
    bid_amount = Column(Float, nullable=False)
    bid_currency = Column(String(3), default="USD")
    proposed_duration = Column(String(100))  # e.g., "2 weeks", "1 month"
    cover_letter = Column(Text)

    # Milestones
    milestones = Column(JSONB)  # list of proposed milestones

    # Communication
    messages_count = Column(Integer, default=0)
    last_message_date = Column(DateTime)

    # Timeline
    client_viewed_date = Column(DateTime)
    interview_date = Column(DateTime)
    awarded_date = Column(DateTime)
    started_date = Column(DateTime)
    completed_date = Column(DateTime)

    # Contract details (if awarded)
    contract_amount = Column(Float)
    contract_terms = Column(Text)

    # Notes
    notes = Column(Text)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<GigProposal {self.gig_title} - {self.status.value}>"
