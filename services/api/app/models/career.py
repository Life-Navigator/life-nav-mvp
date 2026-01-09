"""
Career models
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    ForeignKey,
    Integer,
    Date,
    Numeric,
    Boolean,
    Enum,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class EmploymentType(str, enum.Enum):
    """Employment types"""

    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    FREELANCE = "freelance"
    INTERNSHIP = "internship"
    SELF_EMPLOYED = "self_employed"


class SkillLevel(str, enum.Enum):
    """Skill proficiency levels"""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class CareerProfile(Base):
    """Career profile model - uses string IDs to match Prisma"""

    __tablename__ = "career_profiles"

    id = Column(String(255), primary_key=True)
    user_id = Column(
        String(255),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Profile
    headline = Column(String(255))
    summary = Column(Text)
    current_title = Column(String(255))
    current_company = Column(String(255))
    years_of_experience = Column(Integer)

    # Location
    city = Column(String(100))
    state = Column(String(50))
    country = Column(String(100))

    # Preferences
    desired_job_titles = Column(ARRAY(String))
    desired_industries = Column(ARRAY(String))
    desired_locations = Column(ARRAY(String))
    remote_preference = Column(String(50))  # remote, hybrid, onsite

    # Compensation
    current_salary = Column(Numeric(12, 2))
    desired_salary_min = Column(Numeric(12, 2))
    desired_salary_max = Column(Numeric(12, 2))
    currency = Column(String(3), default="USD")

    # Status
    is_actively_looking = Column(Boolean, default=False)
    is_open_to_opportunities = Column(Boolean, default=True)

    # Links
    linkedin_url = Column(String(500))
    github_url = Column(String(500))
    portfolio_url = Column(String(500))
    resume_url = Column(String(500))

    # Metadata
    extra_data = Column(
        "metadata", JSONB
    )  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    experiences = relationship(
        "JobExperience", back_populates="profile", cascade="all, delete-orphan"
    )
    skills = relationship(
        "Skill", back_populates="profile", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<CareerProfile {self.current_title}>"


class JobExperience(Base):
    """Job experience model - uses string IDs to match Prisma"""

    __tablename__ = "job_experiences"

    id = Column(String(255), primary_key=True)
    profile_id = Column(
        String(255), ForeignKey("career_profiles.id"), nullable=False, index=True
    )
    user_id = Column(
        String(255), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Job Info
    company_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    employment_type = Column(Enum(EmploymentType))

    # Location
    location = Column(String(255))
    is_remote = Column(Boolean, default=False)

    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_current = Column(Boolean, default=False)

    # Description
    description = Column(Text)
    achievements = Column(ARRAY(Text))
    technologies = Column(ARRAY(String))

    # Compensation
    salary = Column(Numeric(12, 2))
    currency = Column(String(3), default="USD")

    # Metadata
    extra_data = Column(
        "metadata", JSONB
    )  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("CareerProfile", back_populates="experiences")

    def __repr__(self):
        return f"<JobExperience {self.job_title} at {self.company_name}>"


class Skill(Base):
    """Skill model - uses string IDs to match Prisma"""

    __tablename__ = "skills"

    id = Column(String(255), primary_key=True)
    profile_id = Column(
        String(255), ForeignKey("career_profiles.id"), nullable=False, index=True
    )
    user_id = Column(
        String(255), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Skill Info
    name = Column(String(255), nullable=False)
    category = Column(String(100))  # programming, design, management, etc.
    proficiency = Column(Enum(SkillLevel))

    # Experience
    years_of_experience = Column(Integer)

    # Endorsements
    endorsement_count = Column(Integer, default=0)

    # Status
    is_primary = Column(Boolean, default=False)

    # Metadata
    extra_data = Column(
        "metadata", JSONB
    )  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("CareerProfile", back_populates="skills")

    def __repr__(self):
        return f"<Skill {self.name} ({self.proficiency})>"
