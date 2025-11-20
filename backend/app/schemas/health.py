"""
Health domain schemas.
Handles health conditions and medications.
"""

from datetime import date, time
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.health import (
    ConditionStatus,
    ConditionType,
    MedicationRoute,
    MedicationStatus,
    Severity,
)
from app.schemas.base import BaseSchema, IDTimestampSchema

# ============================================================================
# HealthCondition Schemas
# ============================================================================


class HealthConditionCreate(BaseSchema):
    """HealthCondition creation schema."""

    condition_name: str = Field(min_length=1, max_length=255)
    condition_type: ConditionType | None = None
    severity: Severity | None = None
    icd_10_code: str | None = Field(default=None, max_length=20)
    diagnosis_date: date | None = None
    resolved_date: date | None = None
    status: ConditionStatus = Field(default=ConditionStatus.ACTIVE)
    diagnosed_by: str | None = Field(default=None, max_length=255)
    symptoms: list[str] | None = None
    treatment_plan: str | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class HealthConditionUpdate(BaseSchema):
    """HealthCondition update schema."""

    condition_name: str | None = Field(default=None, max_length=255)
    condition_type: ConditionType | None = None
    severity: Severity | None = None
    icd_10_code: str | None = Field(default=None, max_length=20)
    diagnosis_date: date | None = None
    resolved_date: date | None = None
    status: ConditionStatus | None = None
    diagnosed_by: str | None = Field(default=None, max_length=255)
    symptoms: list[str] | None = None
    treatment_plan: str | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class HealthConditionResponse(IDTimestampSchema):
    """HealthCondition response schema."""

    condition_name: str
    condition_type: ConditionType | None
    severity: Severity | None
    icd_10_code: str | None
    diagnosis_date: date | None
    resolved_date: date | None
    status: ConditionStatus
    diagnosed_by: str | None
    symptoms: list[str] | None
    treatment_plan: str | None
    metadata: dict[str, Any]
    notes: str | None


# ============================================================================
# Medication Schemas
# ============================================================================


class MedicationCreate(BaseSchema):
    """Medication creation schema."""

    condition_id: UUID | None = None
    medication_name: str = Field(min_length=1, max_length=255)
    generic_name: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    dosage_unit: str | None = Field(default=None, max_length=50)
    form: str | None = Field(default=None, max_length=50)
    frequency: str | None = Field(default=None, max_length=100)
    route: MedicationRoute | None = None
    start_date: date
    end_date: date | None = None
    last_refill_date: date | None = None
    next_refill_date: date | None = None
    status: MedicationStatus = Field(default=MedicationStatus.ACTIVE)
    is_as_needed: bool = Field(default=False)
    prescribed_by: str | None = Field(default=None, max_length=255)
    prescription_number: str | None = Field(default=None, max_length=100)
    pharmacy_name: str | None = Field(default=None, max_length=255)
    reminder_enabled: bool = Field(default=True)
    reminder_times: list[time] | None = None
    side_effects: list[str] | None = None
    interactions: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class MedicationUpdate(BaseSchema):
    """Medication update schema."""

    condition_id: UUID | None = None
    medication_name: str | None = Field(default=None, max_length=255)
    generic_name: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    dosage_unit: str | None = Field(default=None, max_length=50)
    form: str | None = Field(default=None, max_length=50)
    frequency: str | None = Field(default=None, max_length=100)
    route: MedicationRoute | None = None
    start_date: date | None = None
    end_date: date | None = None
    last_refill_date: date | None = None
    next_refill_date: date | None = None
    status: MedicationStatus | None = None
    is_as_needed: bool | None = None
    prescribed_by: str | None = Field(default=None, max_length=255)
    prescription_number: str | None = Field(default=None, max_length=100)
    pharmacy_name: str | None = Field(default=None, max_length=255)
    reminder_enabled: bool | None = None
    reminder_times: list[time] | None = None
    side_effects: list[str] | None = None
    interactions: list[str] | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class MedicationResponse(IDTimestampSchema):
    """Medication response schema."""

    condition_id: UUID | None
    medication_name: str
    generic_name: str | None
    dosage: str | None
    dosage_unit: str | None
    form: str | None
    frequency: str | None
    route: MedicationRoute | None
    start_date: date
    end_date: date | None
    last_refill_date: date | None
    next_refill_date: date | None
    status: MedicationStatus
    is_as_needed: bool
    prescribed_by: str | None
    prescription_number: str | None
    pharmacy_name: str | None
    reminder_enabled: bool
    reminder_times: list[time] | None
    side_effects: list[str] | None
    interactions: list[str] | None
    metadata: dict[str, Any]
    notes: str | None
