"""Comprehensive education endpoints for Life Navigator."""

from typing import List, Optional
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.education_credential import EducationCredential
from app.models.course import Course, StudySession, CourseStatus
from app.models.learning_path import LearningPath, PathCourse
from app.models.education_program import EducationProgram, ProgramCourse
from app.models.learning_goal import LearningGoal, GoalProgressLog, GoalStatus
from app.schemas.education import *

router = APIRouter()


# ============================================================================
# Education Credentials Endpoints
# ============================================================================


@router.get("/credentials", response_model=List[EducationCredentialResponse])
async def list_credentials(
    credential_type: Optional[str] = None,
    expiring_soon: Optional[bool] = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all education credentials with optional filters."""
    query = select(EducationCredential).where(
        EducationCredential.user_id == str(current_user.id)
    )

    if credential_type:
        query = query.where(EducationCredential.credential_type == credential_type)

    if expiring_soon:
        thirty_days_from_now = datetime.utcnow() + timedelta(days=30)
        query = query.where(
            and_(
                EducationCredential.expiry_date.isnot(None),
                EducationCredential.expiry_date <= thirty_days_from_now,
                EducationCredential.expiry_date >= datetime.utcnow(),
            )
        )

    query = query.order_by(EducationCredential.issue_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/credentials",
    response_model=EducationCredentialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_credential(
    credential_data: EducationCredentialCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new education credential."""
    credential = EducationCredential(
        id=str(uuid4()),
        user_id=str(current_user.id),
        tenant_id=current_user.tenant_id,
        **credential_data.model_dump(),
    )
    db.add(credential)
    await db.commit()
    await db.refresh(credential)
    return credential


@router.get("/credentials/{credential_id}", response_model=EducationCredentialResponse)
async def get_credential(
    credential_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific credential by ID."""
    result = await db.execute(
        select(EducationCredential).where(
            and_(
                EducationCredential.id == credential_id,
                EducationCredential.user_id == str(current_user.id),
            )
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    return credential


@router.patch("/credentials/{credential_id}", response_model=EducationCredentialResponse)
async def update_credential(
    credential_id: str,
    credential_data: EducationCredentialUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an education credential."""
    result = await db.execute(
        select(EducationCredential).where(
            and_(
                EducationCredential.id == credential_id,
                EducationCredential.user_id == str(current_user.id),
            )
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    update_data = credential_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(credential, field, value)

    await db.commit()
    await db.refresh(credential)
    return credential


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an education credential."""
    result = await db.execute(
        select(EducationCredential).where(
            and_(
                EducationCredential.id == credential_id,
                EducationCredential.user_id == str(current_user.id),
            )
        )
    )
    credential = result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    await db.delete(credential)
    await db.commit()
    return None


# ============================================================================
# Course Endpoints
# ============================================================================


@router.get("/courses", response_model=List[CourseResponse])
async def list_courses(
    status_filter: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all courses with optional filters."""
    query = select(Course).where(Course.user_id == str(current_user.id))

    if status_filter:
        query = query.where(Course.status == status_filter)

    if platform:
        query = query.where(Course.platform == platform)

    query = query.order_by(Course.last_accessed.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enroll in a new course."""
    course = Course(
        id=str(uuid4()),
        user_id=str(current_user.id),
        tenant_id=current_user.tenant_id,
        enrolled_date=datetime.utcnow(),
        **course_data.model_dump(),
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific course by ID."""
    result = await db.execute(
        select(Course).where(
            and_(Course.id == course_id, Course.user_id == str(current_user.id))
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.patch("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    course_data: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update course information or progress."""
    result = await db.execute(
        select(Course).where(
            and_(Course.id == course_id, Course.user_id == str(current_user.id))
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    update_data = course_data.model_dump(exclude_unset=True)

    # Auto-set started_date if status changes to IN_PROGRESS
    if update_data.get("status") == CourseStatus.IN_PROGRESS and not course.started_date:
        update_data["started_date"] = datetime.utcnow()

    # Auto-set completed_date if status changes to COMPLETED
    if update_data.get("status") == CourseStatus.COMPLETED and not course.completed_date:
        update_data["completed_date"] = datetime.utcnow()
        update_data["progress_percentage"] = 100

    for field, value in update_data.items():
        setattr(course, field, value)

    course.last_accessed = datetime.utcnow()
    await db.commit()
    await db.refresh(course)
    return course


@router.post("/courses/{course_id}/complete", response_model=CourseResponse)
async def complete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a course as completed."""
    result = await db.execute(
        select(Course).where(
            and_(Course.id == course_id, Course.user_id == str(current_user.id))
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course.status = CourseStatus.COMPLETED
    course.progress_percentage = 100
    course.completed_date = datetime.utcnow()

    await db.commit()
    await db.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a course."""
    result = await db.execute(
        select(Course).where(
            and_(Course.id == course_id, Course.user_id == str(current_user.id))
        )
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await db.delete(course)
    await db.commit()
    return None


# ============================================================================
# Study Session Endpoints
# ============================================================================


@router.post("/study-sessions", response_model=StudySessionResponse, status_code=status.HTTP_201_CREATED)
async def create_study_session(
    session_data: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a study session."""
    session = StudySession(
        id=str(uuid4()),
        user_id=str(current_user.id),
        **session_data.model_dump(),
    )
    db.add(session)

    # Update course last_accessed and streak
    result = await db.execute(
        select(Course).where(Course.id == session_data.course_id)
    )
    course = result.scalar_one_or_none()
    if course:
        course.last_accessed = datetime.utcnow()
        course.total_study_sessions = (course.total_study_sessions or 0) + 1
        if session_data.duration_minutes:
            course.hours_completed = (course.hours_completed or 0) + (session_data.duration_minutes / 60)

    await db.commit()
    await db.refresh(session)
    return session


# ============================================================================
# Learning Path Endpoints
# ============================================================================


@router.get("/learning-paths", response_model=List[LearningPathResponse])
async def list_learning_paths(
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all learning paths."""
    query = select(LearningPath).where(LearningPath.user_id == str(current_user.id))

    if active_only:
        query = query.where(LearningPath.is_active == True)

    query = query.order_by(LearningPath.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/learning-paths",
    response_model=LearningPathResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_learning_path(
    path_data: LearningPathCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new learning path."""
    path = LearningPath(
        id=str(uuid4()),
        user_id=str(current_user.id),
        tenant_id=current_user.tenant_id,
        started_date=datetime.utcnow(),
        **path_data.model_dump(),
    )
    db.add(path)
    await db.commit()
    await db.refresh(path)
    return path


@router.get("/learning-paths/{path_id}", response_model=LearningPathResponse)
async def get_learning_path(
    path_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific learning path by ID."""
    result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.id == path_id,
                LearningPath.user_id == str(current_user.id),
            )
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    return path


@router.patch("/learning-paths/{path_id}", response_model=LearningPathResponse)
async def update_learning_path(
    path_id: str,
    path_data: LearningPathUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a learning path."""
    result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.id == path_id,
                LearningPath.user_id == str(current_user.id),
            )
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    update_data = path_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(path, field, value)

    await db.commit()
    await db.refresh(path)
    return path


@router.post("/learning-paths/{path_id}/courses", response_model=PathCourseResponse)
async def add_course_to_path(
    path_id: str,
    course_data: PathCourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a course to a learning path."""
    # Verify path exists and belongs to user
    result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.id == path_id,
                LearningPath.user_id == str(current_user.id),
            )
        )
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    path_course = PathCourse(
        id=str(uuid4()),
        learning_path_id=path_id,
        **course_data.model_dump(),
    )
    db.add(path_course)

    # Update total courses count
    path.total_courses = (path.total_courses or 0) + 1

    await db.commit()
    await db.refresh(path_course)
    return path_course


# ============================================================================
# Education Program Endpoints
# ============================================================================


@router.get("/programs", response_model=List[EducationProgramResponse])
async def list_programs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all education programs."""
    result = await db.execute(
        select(EducationProgram)
        .where(EducationProgram.user_id == str(current_user.id))
        .order_by(EducationProgram.start_date.desc())
    )
    return result.scalars().all()


@router.post(
    "/programs",
    response_model=EducationProgramResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_program(
    program_data: EducationProgramCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new education program."""
    program = EducationProgram(
        id=str(uuid4()),
        user_id=str(current_user.id),
        tenant_id=current_user.tenant_id,
        **program_data.model_dump(),
    )
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


@router.get("/programs/{program_id}", response_model=EducationProgramResponse)
async def get_program(
    program_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific education program by ID."""
    result = await db.execute(
        select(EducationProgram).where(
            and_(
                EducationProgram.id == program_id,
                EducationProgram.user_id == str(current_user.id),
            )
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.patch("/programs/{program_id}", response_model=EducationProgramResponse)
async def update_program(
    program_id: str,
    program_data: EducationProgramUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an education program."""
    result = await db.execute(
        select(EducationProgram).where(
            and_(
                EducationProgram.id == program_id,
                EducationProgram.user_id == str(current_user.id),
            )
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    update_data = program_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(program, field, value)

    await db.commit()
    await db.refresh(program)
    return program


# ============================================================================
# Learning Goal Endpoints
# ============================================================================


@router.get("/goals", response_model=List[LearningGoalResponse])
async def list_goals(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all learning goals."""
    query = select(LearningGoal).where(LearningGoal.user_id == str(current_user.id))

    if status_filter:
        query = query.where(LearningGoal.status == status_filter)

    query = query.order_by(LearningGoal.target_date.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/goals", response_model=LearningGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: LearningGoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new learning goal."""
    goal = LearningGoal(
        id=str(uuid4()),
        user_id=str(current_user.id),
        tenant_id=current_user.tenant_id,
        status=GoalStatus.NOT_STARTED,
        **goal_data.model_dump(),
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.get("/goals/{goal_id}", response_model=LearningGoalResponse)
async def get_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific learning goal by ID."""
    result = await db.execute(
        select(LearningGoal).where(
            and_(
                LearningGoal.id == goal_id,
                LearningGoal.user_id == str(current_user.id),
            )
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.patch("/goals/{goal_id}", response_model=LearningGoalResponse)
async def update_goal(
    goal_id: str,
    goal_data: LearningGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a learning goal."""
    result = await db.execute(
        select(LearningGoal).where(
            and_(
                LearningGoal.id == goal_id,
                LearningGoal.user_id == str(current_user.id),
            )
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = goal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)

    await db.commit()
    await db.refresh(goal)
    return goal


@router.post("/goals/{goal_id}/complete", response_model=LearningGoalResponse)
async def complete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a goal as completed."""
    result = await db.execute(
        select(LearningGoal).where(
            and_(
                LearningGoal.id == goal_id,
                LearningGoal.user_id == str(current_user.id),
            )
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.status = GoalStatus.COMPLETED
    goal.progress_percentage = 100
    goal.completed_date = datetime.utcnow()

    await db.commit()
    await db.refresh(goal)
    return goal


# ============================================================================
# Analytics Endpoints
# ============================================================================


@router.get("/analytics/dashboard", response_model=EducationDashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive dashboard statistics."""
    user_id = str(current_user.id)

    # Count credentials
    credentials_result = await db.execute(
        select(func.count()).select_from(EducationCredential).where(EducationCredential.user_id == user_id)
    )
    total_credentials = credentials_result.scalar() or 0

    # Count active and completed courses
    active_courses_result = await db.execute(
        select(func.count())
        .select_from(Course)
        .where(and_(Course.user_id == user_id, Course.status == CourseStatus.IN_PROGRESS))
    )
    active_courses = active_courses_result.scalar() or 0

    completed_courses_result = await db.execute(
        select(func.count())
        .select_from(Course)
        .where(and_(Course.user_id == user_id, Course.status == CourseStatus.COMPLETED))
    )
    completed_courses = completed_courses_result.scalar() or 0

    # Calculate total learning hours
    hours_result = await db.execute(
        select(func.sum(Course.hours_completed)).where(Course.user_id == user_id)
    )
    total_learning_hours = float(hours_result.scalar() or 0)

    # Count active paths, programs, and goals
    paths_result = await db.execute(
        select(func.count())
        .select_from(LearningPath)
        .where(and_(LearningPath.user_id == user_id, LearningPath.is_active == True))
    )
    active_learning_paths = paths_result.scalar() or 0

    programs_result = await db.execute(
        select(func.count()).select_from(EducationProgram).where(EducationProgram.user_id == user_id)
    )
    active_programs = programs_result.scalar() or 0

    active_goals_result = await db.execute(
        select(func.count())
        .select_from(LearningGoal)
        .where(and_(LearningGoal.user_id == user_id, LearningGoal.status != GoalStatus.COMPLETED))
    )
    active_goals = active_goals_result.scalar() or 0

    goals_achieved_result = await db.execute(
        select(func.count())
        .select_from(LearningGoal)
        .where(and_(LearningGoal.user_id == user_id, LearningGoal.status == GoalStatus.COMPLETED))
    )
    goals_achieved = goals_achieved_result.scalar() or 0

    # Calculate average course progress
    avg_progress_result = await db.execute(
        select(func.avg(Course.progress_percentage))
        .where(and_(Course.user_id == user_id, Course.status == CourseStatus.IN_PROGRESS))
    )
    average_course_progress = float(avg_progress_result.scalar() or 0)

    return EducationDashboardStats(
        total_credentials=total_credentials,
        active_courses=active_courses,
        completed_courses=completed_courses,
        total_learning_hours=total_learning_hours,
        active_learning_paths=active_learning_paths,
        active_programs=active_programs,
        active_goals=active_goals,
        goals_achieved=goals_achieved,
        this_week_hours=0,  # TODO: Implement week calculation
        this_month_hours=0,  # TODO: Implement month calculation
        learning_streak_days=0,  # TODO: Implement streak calculation
        upcoming_deadlines=0,  # TODO: Implement deadline calculation
        expiring_licenses=0,  # TODO: Implement expiring licenses calculation
        average_course_progress=average_course_progress,
    )
