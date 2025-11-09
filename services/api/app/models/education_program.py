"""Education program models for long-term academic programs."""

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


class ProgramType(str, enum.Enum):
    """Types of education programs."""

    UNIVERSITY_DEGREE = "university_degree"
    BOOTCAMP = "bootcamp"
    CERTIFICATION_PROGRAM = "certification_program"
    CORPORATE_TRAINING = "corporate_training"
    NANODEGREE = "nanodegree"
    PROFESSIONAL_DEVELOPMENT = "professional_development"
    CONTINUING_EDUCATION = "continuing_education"


class DegreeType(str, enum.Enum):
    """Types of university degrees."""

    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    DOCTORATE = "doctorate"
    PROFESSIONAL = "professional"
    CERTIFICATE = "certificate"


class ProgramStatus(str, enum.Enum):
    """Status of program enrollment."""

    ENROLLED = "enrolled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    WITHDRAWN = "withdrawn"
    ON_LEAVE = "on_leave"


class EducationProgram(Base):
    """Model for long-term education programs."""

    __tablename__ = "education_programs"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, index=True, nullable=False)

    # Program details
    program_type = Column(SQLEnum(ProgramType), nullable=False)
    title = Column(String, nullable=False)
    institution = Column(String, nullable=False)
    institution_logo = Column(String)
    location = Column(String)  # City, State or Online

    # Academic info
    degree_type = Column(SQLEnum(DegreeType))
    field_of_study = Column(String)
    major = Column(String)
    minor = Column(String)
    concentration = Column(String)

    # Progress
    status = Column(SQLEnum(ProgramStatus), nullable=False)
    current_semester = Column(String)
    current_year = Column(Integer)
    progress_percentage = Column(Integer, default=0)

    # Performance
    current_gpa = Column(Float)
    cumulative_gpa = Column(Float)
    credits_completed = Column(Integer, default=0)
    credits_required = Column(Integer)

    # Dates
    start_date = Column(DateTime)
    expected_graduation = Column(DateTime)
    actual_graduation = Column(DateTime)

    # Financial
    tuition_cost = Column(Float)
    financial_aid = Column(Float)
    scholarships = Column(JSON)  # List of scholarships
    total_cost = Column(Float)

    # Academic details
    honors = Column(String)  # Dean's List, Honors, etc.
    thesis_title = Column(String)
    advisor = Column(String)

    # Resources
    lms_url = Column(String)  # Learning Management System URL
    student_portal_url = Column(String)
    email = Column(String)  # Student email

    # Additional info
    description = Column(Text)
    achievements = Column(JSON)
    extracurricular = Column(JSON)
    skills_gained = Column(JSON)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="education_programs")
    program_courses = relationship(
        "ProgramCourse", back_populates="program", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<EducationProgram {self.title} - {self.institution}>"


class ProgramCourse(Base):
    """Model for courses within an education program."""

    __tablename__ = "program_courses"

    id = Column(String, primary_key=True)
    program_id = Column(String, ForeignKey("education_programs.id"), nullable=False)

    # Course details
    course_code = Column(String)  # e.g., CS 101
    course_name = Column(String, nullable=False)
    credits = Column(Integer)
    semester = Column(String)  # e.g., "Fall 2024"

    # Performance
    grade = Column(String)  # A, B+, etc.
    grade_points = Column(Float)  # GPA points
    status = Column(String)  # in_progress, completed, planned

    # Metadata
    instructor = Column(String)
    syllabus_url = Column(String)
    notes = Column(Text)

    # Timestamps
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    program = relationship("EducationProgram", back_populates="program_courses")

    def __repr__(self):
        return f"<ProgramCourse {self.course_code} - {self.course_name}>"
