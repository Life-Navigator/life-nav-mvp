"""
SQLAlchemy models for all domains
"""
from app.models.user import User
from app.models.goal import Goal, GoalMilestone
from app.models.health import HealthRecord, Medication, HealthProvider
from app.models.finance import FinancialAccount, Transaction, Investment
from app.models.career import CareerProfile, JobExperience, Skill
from app.models.education import EducationRecord, Course, Certification

__all__ = [
    "User",
    "Goal",
    "GoalMilestone",
    "HealthRecord",
    "Medication",
    "HealthProvider",
    "FinancialAccount",
    "Transaction",
    "Investment",
    "CareerProfile",
    "JobExperience",
    "Skill",
    "EducationRecord",
    "Course",
    "Certification",
]
