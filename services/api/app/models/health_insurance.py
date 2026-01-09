"""
Health Insurance models
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Float,
    Boolean,
    Text,
    ForeignKey,
    Date,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class InsuranceType(str, enum.Enum):
    """Insurance type enumeration"""

    HEALTH = "health"
    DENTAL = "dental"
    VISION = "vision"
    LIFE = "life"
    DISABILITY = "disability"


class CoverageType(str, enum.Enum):
    """Coverage type enumeration"""

    INDIVIDUAL = "individual"
    FAMILY = "family"
    EMPLOYEE_ONLY = "employee_only"
    EMPLOYEE_SPOUSE = "employee_spouse"
    EMPLOYEE_CHILDREN = "employee_children"


class ClaimStatus(str, enum.Enum):
    """Claim status enumeration"""

    SUBMITTED = "submitted"
    PROCESSING = "processing"
    APPROVED = "approved"
    DENIED = "denied"
    PAID = "paid"
    APPEALED = "appealed"


class HealthInsurance(Base):
    """Health insurance model - uses string IDs to match Prisma"""

    __tablename__ = "health_insurance"

    id = Column(String(255), primary_key=True)
    user_id = Column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Insurance Details
    insurance_type = Column(SQLEnum(InsuranceType), default=InsuranceType.HEALTH)
    carrier_name = Column(
        String(255), nullable=False
    )  # e.g., Blue Cross, Aetna, UnitedHealthcare
    carrier_logo = Column(String(500))
    plan_name = Column(String(255), nullable=False)

    # Card Information
    member_id = Column(String(100), nullable=False)
    group_number = Column(String(100))
    bin_number = Column(String(50))  # Prescription
    pcn_number = Column(String(50))  # Prescription

    # Coverage
    coverage_type = Column(SQLEnum(CoverageType))
    effective_date = Column(Date, nullable=False)
    termination_date = Column(Date)

    # Costs
    monthly_premium = Column(Float)
    deductible_individual = Column(Float)
    deductible_family = Column(Float)
    out_of_pocket_max_individual = Column(Float)
    out_of_pocket_max_family = Column(Float)
    copay_primary_care = Column(Float)
    copay_specialist = Column(Float)
    copay_urgent_care = Column(Float)
    copay_emergency_room = Column(Float)

    # Network
    network_type = Column(String(50))  # PPO, HMO, EPO, POS
    in_network = Column(Boolean, default=True)

    # Provider Information
    primary_care_physician = Column(String(255))
    pcp_phone = Column(String(20))

    # Contact
    customer_service_phone = Column(String(20))
    claims_address = Column(Text)
    website_url = Column(String(500))

    # Policy Details
    policy_number = Column(String(100))
    employer = Column(String(255))

    # Dependents
    dependents = Column(JSONB)  # List of covered dependents

    # Card Images
    front_card_image = Column(String(500))  # URL to card front image
    back_card_image = Column(String(500))  # URL to card back image

    # Notes
    notes = Column(Text)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="health_insurance")
    claims = relationship("InsuranceClaim", back_populates="insurance")

    def __repr__(self):
        return f"<HealthInsurance {self.carrier_name} - {self.plan_name}>"


class InsuranceClaim(Base):
    """Insurance claim model - uses string IDs to match Prisma"""

    __tablename__ = "insurance_claims"

    id = Column(String(255), primary_key=True)
    user_id = Column(
        String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    insurance_id = Column(
        String(255), ForeignKey("health_insurance.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Claim Details
    claim_number = Column(String(100), nullable=False)
    service_date = Column(Date, nullable=False)
    provider_name = Column(String(255), nullable=False)

    # Amounts
    billed_amount = Column(Float, nullable=False)
    covered_amount = Column(Float)
    patient_responsibility = Column(Float)
    paid_amount = Column(Float)

    # Status
    status = Column(SQLEnum(ClaimStatus), default=ClaimStatus.SUBMITTED)
    status_date = Column(Date)

    # Service
    service_type = Column(String(100))
    diagnosis_codes = Column(JSONB)
    procedure_codes = Column(JSONB)

    # Documents
    eob_document = Column(String(500))  # Explanation of Benefits URL

    # Notes
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    insurance = relationship("HealthInsurance", back_populates="claims")

    def __repr__(self):
        return f"<InsuranceClaim {self.claim_number}>"
