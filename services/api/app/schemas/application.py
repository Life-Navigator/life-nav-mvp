"""
Application and proposal schemas
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponseSchema
from app.models.application import ApplicationStatus, InterviewType


# Job Application Schemas
class JobApplicationBase(BaseModel):
    """Base job application schema"""

    job_title: str = Field(..., max_length=500)
    company: str = Field(..., max_length=255)
    platform: str = Field(..., max_length=50)
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    portfolio_url: Optional[str] = None
    notes: Optional[str] = None


class JobApplicationCreate(JobApplicationBase):
    """Create job application schema"""

    job_listing_id: Optional[UUID] = None
    external_job_id: Optional[str] = None
    resume_version: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None


class JobApplicationUpdate(BaseModel):
    """Update job application schema"""

    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    follow_up_date: Optional[datetime] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    viewed_date: Optional[datetime] = None
    screening_date: Optional[datetime] = None
    interview_dates: Optional[List[dict]] = None
    offer_date: Optional[datetime] = None
    response_deadline: Optional[datetime] = None
    decision_date: Optional[datetime] = None
    offer_salary: Optional[float] = None
    offer_currency: Optional[str] = None
    offer_benefits: Optional[List[str]] = None
    rejection_reason: Optional[str] = None
    feedback_received: Optional[str] = None


class JobApplicationResponse(BaseResponseSchema):
    """Job application response schema"""

    user_id: UUID
    job_listing_id: Optional[UUID]
    external_job_id: Optional[str]
    job_title: str
    company: str
    platform: str
    status: ApplicationStatus
    applied_date: datetime
    resume_version: Optional[str]
    resume_url: Optional[str]
    cover_letter: Optional[str]
    portfolio_url: Optional[str]
    notes: Optional[str]
    follow_up_date: Optional[datetime]
    contact_person: Optional[str]
    contact_email: Optional[str]
    viewed_date: Optional[datetime]
    screening_date: Optional[datetime]
    interview_dates: Optional[List[dict]]
    offer_date: Optional[datetime]
    response_deadline: Optional[datetime]
    decision_date: Optional[datetime]
    offer_salary: Optional[float]
    offer_currency: Optional[str]
    offer_benefits: Optional[List[str]]
    rejection_reason: Optional[str]
    feedback_received: Optional[str]

    class Config:
        from_attributes = True


class JobApplicationList(BaseModel):
    """Job application list response"""

    items: List[JobApplicationResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class ApplicationStats(BaseModel):
    """Application statistics"""

    total_applications: int
    by_status: dict  # {status: count}
    active_applications: int
    interviews_scheduled: int
    offers_received: int
    avg_response_time_days: Optional[float]
    success_rate: Optional[float]


# Gig Proposal Schemas
class GigProposalBase(BaseModel):
    """Base gig proposal schema"""

    gig_title: str = Field(..., max_length=500)
    platform: str = Field(..., max_length=50)
    bid_amount: float
    bid_currency: str = "USD"
    proposed_duration: Optional[str] = None
    cover_letter: str


class GigProposalCreate(GigProposalBase):
    """Create gig proposal schema"""

    gig_listing_id: Optional[UUID] = None
    external_gig_id: Optional[str] = None
    milestones: Optional[List[dict]] = None


class GigProposalUpdate(BaseModel):
    """Update gig proposal schema"""

    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    client_viewed_date: Optional[datetime] = None
    interview_date: Optional[datetime] = None
    awarded_date: Optional[datetime] = None
    started_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    contract_amount: Optional[float] = None
    contract_terms: Optional[str] = None
    messages_count: Optional[int] = None
    last_message_date: Optional[datetime] = None


class GigProposalResponse(BaseResponseSchema):
    """Gig proposal response schema"""

    user_id: UUID
    gig_listing_id: Optional[UUID]
    external_gig_id: Optional[str]
    gig_title: str
    platform: str
    status: ApplicationStatus
    submitted_date: datetime
    bid_amount: float
    bid_currency: str
    proposed_duration: Optional[str]
    cover_letter: str
    milestones: Optional[List[dict]]
    messages_count: int
    last_message_date: Optional[datetime]
    client_viewed_date: Optional[datetime]
    interview_date: Optional[datetime]
    awarded_date: Optional[datetime]
    started_date: Optional[datetime]
    completed_date: Optional[datetime]
    contract_amount: Optional[float]
    contract_terms: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class GigProposalList(BaseModel):
    """Gig proposal list response"""

    items: List[GigProposalResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
