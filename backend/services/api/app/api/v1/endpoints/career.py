"""
Career endpoints
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.career import CareerProfile, JobExperience, Skill
from app.models.job_listing import JobListing, Platform
from app.models.gig_listing import GigListing, GigPlatform
from app.models.application import JobApplication, GigProposal, ApplicationStatus
from app.models.event import Event, EventPlatform
from app.models.social_account import SocialAccount, SocialPost, NetworkConnection, SocialPlatform
from app.schemas.career import *
from app.schemas.job_listing import *
from app.schemas.gig_listing import *
from app.schemas.application import *
from app.schemas.event import *
from app.schemas.social_account import *
from app.services.integrations import (
    LinkedInJobsService,
    IndeedService,
    UpworkService,
    FiverrService,
    FreelancerService,
    EventbriteService,
    MeetupService,
)
import uuid
import logging

logger = logging.getLogger(__name__)

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
        **profile_data.model_dump(), user_id=current_user.id, tenant_id=current_user.tenant_id
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
        **exp_data.model_dump(),
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
        **skill_data.model_dump(),
        profile_id=profile.id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


# ===================================
# JOB BOARD INTEGRATION ENDPOINTS
# ===================================

@router.get("/jobs/linkedin", response_model=JobListingList)
async def get_linkedin_jobs(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for jobs on LinkedIn"""
    try:
        service = LinkedInJobsService()
        jobs_data = await service.search_jobs(
            keywords=keywords,
            location=location,
            job_type=job_type,
            experience_level=experience_level,
            limit=limit,
        )

        # Convert and save to database
        job_listings = []
        for job_data in jobs_data:
            # Check if already exists
            result = await db.execute(
                select(JobListing).where(JobListing.external_id == job_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                job_listing = JobListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=job_data["title"],
                    company=job_data["company"],
                    location=job_data.get("location"),
                    location_type=job_data.get("location_type"),
                    employment_type=job_data.get("employment_type"),
                    description=job_data.get("description"),
                    skills=job_data.get("skills"),
                    salary_min=job_data.get("salary_min"),
                    salary_max=job_data.get("salary_max"),
                    posted_date=datetime.fromisoformat(job_data["posted_date"]),
                    platform=Platform.LINKEDIN,
                    external_id=job_data["id"],
                    external_url=job_data.get("external_url"),
                    applicants=job_data.get("applicants", 0),
                )
                db.add(job_listing)
                job_listings.append(job_listing)
            else:
                job_listings.append(existing)

        await db.commit()

        return JobListingList(
            items=job_listings,
            total=len(job_listings),
            page=1,
            page_size=limit,
            has_more=len(job_listings) >= limit,
        )
    except Exception as e:
        logger.error(f"Error fetching LinkedIn jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/indeed", response_model=JobListingList)
async def get_indeed_jobs(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for jobs on Indeed"""
    try:
        service = IndeedService()
        jobs_data = await service.search_jobs(keywords=keywords, location=location, limit=limit)

        job_listings = []
        for job_data in jobs_data:
            result = await db.execute(
                select(JobListing).where(JobListing.external_id == job_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                job_listing = JobListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=job_data["title"],
                    company=job_data["company"],
                    location=job_data.get("location"),
                    employment_type=job_data.get("employment_type"),
                    description=job_data.get("description"),
                    salary_min=job_data.get("salary_min"),
                    salary_max=job_data.get("salary_max"),
                    posted_date=datetime.fromisoformat(job_data["posted_date"]),
                    platform=Platform.INDEED,
                    external_id=job_data["id"],
                    external_url=job_data.get("external_url"),
                )
                db.add(job_listing)
                job_listings.append(job_listing)
            else:
                job_listings.append(existing)

        await db.commit()

        return JobListingList(
            items=job_listings,
            total=len(job_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Indeed jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/all", response_model=JobListingList)
async def get_all_jobs(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all job listings from database"""
    try:
        query = select(JobListing).where(JobListing.user_id == current_user.id)

        if keywords:
            query = query.where(
                or_(
                    JobListing.title.ilike(f"%{keywords}%"),
                    JobListing.description.ilike(f"%{keywords}%"),
                )
            )
        if location:
            query = query.where(JobListing.location.ilike(f"%{location}%"))

        # Count total
        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        # Get paginated results
        query = query.order_by(JobListing.posted_date.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        jobs = result.scalars().all()

        return JobListingList(
            items=jobs,
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > page * page_size,
        )
    except Exception as e:
        logger.error(f"Error fetching all jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/recommended", response_model=JobListingList)
async def get_recommended_jobs(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recommended jobs based on user profile"""
    try:
        # Get user's career profile
        profile_result = await db.execute(
            select(CareerProfile)
            .where(CareerProfile.user_id == current_user.id)
            .options(selectinload(CareerProfile.skills))
        )
        profile = profile_result.scalar_one_or_none()

        if not profile:
            return JobListingList(items=[], total=0, page=1, page_size=limit, has_more=False)

        # Get user skills
        user_skills = [skill.name for skill in profile.skills]
        user_experience = profile.years_of_experience or 0

        # Fetch recommended jobs from LinkedIn
        service = LinkedInJobsService()
        jobs_data = await service.get_recommended_jobs(
            user_skills=user_skills,
            user_experience=user_experience,
            limit=limit,
        )

        job_listings = []
        for job_data in jobs_data:
            result = await db.execute(
                select(JobListing).where(JobListing.external_id == job_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                job_listing = JobListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=job_data["title"],
                    company=job_data["company"],
                    location=job_data.get("location"),
                    description=job_data.get("description"),
                    salary_min=job_data.get("salary_min"),
                    salary_max=job_data.get("salary_max"),
                    posted_date=datetime.fromisoformat(job_data["posted_date"]),
                    platform=Platform.LINKEDIN,
                    external_id=job_data["id"],
                    external_url=job_data.get("external_url"),
                    match_score=job_data.get("match_score"),
                )
                db.add(job_listing)
                job_listings.append(job_listing)
            else:
                job_listings.append(existing)

        await db.commit()

        return JobListingList(
            items=job_listings,
            total=len(job_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching recommended jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/save")
async def save_job(
    request: SaveJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a job listing"""
    try:
        result = await db.execute(
            select(JobListing).where(
                and_(
                    JobListing.id == request.job_id,
                    JobListing.user_id == current_user.id,
                )
            )
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        job.is_saved = True
        await db.commit()

        return {"message": "Job saved successfully", "job_id": str(job.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/saved/{job_id}")
async def unsave_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a job from saved list"""
    try:
        result = await db.execute(
            select(JobListing).where(
                and_(
                    JobListing.id == job_id,
                    JobListing.user_id == current_user.id,
                )
            )
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        job.is_saved = False
        await db.commit()

        return {"message": "Job removed from saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsaving job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/saved", response_model=JobListingList)
async def get_saved_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all saved jobs"""
    try:
        query = select(JobListing).where(
            and_(
                JobListing.user_id == current_user.id,
                JobListing.is_saved == True,
            )
        )

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        query = query.order_by(JobListing.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        jobs = result.scalars().all()

        return JobListingList(
            items=jobs,
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > page * page_size,
        )
    except Exception as e:
        logger.error(f"Error fetching saved jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/apply", response_model=JobApplicationResponse)
async def apply_to_job(
    request: ApplyToJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply to a job"""
    try:
        # Get job listing
        result = await db.execute(
            select(JobListing).where(JobListing.id == request.job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Create application
        application = JobApplication(
            id=uuid.uuid4(),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            job_listing_id=job.id,
            external_job_id=job.external_id,
            job_title=job.title,
            company=job.company,
            platform=job.platform.value,
            resume_url=request.resume_url,
            cover_letter=request.cover_letter,
            notes=request.notes,
        )

        db.add(application)

        # Mark job as applied
        job.is_applied = True
        job.applied_at = datetime.utcnow()

        await db.commit()
        await db.refresh(application)

        return application
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying to job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===================================
# FREELANCE GIG ENDPOINTS
# ===================================

@router.get("/gigs/upwork", response_model=GigListingList)
async def get_upwork_gigs(
    keywords: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for gigs on Upwork"""
    try:
        service = UpworkService()
        gigs_data = await service.search_gigs(keywords=keywords, category=category, limit=limit)

        gig_listings = []
        for gig_data in gigs_data:
            result = await db.execute(
                select(GigListing).where(GigListing.external_id == gig_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                gig_listing = GigListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=gig_data["title"],
                    description=gig_data.get("description"),
                    budget_type=gig_data["budget_type"],
                    budget_amount=gig_data.get("budget_amount"),
                    budget_min=gig_data.get("budget_min"),
                    budget_max=gig_data.get("budget_max"),
                    client_rating=gig_data.get("client_rating"),
                    client_verified=gig_data.get("client_verified", False),
                    skills_required=gig_data.get("skills_required"),
                    posted_date=datetime.fromisoformat(gig_data["posted_date"]),
                    platform=GigPlatform.UPWORK,
                    external_id=gig_data["id"],
                    external_url=gig_data.get("external_url"),
                    proposals_count=gig_data.get("proposals_count", 0),
                )
                db.add(gig_listing)
                gig_listings.append(gig_listing)
            else:
                gig_listings.append(existing)

        await db.commit()

        return GigListingList(
            items=gig_listings,
            total=len(gig_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Upwork gigs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gigs/fiverr", response_model=GigListingList)
async def get_fiverr_gigs(
    keywords: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for gigs on Fiverr"""
    try:
        service = FiverrService()
        gigs_data = await service.search_gigs(keywords=keywords, limit=limit)

        gig_listings = []
        for gig_data in gigs_data:
            result = await db.execute(
                select(GigListing).where(GigListing.external_id == gig_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                gig_listing = GigListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=gig_data["title"],
                    description=gig_data.get("description"),
                    budget_type=gig_data["budget_type"],
                    budget_amount=gig_data.get("budget_amount"),
                    client_verified=gig_data.get("client_verified", False),
                    skills_required=gig_data.get("skills_required"),
                    posted_date=datetime.fromisoformat(gig_data["posted_date"]),
                    platform=GigPlatform.FIVERR,
                    external_id=gig_data["id"],
                    external_url=gig_data.get("external_url"),
                )
                db.add(gig_listing)
                gig_listings.append(gig_listing)
            else:
                gig_listings.append(existing)

        await db.commit()

        return GigListingList(
            items=gig_listings,
            total=len(gig_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Fiverr gigs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gigs/freelancer", response_model=GigListingList)
async def get_freelancer_gigs(
    keywords: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for gigs on Freelancer.com"""
    try:
        service = FreelancerService()
        gigs_data = await service.search_gigs(keywords=keywords, limit=limit)

        gig_listings = []
        for gig_data in gigs_data:
            result = await db.execute(
                select(GigListing).where(GigListing.external_id == gig_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                gig_listing = GigListing(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=gig_data["title"],
                    description=gig_data.get("description"),
                    budget_type=gig_data["budget_type"],
                    budget_amount=gig_data.get("budget_amount"),
                    client_rating=gig_data.get("client_rating"),
                    skills_required=gig_data.get("skills_required"),
                    posted_date=datetime.fromisoformat(gig_data["posted_date"]),
                    platform=GigPlatform.FREELANCER,
                    external_id=gig_data["id"],
                    external_url=gig_data.get("external_url"),
                    proposals_count=gig_data.get("proposals_count", 0),
                )
                db.add(gig_listing)
                gig_listings.append(gig_listing)
            else:
                gig_listings.append(existing)

        await db.commit()

        return GigListingList(
            items=gig_listings,
            total=len(gig_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Freelancer gigs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gigs/all", response_model=GigListingList)
async def get_all_gigs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all gig listings"""
    try:
        query = select(GigListing).where(GigListing.user_id == current_user.id)

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        query = query.order_by(GigListing.posted_date.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        gigs = result.scalars().all()

        return GigListingList(
            items=gigs,
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > page * page_size,
        )
    except Exception as e:
        logger.error(f"Error fetching all gigs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gigs/save")
async def save_gig(
    request: SaveGigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a gig listing"""
    try:
        result = await db.execute(
            select(GigListing).where(
                and_(
                    GigListing.id == request.gig_id,
                    GigListing.user_id == current_user.id,
                )
            )
        )
        gig = result.scalar_one_or_none()

        if not gig:
            raise HTTPException(status_code=404, detail="Gig not found")

        gig.is_saved = True
        await db.commit()

        return {"message": "Gig saved successfully", "gig_id": str(gig.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving gig: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gigs/apply", response_model=GigProposalResponse)
async def apply_to_gig(
    request: SubmitProposalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a proposal for a gig"""
    try:
        result = await db.execute(
            select(GigListing).where(GigListing.id == request.gig_id)
        )
        gig = result.scalar_one_or_none()

        if not gig:
            raise HTTPException(status_code=404, detail="Gig not found")

        proposal = GigProposal(
            id=uuid.uuid4(),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            gig_listing_id=gig.id,
            external_gig_id=gig.external_id,
            gig_title=gig.title,
            platform=gig.platform.value,
            bid_amount=request.bid_amount,
            proposed_duration=request.proposed_duration,
            cover_letter=request.cover_letter,
            milestones=request.milestones,
        )

        db.add(proposal)

        gig.is_applied = True
        gig.proposal_submitted_at = datetime.utcnow()

        await db.commit()
        await db.refresh(proposal)

        return proposal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting proposal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===================================
# APPLICATION TRACKING ENDPOINTS
# ===================================

@router.get("/applications", response_model=JobApplicationList)
async def list_applications(
    status_filter: Optional[ApplicationStatus] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all job applications"""
    try:
        query = select(JobApplication).where(JobApplication.user_id == current_user.id)

        if status_filter:
            query = query.where(JobApplication.status == status_filter)

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        query = query.order_by(JobApplication.applied_date.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        applications = result.scalars().all()

        return JobApplicationList(
            items=applications,
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > page * page_size,
        )
    except Exception as e:
        logger.error(f"Error listing applications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/applications", response_model=JobApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    app_data: JobApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new job application"""
    try:
        application = JobApplication(
            id=uuid.uuid4(),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            **app_data.model_dump(),
        )

        db.add(application)
        await db.commit()
        await db.refresh(application)

        return application
    except Exception as e:
        logger.error(f"Error creating application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/applications/{application_id}", response_model=JobApplicationResponse)
async def update_application(
    application_id: UUID,
    app_update: JobApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a job application"""
    try:
        result = await db.execute(
            select(JobApplication).where(
                and_(
                    JobApplication.id == application_id,
                    JobApplication.user_id == current_user.id,
                )
            )
        )
        application = result.scalar_one_or_none()

        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        for field, value in app_update.model_dump(exclude_unset=True).items():
            setattr(application, field, value)

        await db.commit()
        await db.refresh(application)

        return application
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications/stats", response_model=ApplicationStats)
async def get_application_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get application statistics"""
    try:
        # Total applications
        total_result = await db.execute(
            select(func.count()).where(JobApplication.user_id == current_user.id)
        )
        total_applications = total_result.scalar()

        # By status
        status_result = await db.execute(
            select(JobApplication.status, func.count())
            .where(JobApplication.user_id == current_user.id)
            .group_by(JobApplication.status)
        )
        by_status = {status.value: count for status, count in status_result.all()}

        # Active applications (not rejected, declined, or withdrawn)
        active_statuses = [
            ApplicationStatus.APPLIED,
            ApplicationStatus.VIEWED,
            ApplicationStatus.SCREENING,
            ApplicationStatus.INTERVIEWING,
            ApplicationStatus.OFFERED,
        ]
        active_result = await db.execute(
            select(func.count())
            .where(
                and_(
                    JobApplication.user_id == current_user.id,
                    JobApplication.status.in_(active_statuses),
                )
            )
        )
        active_applications = active_result.scalar()

        # Interviews scheduled
        interview_result = await db.execute(
            select(func.count())
            .where(
                and_(
                    JobApplication.user_id == current_user.id,
                    JobApplication.status == ApplicationStatus.INTERVIEWING,
                )
            )
        )
        interviews_scheduled = interview_result.scalar()

        # Offers received
        offer_result = await db.execute(
            select(func.count())
            .where(
                and_(
                    JobApplication.user_id == current_user.id,
                    JobApplication.offer_date.isnot(None),
                )
            )
        )
        offers_received = offer_result.scalar()

        return ApplicationStats(
            total_applications=total_applications,
            by_status=by_status,
            active_applications=active_applications,
            interviews_scheduled=interviews_scheduled,
            offers_received=offers_received,
            avg_response_time_days=None,  # Calculate if needed
            success_rate=None,  # Calculate if needed
        )
    except Exception as e:
        logger.error(f"Error fetching application stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===================================
# NETWORKING & EVENTS ENDPOINTS
# ===================================

@router.get("/events/eventbrite", response_model=EventList)
async def get_eventbrite_events(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for events on Eventbrite"""
    try:
        service = EventbriteService()
        events_data = await service.search_events(keywords=keywords, location=location, limit=limit)

        event_listings = []
        for event_data in events_data:
            result = await db.execute(
                select(Event).where(Event.external_id == event_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                event = Event(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=event_data["title"],
                    description=event_data.get("description"),
                    category=event_data.get("category"),
                    organizer_name=event_data.get("organizer_name"),
                    start_date=datetime.fromisoformat(event_data["start_date"]),
                    end_date=datetime.fromisoformat(event_data["end_date"]) if event_data.get("end_date") else None,
                    is_virtual=event_data.get("is_virtual", False),
                    venue_name=event_data.get("venue_name"),
                    city=event_data.get("city"),
                    state=event_data.get("state"),
                    country=event_data.get("country"),
                    online_url=event_data.get("online_url"),
                    is_free=event_data.get("is_free", True),
                    price=event_data.get("price"),
                    capacity=event_data.get("capacity"),
                    attendees_count=event_data.get("attendees_count", 0),
                    platform=EventPlatform.EVENTBRITE,
                    external_id=event_data["id"],
                    external_url=event_data.get("external_url"),
                    tags=event_data.get("tags"),
                )
                db.add(event)
                event_listings.append(event)
            else:
                event_listings.append(existing)

        await db.commit()

        return EventList(
            items=event_listings,
            total=len(event_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Eventbrite events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/meetup", response_model=EventList)
async def get_meetup_events(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search for events on Meetup"""
    try:
        service = MeetupService()
        events_data = await service.search_events(keywords=keywords, location=location, limit=limit)

        event_listings = []
        for event_data in events_data:
            result = await db.execute(
                select(Event).where(Event.external_id == event_data["id"])
            )
            existing = result.scalar_one_or_none()

            if not existing:
                event = Event(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    tenant_id=current_user.tenant_id,
                    title=event_data["title"],
                    description=event_data.get("description"),
                    category=event_data.get("category"),
                    organizer_name=event_data.get("organizer_name"),
                    start_date=datetime.fromisoformat(event_data["start_date"]),
                    is_virtual=event_data.get("is_virtual", False),
                    venue_name=event_data.get("venue_name"),
                    city=event_data.get("city"),
                    state=event_data.get("state"),
                    online_url=event_data.get("online_url"),
                    is_free=event_data.get("is_free", True),
                    attendees_count=event_data.get("attendees_count", 0),
                    platform=EventPlatform.MEETUP,
                    external_id=event_data["id"],
                    external_url=event_data.get("external_url"),
                    topics=event_data.get("topics"),
                )
                db.add(event)
                event_listings.append(event)
            else:
                event_listings.append(existing)

        await db.commit()

        return EventList(
            items=event_listings,
            total=len(event_listings),
            page=1,
            page_size=limit,
            has_more=False,
        )
    except Exception as e:
        logger.error(f"Error fetching Meetup events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/search", response_model=EventList)
async def search_all_events(
    keywords: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search all events in database"""
    try:
        query = select(Event).where(Event.user_id == current_user.id)

        if keywords:
            query = query.where(
                or_(
                    Event.title.ilike(f"%{keywords}%"),
                    Event.description.ilike(f"%{keywords}%"),
                )
            )
        if location:
            query = query.where(Event.city.ilike(f"%{location}%"))

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        query = query.order_by(Event.start_date.asc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        events = result.scalars().all()

        return EventList(
            items=events,
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > page * page_size,
        )
    except Exception as e:
        logger.error(f"Error searching events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/events/{event_id}/save")
async def save_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an event"""
    try:
        result = await db.execute(
            select(Event).where(
                and_(
                    Event.id == event_id,
                    Event.user_id == current_user.id,
                )
            )
        )
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        event.is_saved = True
        await db.commit()

        return {"message": "Event saved successfully", "event_id": str(event.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/events/{event_id}/rsvp")
async def rsvp_to_event(
    event_id: UUID,
    request: RSVPEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """RSVP to an event"""
    try:
        result = await db.execute(
            select(Event).where(
                and_(
                    Event.id == event_id,
                    Event.user_id == current_user.id,
                )
            )
        )
        event = result.scalar_one_or_none()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        event.rsvp_status = request.rsvp_status
        event.rsvp_date = datetime.utcnow()

        await db.commit()

        return {"message": "RSVP recorded successfully", "status": request.rsvp_status.value}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error RSVP to event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===================================
# SOCIAL MEDIA INTEGRATION ENDPOINTS
# ===================================

@router.get("/social/accounts", response_model=SocialAccountList)
async def get_connected_social_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all connected social media accounts"""
    try:
        result = await db.execute(
            select(SocialAccount).where(SocialAccount.user_id == current_user.id)
        )
        accounts = result.scalars().all()

        return SocialAccountList(items=accounts, total=len(accounts))
    except Exception as e:
        logger.error(f"Error fetching social accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/social/{platform}/connect", status_code=status.HTTP_201_CREATED)
async def connect_social_account(
    platform: SocialPlatform,
    connect_data: SocialAccountConnect,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect a social media account"""
    try:
        # Check if already connected
        result = await db.execute(
            select(SocialAccount).where(
                and_(
                    SocialAccount.user_id == current_user.id,
                    SocialAccount.platform == platform,
                )
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            for field, value in connect_data.model_dump(exclude_unset=True).items():
                setattr(existing, field, value)
            existing.connected_at = datetime.utcnow()
            await db.commit()
            return {"message": f"{platform.value} account updated", "account_id": str(existing.id)}

        # Create new
        account = SocialAccount(
            id=uuid.uuid4(),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            **connect_data.model_dump(),
        )

        db.add(account)
        await db.commit()

        return {"message": f"{platform.value} account connected", "account_id": str(account.id)}
    except Exception as e:
        logger.error(f"Error connecting social account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/social/{platform}/disconnect")
async def disconnect_social_account(
    platform: SocialPlatform,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a social media account"""
    try:
        result = await db.execute(
            select(SocialAccount).where(
                and_(
                    SocialAccount.user_id == current_user.id,
                    SocialAccount.platform == platform,
                )
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise HTTPException(status_code=404, detail="Account not connected")

        await db.delete(account)
        await db.commit()

        return {"message": f"{platform.value} account disconnected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting social account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/social/{platform}/analytics", response_model=SocialAnalytics)
async def get_social_analytics(
    platform: SocialPlatform,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics for a specific social platform"""
    try:
        result = await db.execute(
            select(SocialAccount).where(
                and_(
                    SocialAccount.user_id == current_user.id,
                    SocialAccount.platform == platform,
                )
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise HTTPException(status_code=404, detail="Account not connected")

        # Mock analytics data
        return SocialAnalytics(
            platform=platform,
            followers_count=account.followers_count,
            following_count=account.following_count,
            posts_count=account.posts_count,
            engagement_rate=3.5,
            total_likes=0,
            total_comments=0,
            total_shares=0,
            total_views=0,
            follower_growth_30d=50,
            top_posts=[],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching social analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/social/cross-post", response_model=SocialPostResponse, status_code=status.HTTP_201_CREATED)
async def cross_post_content(
    request: CrossPostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cross-post content to multiple social platforms"""
    try:
        post = SocialPost(
            id=uuid.uuid4(),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            content=request.content,
            media_urls=request.media_urls,
            hashtags=request.hashtags,
            platforms=request.platforms,
            scheduled_at=request.scheduled_at,
            published_at=datetime.utcnow() if not request.scheduled_at else None,
        )

        db.add(post)
        await db.commit()
        await db.refresh(post)

        return post
    except Exception as e:
        logger.error(f"Error cross-posting: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===================================
# ANALYTICS ENDPOINTS
# ===================================

@router.get("/analytics/network", response_model=NetworkAnalytics)
async def get_network_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get network analytics"""
    try:
        # Total connections
        total_result = await db.execute(
            select(func.count()).where(NetworkConnection.user_id == current_user.id)
        )
        total_connections = total_result.scalar()

        # By platform
        platform_result = await db.execute(
            select(NetworkConnection.platform, func.count())
            .where(NetworkConnection.user_id == current_user.id)
            .group_by(NetworkConnection.platform)
        )
        connections_by_platform = {platform.value: count for platform, count in platform_result.all()}

        # New connections in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_result = await db.execute(
            select(func.count())
            .where(
                and_(
                    NetworkConnection.user_id == current_user.id,
                    NetworkConnection.connected_at >= thirty_days_ago,
                )
            )
        )
        new_connections_30d = new_result.scalar()

        return NetworkAnalytics(
            total_connections=total_connections,
            connections_by_platform=connections_by_platform,
            new_connections_30d=new_connections_30d,
            connection_strength_avg=75.0,  # Mock data
            industry_breakdown={},
            location_breakdown={},
            top_companies=[],
        )
    except Exception as e:
        logger.error(f"Error fetching network analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/influence-score", response_model=InfluenceScore)
async def get_influence_score(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate and return user's influence score"""
    try:
        # Get all social accounts
        result = await db.execute(
            select(SocialAccount).where(SocialAccount.user_id == current_user.id)
        )
        accounts = result.scalars().all()

        # Calculate scores (simplified algorithm)
        total_followers = sum(account.followers_count for account in accounts)
        total_posts = sum(account.posts_count for account in accounts)

        # Simple scoring algorithm
        overall_score = min((total_followers / 100) + (total_posts / 10), 100.0)

        platform_scores = {}
        for account in accounts:
            score = min((account.followers_count / 100) + (account.posts_count / 10), 100.0)
            platform_scores[f"{account.platform.value}_score"] = score

        return InfluenceScore(
            overall_score=overall_score,
            **platform_scores,
            factors={
                "followers": total_followers,
                "posts": total_posts,
                "engagement": 0,
            },
            recommendations=[
                "Post more consistently to increase engagement",
                "Connect with industry leaders",
                "Share valuable content regularly",
            ],
        )
    except Exception as e:
        logger.error(f"Error calculating influence score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/market-insights")
async def get_job_market_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get job market insights based on user profile"""
    try:
        # Get user's career profile
        result = await db.execute(
            select(CareerProfile)
            .where(CareerProfile.user_id == current_user.id)
            .options(selectinload(CareerProfile.skills))
        )
        profile = result.scalar_one_or_none()

        if not profile:
            return {
                "trending_skills": [],
                "salary_trends": {},
                "job_openings_by_industry": {},
                "recommendations": ["Create a career profile to get personalized insights"],
            }

        # Mock market insights
        return {
            "trending_skills": ["Python", "React", "AWS", "Machine Learning", "Docker"],
            "salary_trends": {
                "avg_salary_increase": "5.2%",
                "industry_avg": 125000,
                "your_range": f"${profile.desired_salary_min} - ${profile.desired_salary_max}",
            },
            "job_openings_by_industry": {
                "Technology": 1250,
                "Finance": 450,
                "Healthcare": 300,
            },
            "recommendations": [
                "Consider learning cloud technologies to increase marketability",
                "Your salary expectations align with market rates",
                "Remote opportunities have increased 40% in your field",
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching market insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
