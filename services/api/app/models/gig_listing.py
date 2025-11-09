"""
Gig listing models for freelance platform integrations
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


class GigPlatform(str, enum.Enum):
    """Freelance platform types"""

    UPWORK = "upwork"
    FIVERR = "fiverr"
    FREELANCER = "freelancer"
    TOPTAL = "toptal"
    GURU = "guru"


class BudgetType(str, enum.Enum):
    """Budget type for gigs"""

    FIXED = "fixed"
    HOURLY = "hourly"


class GigDuration(str, enum.Enum):
    """Expected project duration"""

    LESS_THAN_WEEK = "less-than-week"
    ONE_TO_FOUR_WEEKS = "one-to-four-weeks"
    ONE_TO_THREE_MONTHS = "one-to-three-months"
    THREE_TO_SIX_MONTHS = "three-to-six-months"
    MORE_THAN_SIX_MONTHS = "more-than-six-months"


class GigComplexity(str, enum.Enum):
    """Project complexity level"""

    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class GigListing(Base):
    """Freelance gig listing model from external platforms"""

    __tablename__ = "gig_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Gig details
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)

    # Client information
    client_name = Column(String(255))
    client_rating = Column(Float)  # 0-5
    client_reviews_count = Column(Integer, default=0)
    client_country = Column(String(100))
    client_verified = Column(Boolean, default=False)

    # Budget
    budget_type = Column(SQLEnum(BudgetType), nullable=False)
    budget_amount = Column(Float)  # Fixed price
    budget_min = Column(Float)  # Hourly min rate
    budget_max = Column(Float)  # Hourly max rate
    currency = Column(String(3), default="USD")

    # Project details
    duration = Column(SQLEnum(GigDuration))
    complexity = Column(SQLEnum(GigComplexity))
    category = Column(String(100))
    subcategory = Column(String(100))

    # Requirements
    skills_required = Column(JSONB)  # list of required skills
    experience_level = Column(String(50))  # entry, intermediate, expert
    deliverables = Column(JSONB)  # list of expected deliverables

    # Dates
    posted_date = Column(DateTime, nullable=False)
    deadline = Column(DateTime)

    # Platform
    platform = Column(SQLEnum(GigPlatform), nullable=False)
    external_id = Column(String(255), unique=True, index=True)
    external_url = Column(String(1000))

    # Stats
    proposals_count = Column(Integer, default=0)
    avg_bid = Column(Float)

    # Match
    match_score = Column(Float)  # 0-100

    # Tracking
    is_saved = Column(Boolean, default=False)
    is_applied = Column(Boolean, default=False)
    proposal_submitted_at = Column(DateTime)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<GigListing {self.title} on {self.platform.value}>"
