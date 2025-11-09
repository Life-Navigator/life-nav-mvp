"""
Health endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.health import HealthRecord, Medication, HealthProvider
from app.models.health_insurance import HealthInsurance, InsuranceClaim
from app.schemas.health import *
from app.schemas.health_insurance import (
    HealthInsuranceCreate,
    HealthInsuranceUpdate,
    HealthInsuranceResponse,
    InsuranceClaimCreate,
    InsuranceClaimUpdate,
    InsuranceClaimResponse,
)

router = APIRouter()


# Health Records
@router.get("/records", response_model=List[HealthRecordResponse])
async def list_health_records(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List health records"""
    result = await db.execute(
        select(HealthRecord)
        .where(HealthRecord.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post(
    "/records", response_model=HealthRecordResponse, status_code=status.HTTP_201_CREATED
)
async def create_health_record(
    record_data: HealthRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create health record"""
    record = HealthRecord(
        **record_data.model_dump(), user_id=current_user.id, tenant_id=current_user.tenant_id
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/records/{record_id}", response_model=HealthRecordResponse)
async def get_health_record(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get health record"""
    result = await db.execute(
        select(HealthRecord).where(
            HealthRecord.id == record_id, HealthRecord.user_id == current_user.id
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Medications
@router.get("/medications", response_model=List[MedicationResponse])
async def list_medications(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List medications"""
    result = await db.execute(
        select(Medication).where(
            Medication.user_id == current_user.id, Medication.is_active is True
        )
    )
    return result.scalars().all()


@router.post(
    "/medications",
    response_model=MedicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_medication(
    med_data: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create medication"""
    medication = Medication(
        **med_data.model_dump(), user_id=current_user.id, tenant_id=current_user.tenant_id
    )
    db.add(medication)
    await db.commit()
    await db.refresh(medication)
    return medication


# Providers
@router.get("/providers", response_model=List[HealthProviderResponse])
async def list_providers(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List health providers"""
    result = await db.execute(
        select(HealthProvider).where(HealthProvider.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post(
    "/providers",
    response_model=HealthProviderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_provider(
    provider_data: HealthProviderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create health provider"""
    provider = HealthProvider(
        **provider_data.model_dump(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


# Health Insurance Endpoints
@router.get("/insurance", response_model=List[HealthInsuranceResponse])
async def list_health_insurance(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List health insurance policies"""
    result = await db.execute(
        select(HealthInsurance)
        .where(HealthInsurance.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post(
    "/insurance",
    response_model=HealthInsuranceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_health_insurance(
    insurance_data: HealthInsuranceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create health insurance policy"""
    insurance = HealthInsurance(
        **insurance_data.model_dump(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(insurance)
    await db.commit()
    await db.refresh(insurance)
    return insurance


@router.get("/insurance/{insurance_id}", response_model=HealthInsuranceResponse)
async def get_health_insurance(
    insurance_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get health insurance policy"""
    result = await db.execute(
        select(HealthInsurance).where(
            HealthInsurance.id == insurance_id,
            HealthInsurance.user_id == current_user.id,
        )
    )
    insurance = result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail="Insurance policy not found")
    return insurance


@router.patch("/insurance/{insurance_id}", response_model=HealthInsuranceResponse)
async def update_health_insurance(
    insurance_id: str,
    insurance_data: HealthInsuranceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update health insurance policy"""
    result = await db.execute(
        select(HealthInsurance).where(
            HealthInsurance.id == insurance_id,
            HealthInsurance.user_id == current_user.id,
        )
    )
    insurance = result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail="Insurance policy not found")

    for key, value in insurance_data.model_dump(exclude_unset=True).items():
        setattr(insurance, key, value)

    await db.commit()
    await db.refresh(insurance)
    return insurance


@router.delete("/insurance/{insurance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_insurance(
    insurance_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete health insurance policy"""
    result = await db.execute(
        select(HealthInsurance).where(
            HealthInsurance.id == insurance_id,
            HealthInsurance.user_id == current_user.id,
        )
    )
    insurance = result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail="Insurance policy not found")

    await db.delete(insurance)
    await db.commit()
    return None


# Insurance Claims Endpoints
@router.get(
    "/insurance/{insurance_id}/claims", response_model=List[InsuranceClaimResponse]
)
async def list_insurance_claims(
    insurance_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List insurance claims for a policy"""
    # First verify the insurance belongs to the user
    insurance_result = await db.execute(
        select(HealthInsurance).where(
            HealthInsurance.id == insurance_id,
            HealthInsurance.user_id == current_user.id,
        )
    )
    insurance = insurance_result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail="Insurance policy not found")

    result = await db.execute(
        select(InsuranceClaim)
        .where(InsuranceClaim.insurance_id == insurance_id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post(
    "/insurance/{insurance_id}/claims",
    response_model=InsuranceClaimResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_insurance_claim(
    insurance_id: str,
    claim_data: InsuranceClaimCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create insurance claim"""
    # Verify the insurance belongs to the user
    insurance_result = await db.execute(
        select(HealthInsurance).where(
            HealthInsurance.id == insurance_id,
            HealthInsurance.user_id == current_user.id,
        )
    )
    insurance = insurance_result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail="Insurance policy not found")

    claim = InsuranceClaim(
        **claim_data.model_dump(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    return claim


@router.get("/claims/{claim_id}", response_model=InsuranceClaimResponse)
async def get_insurance_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get insurance claim"""
    result = await db.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.id == claim_id, InsuranceClaim.user_id == current_user.id
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.patch("/claims/{claim_id}", response_model=InsuranceClaimResponse)
async def update_insurance_claim(
    claim_id: str,
    claim_data: InsuranceClaimUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update insurance claim"""
    result = await db.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.id == claim_id, InsuranceClaim.user_id == current_user.id
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    for key, value in claim_data.model_dump(exclude_unset=True).items():
        setattr(claim, key, value)

    await db.commit()
    await db.refresh(claim)
    return claim


@router.delete("/claims/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_insurance_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete insurance claim"""
    result = await db.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.id == claim_id, InsuranceClaim.user_id == current_user.id
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    await db.delete(claim)
    await db.commit()
    return None
