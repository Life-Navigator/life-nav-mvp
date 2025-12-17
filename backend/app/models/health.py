"""
Health domain models.
Handles health conditions and medications.
"""

from datetime import date, time
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import ARRAY, Date, Enum, ForeignKey, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import BaseTenantModel


class ConditionType(str, PyEnum):
    """Health condition type enumeration."""

    CHRONIC = "chronic"
    ACUTE = "acute"
    GENETIC = "genetic"
    MENTAL_HEALTH = "mental_health"
    OTHER = "other"


class Severity(str, PyEnum):
    """Condition severity enumeration."""

    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class ConditionStatus(str, PyEnum):
    """Health condition status enumeration."""

    ACTIVE = "active"
    RESOLVED = "resolved"
    IN_REMISSION = "in_remission"
    CHRONIC_MANAGED = "chronic_managed"


class MedicationStatus(str, PyEnum):
    """Medication status enumeration."""

    ACTIVE = "active"
    DISCONTINUED = "discontinued"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class MedicationRoute(str, PyEnum):
    """Medication route enumeration."""

    ORAL = "oral"
    TOPICAL = "topical"
    INJECTION = "injection"
    INHALATION = "inhalation"
    OTHER = "other"


class HealthCondition(BaseTenantModel, Base):
    """
    Health condition model.
    Represents health conditions and diagnoses.
    """

    __tablename__ = "health_conditions"

    # Condition details
    condition_name: Mapped[str] = mapped_column(String(255), nullable=False)
    condition_type: Mapped[ConditionType | None] = mapped_column(Enum(ConditionType), index=True)
    severity: Mapped[Severity | None] = mapped_column(Enum(Severity))
    icd_10_code: Mapped[str | None] = mapped_column(String(20))

    # Dates
    diagnosis_date: Mapped[date | None] = mapped_column(Date)
    resolved_date: Mapped[date | None] = mapped_column(Date)

    # Status
    status: Mapped[ConditionStatus] = mapped_column(
        Enum(ConditionStatus),
        default=ConditionStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Clinical details
    diagnosed_by: Mapped[str | None] = mapped_column(String(255))
    symptoms: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    treatment_plan: Mapped[str | None] = mapped_column(Text)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)


class LabResultStatus(str, PyEnum):
    """Lab result status enumeration."""

    PENDING = "pending"
    NORMAL = "normal"
    ABNORMAL_LOW = "abnormal_low"
    ABNORMAL_HIGH = "abnormal_high"
    CRITICAL = "critical"


class LabResult(BaseTenantModel, Base):
    """
    Lab result model.
    Tracks laboratory test results extracted from documents or entered manually.
    """

    __tablename__ = "lab_results"

    # Test details
    test_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    test_code: Mapped[str | None] = mapped_column(String(50))  # LOINC code
    result_value: Mapped[str] = mapped_column(String(100), nullable=False)
    result_unit: Mapped[str | None] = mapped_column(String(50))
    reference_range_low: Mapped[str | None] = mapped_column(String(50))
    reference_range_high: Mapped[str | None] = mapped_column(String(50))
    reference_range: Mapped[str | None] = mapped_column(String(100))  # Display format

    # Status
    status: Mapped[LabResultStatus] = mapped_column(
        Enum(LabResultStatus),
        default=LabResultStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Dates
    test_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    result_date: Mapped[date | None] = mapped_column(Date)

    # Provider details
    ordering_provider: Mapped[str | None] = mapped_column(String(255))
    performing_lab: Mapped[str | None] = mapped_column(String(255))

    # Condition relationship
    condition_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("health_conditions.id", ondelete="SET NULL"),
        index=True,
    )

    # Source tracking
    source: Mapped[str | None] = mapped_column(String(50))  # ocr, manual, api
    document_id: Mapped[str | None] = mapped_column(String(255))

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)


class Medication(BaseTenantModel, Base):
    """
    Medication model.
    Tracks medications and prescriptions.
    """

    __tablename__ = "medications"

    # Condition relationship
    condition_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("health_conditions.id", ondelete="SET NULL"),
        index=True,
    )

    # Medication details
    medication_name: Mapped[str] = mapped_column(String(255), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(255))
    dosage: Mapped[str | None] = mapped_column(String(100))
    dosage_unit: Mapped[str | None] = mapped_column(String(50))
    form: Mapped[str | None] = mapped_column(String(50))
    frequency: Mapped[str | None] = mapped_column(String(100))
    route: Mapped[MedicationRoute | None] = mapped_column(Enum(MedicationRoute))

    # Dates
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    last_refill_date: Mapped[date | None] = mapped_column(Date)
    next_refill_date: Mapped[date | None] = mapped_column(Date)

    # Status
    status: Mapped[MedicationStatus] = mapped_column(
        Enum(MedicationStatus),
        default=MedicationStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    is_as_needed: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Prescriber
    prescribed_by: Mapped[str | None] = mapped_column(String(255))
    prescription_number: Mapped[str | None] = mapped_column(String(100))
    pharmacy_name: Mapped[str | None] = mapped_column(String(255))

    # Reminders
    reminder_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    reminder_times: Mapped[list[time] | None] = mapped_column(ARRAY(Time))

    # Metadata
    side_effects: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    interactions: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)
