"""
Education models
"""
from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Date, Numeric, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class DegreeType(str, enum.Enum):
    """Degree types"""
    HIGH_SCHOOL = "high_school"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    DOCTORATE = "doctorate"
    PROFESSIONAL = "professional"
    CERTIFICATE = "certificate"
    BOOTCAMP = "bootcamp"
    OTHER = "other"


class CourseStatus(str, enum.Enum):
    """Course status"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DROPPED = "dropped"


class EducationRecord(Base):
    """Education record model"""

    __tablename__ = "education_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Institution
    institution_name = Column(String(255), nullable=False)
    institution_type = Column(String(100))  # university, college, bootcamp, etc.
    location = Column(String(255))

    # Degree/Program
    degree_type = Column(Enum(DegreeType), nullable=False)
    degree_name = Column(String(255))
    field_of_study = Column(String(255))
    major = Column(String(255))
    minor = Column(String(255))

    # Academic Performance
    gpa = Column(Numeric(4, 2))
    gpa_scale = Column(Numeric(3, 1), default=4.0)
    honors = Column(ARRAY(String))

    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    graduation_date = Column(Date)
    is_current = Column(Boolean, default=False)

    # Description
    description = Column(Text)
    activities = Column(ARRAY(Text))
    achievements = Column(ARRAY(Text))

    # Verification
    is_verified = Column(Boolean, default=False)
    diploma_url = Column(String(500))
    transcript_url = Column(String(500))

    # Metadata
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    courses = relationship("Course", back_populates="education_record", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<EducationRecord {self.degree_name} from {self.institution_name}>"


class Course(Base):
    """Course model"""

    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    education_record_id = Column(UUID(as_uuid=True), ForeignKey("education_records.id"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Course Info
    course_code = Column(String(50))
    course_name = Column(String(255), nullable=False)
    instructor = Column(String(255))
    credits = Column(Numeric(4, 2))

    # Status
    status = Column(Enum(CourseStatus), default=CourseStatus.NOT_STARTED)

    # Performance
    grade = Column(String(5))
    grade_points = Column(Numeric(4, 2))
    final_score = Column(Numeric(5, 2))

    # Dates
    start_date = Column(Date)
    end_date = Column(Date)
    semester = Column(String(50))  # Fall 2023, Spring 2024, etc.

    # Content
    description = Column(Text)
    syllabus_url = Column(String(500))
    skills_learned = Column(ARRAY(String))

    # Metadata
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    education_record = relationship("EducationRecord", back_populates="courses")

    def __repr__(self):
        return f"<Course {self.course_name}>"


class Certification(Base):
    """Certification model"""

    __tablename__ = "certifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Certification Info
    name = Column(String(255), nullable=False)
    issuing_organization = Column(String(255), nullable=False)
    credential_id = Column(String(255))
    credential_url = Column(String(500))

    # Dates
    issue_date = Column(Date, nullable=False)
    expiration_date = Column(Date)
    does_not_expire = Column(Boolean, default=False)

    # Status
    is_active = Column(Boolean, default=True)

    # Skills
    skills = Column(ARRAY(String))

    # Description
    description = Column(Text)

    # Verification
    is_verified = Column(Boolean, default=False)

    # Metadata
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Certification {self.name}>"
