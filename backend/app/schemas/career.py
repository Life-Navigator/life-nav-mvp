"""
Career domain schemas.
Handles career profiles, job applications, and interviews.
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.career import (
    ApplicationStatus,
    CareerLevel,
    InterviewOutcome,
    InterviewStatus,
    InterviewType,
    JobSearchStatus,
    RemotePreference,
)
from app.schemas.base import BaseSchema, IDTimestampSchema

# ============================================================================
# CareerProfile Schemas
# ============================================================================


class CareerProfileCreate(BaseSchema):
    """CareerProfile creation schema."""

    headline: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    industry: str | None = Field(default=None, max_length=100)
    current_job_title: str | None = Field(default=None, max_length=255)
    years_of_experience: int | None = Field(default=None, ge=0)
    career_level: CareerLevel | None = None
    desired_job_titles: list[str] | None = None
    desired_industries: list[str] | None = None
    desired_locations: list[str] | None = None
    desired_salary_min: int | None = Field(default=None, ge=0)
    desired_salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str = Field(default="USD", max_length=3)
    remote_preference: RemotePreference | None = None
    open_to_relocation: bool = Field(default=False)
    job_search_status: JobSearchStatus = Field(default=JobSearchStatus.PASSIVE)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    skills: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class CareerProfileUpdate(BaseSchema):
    """CareerProfile update schema."""

    headline: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    industry: str | None = Field(default=None, max_length=100)
    current_job_title: str | None = Field(default=None, max_length=255)
    years_of_experience: int | None = Field(default=None, ge=0)
    career_level: CareerLevel | None = None
    desired_job_titles: list[str] | None = None
    desired_industries: list[str] | None = None
    desired_locations: list[str] | None = None
    desired_salary_min: int | None = Field(default=None, ge=0)
    desired_salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=3)
    remote_preference: RemotePreference | None = None
    open_to_relocation: bool | None = None
    job_search_status: JobSearchStatus | None = None
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    skills: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class CareerProfileResponse(IDTimestampSchema):
    """CareerProfile response schema."""

    headline: str | None
    summary: str | None
    industry: str | None
    current_job_title: str | None
    years_of_experience: int | None
    career_level: CareerLevel | None
    desired_job_titles: list[str] | None
    desired_industries: list[str] | None
    desired_locations: list[str] | None
    desired_salary_min: int | None
    desired_salary_max: int | None
    salary_currency: str
    remote_preference: RemotePreference | None
    open_to_relocation: bool
    job_search_status: JobSearchStatus
    linkedin_url: str | None
    portfolio_url: str | None
    github_url: str | None
    website_url: str | None
    skills: dict[str, Any]
    metadata: dict[str, Any]


# ============================================================================
# JobApplication Schemas
# ============================================================================


class JobApplicationCreate(BaseSchema):
    """JobApplication creation schema."""

    job_title: str = Field(min_length=1, max_length=255)
    company_name: str = Field(min_length=1, max_length=255)
    company_website: str | None = Field(default=None, max_length=500)
    job_url: str | None = Field(default=None, max_length=500)
    job_description: str | None = None
    location: str | None = Field(default=None, max_length=255)
    remote_type: str | None = Field(default=None, max_length=50)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str = Field(default="USD", max_length=3)
    application_date: date
    application_method: str | None = Field(default=None, max_length=100)
    status: ApplicationStatus = Field(default=ApplicationStatus.APPLIED)
    recruiter_name: str | None = Field(default=None, max_length=255)
    recruiter_email: str | None = Field(default=None, max_length=255)
    recruiter_phone: str | None = Field(default=None, max_length=20)
    hiring_manager_name: str | None = Field(default=None, max_length=255)
    resume_version: str | None = Field(default=None, max_length=100)
    cover_letter_version: str | None = Field(default=None, max_length=100)
    referral_source: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class JobApplicationUpdate(BaseSchema):
    """JobApplication update schema."""

    job_title: str | None = Field(default=None, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    company_website: str | None = Field(default=None, max_length=500)
    job_url: str | None = Field(default=None, max_length=500)
    job_description: str | None = None
    location: str | None = Field(default=None, max_length=255)
    remote_type: str | None = Field(default=None, max_length=50)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=3)
    application_date: date | None = None
    application_method: str | None = Field(default=None, max_length=100)
    status: ApplicationStatus | None = None
    recruiter_name: str | None = Field(default=None, max_length=255)
    recruiter_email: str | None = Field(default=None, max_length=255)
    recruiter_phone: str | None = Field(default=None, max_length=20)
    hiring_manager_name: str | None = Field(default=None, max_length=255)
    resume_version: str | None = Field(default=None, max_length=100)
    cover_letter_version: str | None = Field(default=None, max_length=100)
    referral_source: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class JobApplicationResponse(IDTimestampSchema):
    """JobApplication response schema."""

    job_title: str
    company_name: str
    company_website: str | None
    job_url: str | None
    job_description: str | None
    location: str | None
    remote_type: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str
    application_date: date
    application_method: str | None
    status: ApplicationStatus
    recruiter_name: str | None
    recruiter_email: str | None
    recruiter_phone: str | None
    hiring_manager_name: str | None
    resume_version: str | None
    cover_letter_version: str | None
    referral_source: str | None
    metadata: dict[str, Any]
    tags: list[str] | None
    notes: str | None


# ============================================================================
# Interview Schemas
# ============================================================================


class InterviewCreate(BaseSchema):
    """Interview creation schema."""

    application_id: UUID | None = None
    interview_type: InterviewType | None = None
    interview_date: datetime
    duration_minutes: int | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=255)
    meeting_link: str | None = Field(default=None, max_length=500)
    interviewers: dict[str, Any] | None = None
    preparation_notes: str | None = None
    questions_prepared: list[str] | None = None
    status: InterviewStatus = Field(default=InterviewStatus.SCHEDULED)
    outcome: InterviewOutcome | None = None
    feedback: str | None = None
    next_steps: str | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class InterviewUpdate(BaseSchema):
    """Interview update schema."""

    application_id: UUID | None = None
    interview_type: InterviewType | None = None
    interview_date: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=255)
    meeting_link: str | None = Field(default=None, max_length=500)
    interviewers: dict[str, Any] | None = None
    preparation_notes: str | None = None
    questions_prepared: list[str] | None = None
    thank_you_sent: bool | None = None
    thank_you_sent_at: datetime | None = None
    status: InterviewStatus | None = None
    outcome: InterviewOutcome | None = None
    feedback: str | None = None
    next_steps: str | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class InterviewResponse(IDTimestampSchema):
    """Interview response schema."""

    application_id: UUID | None
    interview_type: InterviewType | None
    interview_date: datetime
    duration_minutes: int | None
    location: str | None
    meeting_link: str | None
    interviewers: dict[str, Any]
    preparation_notes: str | None
    questions_prepared: list[str] | None
    thank_you_sent: bool
    thank_you_sent_at: datetime | None
    status: InterviewStatus
    outcome: InterviewOutcome | None
    feedback: str | None
    next_steps: str | None
    metadata: dict[str, Any]
    notes: str | None
