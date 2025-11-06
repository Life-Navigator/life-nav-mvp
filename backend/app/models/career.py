"""
Career domain models.
Handles career profiles, job applications, and interviews.
"""

from datetime import date, datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import ARRAY, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import BaseTenantModel


class CareerLevel(str, PyEnum):
    """Career level enumeration."""

    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    MANAGER = "manager"
    DIRECTOR = "director"
    VP = "vp"
    C_LEVEL = "c-level"


class RemotePreference(str, PyEnum):
    """Remote work preference enumeration."""

    ON_SITE = "on-site"
    HYBRID = "hybrid"
    REMOTE = "remote"
    FLEXIBLE = "flexible"


class JobSearchStatus(str, PyEnum):
    """Job search status enumeration."""

    NOT_LOOKING = "not_looking"
    PASSIVE = "passive"
    ACTIVE = "active"
    URGENT = "urgent"


class ApplicationStatus(str, PyEnum):
    """Job application status enumeration."""

    SAVED = "saved"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class InterviewType(str, PyEnum):
    """Interview type enumeration."""

    PHONE_SCREEN = "phone_screen"
    VIDEO = "video"
    ON_SITE = "on-site"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    PANEL = "panel"
    FINAL = "final"


class InterviewStatus(str, PyEnum):
    """Interview status enumeration."""

    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class InterviewOutcome(str, PyEnum):
    """Interview outcome enumeration."""

    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    WAITING_FEEDBACK = "waiting_feedback"


class CareerProfile(BaseTenantModel, Base):
    """
    Career profile model.
    Represents a user's career profile and job search preferences.
    """

    __tablename__ = "career_profiles"

    # Profile details
    headline: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(String(100), index=True)
    current_job_title: Mapped[str | None] = mapped_column(String(255))
    years_of_experience: Mapped[int | None] = mapped_column()
    career_level: Mapped[CareerLevel | None] = mapped_column(Enum(CareerLevel))

    # Preferences
    desired_job_titles: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    desired_industries: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    desired_locations: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    desired_salary_min: Mapped[int | None] = mapped_column()
    desired_salary_max: Mapped[int | None] = mapped_column()
    salary_currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    remote_preference: Mapped[RemotePreference | None] = mapped_column(Enum(RemotePreference))
    open_to_relocation: Mapped[bool] = mapped_column(default=False, nullable=False)
    job_search_status: Mapped[JobSearchStatus] = mapped_column(
        Enum(JobSearchStatus),
        default=JobSearchStatus.PASSIVE,
        nullable=False,
    )

    # Links
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    portfolio_url: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))
    website_url: Mapped[str | None] = mapped_column(String(500))

    # Metadata
    skills: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")


class JobApplication(BaseTenantModel, Base):
    """
    Job application model.
    Tracks job applications and their status.
    """

    __tablename__ = "job_applications"

    # Job details
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_website: Mapped[str | None] = mapped_column(String(500))
    job_url: Mapped[str | None] = mapped_column(String(500))
    job_description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    remote_type: Mapped[str | None] = mapped_column(String(50))
    salary_min: Mapped[int | None] = mapped_column()
    salary_max: Mapped[int | None] = mapped_column()
    salary_currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Application details
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    application_method: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus),
        default=ApplicationStatus.APPLIED,
        nullable=False,
        index=True,
    )

    # Contact
    recruiter_name: Mapped[str | None] = mapped_column(String(255))
    recruiter_email: Mapped[str | None] = mapped_column(String(255))
    recruiter_phone: Mapped[str | None] = mapped_column(String(20))
    hiring_manager_name: Mapped[str | None] = mapped_column(String(255))

    # Tracking
    resume_version: Mapped[str | None] = mapped_column(String(100))
    cover_letter_version: Mapped[str | None] = mapped_column(String(100))
    referral_source: Mapped[str | None] = mapped_column(String(255))

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    notes: Mapped[str | None] = mapped_column(Text)


class Interview(BaseTenantModel, Base):
    """
    Interview model.
    Tracks interviews for job applications.
    """

    __tablename__ = "interviews"

    # Application relationship
    application_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE"),
        index=True,
    )

    # Interview details
    interview_type: Mapped[InterviewType | None] = mapped_column(Enum(InterviewType))
    interview_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int | None] = mapped_column()
    location: Mapped[str | None] = mapped_column(String(255))
    meeting_link: Mapped[str | None] = mapped_column(String(500))

    # Participants
    interviewers: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")

    # Preparation
    preparation_notes: Mapped[str | None] = mapped_column(Text)
    questions_prepared: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Follow-up
    thank_you_sent: Mapped[bool] = mapped_column(default=False, nullable=False)
    thank_you_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Outcome
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(InterviewStatus),
        default=InterviewStatus.SCHEDULED,
        nullable=False,
    )
    outcome: Mapped[InterviewOutcome | None] = mapped_column(Enum(InterviewOutcome))
    feedback: Mapped[str | None] = mapped_column(Text)
    next_steps: Mapped[str | None] = mapped_column(Text)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)
