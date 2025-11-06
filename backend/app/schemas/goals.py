"""
Goals domain schemas.
Handles goals and milestones tracking.
"""

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.goals import (
    GoalCategory,
    GoalStatus,
    GoalType,
    MilestoneStatus,
    Priority,
)
from app.schemas.base import BaseSchema, IDTimestampSchema


# ============================================================================
# Goal Schemas
# ============================================================================


class GoalCreate(BaseSchema):
    """Goal creation schema."""

    parent_goal_id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: GoalCategory | None = None
    goal_type: GoalType | None = None
    is_specific: bool = Field(default=False)
    is_measurable: bool = Field(default=False)
    is_achievable: bool = Field(default=False)
    is_relevant: bool = Field(default=False)
    is_time_bound: bool = Field(default=False)
    start_date: date | None = None
    target_date: date | None = None
    status: GoalStatus = Field(default=GoalStatus.NOT_STARTED)
    progress_percentage: int = Field(default=0, ge=0, le=100)
    metric_name: str | None = Field(default=None, max_length=255)
    metric_unit: str | None = Field(default=None, max_length=50)
    target_value: Decimal | None = None
    current_value: Decimal | None = None
    priority: Priority = Field(default=Priority.MEDIUM)
    importance_score: int | None = Field(default=None, ge=1, le=10)
    urgency_score: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class GoalUpdate(BaseSchema):
    """Goal update schema."""

    parent_goal_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    category: GoalCategory | None = None
    goal_type: GoalType | None = None
    is_specific: bool | None = None
    is_measurable: bool | None = None
    is_achievable: bool | None = None
    is_relevant: bool | None = None
    is_time_bound: bool | None = None
    start_date: date | None = None
    target_date: date | None = None
    completed_date: date | None = None
    status: GoalStatus | None = None
    progress_percentage: int | None = Field(default=None, ge=0, le=100)
    metric_name: str | None = Field(default=None, max_length=255)
    metric_unit: str | None = Field(default=None, max_length=50)
    target_value: Decimal | None = None
    current_value: Decimal | None = None
    priority: Priority | None = None
    importance_score: int | None = Field(default=None, ge=1, le=10)
    urgency_score: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class GoalResponse(IDTimestampSchema):
    """Goal response schema."""

    parent_goal_id: UUID | None
    title: str
    description: str | None
    category: GoalCategory | None
    goal_type: GoalType | None
    is_specific: bool
    is_measurable: bool
    is_achievable: bool
    is_relevant: bool
    is_time_bound: bool
    start_date: date | None
    target_date: date | None
    completed_date: date | None
    status: GoalStatus
    progress_percentage: int
    metric_name: str | None
    metric_unit: str | None
    target_value: Decimal | None
    current_value: Decimal | None
    priority: Priority
    importance_score: int | None
    urgency_score: int | None
    tags: list[str] | None
    metadata: dict[str, Any]
    notes: str | None


# ============================================================================
# Milestone Schemas
# ============================================================================


class MilestoneCreate(BaseSchema):
    """Milestone creation schema."""

    goal_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    target_date: date | None = None
    status: MilestoneStatus = Field(default=MilestoneStatus.PENDING)
    is_required: bool = Field(default=True)
    order_index: int | None = Field(default=None, ge=0)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class MilestoneUpdate(BaseSchema):
    """Milestone update schema."""

    goal_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    target_date: date | None = None
    completed_date: date | None = None
    status: MilestoneStatus | None = None
    is_required: bool | None = None
    order_index: int | None = Field(default=None, ge=0)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class MilestoneResponse(IDTimestampSchema):
    """Milestone response schema."""

    goal_id: UUID
    title: str
    description: str | None
    target_date: date | None
    completed_date: date | None
    status: MilestoneStatus
    is_required: bool
    order_index: int | None
    metadata: dict[str, Any]
    notes: str | None
