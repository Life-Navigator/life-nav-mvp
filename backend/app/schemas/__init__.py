"""Pydantic schemas for request/response validation."""

from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, TokenResponse
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
from app.schemas.education import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    EducationCredentialCreate,
    EducationCredentialResponse,
    EducationCredentialUpdate,
)
from app.schemas.finance import (
    BudgetCreate,
    BudgetResponse,
    BudgetUpdate,
    FinancialAccountCreate,
    FinancialAccountResponse,
    FinancialAccountUpdate,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.schemas.goals import (
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
)
from app.schemas.health import (
    HealthConditionCreate,
    HealthConditionResponse,
    HealthConditionUpdate,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
)
from app.schemas.relationships import (
    ContactCreate,
    ContactInteractionCreate,
    ContactInteractionResponse,
    ContactInteractionUpdate,
    ContactResponse,
    ContactUpdate,
)
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
)

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "RegisterRequest",
    "TokenResponse",
    # User
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    # Finance
    "FinancialAccountCreate",
    "FinancialAccountResponse",
    "FinancialAccountUpdate",
    "TransactionCreate",
    "TransactionResponse",
    "TransactionUpdate",
    "BudgetCreate",
    "BudgetResponse",
    "BudgetUpdate",
    # Career
    "CareerProfileCreate",
    "CareerProfileResponse",
    "CareerProfileUpdate",
    "JobApplicationCreate",
    "JobApplicationResponse",
    "JobApplicationUpdate",
    "InterviewCreate",
    "InterviewResponse",
    "InterviewUpdate",
    # Education
    "EducationCredentialCreate",
    "EducationCredentialResponse",
    "EducationCredentialUpdate",
    "CourseCreate",
    "CourseResponse",
    "CourseUpdate",
    # Goals
    "GoalCreate",
    "GoalResponse",
    "GoalUpdate",
    "MilestoneCreate",
    "MilestoneResponse",
    "MilestoneUpdate",
    # Health
    "HealthConditionCreate",
    "HealthConditionResponse",
    "HealthConditionUpdate",
    "MedicationCreate",
    "MedicationResponse",
    "MedicationUpdate",
    # Relationships
    "ContactCreate",
    "ContactResponse",
    "ContactUpdate",
    "ContactInteractionCreate",
    "ContactInteractionResponse",
    "ContactInteractionUpdate",
]
