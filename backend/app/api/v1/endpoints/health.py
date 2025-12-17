"""
Health domain endpoints.
Handles health conditions and medications.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, HIPAADBSession, TenantID
from app.core.logging import logger
from app.models.health import HealthCondition, LabResult, Medication
from app.schemas.health import (
    HealthConditionCreate,
    HealthConditionResponse,
    HealthConditionUpdate,
    LabResultCreate,
    LabResultResponse,
    LabResultUpdate,
    LabResultBulkCreate,
    LabResultBulkResponse,
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
    db: HIPAADBSession,
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Get a specific health condition by ID.

    Returns 404 if condition not found or user doesn't have access.
    """
    result = await db.execute(select(HealthCondition).where(HealthCondition.id == condition_id))
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    # Authorization check: ensure user owns this health condition
    if condition.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this health condition",
        )

    logger.info("Get health condition", condition_id=str(condition_id))
    return HealthConditionResponse.model_validate(condition)


@router.post(
    "/conditions", response_model=HealthConditionResponse, status_code=status.HTTP_201_CREATED
)
async def create_health_condition(
    data: HealthConditionCreate,
    db: HIPAADBSession,
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Update a health condition.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(HealthCondition).where(HealthCondition.id == condition_id))
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    # Authorization check: ensure user owns this health condition
    if condition.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this health condition",
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Delete a health condition.

    Soft deletes the condition by setting deleted_at timestamp.
    """
    result = await db.execute(select(HealthCondition).where(HealthCondition.id == condition_id))
    condition = result.scalar_one_or_none()

    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health condition not found",
        )

    # Authorization check: ensure user owns this health condition
    if condition.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this health condition",
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
    db: HIPAADBSession,
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Get a specific medication by ID.

    Returns 404 if medication not found or user doesn't have access.
    """
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    # Authorization check: ensure user owns this medication
    if medication.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this medication",
        )

    logger.info("Get medication", medication_id=str(medication_id))
    return MedicationResponse.model_validate(medication)


@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    data: MedicationCreate,
    db: HIPAADBSession,
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Update a medication.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    # Authorization check: ensure user owns this medication
    if medication.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this medication",
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
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Delete a medication.

    Soft deletes the medication by setting deleted_at timestamp.
    """
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    medication = result.scalar_one_or_none()

    if not medication:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found",
        )

    # Authorization check: ensure user owns this medication
    if medication.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this medication",
        )

    await db.delete(medication)
    await db.commit()

    logger.info("Medication deleted", medication_id=str(medication_id))
    return None


# ============================================================================
# Lab Result Endpoints
# ============================================================================


@router.get("/lab-results", response_model=list[LabResultResponse])
async def list_lab_results(
    db: HIPAADBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    condition_id: UUID | None = None,
):
    """
    List all lab results for the current user.

    Optionally filter by condition_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(LabResult).where(LabResult.user_id == current_user.id)

    if condition_id:
        query = query.where(LabResult.condition_id == condition_id)

    query = query.offset(skip).limit(limit).order_by(LabResult.test_date.desc())

    result = await db.execute(query)
    lab_results = result.scalars().all()

    logger.info(
        "List lab results",
        user_id=str(current_user.id),
        count=len(lab_results),
        condition_id=str(condition_id) if condition_id else None,
    )

    return [LabResultResponse.model_validate(lr) for lr in lab_results]


@router.get("/lab-results/{lab_result_id}", response_model=LabResultResponse)
async def get_lab_result(
    lab_result_id: UUID,
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Get a specific lab result by ID.

    Returns 404 if lab result not found or user doesn't have access.
    """
    result = await db.execute(select(LabResult).where(LabResult.id == lab_result_id))
    lab_result = result.scalar_one_or_none()

    if not lab_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab result not found",
        )

    # Authorization check
    if lab_result.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this lab result",
        )

    logger.info("Get lab result", lab_result_id=str(lab_result_id))
    return LabResultResponse.model_validate(lab_result)


@router.post("/lab-results", response_model=LabResultResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_result(
    data: LabResultCreate,
    db: HIPAADBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new lab result.

    Associates the lab result with the current user and tenant.
    """
    lab_result = LabResult(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(lab_result)
    await db.commit()
    await db.refresh(lab_result)

    logger.info("Lab result created", lab_result_id=str(lab_result.id))
    return LabResultResponse.model_validate(lab_result)


@router.patch("/lab-results/{lab_result_id}", response_model=LabResultResponse)
async def update_lab_result(
    lab_result_id: UUID,
    data: LabResultUpdate,
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Update a lab result.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(LabResult).where(LabResult.id == lab_result_id))
    lab_result = result.scalar_one_or_none()

    if not lab_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab result not found",
        )

    # Authorization check
    if lab_result.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this lab result",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lab_result, key, value)

    await db.commit()
    await db.refresh(lab_result)

    logger.info("Lab result updated", lab_result_id=str(lab_result_id))
    return LabResultResponse.model_validate(lab_result)


@router.delete("/lab-results/{lab_result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lab_result(
    lab_result_id: UUID,
    db: HIPAADBSession,
    current_user: CurrentUser,
):
    """
    Delete a lab result.
    """
    result = await db.execute(select(LabResult).where(LabResult.id == lab_result_id))
    lab_result = result.scalar_one_or_none()

    if not lab_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lab result not found",
        )

    # Authorization check
    if lab_result.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this lab result",
        )

    await db.delete(lab_result)
    await db.commit()

    logger.info("Lab result deleted", lab_result_id=str(lab_result_id))
    return None


@router.post("/lab-results/bulk", response_model=LabResultBulkResponse)
async def create_lab_results_bulk(
    data: LabResultBulkCreate,
    db: HIPAADBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Bulk create lab results from OCR extraction.

    Used by the OCR pipeline to save extracted health data.
    Creates lab results in a single database operation for efficiency.
    """
    from datetime import datetime as dt

    created_ids: list[UUID] = []
    errors: list[str] = []
    skipped = 0

    for i, item in enumerate(data.lab_results):
        try:
            # Parse date if string
            test_date = item.date
            if isinstance(test_date, str):
                try:
                    test_date = dt.strptime(test_date, "%Y-%m-%d").date()
                except ValueError:
                    test_date = dt.now().date()
            elif test_date is None:
                test_date = dt.now().date()

            lab_result = LabResult(
                user_id=current_user.id,
                tenant_id=tenant_id,
                test_name=item.test_name,
                result_value=item.result_value,
                result_unit=item.result_unit,
                reference_range=item.reference_range,
                test_date=test_date,
                ordering_provider=item.provider,
                source="ocr",
                metadata_=item.metadata_ or {"source": "ocr", "confidence": item.confidence},
            )
            db.add(lab_result)
            await db.flush()
            created_ids.append(lab_result.id)

        except Exception as e:
            errors.append(f"Lab result {i + 1}: {str(e)}")
            skipped += 1

    await db.commit()

    logger.info(
        "Bulk lab results created",
        user_id=str(current_user.id),
        created_count=len(created_ids),
        skipped_count=skipped,
        error_count=len(errors),
    )

    return LabResultBulkResponse(
        created_count=len(created_ids),
        skipped_count=skipped,
        errors=errors,
        lab_result_ids=created_ids,
    )
