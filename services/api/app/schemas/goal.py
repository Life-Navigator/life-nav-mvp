"""
Goal schemas
"""
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, UUID4, Field
from app.schemas.base import BaseResponseSchema
from app.models.goal import GoalCategory, GoalStatus, GoalPriority


class GoalMilestoneBase(BaseModel):
    """Base milestone schema"""
    title: str
    description: Optional[str] = None
    target_value: Optional[Decimal] = None
    target_date: Optional[date] = None


class GoalMilestoneCreate(GoalMilestoneBase):
    """Milestone creation schema"""
    order: int = 0


class GoalMilestoneUpdate(BaseModel):
    """Milestone update schema"""
    title: Optional[str] = None
    description: Optional[str] = None
    target_value: Optional[Decimal] = None
    target_date: Optional[date] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None


class GoalMilestoneResponse(BaseResponseSchema):
    """Milestone response schema"""
    goal_id: UUID4
    title: str
    description: Optional[str]
    target_value: Optional[Decimal]
    target_date: Optional[date]
    is_completed: bool
    completed_at: Optional[datetime]
    order: int


class GoalBase(BaseModel):
    """Base goal schema"""
    title: str
    description: Optional[str] = None
    category: GoalCategory
    priority: GoalPriority = GoalPriority.MEDIUM


class GoalCreate(GoalBase):
    """Goal creation schema"""
    target_value: Optional[Decimal] = None
    unit: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    tags: Optional[List[str]] = None


class GoalUpdate(BaseModel):
    """Goal update schema"""
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[GoalCategory] = None
    status: Optional[GoalStatus] = None
    priority: Optional[GoalPriority] = None
    target_value: Optional[Decimal] = None
    current_value: Optional[Decimal] = None
    unit: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    tags: Optional[List[str]] = None


class GoalResponse(BaseResponseSchema):
    """Goal response schema"""
    title: str
    description: Optional[str]
    category: GoalCategory
    status: GoalStatus
    priority: GoalPriority
    target_value: Optional[Decimal]
    current_value: Decimal
    unit: Optional[str]
    progress_percentage: int
    start_date: Optional[date]
    target_date: Optional[date]
    completed_at: Optional[datetime]
    tags: Optional[List[str]]
    milestones: List[GoalMilestoneResponse] = []
