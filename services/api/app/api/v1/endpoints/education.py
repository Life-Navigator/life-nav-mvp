"""
Education endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.education import EducationRecord, Course, Certification
from app.schemas.education import *

router = APIRouter()

# Education Records
@router.get("/records", response_model=List[EducationRecordResponse])
async def list_education_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List education records"""
    result = await db.execute(
        select(EducationRecord).where(EducationRecord.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/records", response_model=EducationRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_education_record(
    record_data: EducationRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create education record"""
    record = EducationRecord(**record_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


# Courses
@router.get("/courses", response_model=List[CourseResponse])
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List courses"""
    result = await db.execute(
        select(Course).where(Course.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create course"""
    course = Course(**course_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


# Certifications
@router.get("/certifications", response_model=List[CertificationResponse])
async def list_certifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List certifications"""
    result = await db.execute(
        select(Certification).where(Certification.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/certifications", response_model=CertificationResponse, status_code=status.HTTP_201_CREATED)
async def create_certification(
    cert_data: CertificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create certification"""
    cert = Certification(**cert_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert
