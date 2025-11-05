"""
Goal models
"""
from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Date, Numeric, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class GoalCategory(str, enum.Enum):
    """Goal categories"""
    FINANCIAL = "financial"
    HEALTH = "health"
    CAREER = "career"
    EDUCATION = "education"
    PERSONAL = "personal"
    FAMILY = "family"
    OTHER = "other"


class GoalStatus(str, enum.Enum):
    """Goal status"""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class GoalPriority(str, enum.Enum):
    """Goal priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Goal(Base):
    """Goal model"""

    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Goal Info
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(Enum(GoalCategory), nullable=False)
    status = Column(Enum(GoalStatus), default=GoalStatus.DRAFT)
    priority = Column(Enum(GoalPriority), default=GoalPriority.MEDIUM)

    # Target & Progress
    target_value = Column(Numeric(15, 2))
    current_value = Column(Numeric(15, 2), default=0)
    unit = Column(String(50))
    progress_percentage = Column(Integer, default=0)

    # Dates
    start_date = Column(Date)
    target_date = Column(Date)
    completed_at = Column(DateTime)

    # Additional data
    tags = Column(JSONB)
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    milestones = relationship("GoalMilestone", back_populates="goal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Goal {self.title}>"


class GoalMilestone(Base):
    """Goal milestone model"""

    __tablename__ = "goal_milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Milestone Info
    title = Column(String(255), nullable=False)
    description = Column(Text)
    target_value = Column(Numeric(15, 2))
    is_completed = Column(Boolean, default=False)

    # Dates
    target_date = Column(Date)
    completed_at = Column(DateTime)

    # Order
    order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    goal = relationship("Goal", back_populates="milestones")

    def __repr__(self):
        return f"<GoalMilestone {self.title}>"
