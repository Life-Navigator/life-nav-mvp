"""Pydantic schemas for education module."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from app.models.education_credential import CredentialType
from app.models.course import CoursePlatform, CourseStatus, CourseDifficulty
from app.models.learning_path import PathType, DifficultyLevel
from app.models.education_program import ProgramType, DegreeType, ProgramStatus
from app.models.learning_goal import GoalType, GoalPriority, GoalStatus


# ============================================================================
# Education Credential Schemas
# ============================================================================


class EducationCredentialBase(BaseModel):
    """Base schema for education credentials."""

    credential_type: CredentialType
    title: str
    institution: str
    institution_logo: Optional[str] = None
    field_of_study: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    is_verified: bool = False
    grade: Optional[str] = None
    gpa: Optional[float] = None
    honors: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = None
    certificate_image: Optional[str] = None


class EducationCredentialCreate(EducationCredentialBase):
    """Schema for creating an education credential."""

    pass


class EducationCredentialUpdate(BaseModel):
    """Schema for updating an education credential."""

    credential_type: Optional[CredentialType] = None
    title: Optional[str] = None
    institution: Optional[str] = None
    institution_logo: Optional[str] = None
    field_of_study: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    is_verified: Optional[bool] = None
    grade: Optional[str] = None
    gpa: Optional[float] = None
    honors: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = None
    certificate_image: Optional[str] = None


class EducationCredentialResponse(EducationCredentialBase):
    """Schema for education credential responses."""

    id: str
    user_id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Course Schemas
# ============================================================================


class CourseBase(BaseModel):
    """Base schema for courses."""

    title: str
    platform: CoursePlatform
    external_id: Optional[str] = None
    course_url: Optional[str] = None
    description: Optional[str] = None
    instructor: Optional[str] = None
    institution: Optional[str] = None
    thumbnail: Optional[str] = None
    difficulty: Optional[CourseDifficulty] = None
    status: CourseStatus = CourseStatus.NOT_STARTED
    progress_percentage: int = 0
    current_lesson: Optional[str] = None
    lessons_completed: int = 0
    total_lessons: Optional[int] = None
    estimated_hours: Optional[int] = None
    hours_completed: float = 0
    enrolled_date: Optional[datetime] = None
    started_date: Optional[datetime] = None
    target_completion_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    skills: Optional[List[str]] = None
    learning_goals: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    rating: Optional[float] = None
    review: Optional[str] = None
    certificate_earned: bool = False
    certificate_url: Optional[str] = None
    weekly_goal_hours: Optional[float] = None
    reminder_enabled: bool = True
    reminder_days: Optional[List[str]] = None
    reminder_time: Optional[str] = None
    notes: Optional[str] = None


class CourseCreate(CourseBase):
    """Schema for creating a course."""

    pass


class CourseUpdate(BaseModel):
    """Schema for updating a course."""

    title: Optional[str] = None
    platform: Optional[CoursePlatform] = None
    external_id: Optional[str] = None
    course_url: Optional[str] = None
    description: Optional[str] = None
    instructor: Optional[str] = None
    institution: Optional[str] = None
    thumbnail: Optional[str] = None
    difficulty: Optional[CourseDifficulty] = None
    status: Optional[CourseStatus] = None
    progress_percentage: Optional[int] = None
    current_lesson: Optional[str] = None
    lessons_completed: Optional[int] = None
    total_lessons: Optional[int] = None
    estimated_hours: Optional[int] = None
    hours_completed: Optional[float] = None
    enrolled_date: Optional[datetime] = None
    started_date: Optional[datetime] = None
    target_completion_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    skills: Optional[List[str]] = None
    learning_goals: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    rating: Optional[float] = None
    review: Optional[str] = None
    certificate_earned: Optional[bool] = None
    certificate_url: Optional[str] = None
    weekly_goal_hours: Optional[float] = None
    reminder_enabled: Optional[bool] = None
    reminder_days: Optional[List[str]] = None
    reminder_time: Optional[str] = None
    notes: Optional[str] = None


class CourseResponse(CourseBase):
    """Schema for course responses."""

    id: str
    user_id: str
    tenant_id: str
    streak_days: int = 0
    last_study_date: Optional[datetime] = None
    total_study_sessions: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudySessionCreate(BaseModel):
    """Schema for creating a study session."""

    course_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    lessons_covered: Optional[List[str]] = None
    notes: Optional[str] = None
    progress_before: Optional[int] = None
    progress_after: Optional[int] = None


class StudySessionResponse(BaseModel):
    """Schema for study session responses."""

    id: str
    course_id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: Optional[int]
    lessons_covered: Optional[List[str]]
    notes: Optional[str]
    progress_before: Optional[int]
    progress_after: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Learning Path Schemas
# ============================================================================


class PathCourseBase(BaseModel):
    """Base schema for path courses."""

    course_id: str
    order: int
    is_required: bool = True
    is_completed: bool = False
    prerequisites: Optional[List[str]] = None
    notes: Optional[str] = None


class PathCourseCreate(PathCourseBase):
    """Schema for adding a course to a learning path."""

    pass


class PathCourseResponse(PathCourseBase):
    """Schema for path course responses."""

    id: str
    learning_path_id: str
    completion_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LearningPathBase(BaseModel):
    """Base schema for learning paths."""

    title: str
    description: Optional[str] = None
    path_type: PathType
    difficulty_level: Optional[DifficultyLevel] = None
    target_role: Optional[str] = None
    estimated_months: Optional[int] = None
    estimated_hours: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    thumbnail: Optional[str] = None
    target_completion_date: Optional[datetime] = None
    skills_to_master: Optional[List[str]] = None
    milestones: Optional[List[dict]] = None
    is_active: bool = True
    is_public: bool = False
    motivation: Optional[str] = None
    reward: Optional[str] = None


class LearningPathCreate(LearningPathBase):
    """Schema for creating a learning path."""

    pass


class LearningPathUpdate(BaseModel):
    """Schema for updating a learning path."""

    title: Optional[str] = None
    description: Optional[str] = None
    path_type: Optional[PathType] = None
    difficulty_level: Optional[DifficultyLevel] = None
    target_role: Optional[str] = None
    estimated_months: Optional[int] = None
    estimated_hours: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    thumbnail: Optional[str] = None
    target_completion_date: Optional[datetime] = None
    skills_to_master: Optional[List[str]] = None
    milestones: Optional[List[dict]] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    motivation: Optional[str] = None
    reward: Optional[str] = None


class LearningPathResponse(LearningPathBase):
    """Schema for learning path responses."""

    id: str
    user_id: str
    tenant_id: str
    progress_percentage: int = 0
    current_course_id: Optional[str] = None
    courses_completed: int = 0
    total_courses: int = 0
    started_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Education Program Schemas
# ============================================================================


class ProgramCourseBase(BaseModel):
    """Base schema for program courses."""

    course_code: Optional[str] = None
    course_name: str
    credits: Optional[int] = None
    semester: Optional[str] = None
    grade: Optional[str] = None
    grade_points: Optional[float] = None
    status: Optional[str] = None
    instructor: Optional[str] = None
    syllabus_url: Optional[str] = None
    notes: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ProgramCourseCreate(ProgramCourseBase):
    """Schema for creating a program course."""

    pass


class ProgramCourseResponse(ProgramCourseBase):
    """Schema for program course responses."""

    id: str
    program_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EducationProgramBase(BaseModel):
    """Base schema for education programs."""

    program_type: ProgramType
    title: str
    institution: str
    institution_logo: Optional[str] = None
    location: Optional[str] = None
    degree_type: Optional[DegreeType] = None
    field_of_study: Optional[str] = None
    major: Optional[str] = None
    minor: Optional[str] = None
    concentration: Optional[str] = None
    status: ProgramStatus
    current_semester: Optional[str] = None
    current_year: Optional[int] = None
    current_gpa: Optional[float] = None
    cumulative_gpa: Optional[float] = None
    credits_completed: int = 0
    credits_required: Optional[int] = None
    start_date: Optional[datetime] = None
    expected_graduation: Optional[datetime] = None
    actual_graduation: Optional[datetime] = None
    tuition_cost: Optional[float] = None
    financial_aid: Optional[float] = None
    scholarships: Optional[List[dict]] = None
    total_cost: Optional[float] = None
    honors: Optional[str] = None
    thesis_title: Optional[str] = None
    advisor: Optional[str] = None
    lms_url: Optional[str] = None
    student_portal_url: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    achievements: Optional[List[str]] = None
    extracurricular: Optional[List[str]] = None
    skills_gained: Optional[List[str]] = None


class EducationProgramCreate(EducationProgramBase):
    """Schema for creating an education program."""

    pass


class EducationProgramUpdate(BaseModel):
    """Schema for updating an education program."""

    program_type: Optional[ProgramType] = None
    title: Optional[str] = None
    institution: Optional[str] = None
    institution_logo: Optional[str] = None
    location: Optional[str] = None
    degree_type: Optional[DegreeType] = None
    field_of_study: Optional[str] = None
    major: Optional[str] = None
    minor: Optional[str] = None
    concentration: Optional[str] = None
    status: Optional[ProgramStatus] = None
    current_semester: Optional[str] = None
    current_year: Optional[int] = None
    current_gpa: Optional[float] = None
    cumulative_gpa: Optional[float] = None
    credits_completed: Optional[int] = None
    credits_required: Optional[int] = None
    start_date: Optional[datetime] = None
    expected_graduation: Optional[datetime] = None
    actual_graduation: Optional[datetime] = None
    tuition_cost: Optional[float] = None
    financial_aid: Optional[float] = None
    scholarships: Optional[List[dict]] = None
    total_cost: Optional[float] = None
    honors: Optional[str] = None
    thesis_title: Optional[str] = None
    advisor: Optional[str] = None
    lms_url: Optional[str] = None
    student_portal_url: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    achievements: Optional[List[str]] = None
    extracurricular: Optional[List[str]] = None
    skills_gained: Optional[List[str]] = None


class EducationProgramResponse(EducationProgramBase):
    """Schema for education program responses."""

    id: str
    user_id: str
    tenant_id: str
    progress_percentage: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Learning Goal Schemas
# ============================================================================


class GoalProgressLogCreate(BaseModel):
    """Schema for creating a goal progress log."""

    progress_percentage: int
    hours_logged: Optional[float] = None
    note: Optional[str] = None
    achievements: Optional[List[str]] = None
    challenges_faced: Optional[str] = None
    learnings: Optional[str] = None
    next_steps: Optional[str] = None
    log_date: Optional[datetime] = None


class GoalProgressLogResponse(BaseModel):
    """Schema for goal progress log responses."""

    id: str
    goal_id: str
    progress_percentage: int
    hours_logged: Optional[float]
    note: Optional[str]
    achievements: Optional[List[str]]
    challenges_faced: Optional[str]
    learnings: Optional[str]
    next_steps: Optional[str]
    log_date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LearningGoalBase(BaseModel):
    """Base schema for learning goals."""

    goal_type: GoalType
    title: str
    description: Optional[str] = None
    priority: GoalPriority = GoalPriority.MEDIUM
    target_credential: Optional[str] = None
    target_skill: Optional[str] = None
    target_hours: Optional[int] = None
    target_courses: Optional[List[str]] = None
    target_books: Optional[List[str]] = None
    target_projects: Optional[List[str]] = None
    target_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    milestones: Optional[List[dict]] = None
    action_items: Optional[List[dict]] = None
    obstacles: Optional[List[str]] = None
    why_important: Optional[str] = None
    reward: Optional[str] = None
    accountability_partner: Optional[str] = None
    success_criteria: Optional[List[str]] = None
    weekly_time_commitment: Optional[float] = None
    reminder_frequency: Optional[str] = None
    related_learning_path_id: Optional[str] = None
    related_program_id: Optional[str] = None


class LearningGoalCreate(LearningGoalBase):
    """Schema for creating a learning goal."""

    pass


class LearningGoalUpdate(BaseModel):
    """Schema for updating a learning goal."""

    goal_type: Optional[GoalType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[GoalPriority] = None
    target_credential: Optional[str] = None
    target_skill: Optional[str] = None
    target_hours: Optional[int] = None
    target_courses: Optional[List[str]] = None
    target_books: Optional[List[str]] = None
    target_projects: Optional[List[str]] = None
    target_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    status: Optional[GoalStatus] = None
    progress_percentage: Optional[int] = None
    hours_invested: Optional[float] = None
    milestones: Optional[List[dict]] = None
    action_items: Optional[List[dict]] = None
    obstacles: Optional[List[str]] = None
    why_important: Optional[str] = None
    reward: Optional[str] = None
    accountability_partner: Optional[str] = None
    success_criteria: Optional[List[str]] = None
    weekly_time_commitment: Optional[float] = None
    reminder_frequency: Optional[str] = None
    related_learning_path_id: Optional[str] = None
    related_program_id: Optional[str] = None


class LearningGoalResponse(LearningGoalBase):
    """Schema for learning goal responses."""

    id: str
    user_id: str
    tenant_id: str
    progress_percentage: int = 0
    status: GoalStatus
    hours_invested: float = 0
    completed_date: Optional[datetime] = None
    next_reminder: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Analytics and Dashboard Schemas
# ============================================================================


class EducationDashboardStats(BaseModel):
    """Schema for education dashboard statistics."""

    total_credentials: int
    active_courses: int
    completed_courses: int
    total_learning_hours: float
    active_learning_paths: int
    active_programs: int
    active_goals: int
    goals_achieved: int
    this_week_hours: float
    this_month_hours: float
    learning_streak_days: int
    upcoming_deadlines: int
    expiring_licenses: int
    average_course_progress: float


class LearningActivityDay(BaseModel):
    """Schema for a single day's learning activity."""

    date: str
    hours: float
    sessions: int
    courses_worked_on: int


class SkillProgress(BaseModel):
    """Schema for skill progress tracking."""

    skill_name: str
    proficiency_level: int  # 0-100
    courses_completed: int
    total_courses: int
    hours_invested: float
    last_practiced: Optional[datetime]


class CourseRecommendation(BaseModel):
    """Schema for course recommendations."""

    title: str
    platform: CoursePlatform
    instructor: str
    thumbnail: Optional[str]
    estimated_hours: int
    rating: float
    relevance_score: float
    reason: str
    skills: List[str]
