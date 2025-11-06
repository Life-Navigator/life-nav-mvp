"""
Health domain endpoints.
Handles health conditions and medications.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.health import HealthCondition, Medication
from app.schemas.health import (
    HealthConditionCreate,
    HealthConditionResponse,
    HealthConditionUpdate,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
)

router = APIRouter()


# ============================================================================
# HealthCondition Endpoints
# ============================================================================


@router.get("/conditions", response_model=list[HealthConditionResponse])
async def list_health_conditions(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all health conditions for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(HealthCondition)
        .where(HealthCondition.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(HealthCondition.created_at.desc())
    )
    conditions = result.scalars().all()

    logger.info(
        "List health conditions",
        user_id=str(current_user.id),
        count=len(conditions),
    )

    return [HealthConditionResponse.model_validate(condition) for condition in conditions]


@router.get("/conditions/{condition_id}", response_model=HealthConditionResponse)
async def get_health_condition(
    condition_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific health condition by ID.

    Returns 404 if condition not found or user doesn't have access.
    """
    result = await db.execute(
        select(HealthCondition).where(HealthCondition.id == condition_id)
    )
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    logger.info("Get health condition", condition_id=str(condition_id))
    return HealthConditionResponse.model_validate(condition)


@router.post("/conditions", response_model=HealthConditionResponse, status_code=status.HTTP_201_CREATED)
async def create_health_condition(
    data: HealthConditionCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new health condition.

    Associates the condition with the current user and tenant.
    """
    condition = HealthCondition(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(condition)
    await db.commit()
    await db.refresh(condition)

    logger.info("Health condition created", condition_id=str(condition.id))
    return HealthConditionResponse.model_validate(condition)


@router.patch("/conditions/{condition_id}", response_model=HealthConditionResponse)
async def update_health_condition(
    condition_id: UUID,
    data: HealthConditionUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a health condition.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(HealthCondition).where(HealthCondition.id == condition_id)
    )
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(condition, key, value)

    await db.commit()
    await db.refresh(condition)

    logger.info("Health condition updated", condition_id=str(condition_id))
    return HealthConditionResponse.model_validate(condition)


@router.delete("/conditions/{condition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_condition(
    condition_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a health condition.

    Soft deletes the condition by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(HealthCondition).where(HealthCondition.id == condition_id)
    )
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    await db.delete(condition)
    await db.commit()

    logger.info("Health condition deleted", condition_id=str(condition_id))
    return None


# ============================================================================
# Medication Endpoints
# ============================================================================


@router.get("/medications", response_model=list[MedicationResponse])
async def list_medications(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    condition_id: UUID | None = None,
):
    """
    List all medications for the current user.

    Optionally filter by condition_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(Medication).where(Medication.user_id == current_user.id)

    if condition_id:
        query = query.where(Medication.condition_id == condition_id)

    query = query.offset(skip).limit(limit).order_by(Medication.start_date.desc())

    result = await db.execute(query)
    medications = result.scalars().all()

    logger.info(
        "List medications",
        user_id=str(current_user.id),
        count=len(medications),
        condition_id=str(condition_id) if condition_id else None,
    )

    return [MedicationResponse.model_validate(med) for med in medications]


@router.get("/medications/{medication_id}", response_model=MedicationResponse)
async def get_medication(
    medication_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific medication by ID.

    Returns 404 if medication not found or user doesn't have access.
    """
    result = await db.execute(
        select(Medication).where(Medication.id == medication_id)
    )
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    logger.info("Get medication", medication_id=str(medication_id))
    return MedicationResponse.model_validate(medication)


@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    data: MedicationCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new medication.

    Associates the medication with the current user and tenant.
    """
    medication = Medication(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(medication)
    await db.commit()
    await db.refresh(medication)

    logger.info("Medication created", medication_id=str(medication.id))
    return MedicationResponse.model_validate(medication)


@router.patch("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: UUID,
    data: MedicationUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a medication.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(Medication).where(Medication.id == medication_id)
    )
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(medication, key, value)

    await db.commit()
    await db.refresh(medication)

    logger.info("Medication updated", medication_id=str(medication_id))
    return MedicationResponse.model_validate(medication)


@router.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medication(
    medication_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a medication.

    Soft deletes the medication by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(Medication).where(Medication.id == medication_id)
    )
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    await db.delete(medication)
    await db.commit()

    logger.info("Medication deleted", medication_id=str(medication_id))
    return None
