"""
Education domain schemas.
Handles education credentials and courses.
"""

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.education import (
    CourseStatus,
    CredentialStatus,
    CredentialType,
    DifficultyLevel,
)
from app.schemas.base import BaseSchema, IDTimestampSchema


# ============================================================================
# EducationCredential Schemas
# ============================================================================


class EducationCredentialCreate(BaseSchema):
    """EducationCredential creation schema."""

    credential_type: CredentialType
    credential_name: str = Field(min_length=1, max_length=255)
    institution_name: str = Field(min_length=1, max_length=255)
    field_of_study: str | None = Field(default=None, max_length=255)
    major: str | None = Field(default=None, max_length=255)
    minor: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    graduation_date: date | None = None
    expected_graduation_date: date | None = None
    status: CredentialStatus = Field(default=CredentialStatus.IN_PROGRESS)
    gpa: Decimal | None = Field(default=None, ge=0, le=10)
    gpa_scale: Decimal = Field(default=Decimal("4.0"), ge=0, le=10)
    honors: list[str] | None = None
    thesis_title: str | None = None
    credential_id: str | None = Field(default=None, max_length=255)
    credential_url: str | None = Field(default=None, max_length=500)
    verified: bool = Field(default=False)
    verification_date: date | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class EducationCredentialUpdate(BaseSchema):
    """EducationCredential update schema."""

    credential_type: CredentialType | None = None
    credential_name: str | None = Field(default=None, max_length=255)
    institution_name: str | None = Field(default=None, max_length=255)
    field_of_study: str | None = Field(default=None, max_length=255)
    major: str | None = Field(default=None, max_length=255)
    minor: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    graduation_date: date | None = None
    expected_graduation_date: date | None = None
    status: CredentialStatus | None = None
    gpa: Decimal | None = Field(default=None, ge=0, le=10)
    gpa_scale: Decimal | None = Field(default=None, ge=0, le=10)
    honors: list[str] | None = None
    thesis_title: str | None = None
    credential_id: str | None = Field(default=None, max_length=255)
    credential_url: str | None = Field(default=None, max_length=500)
    verified: bool | None = None
    verification_date: date | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class EducationCredentialResponse(IDTimestampSchema):
    """EducationCredential response schema."""

    credential_type: CredentialType
    credential_name: str
    institution_name: str
    field_of_study: str | None
    major: str | None
    minor: str | None
    start_date: date | None
    end_date: date | None
    graduation_date: date | None
    expected_graduation_date: date | None
    status: CredentialStatus
    gpa: Decimal | None
    gpa_scale: Decimal
    honors: list[str] | None
    thesis_title: str | None
    credential_id: str | None
    credential_url: str | None
    verified: bool
    verification_date: date | None
    metadata: dict[str, Any]
    notes: str | None


# ============================================================================
# Course Schemas
# ============================================================================


class CourseCreate(BaseSchema):
    """Course creation schema."""

    credential_id: UUID | None = None
    course_name: str = Field(min_length=1, max_length=255)
    course_code: str | None = Field(default=None, max_length=50)
    provider: str | None = Field(default=None, max_length=255)
    platform: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    difficulty_level: DifficultyLevel | None = None
    start_date: date | None = None
    end_date: date | None = None
    enrollment_date: date | None = None
    completion_date: date | None = None
    status: CourseStatus = Field(default=CourseStatus.ENROLLED)
    progress_percentage: int | None = Field(default=None, ge=0, le=100)
    hours_completed: Decimal | None = Field(default=None, ge=0)
    total_hours: Decimal | None = Field(default=None, ge=0)
    grade: str | None = Field(default=None, max_length=10)
    certificate_url: str | None = Field(default=None, max_length=500)
    certificate_id: str | None = Field(default=None, max_length=255)
    cost: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=3)
    skills_learned: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class CourseUpdate(BaseSchema):
    """Course update schema."""

    credential_id: UUID | None = None
    course_name: str | None = Field(default=None, max_length=255)
    course_code: str | None = Field(default=None, max_length=50)
    provider: str | None = Field(default=None, max_length=255)
    platform: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    difficulty_level: DifficultyLevel | None = None
    start_date: date | None = None
    end_date: date | None = None
    enrollment_date: date | None = None
    completion_date: date | None = None
    status: CourseStatus | None = None
    progress_percentage: int | None = Field(default=None, ge=0, le=100)
    hours_completed: Decimal | None = Field(default=None, ge=0)
    total_hours: Decimal | None = Field(default=None, ge=0)
    grade: str | None = Field(default=None, max_length=10)
    certificate_url: str | None = Field(default=None, max_length=500)
    certificate_id: str | None = Field(default=None, max_length=255)
    cost: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=3)
    skills_learned: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class CourseResponse(IDTimestampSchema):
    """Course response schema."""

    credential_id: UUID | None
    course_name: str
    course_code: str | None
    provider: str | None
    platform: str | None
    category: str | None
    difficulty_level: DifficultyLevel | None
    start_date: date | None
    end_date: date | None
    enrollment_date: date | None
    completion_date: date | None
    status: CourseStatus
    progress_percentage: int | None
    hours_completed: Decimal | None
    total_hours: Decimal | None
    grade: str | None
    certificate_url: str | None
    certificate_id: str | None
    cost: Decimal | None
    currency: str
    skills_learned: list[str] | None
    metadata: dict[str, Any]
    notes: str | None
