"""
Goals domain models.
Handles goals and milestones tracking.
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


class GoalCategory(str, PyEnum):
    """Goal category enumeration."""

    FINANCIAL = "financial"
    CAREER = "career"
    EDUCATION = "education"
    HEALTH = "health"
    RELATIONSHIPS = "relationships"
    PERSONAL = "personal"
    FAMILY = "family"
    TRAVEL = "travel"
    OTHER = "other"


class GoalType(str, PyEnum):
    """Goal type enumeration."""

    SHORT_TERM = "short_term"
    MEDIUM_TERM = "medium_term"
    LONG_TERM = "long_term"
    HABIT = "habit"


class GoalStatus(str, PyEnum):
    """Goal status enumeration."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ON_HOLD = "on_hold"


class Priority(str, PyEnum):
    """Priority level enumeration."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MilestoneStatus(str, PyEnum):
    """Milestone status enumeration."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class Goal(BaseTenantModel, Base):
    """
    Goal model.
    Represents user goals with SMART framework tracking.
    """

    __tablename__ = "goals"

    # Parent relationship for sub-goals
    parent_goal_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
    )

    # Goal details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[GoalCategory | None] = mapped_column(Enum(GoalCategory), index=True)
    goal_type: Mapped[GoalType | None] = mapped_column(Enum(GoalType))

    # SMART framework
    is_specific: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_measurable: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_achievable: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_relevant: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_time_bound: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Timeline
    start_date: Mapped[date | None] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date, index=True)
    completed_date: Mapped[date | None] = mapped_column(Date)

    # Progress tracking
    status: Mapped[GoalStatus] = mapped_column(
        Enum(GoalStatus),
        default=GoalStatus.NOT_STARTED,
        nullable=False,
        index=True,
    )
    progress_percentage: Mapped[int] = mapped_column(default=0, nullable=False)

    # Measurement
    metric_name: Mapped[str | None] = mapped_column(String(255))
    metric_unit: Mapped[str | None] = mapped_column(String(50))
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    current_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))

    # Priority
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority),
        default=Priority.MEDIUM,
        nullable=False,
    )
    importance_score: Mapped[int | None] = mapped_column()
    urgency_score: Mapped[int | None] = mapped_column()

    # Metadata
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)


class Milestone(BaseTenantModel, Base):
    """
    Milestone model.
    Represents milestones for goals.
    """

    __tablename__ = "milestones"

    # Goal relationship
    goal_id: Mapped[UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Milestone details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    target_date: Mapped[date | None] = mapped_column(Date)
    completed_date: Mapped[date | None] = mapped_column(Date)

    # Status
    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus),
        default=MilestoneStatus.PENDING,
        nullable=False,
        index=True,
    )
    is_required: Mapped[bool] = mapped_column(default=True, nullable=False)
    order_index: Mapped[int | None] = mapped_column()

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)
