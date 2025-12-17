"""
Health domain schemas.
Handles health conditions and medications.
"""

from datetime import date, time
from typing import Any, Optional, Union
from uuid import UUID

from pydantic import Field

from app.models.health import (
    ConditionStatus,
    ConditionType,
    LabResultStatus,
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


# ============================================================================
# LabResult Schemas
# ============================================================================


class LabResultCreate(BaseSchema):
    """LabResult creation schema."""

    test_name: str = Field(min_length=1, max_length=255)
    test_code: str | None = Field(default=None, max_length=50)
    result_value: str = Field(min_length=1, max_length=100)
    result_unit: str | None = Field(default=None, max_length=50)
    reference_range_low: str | None = Field(default=None, max_length=50)
    reference_range_high: str | None = Field(default=None, max_length=50)
    reference_range: str | None = Field(default=None, max_length=100)
    status: LabResultStatus = Field(default=LabResultStatus.PENDING)
    test_date: date
    result_date: date | None = None
    ordering_provider: str | None = Field(default=None, max_length=255)
    performing_lab: str | None = Field(default=None, max_length=255)
    condition_id: UUID | None = None
    source: str | None = Field(default=None, max_length=50)
    document_id: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class LabResultUpdate(BaseSchema):
    """LabResult update schema."""

    test_name: str | None = Field(default=None, max_length=255)
    test_code: str | None = Field(default=None, max_length=50)
    result_value: str | None = Field(default=None, max_length=100)
    result_unit: str | None = Field(default=None, max_length=50)
    reference_range_low: str | None = Field(default=None, max_length=50)
    reference_range_high: str | None = Field(default=None, max_length=50)
    reference_range: str | None = Field(default=None, max_length=100)
    status: LabResultStatus | None = None
    test_date: date | None = None
    result_date: date | None = None
    ordering_provider: str | None = Field(default=None, max_length=255)
    performing_lab: str | None = Field(default=None, max_length=255)
    condition_id: UUID | None = None
    source: str | None = Field(default=None, max_length=50)
    document_id: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class LabResultResponse(IDTimestampSchema):
    """LabResult response schema."""

    test_name: str
    test_code: str | None
    result_value: str
    result_unit: str | None
    reference_range_low: str | None
    reference_range_high: str | None
    reference_range: str | None
    status: LabResultStatus
    test_date: date
    result_date: date | None
    ordering_provider: str | None
    performing_lab: str | None
    condition_id: UUID | None
    source: str | None
    document_id: str | None
    metadata: dict[str, Any]
    notes: str | None


class LabResultBulkItem(BaseSchema):
    """Single lab result in bulk create request (from OCR)."""

    test_name: str = Field(min_length=1)
    result_value: str = Field(min_length=1)
    result_unit: str | None = None
    reference_range: str | None = None
    test_date: Optional[Union[date, str]] = Field(default=None, alias="test_date")
    provider: str | None = Field(default=None, alias="ordering_provider")
    confidence: float = 0.0
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")

    class Config:
        populate_by_name = True


class LabResultBulkCreate(BaseSchema):
    """Bulk lab result creation from OCR extraction."""

    user_id: UUID | None = Field(default=None, alias="userId")
    lab_results: list[LabResultBulkItem] = Field(alias="labResults")

    class Config:
        populate_by_name = True


class LabResultBulkResponse(BaseSchema):
    """Response for bulk lab result creation."""

    created_count: int
    skipped_count: int
    errors: list[str] = []
    lab_result_ids: list[UUID] = []
