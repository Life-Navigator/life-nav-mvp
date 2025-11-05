"""
Pydantic schemas for request/response validation
"""
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserLogin, Token
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse, GoalMilestoneCreate, GoalMilestoneResponse
from app.schemas.health import (
    HealthRecordCreate, HealthRecordUpdate, HealthRecordResponse,
    MedicationCreate, MedicationUpdate, MedicationResponse,
    HealthProviderCreate, HealthProviderUpdate, HealthProviderResponse
)
from app.schemas.finance import (
    FinancialAccountCreate, FinancialAccountUpdate, FinancialAccountResponse,
    TransactionCreate, TransactionUpdate, TransactionResponse,
    InvestmentCreate, InvestmentUpdate, InvestmentResponse
)
from app.schemas.career import (
    CareerProfileCreate, CareerProfileUpdate, CareerProfileResponse,
    JobExperienceCreate, JobExperienceUpdate, JobExperienceResponse,
    SkillCreate, SkillUpdate, SkillResponse
)
from app.schemas.education import (
    EducationRecordCreate, EducationRecordUpdate, EducationRecordResponse,
    CourseCreate, CourseUpdate, CourseResponse,
    CertificationCreate, CertificationUpdate, CertificationResponse
)

__all__ = [
    # User
    "UserCreate", "UserUpdate", "UserResponse", "UserLogin", "Token",
    # Goal
    "GoalCreate", "GoalUpdate", "GoalResponse", "GoalMilestoneCreate", "GoalMilestoneResponse",
    # Health
    "HealthRecordCreate", "HealthRecordUpdate", "HealthRecordResponse",
    "MedicationCreate", "MedicationUpdate", "MedicationResponse",
    "HealthProviderCreate", "HealthProviderUpdate", "HealthProviderResponse",
    # Finance
    "FinancialAccountCreate", "FinancialAccountUpdate", "FinancialAccountResponse",
    "TransactionCreate", "TransactionUpdate", "TransactionResponse",
    "InvestmentCreate", "InvestmentUpdate", "InvestmentResponse",
    # Career
    "CareerProfileCreate", "CareerProfileUpdate", "CareerProfileResponse",
    "JobExperienceCreate", "JobExperienceUpdate", "JobExperienceResponse",
    "SkillCreate", "SkillUpdate", "SkillResponse",
    # Education
    "EducationRecordCreate", "EducationRecordUpdate", "EducationRecordResponse",
    "CourseCreate", "CourseUpdate", "CourseResponse",
    "CertificationCreate", "CertificationUpdate", "CertificationResponse",
]
