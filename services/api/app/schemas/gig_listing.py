"""
Gig listing schemas
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponseSchema
from app.models.gig_listing import (
    GigPlatform,
    BudgetType,
    GigDuration,
    GigComplexity,
)


# Gig Listing Schemas
class GigListingBase(BaseModel):
    """Base gig listing schema"""

    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_rating: Optional[float] = Field(None, ge=0, le=5)
    client_reviews_count: Optional[int] = 0
    client_country: Optional[str] = None
    client_verified: bool = False
    budget_type: BudgetType
    budget_amount: Optional[float] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: str = "USD"
    duration: Optional[GigDuration] = None
    complexity: Optional[GigComplexity] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    skills_required: Optional[List[str]] = None
    experience_level: Optional[str] = None
    deliverables: Optional[List[str]] = None


class GigListingCreate(GigListingBase):
    """Create gig listing schema"""

    platform: GigPlatform
    external_id: str = Field(..., max_length=255)
    external_url: Optional[str] = None
    posted_date: datetime


class GigListingUpdate(BaseModel):
    """Update gig listing schema"""

    is_saved: Optional[bool] = None
    is_applied: Optional[bool] = None
    match_score: Optional[float] = Field(None, ge=0, le=100)


class GigListingResponse(BaseResponseSchema):
    """Gig listing response schema"""

    user_id: UUID
    title: str
    description: Optional[str]
    client_name: Optional[str]
    client_rating: Optional[float]
    client_reviews_count: int
    client_country: Optional[str]
    client_verified: bool
    budget_type: BudgetType
    budget_amount: Optional[float]
    budget_min: Optional[float]
    budget_max: Optional[float]
    currency: str
    duration: Optional[GigDuration]
    complexity: Optional[GigComplexity]
    category: Optional[str]
    subcategory: Optional[str]
    skills_required: Optional[List[str]]
    experience_level: Optional[str]
    deliverables: Optional[List[str]]
    posted_date: datetime
    deadline: Optional[datetime]
    platform: GigPlatform
    external_id: str
    external_url: Optional[str]
    proposals_count: int
    avg_bid: Optional[float]
    match_score: Optional[float]
    is_saved: bool
    is_applied: bool
    proposal_submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


class GigListingList(BaseModel):
    """Gig listing list response"""

    items: List[GigListingResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class GigSearchFilters(BaseModel):
    """Gig search filters"""

    keywords: Optional[str] = None
    budget_type: Optional[BudgetType] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    complexity: Optional[GigComplexity] = None
    duration: Optional[GigDuration] = None
    category: Optional[str] = None
    skills: Optional[List[str]] = None
    client_verified_only: bool = False
    posted_within_days: Optional[int] = Field(None, ge=1, le=365)
    platform: Optional[GigPlatform] = None


class SaveGigRequest(BaseModel):
    """Request to save a gig"""

    gig_id: UUID


class SubmitProposalRequest(BaseModel):
    """Request to submit a proposal"""

    gig_id: UUID
    bid_amount: float
    proposed_duration: Optional[str] = None
    cover_letter: str
    milestones: Optional[List[dict]] = None
