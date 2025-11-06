"""
Education domain endpoints.
Handles education credentials and courses.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.education import Course, EducationCredential
from app.schemas.education import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    EducationCredentialCreate,
    EducationCredentialResponse,
    EducationCredentialUpdate,
)

router = APIRouter()


# ============================================================================
# EducationCredential Endpoints
# ============================================================================


@router.get("/credentials", response_model=list[EducationCredentialResponse])
async def list_education_credentials(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all education credentials for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(EducationCredential)
        .where(EducationCredential.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(EducationCredential.created_at.desc())
    )
    credentials = result.scalars().all()

    logger.info(
        "List education credentials",
        user_id=str(current_user.id),
        count=len(credentials),
    )

    return [EducationCredentialResponse.model_validate(cred) for cred in credentials]


@router.get("/credentials/{credential_id}", response_model=EducationCredentialResponse)
async def get_education_credential(
    credential_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific education credential by ID.

    Returns 404 if credential not found or user doesn't have access.
    """
    result = await db.execute(
        select(EducationCredential).where(EducationCredential.id == credential_id)
    )
    credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education credential not found",
        )

    logger.info("Get education credential", credential_id=str(credential_id))
    return EducationCredentialResponse.model_validate(credential)


@router.post("/credentials", response_model=EducationCredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_education_credential(
    data: EducationCredentialCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new education credential.

    Associates the credential with the current user and tenant.
    """
    credential = EducationCredential(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(credential)
    await db.commit()
    await db.refresh(credential)

    logger.info("Education credential created", credential_id=str(credential.id))
    return EducationCredentialResponse.model_validate(credential)


@router.patch("/credentials/{credential_id}", response_model=EducationCredentialResponse)
async def update_education_credential(
    credential_id: UUID,
    data: EducationCredentialUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update an education credential.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(EducationCredential).where(EducationCredential.id == credential_id)
    )
    credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education credential not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(credential, key, value)

    await db.commit()
    await db.refresh(credential)

    logger.info("Education credential updated", credential_id=str(credential_id))
    return EducationCredentialResponse.model_validate(credential)


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_education_credential(
    credential_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete an education credential.

    Soft deletes the credential by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(EducationCredential).where(EducationCredential.id == credential_id)
    )
    credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Education credential not found",
        )

    await db.delete(credential)
    await db.commit()

    logger.info("Education credential deleted", credential_id=str(credential_id))
    return None


# ============================================================================
# Course Endpoints
# ============================================================================


@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    credential_id: UUID | None = None,
):
    """
    List all courses for the current user.

    Optionally filter by credential_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(Course).where(Course.user_id == current_user.id)

    if credential_id:
        query = query.where(Course.credential_id == credential_id)

    query = query.offset(skip).limit(limit).order_by(Course.created_at.desc())

    result = await db.execute(query)
    courses = result.scalars().all()

    logger.info(
        "List courses",
        user_id=str(current_user.id),
        count=len(courses),
        credential_id=str(credential_id) if credential_id else None,
    )

    return [CourseResponse.model_validate(course) for course in courses]


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific course by ID.

    Returns 404 if course not found or user doesn't have access.
    """
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    logger.info("Get course", course_id=str(course_id))
    return CourseResponse.model_validate(course)


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: CourseCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new course.

    Associates the course with the current user and tenant.
    """
    course = Course(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)

    logger.info("Course created", course_id=str(course.id))
    return CourseResponse.model_validate(course)


@router.patch("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: UUID,
    data: CourseUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a course.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(course, key, value)

    await db.commit()
    await db.refresh(course)

    logger.info("Course updated", course_id=str(course_id))
    return CourseResponse.model_validate(course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a course.

    Soft deletes the course by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    await db.delete(course)
    await db.commit()

    logger.info("Course deleted", course_id=str(course_id))
    return None
