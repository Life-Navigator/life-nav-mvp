"""
Job listing schemas
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponseSchema
from app.models.job_listing import (
    Platform,
    LocationType,
    EmploymentType,
    ExperienceLevel,
)


# Job Listing Schemas
class JobListingBase(BaseModel):
    """Base job listing schema"""

    title: str = Field(..., max_length=500)
    company: str = Field(..., max_length=255)
    company_logo: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[LocationType] = None
    employment_type: Optional[EmploymentType] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: str = "USD"
    salary_period: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    responsibilities: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    experience_level: Optional[ExperienceLevel] = None
    years_of_experience_min: Optional[int] = None
    years_of_experience_max: Optional[int] = None
    category: Optional[str] = None
    industry: Optional[str] = None


class JobListingCreate(JobListingBase):
    """Create job listing schema"""

    platform: Platform
    external_id: str = Field(..., max_length=255)
    external_url: Optional[str] = None
    posted_date: datetime


class JobListingUpdate(BaseModel):
    """Update job listing schema"""

    is_saved: Optional[bool] = None
    is_applied: Optional[bool] = None
    match_score: Optional[float] = Field(None, ge=0, le=100)


class JobListingResponse(BaseResponseSchema):
    """Job listing response schema"""

    user_id: UUID
    title: str
    company: str
    company_logo: Optional[str]
    location: Optional[str]
    location_type: Optional[LocationType]
    employment_type: Optional[EmploymentType]
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_currency: str
    salary_period: Optional[str]
    description: Optional[str]
    requirements: Optional[List[str]]
    responsibilities: Optional[List[str]]
    benefits: Optional[List[str]]
    skills: Optional[List[str]]
    experience_level: Optional[ExperienceLevel]
    years_of_experience_min: Optional[int]
    years_of_experience_max: Optional[int]
    category: Optional[str]
    industry: Optional[str]
    posted_date: datetime
    expiry_date: Optional[datetime]
    platform: Platform
    external_id: str
    external_url: Optional[str]
    applicants: int
    views: int
    match_score: Optional[float]
    is_saved: bool
    is_applied: bool
    applied_at: Optional[datetime]

    class Config:
        from_attributes = True


class JobListingList(BaseModel):
    """Job listing list response"""

    items: List[JobListingResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class JobSearchFilters(BaseModel):
    """Job search filters"""

    keywords: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[LocationType] = None
    employment_type: Optional[EmploymentType] = None
    experience_level: Optional[ExperienceLevel] = None
    salary_min: Optional[float] = None
    industry: Optional[str] = None
    skills: Optional[List[str]] = None
    posted_within_days: Optional[int] = Field(None, ge=1, le=365)
    platform: Optional[Platform] = None


class SaveJobRequest(BaseModel):
    """Request to save a job"""

    job_id: UUID


class ApplyToJobRequest(BaseModel):
    """Request to apply to a job"""

    job_id: UUID
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    notes: Optional[str] = None
