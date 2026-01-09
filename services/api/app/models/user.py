"""
User model
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """User model - uses string IDs to match Prisma/Supabase schema"""

    __tablename__ = "users"

    # String ID to match Prisma (cuid/ulid format)
    id = Column(String(255), primary_key=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Basic Info
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    first_name = Column(String(100))
    last_name = Column(String(100))
    full_name = Column(String(200))
    phone = Column(String(20))
    avatar_url = Column(Text)
    bio = Column(Text)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    last_login_at = Column(DateTime)
    email_verified_at = Column(DateTime)

    # Education module relationships
    education_credentials = relationship("EducationRecord", back_populates="user")
    courses = relationship("Course", back_populates="user")

    # Health module relationships
    health_insurance = relationship("HealthInsurance", back_populates="user")

    def __repr__(self):
        return f"<User {self.email}>"
