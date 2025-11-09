"""
Health Insurance schemas
"""

from datetime import date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4
from app.schemas.base import BaseResponseSchema
from app.models.health_insurance import InsuranceType, CoverageType, ClaimStatus


# Health Insurance Schemas
class HealthInsuranceCreate(BaseModel):
    insurance_type: InsuranceType
    carrier_name: str
    plan_name: str
    member_id: str
    group_number: Optional[str] = None
    bin_number: Optional[str] = None
    pcn_number: Optional[str] = None
    coverage_type: Optional[CoverageType] = None
    effective_date: date
    termination_date: Optional[date] = None
    monthly_premium: Optional[float] = None
    deductible_individual: Optional[float] = None
    deductible_family: Optional[float] = None
    out_of_pocket_max_individual: Optional[float] = None
    out_of_pocket_max_family: Optional[float] = None
    copay_primary_care: Optional[float] = None
    copay_specialist: Optional[float] = None
    copay_urgent_care: Optional[float] = None
    copay_emergency_room: Optional[float] = None
    network_type: Optional[str] = None
    in_network: Optional[bool] = True
    primary_care_physician: Optional[str] = None
    pcp_phone: Optional[str] = None
    customer_service_phone: Optional[str] = None
    claims_address: Optional[str] = None
    website_url: Optional[str] = None
    policy_number: Optional[str] = None
    employer: Optional[str] = None
    dependents: Optional[List[Dict[str, Any]]] = None
    front_card_image: Optional[str] = None
    back_card_image: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = True


class HealthInsuranceUpdate(BaseModel):
    insurance_type: Optional[InsuranceType] = None
    carrier_name: Optional[str] = None
    plan_name: Optional[str] = None
    member_id: Optional[str] = None
    group_number: Optional[str] = None
    bin_number: Optional[str] = None
    pcn_number: Optional[str] = None
    coverage_type: Optional[CoverageType] = None
    effective_date: Optional[date] = None
    termination_date: Optional[date] = None
    monthly_premium: Optional[float] = None
    deductible_individual: Optional[float] = None
    deductible_family: Optional[float] = None
    out_of_pocket_max_individual: Optional[float] = None
    out_of_pocket_max_family: Optional[float] = None
    copay_primary_care: Optional[float] = None
    copay_specialist: Optional[float] = None
    copay_urgent_care: Optional[float] = None
    copay_emergency_room: Optional[float] = None
    network_type: Optional[str] = None
    in_network: Optional[bool] = None
    primary_care_physician: Optional[str] = None
    pcp_phone: Optional[str] = None
    customer_service_phone: Optional[str] = None
    claims_address: Optional[str] = None
    website_url: Optional[str] = None
    policy_number: Optional[str] = None
    employer: Optional[str] = None
    dependents: Optional[List[Dict[str, Any]]] = None
    front_card_image: Optional[str] = None
    back_card_image: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class HealthInsuranceResponse(BaseResponseSchema):
    insurance_type: InsuranceType
    carrier_name: str
    carrier_logo: Optional[str]
    plan_name: str
    member_id: str
    group_number: Optional[str]
    bin_number: Optional[str]
    pcn_number: Optional[str]
    coverage_type: Optional[CoverageType]
    effective_date: date
    termination_date: Optional[date]
    monthly_premium: Optional[float]
    deductible_individual: Optional[float]
    deductible_family: Optional[float]
    out_of_pocket_max_individual: Optional[float]
    out_of_pocket_max_family: Optional[float]
    copay_primary_care: Optional[float]
    copay_specialist: Optional[float]
    copay_urgent_care: Optional[float]
    copay_emergency_room: Optional[float]
    network_type: Optional[str]
    in_network: bool
    primary_care_physician: Optional[str]
    pcp_phone: Optional[str]
    customer_service_phone: Optional[str]
    claims_address: Optional[str]
    website_url: Optional[str]
    policy_number: Optional[str]
    employer: Optional[str]
    dependents: Optional[List[Dict[str, Any]]]
    front_card_image: Optional[str]
    back_card_image: Optional[str]
    notes: Optional[str]
    is_active: bool


# Insurance Claim Schemas
class InsuranceClaimCreate(BaseModel):
    insurance_id: UUID4
    claim_number: str
    service_date: date
    provider_name: str
    billed_amount: float
    covered_amount: Optional[float] = None
    patient_responsibility: Optional[float] = None
    paid_amount: Optional[float] = None
    status: Optional[ClaimStatus] = ClaimStatus.SUBMITTED
    status_date: Optional[date] = None
    service_type: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    procedure_codes: Optional[List[str]] = None
    eob_document: Optional[str] = None
    notes: Optional[str] = None


class InsuranceClaimUpdate(BaseModel):
    claim_number: Optional[str] = None
    service_date: Optional[date] = None
    provider_name: Optional[str] = None
    billed_amount: Optional[float] = None
    covered_amount: Optional[float] = None
    patient_responsibility: Optional[float] = None
    paid_amount: Optional[float] = None
    status: Optional[ClaimStatus] = None
    status_date: Optional[date] = None
    service_type: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    procedure_codes: Optional[List[str]] = None
    eob_document: Optional[str] = None
    notes: Optional[str] = None


class InsuranceClaimResponse(BaseResponseSchema):
    insurance_id: UUID4
    claim_number: str
    service_date: date
    provider_name: str
    billed_amount: float
    covered_amount: Optional[float]
    patient_responsibility: Optional[float]
    paid_amount: Optional[float]
    status: ClaimStatus
    status_date: Optional[date]
    service_type: Optional[str]
    diagnosis_codes: Optional[List[str]]
    procedure_codes: Optional[List[str]]
    eob_document: Optional[str]
    notes: Optional[str]
