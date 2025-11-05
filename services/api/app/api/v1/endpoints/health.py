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
from app.schemas.health import *

router = APIRouter()

# Health Records
@router.get("/records", response_model=List[HealthRecordResponse])
async def list_health_records(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List health records"""
    result = await db.execute(
        select(HealthRecord)
        .where(HealthRecord.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/records", response_model=HealthRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_health_record(
    record_data: HealthRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create health record"""
    record = HealthRecord(**record_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/records/{record_id}", response_model=HealthRecordResponse)
async def get_health_record(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get health record"""
    result = await db.execute(
        select(HealthRecord).where(HealthRecord.id == record_id, HealthRecord.user_id == current_user.id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# Medications
@router.get("/medications", response_model=List[MedicationResponse])
async def list_medications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List medications"""
    result = await db.execute(
        select(Medication).where(Medication.user_id == current_user.id, Medication.is_active == True)
    )
    return result.scalars().all()


@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    med_data: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create medication"""
    medication = Medication(**med_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(medication)
    await db.commit()
    await db.refresh(medication)
    return medication


# Providers
@router.get("/providers", response_model=List[HealthProviderResponse])
async def list_providers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List health providers"""
    result = await db.execute(
        select(HealthProvider).where(HealthProvider.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/providers", response_model=HealthProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: HealthProviderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create health provider"""
    provider = HealthProvider(**provider_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider
