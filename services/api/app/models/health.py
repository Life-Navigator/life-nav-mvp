"""
Health models
"""

from datetime import datetime, date
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    ForeignKey,
    Integer,
    Date,
    Numeric,
    Boolean,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class RecordType(str, enum.Enum):
    """Health record types"""

    VISIT = "visit"
    LAB_RESULT = "lab_result"
    DIAGNOSIS = "diagnosis"
    PROCEDURE = "procedure"
    IMMUNIZATION = "immunization"
    VITAL_SIGNS = "vital_signs"
    OTHER = "other"


class HealthRecord(Base):
    """Health record model (FHIR-inspired)"""

    __tablename__ = "health_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Record Info
    record_type = Column(Enum(RecordType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    notes = Column(Text)

    # Clinical Data
    diagnosis_code = Column(String(50))  # ICD-10 code
    procedure_code = Column(String(50))  # CPT code
    snomed_code = Column(String(50))  # SNOMED CT code

    # Provider
    provider_id = Column(UUID(as_uuid=True), ForeignKey("health_providers.id"))
    provider_name = Column(String(255))
    facility_name = Column(String(255))

    # Dates
    record_date = Column(Date, nullable=False)
    follow_up_date = Column(Date)

    # Attachments & Data
    attachments = Column(JSONB)  # Document URLs
    vitals = Column(JSONB)  # Blood pressure, temperature, etc.
    lab_results = Column(JSONB)  # Lab test results
    extra_data = Column(
        "metadata", JSONB
    )  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    provider = relationship("HealthProvider", back_populates="records")
    medications = relationship("Medication", back_populates="health_record")

    def __repr__(self):
        return f"<HealthRecord {self.title}>"


class Medication(Base):
    """Medication model"""

    __tablename__ = "medications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    health_record_id = Column(UUID(as_uuid=True), ForeignKey("health_records.id"))
    tenant_id = Column(String(255), nullable=False, index=True)

    # Medication Info
    name = Column(String(255), nullable=False)
    generic_name = Column(String(255))
    dosage = Column(String(100))
    frequency = Column(String(100))
    route = Column(String(50))  # oral, injection, etc.

    # Prescription
    prescriber_name = Column(String(255))
    pharmacy_name = Column(String(255))
    prescription_number = Column(String(100))

    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)

    # Status
    is_active = Column(Boolean, default=True)
    is_as_needed = Column(Boolean, default=False)

    # Instructions
    instructions = Column(Text)
    side_effects = Column(Text)
    notes = Column(Text)

    # Metadata
    extra_data = Column(
        "metadata", JSONB
    )  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    health_record = relationship("HealthRecord", back_populates="medications")

    def __repr__(self):
        return f"<Medication {self.name}>"


class HealthProvider(Base):
    """Health provider model"""

    __tablename__ = "health_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Provider Info
    name = Column(String(255), nullable=False)
    specialty = Column(String(100))
    provider_type = Column(String(50))  # physician, dentist, therapist, etc.

    # Contact
    phone = Column(String(20))
    email = Column(String(255))
    fax = Column(String(20))

    # Address
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    zip_code = Column(String(20))
    country = Column(String(100))

    # Practice
    practice_name = Column(String(255))
    npi_number = Column(String(20))  # National Provider Identifier

    # Status
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Notes
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    records = relationship("HealthRecord", back_populates="provider")

    def __repr__(self):
        return f"<HealthProvider {self.name}>"
