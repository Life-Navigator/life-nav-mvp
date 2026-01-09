"""Course model for tracking online courses from various platforms."""

import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class CoursePlatform(str, enum.Enum):
    """Supported learning platforms."""

    COURSERA = "coursera"
    UDEMY = "udemy"
    LINKEDIN_LEARNING = "linkedin_learning"
    PLURALSIGHT = "pluralsight"
    EDX = "edx"
    UDACITY = "udacity"
    SKILLSHARE = "skillshare"
    CODECADEMY = "codecademy"
    FREECODECAMP = "freecodecamp"
    KHAN_ACADEMY = "khan_academy"
    YOUTUBE = "youtube"
    FRONTEND_MASTERS = "frontend_masters"
    EGGHEAD = "egghead"
    OTHER = "other"


class CourseStatus(str, enum.Enum):
    """Course enrollment status."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"
    DROPPED = "dropped"


class CourseDifficulty(str, enum.Enum):
    """Course difficulty level."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class Course(Base):
    """Model for individual courses from various platforms. - uses string IDs to match Prisma"""

    __tablename__ = "courses"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, index=True, nullable=False)

    # Course details
    title = Column(String, nullable=False)
    platform = Column(SQLEnum(CoursePlatform), nullable=False)
    external_id = Column(String)  # Platform course ID
    course_url = Column(String)

    # Content
    description = Column(Text)
    instructor = Column(String)
    institution = Column(String)
    thumbnail = Column(String)
    difficulty = Column(SQLEnum(CourseDifficulty))

    # Progress
    status = Column(SQLEnum(CourseStatus), default=CourseStatus.NOT_STARTED)
    progress_percentage = Column(Integer, default=0)
    current_lesson = Column(String)
    lessons_completed = Column(Integer, default=0)
    total_lessons = Column(Integer)

    # Time tracking
    estimated_hours = Column(Integer)
    hours_completed = Column(Float, default=0)

    # Dates
    enrolled_date = Column(DateTime)
    started_date = Column(DateTime)
    target_completion_date = Column(DateTime)
    completed_date = Column(DateTime)
    last_accessed = Column(DateTime)

    # Learning
    skills = Column(JSON)  # Skills taught
    learning_goals = Column(JSON)  # User's learning goals
    tags = Column(JSON)  # Custom tags

    # Social
    rating = Column(Float)  # User's rating (1-5)
    review = Column(Text)
    certificate_earned = Column(Boolean, default=False)
    certificate_url = Column(String)

    # Study plan
    weekly_goal_hours = Column(Float)
    reminder_enabled = Column(Boolean, default=True)
    reminder_days = Column(JSON)  # Days of week for reminders
    reminder_time = Column(String)  # Time of day

    # Gamification
    streak_days = Column(Integer, default=0)
    last_study_date = Column(DateTime)
    total_study_sessions = Column(Integer, default=0)

    # Notes
    notes = Column(Text)
    bookmarks = Column(JSON)  # Bookmarked lessons

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="courses")
    study_sessions = relationship(
        "StudySession", back_populates="course", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Course {self.title} - {self.platform.value}>"


class StudySession(Base):
    """Model for tracking individual study sessions. - uses string IDs to match Prisma"""

    __tablename__ = "study_sessions"

    id = Column(String, primary_key=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Session details
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    lessons_covered = Column(JSON)
    notes = Column(Text)

    # Progress made
    progress_before = Column(Integer)
    progress_after = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    course = relationship("Course", back_populates="study_sessions")
    user = relationship("User")

    def __repr__(self):
        return f"<StudySession {self.course_id} - {self.start_time}>"
