"""
Job listing models for job board integrations
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


class Platform(str, enum.Enum):
    """Job platform types"""

    LINKEDIN = "linkedin"
    INDEED = "indeed"
    GLASSDOOR = "glassdoor"
    ZIPRECRUITER = "ziprecruiter"
    MONSTER = "monster"


class LocationType(str, enum.Enum):
    """Location type for jobs"""

    ONSITE = "onsite"
    REMOTE = "remote"
    HYBRID = "hybrid"


class EmploymentType(str, enum.Enum):
    """Employment type"""

    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    TEMPORARY = "temporary"


class ExperienceLevel(str, enum.Enum):
    """Experience level required"""

    ENTRY_LEVEL = "entry-level"
    MID_LEVEL = "mid-level"
    SENIOR_LEVEL = "senior-level"
    EXECUTIVE = "executive"
    INTERNSHIP = "internship"


class JobListing(Base):
    """Job listing model from external platforms"""

    __tablename__ = "job_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Job details
    title = Column(String(500), nullable=False, index=True)
    company = Column(String(255), nullable=False)
    company_logo = Column(String(1000))
    location = Column(String(500))
    location_type = Column(SQLEnum(LocationType))
    employment_type = Column(SQLEnum(EmploymentType))

    # Salary
    salary_min = Column(Float)
    salary_max = Column(Float)
    salary_currency = Column(String(3), default="USD")
    salary_period = Column(String(50))  # hourly, monthly, yearly

    # Description
    description = Column(Text)
    requirements = Column(JSONB)  # list of requirements
    responsibilities = Column(JSONB)  # list of responsibilities
    benefits = Column(JSONB)  # list of benefits
    skills = Column(JSONB)  # list of required skills

    # Experience
    experience_level = Column(SQLEnum(ExperienceLevel))
    years_of_experience_min = Column(Integer)
    years_of_experience_max = Column(Integer)

    # Category & Industry
    category = Column(String(100))
    industry = Column(String(100))

    # Dates
    posted_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime)

    # Platform
    platform = Column(SQLEnum(Platform), nullable=False)
    external_id = Column(String(255), unique=True, index=True)  # ID from external platform
    external_url = Column(String(1000))

    # Stats
    applicants = Column(Integer, default=0)
    views = Column(Integer, default=0)

    # Match
    match_score = Column(Float)  # 0-100, calculated based on user profile

    # Tracking
    is_saved = Column(Boolean, default=False)
    is_applied = Column(Boolean, default=False)
    applied_at = Column(DateTime)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<JobListing {self.title} at {self.company}>"
