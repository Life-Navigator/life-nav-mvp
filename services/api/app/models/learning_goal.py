"""Learning goal models for educational planning and tracking."""

import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class GoalType(str, enum.Enum):
    """Types of learning goals."""

    EARN_CREDENTIAL = "earn_credential"
    COMPLETE_COURSE = "complete_course"
    MASTER_SKILL = "master_skill"
    LEARNING_HOURS = "learning_hours"
    CAREER_TRANSITION = "career_transition"
    CERTIFICATION = "certification"
    READING_GOAL = "reading_goal"
    PROJECT_COMPLETION = "project_completion"


class GoalPriority(str, enum.Enum):
    """Priority levels for goals."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GoalStatus(str, enum.Enum):
    """Status of learning goals."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ON_HOLD = "on_hold"


class LearningGoal(Base):
    """Model for learning goals and planning."""

    __tablename__ = "learning_goals"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, index=True, nullable=False)

    # Goal details
    goal_type = Column(SQLEnum(GoalType), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    priority = Column(SQLEnum(GoalPriority), default=GoalPriority.MEDIUM)

    # Target specifics
    target_credential = Column(String)
    target_skill = Column(String)
    target_hours = Column(Integer)
    target_courses = Column(JSON)  # Course IDs to complete
    target_books = Column(JSON)  # Books to read
    target_projects = Column(JSON)  # Projects to complete

    # Timeline
    target_date = Column(DateTime)
    start_date = Column(DateTime)
    completed_date = Column(DateTime)

    # Progress
    progress_percentage = Column(Integer, default=0)
    status = Column(SQLEnum(GoalStatus), default=GoalStatus.NOT_STARTED)
    hours_invested = Column(Float, default=0)

    # Tracking
    milestones = Column(JSON)  # List of milestones with completion status
    action_items = Column(JSON)  # Actionable tasks
    obstacles = Column(JSON)  # Challenges faced

    # Motivation
    why_important = Column(Text)
    reward = Column(String)  # Reward upon completion
    accountability_partner = Column(String)

    # Metrics
    success_criteria = Column(JSON)  # How to measure success
    weekly_time_commitment = Column(Float)  # Hours per week

    # Reminders
    reminder_frequency = Column(String)  # daily, weekly, biweekly
    next_reminder = Column(DateTime)

    # Related entities
    related_learning_path_id = Column(String, ForeignKey("learning_paths.id"))
    related_program_id = Column(String, ForeignKey("education_programs.id"))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="learning_goals")
    related_learning_path = relationship("LearningPath")
    related_program = relationship("EducationProgram")
    progress_logs = relationship(
        "GoalProgressLog", back_populates="goal", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<LearningGoal {self.title}>"


class GoalProgressLog(Base):
    """Model for tracking progress updates on learning goals."""

    __tablename__ = "goal_progress_logs"

    id = Column(String, primary_key=True)
    goal_id = Column(String, ForeignKey("learning_goals.id"), nullable=False)

    # Progress details
    progress_percentage = Column(Integer, nullable=False)
    hours_logged = Column(Float)
    note = Column(Text)
    achievements = Column(JSON)  # What was accomplished

    # Reflection
    challenges_faced = Column(Text)
    learnings = Column(Text)
    next_steps = Column(Text)

    # Timestamps
    log_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    goal = relationship("LearningGoal", back_populates="progress_logs")

    def __repr__(self):
        return f"<GoalProgressLog {self.goal_id} - {self.log_date}>"
