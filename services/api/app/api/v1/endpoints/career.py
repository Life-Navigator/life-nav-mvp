"""
Career endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.career import CareerProfile, JobExperience, Skill
from app.schemas.career import *

router = APIRouter()


# Profile
@router.get("/profile", response_model=CareerProfileResponse)
async def get_career_profile(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get career profile"""
    result = await db.execute(
        select(CareerProfile)
        .where(CareerProfile.user_id == current_user.id)
        .options(
            selectinload(CareerProfile.experiences), selectinload(CareerProfile.skills)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post(
    "/profile",
    response_model=CareerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_career_profile(
    profile_data: CareerProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create career profile"""
    profile = CareerProfile(
        **profile_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


# Experiences
@router.get("/experiences", response_model=List[JobExperienceResponse])
async def list_experiences(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List job experiences"""
    result = await db.execute(
        select(JobExperience).where(JobExperience.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post(
    "/experiences",
    response_model=JobExperienceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_experience(
    exp_data: JobExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create job experience"""
    # Get profile first
    result = await db.execute(
        select(CareerProfile).where(CareerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Create career profile first")

    experience = JobExperience(
        **exp_data.dict(),
        profile_id=profile.id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(experience)
    await db.commit()
    await db.refresh(experience)
    return experience


# Skills
@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List skills"""
    result = await db.execute(select(Skill).where(Skill.user_id == current_user.id))
    return result.scalars().all()


@router.post(
    "/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED
)
async def create_skill(
    skill_data: SkillCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create skill"""
    result = await db.execute(
        select(CareerProfile).where(CareerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Create career profile first")

    skill = Skill(
        **skill_data.dict(),
        profile_id=profile.id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill
