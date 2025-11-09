"""Education credentials model for tracking degrees, certificates, licenses, and badges."""

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


class CredentialType(str, enum.Enum):
    """Types of educational credentials."""

    DEGREE = "degree"
    DIPLOMA = "diploma"
    CERTIFICATE = "certificate"
    LICENSE = "license"
    BADGE = "badge"
    MICRO_CREDENTIAL = "micro-credential"


class EducationCredential(Base):
    """Model for educational credentials."""

    __tablename__ = "education_credentials"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, index=True, nullable=False)

    # Credential details
    credential_type = Column(SQLEnum(CredentialType), nullable=False)
    title = Column(String, nullable=False)
    institution = Column(String, nullable=False)
    institution_logo = Column(String)
    field_of_study = Column(String)

    # Dates
    issue_date = Column(DateTime)
    expiry_date = Column(DateTime)  # For licenses

    # Verification
    credential_id = Column(String)  # External credential ID
    credential_url = Column(String)  # Verification URL
    is_verified = Column(Boolean, default=False)

    # Grade/Performance
    grade = Column(String)
    gpa = Column(Float)
    honors = Column(String)

    # Metadata
    description = Column(Text)
    skills = Column(JSON)  # Skills gained
    certificate_image = Column(String)  # Image URL

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="education_credentials")

    def __repr__(self):
        return f"<EducationCredential {self.title} - {self.institution}>"
