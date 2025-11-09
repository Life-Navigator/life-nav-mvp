"""
Resume models for AI-powered resume builder
"""

from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.db.base_class import Base


class Resume(Base):
    """User's resume document with AI-generated content"""
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Basic Info
    title = Column(String(255), nullable=False)  # "Software Engineer Resume - Google"
    template_id = Column(String(100), ForeignKey("resume_templates.id"), nullable=False)
    is_primary = Column(Boolean, default=False)  # User's default resume
    status = Column(String(50), default="draft")  # draft, published, archived

    # Resume Content (structured JSON)
    content = Column(JSONB, nullable=False)  # Full resume structure with all sections

    # Metadata
    created_from = Column(String(50), default="scratch")  # scratch, profile, import, job_tailored
    last_optimized_at = Column(DateTime, nullable=True)

    # AI Metrics
    ats_score = Column(Float, nullable=True)  # 0-100 ATS compatibility score
    keyword_density = Column(Float, nullable=True)  # Optimal 2-4%
    readability_score = Column(Float, nullable=True)  # Flesch Reading Ease

    # Job Targeting (optional - for tailored resumes)
    target_job_title = Column(String(255), nullable=True)
    target_company = Column(String(255), nullable=True)
    target_job_id = Column(UUID(as_uuid=True), nullable=True)  # Link to job listing if available
    target_job_description = Column(Text, nullable=True)  # Stored for re-optimization

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="resumes")
    template = relationship("ResumeTemplate")
    versions = relationship("ResumeVersion", back_populates="resume", cascade="all, delete-orphan")


class ResumeVersion(Base):
    """Version history for resume changes"""
    __tablename__ = "resume_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=False)

    # Version Info
    version_number = Column(Integer, nullable=False)
    content = Column(JSONB, nullable=False)  # Snapshot of resume content at this version

    # Change Tracking
    change_summary = Column(String(500), nullable=True)  # "Optimized for ATS", "Tailored for Google SWE role"
    changed_by = Column(String(50), default="user")  # user, ai_optimization, ai_tailoring

    # Metrics at this version
    ats_score = Column(Float, nullable=True)
    keyword_density = Column(Float, nullable=True)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    resume = relationship("Resume", back_populates="versions")


class ResumeTemplate(Base):
    """Resume templates with different styles and layouts"""
    __tablename__ = "resume_templates"

    id = Column(String(100), primary_key=True)  # "modern-tech", "classic-professional", "creative-designer"

    # Template Info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)  # tech, creative, executive, entry_level, academic

    # Characteristics
    is_ats_friendly = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    # Layout Configuration (JSON)
    layout_config = Column(JSONB, nullable=False)  # Font, spacing, colors, section order, etc.

    # Preview
    preview_url = Column(String(500), nullable=True)  # URL to template preview image
    thumbnail_url = Column(String(500), nullable=True)

    # Usage tracking
    usage_count = Column(Integer, default=0)

    # Display order
    display_order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
