"""
Education domain models.
Handles education credentials and courses.
"""

from datetime import date
from decimal import Decimal
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import ARRAY, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import BaseTenantModel


class CredentialType(str, PyEnum):
    """Education credential type enumeration."""

    HIGH_SCHOOL = "high_school"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    DOCTORATE = "doctorate"
    CERTIFICATE = "certificate"
    BOOTCAMP = "bootcamp"
    PROFESSIONAL_CERTIFICATION = "professional_certification"


class CredentialStatus(str, PyEnum):
    """Education credential status enumeration."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    INCOMPLETE = "incomplete"
    DROPPED = "dropped"


class CourseStatus(str, PyEnum):
    """Course status enumeration."""

    ENROLLED = "enrolled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DROPPED = "dropped"
    ON_HOLD = "on_hold"


class DifficultyLevel(str, PyEnum):
    """Course difficulty level enumeration."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class EducationCredential(BaseTenantModel, Base):
    """
    Education credential model.
    Represents degrees, certifications, and other credentials.
    """

    __tablename__ = "education_credentials"

    # Credential details
    credential_type: Mapped[CredentialType] = mapped_column(
        Enum(CredentialType), nullable=False, index=True
    )
    credential_name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    field_of_study: Mapped[str | None] = mapped_column(String(255))
    major: Mapped[str | None] = mapped_column(String(255))
    minor: Mapped[str | None] = mapped_column(String(255))

    # Dates
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    graduation_date: Mapped[date | None] = mapped_column(Date)
    expected_graduation_date: Mapped[date | None] = mapped_column(Date)

    # Status
    status: Mapped[CredentialStatus] = mapped_column(
        Enum(CredentialStatus),
        default=CredentialStatus.IN_PROGRESS,
        nullable=False,
    )

    # Details
    gpa: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    gpa_scale: Mapped[Decimal] = mapped_column(
        Numeric(3, 1), default=Decimal("4.0"), nullable=False
    )
    honors: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    thesis_title: Mapped[str | None] = mapped_column(Text)

    # Verification
    credential_id: Mapped[str | None] = mapped_column(String(255))
    credential_url: Mapped[str | None] = mapped_column(String(500))
    verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    verification_date: Mapped[date | None] = mapped_column(Date)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)


class Course(BaseTenantModel, Base):
    """
    Course model.
    Represents individual courses and learning programs.
    """

    __tablename__ = "courses"

    # Credential relationship
    credential_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("education_credentials.id", ondelete="SET NULL"),
    )

    # Course details
    course_name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_code: Mapped[str | None] = mapped_column(String(50))
    provider: Mapped[str | None] = mapped_column(String(255), index=True)
    platform: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    difficulty_level: Mapped[DifficultyLevel | None] = mapped_column(Enum(DifficultyLevel))

    # Dates
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    enrollment_date: Mapped[date | None] = mapped_column(Date)
    completion_date: Mapped[date | None] = mapped_column(Date)

    # Progress
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus),
        default=CourseStatus.ENROLLED,
        nullable=False,
        index=True,
    )
    progress_percentage: Mapped[int | None] = mapped_column()
    hours_completed: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    total_hours: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Outcome
    grade: Mapped[str | None] = mapped_column(String(10))
    certificate_url: Mapped[str | None] = mapped_column(String(500))
    certificate_id: Mapped[str | None] = mapped_column(String(255))

    # Cost
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Metadata
    skills_learned: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)
