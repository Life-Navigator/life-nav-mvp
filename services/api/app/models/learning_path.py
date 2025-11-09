"""Learning path models for curated skill development journeys."""

import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class PathType(str, enum.Enum):
    """Types of learning paths."""

    CAREER_FOCUSED = "career_focused"
    SKILL_SPECIFIC = "skill_specific"
    CERTIFICATION_PREP = "certification_prep"
    CUSTOM = "custom"
    RECOMMENDED = "recommended"


class DifficultyLevel(str, enum.Enum):
    """Difficulty levels for learning paths."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class LearningPath(Base):
    """Model for curated learning paths."""

    __tablename__ = "learning_paths"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, index=True, nullable=False)

    # Path details
    title = Column(String, nullable=False)
    description = Column(Text)
    path_type = Column(SQLEnum(PathType), nullable=False)
    difficulty_level = Column(SQLEnum(DifficultyLevel))

    # Metadata
    target_role = Column(String)  # e.g., "Full Stack Developer"
    estimated_months = Column(Integer)
    estimated_hours = Column(Integer)

    # Visual
    color = Column(String)  # Hex color for UI
    icon = Column(String)  # Icon identifier
    thumbnail = Column(String)

    # Progress
    progress_percentage = Column(Integer, default=0)
    current_course_id = Column(String, ForeignKey("courses.id"))
    courses_completed = Column(Integer, default=0)
    total_courses = Column(Integer, default=0)

    # Goals
    target_completion_date = Column(DateTime)
    skills_to_master = Column(JSON)  # List of skills
    milestones = Column(JSON)  # Achievement milestones

    # Status
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Share with community
    started_date = Column(DateTime)
    completed_date = Column(DateTime)

    # Motivation
    motivation = Column(Text)  # Why this path
    reward = Column(String)  # What you'll gain

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="learning_paths")
    current_course = relationship("Course", foreign_keys=[current_course_id])
    path_courses = relationship(
        "PathCourse", back_populates="learning_path", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<LearningPath {self.title}>"


class PathCourse(Base):
    """Model for courses within a learning path."""

    __tablename__ = "path_courses"

    id = Column(String, primary_key=True)
    learning_path_id = Column(String, ForeignKey("learning_paths.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)

    # Order and requirements
    order = Column(Integer, nullable=False)
    is_required = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)

    # Prerequisites
    prerequisites = Column(JSON)  # IDs of prerequisite courses

    # Metadata
    completion_date = Column(DateTime)
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    learning_path = relationship("LearningPath", back_populates="path_courses")
    course = relationship("Course")

    def __repr__(self):
        return f"<PathCourse {self.learning_path_id} - {self.order}>"
