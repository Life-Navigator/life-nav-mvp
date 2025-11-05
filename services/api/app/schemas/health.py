"""
Health schemas
"""
from datetime import date, datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, UUID4
from app.schemas.base import BaseResponseSchema
from app.models.health import RecordType


# Health Record Schemas
class HealthRecordCreate(BaseModel):
    record_type: RecordType
    title: str
    description: Optional[str] = None
    notes: Optional[str] = None
    diagnosis_code: Optional[str] = None
    procedure_code: Optional[str] = None
    record_date: date
    provider_id: Optional[UUID4] = None


class HealthRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    vitals: Optional[Dict[str, Any]] = None


class HealthRecordResponse(BaseResponseSchema):
    record_type: RecordType
    title: str
    description: Optional[str]
    notes: Optional[str]
    diagnosis_code: Optional[str]
    record_date: date
    provider_name: Optional[str]


# Medication Schemas
class MedicationCreate(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    start_date: date


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    is_active: Optional[bool] = None


class MedicationResponse(BaseResponseSchema):
    name: str
    dosage: Optional[str]
    frequency: Optional[str]
    is_active: bool
    start_date: date


# Health Provider Schemas
class HealthProviderCreate(BaseModel):
    name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None


class HealthProviderUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class HealthProviderResponse(BaseResponseSchema):
    name: str
    specialty: Optional[str]
    phone: Optional[str]
    is_active: bool
