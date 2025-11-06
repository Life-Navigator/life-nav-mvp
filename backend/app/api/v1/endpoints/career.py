"""
Career domain endpoints.
Handles career profiles, job applications, and interviews.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.career import CareerProfile, Interview, JobApplication
from app.schemas.career import (
    CareerProfileCreate,
    CareerProfileResponse,
    CareerProfileUpdate,
    InterviewCreate,
    InterviewResponse,
    InterviewUpdate,
    JobApplicationCreate,
    JobApplicationResponse,
    JobApplicationUpdate,
)

router = APIRouter()


# ============================================================================
# CareerProfile Endpoints
# ============================================================================


@router.get("/profiles", response_model=list[CareerProfileResponse])
async def list_career_profiles(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all career profiles for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(CareerProfile)
        .where(CareerProfile.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(CareerProfile.created_at.desc())
    )
    profiles = result.scalars().all()

    logger.info(
        "List career profiles",
        user_id=str(current_user.id),
        count=len(profiles),
    )

    return [CareerProfileResponse.model_validate(profile) for profile in profiles]


@router.get("/profiles/{profile_id}", response_model=CareerProfileResponse)
async def get_career_profile(
    profile_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific career profile by ID.

    Returns 404 if profile not found or user doesn't have access.
    """
    result = await db.execute(
        select(CareerProfile).where(CareerProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    logger.info("Get career profile", profile_id=str(profile_id))
    return CareerProfileResponse.model_validate(profile)


@router.post("/profiles", response_model=CareerProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_career_profile(
    data: CareerProfileCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new career profile.

    Associates the profile with the current user and tenant.
    """
    profile = CareerProfile(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    logger.info("Career profile created", profile_id=str(profile.id))
    return CareerProfileResponse.model_validate(profile)


@router.patch("/profiles/{profile_id}", response_model=CareerProfileResponse)
async def update_career_profile(
    profile_id: UUID,
    data: CareerProfileUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a career profile.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(CareerProfile).where(CareerProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)

    logger.info("Career profile updated", profile_id=str(profile_id))
    return CareerProfileResponse.model_validate(profile)


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_career_profile(
    profile_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a career profile.

    Soft deletes the profile by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(CareerProfile).where(CareerProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    await db.delete(profile)
    await db.commit()

    logger.info("Career profile deleted", profile_id=str(profile_id))
    return None


# ============================================================================
# JobApplication Endpoints
# ============================================================================


@router.get("/applications", response_model=list[JobApplicationResponse])
async def list_job_applications(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all job applications for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(JobApplication.application_date.desc())
    )
    applications = result.scalars().all()

    logger.info(
        "List job applications",
        user_id=str(current_user.id),
        count=len(applications),
    )

    return [JobApplicationResponse.model_validate(app) for app in applications]


@router.get("/applications/{application_id}", response_model=JobApplicationResponse)
async def get_job_application(
    application_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific job application by ID.

    Returns 404 if application not found or user doesn't have access.
    """
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    logger.info("Get job application", application_id=str(application_id))
    return JobApplicationResponse.model_validate(application)


@router.post("/applications", response_model=JobApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_job_application(
    data: JobApplicationCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new job application.

    Associates the application with the current user and tenant.
    """
    application = JobApplication(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    logger.info("Job application created", application_id=str(application.id))
    return JobApplicationResponse.model_validate(application)


@router.patch("/applications/{application_id}", response_model=JobApplicationResponse)
async def update_job_application(
    application_id: UUID,
    data: JobApplicationUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a job application.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(application, key, value)

    await db.commit()
    await db.refresh(application)

    logger.info("Job application updated", application_id=str(application_id))
    return JobApplicationResponse.model_validate(application)


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_application(
    application_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a job application.

    Soft deletes the application by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    await db.delete(application)
    await db.commit()

    logger.info("Job application deleted", application_id=str(application_id))
    return None


# ============================================================================
# Interview Endpoints
# ============================================================================


@router.get("/interviews", response_model=list[InterviewResponse])
async def list_interviews(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    application_id: UUID | None = None,
):
    """
    List all interviews for the current user.

    Optionally filter by application_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(Interview).where(Interview.user_id == current_user.id)

    if application_id:
        query = query.where(Interview.application_id == application_id)

    query = query.offset(skip).limit(limit).order_by(Interview.interview_date.desc())

    result = await db.execute(query)
    interviews = result.scalars().all()

    logger.info(
        "List interviews",
        user_id=str(current_user.id),
        count=len(interviews),
        application_id=str(application_id) if application_id else None,
    )

    return [InterviewResponse.model_validate(interview) for interview in interviews]


@router.get("/interviews/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific interview by ID.

    Returns 404 if interview not found or user doesn't have access.
    """
    result = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    logger.info("Get interview", interview_id=str(interview_id))
    return InterviewResponse.model_validate(interview)


@router.post("/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    data: InterviewCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new interview.

    Associates the interview with the current user and tenant.
    """
    interview = Interview(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(interview)
    await db.commit()
    await db.refresh(interview)

    logger.info("Interview created", interview_id=str(interview.id))
    return InterviewResponse.model_validate(interview)


@router.patch("/interviews/{interview_id}", response_model=InterviewResponse)
async def update_interview(
    interview_id: UUID,
    data: InterviewUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update an interview.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(interview, key, value)

    await db.commit()
    await db.refresh(interview)

    logger.info("Interview updated", interview_id=str(interview_id))
    return InterviewResponse.model_validate(interview)


@router.delete("/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete an interview.

    Soft deletes the interview by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(Interview).where(Interview.id == interview_id)
    )
    interview = result.scalar_one_or_none()

    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    await db.delete(interview)
    await db.commit()

    logger.info("Interview deleted", interview_id=str(interview_id))
    return None
