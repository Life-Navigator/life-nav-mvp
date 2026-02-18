"""
SQLAlchemy models for all domains
"""

from app.models.user import User
from app.models.user_integration import UserIntegration
from app.models.goal import Goal, GoalMilestone
from app.models.health import HealthRecord, Medication, HealthProvider
from app.models.health_insurance import (
    HealthInsurance,
    InsuranceClaim,
    InsuranceType,
    CoverageType,
    ClaimStatus,
)
from app.models.finance import FinancialAccount, Transaction, Investment
from app.models.career import CareerProfile, JobExperience, Skill
from app.models.education import EducationRecord, Course, Certification
from app.models.agent import (
    Agent,
    AgentTask,
    Conversation,
    ConversationMessage,
    AgentType,
    AgentState,
    TaskStatus,
)
from app.models.job_listing import JobListing, Platform, LocationType, EmploymentType, ExperienceLevel
from app.models.gig_listing import GigListing, GigPlatform, BudgetType, GigDuration, GigComplexity
from app.models.application import JobApplication, GigProposal, ApplicationStatus, InterviewType
from app.models.event import Event, EventAttendee, EventPlatform, EventCategory, EventStatus, RSVPStatus
from app.models.social_account import SocialAccount, SocialPost, NetworkConnection, SocialPlatform, ConnectionStatus

__all__ = [
    "User",
    "UserIntegration",
    "Goal",
    "GoalMilestone",
    "HealthRecord",
    "Medication",
    "HealthProvider",
    "HealthInsurance",
    "InsuranceClaim",
    "InsuranceType",
    "CoverageType",
    "ClaimStatus",
    "FinancialAccount",
    "Transaction",
    "Investment",
    "CareerProfile",
    "JobExperience",
    "Skill",
    "EducationRecord",
    "Course",
    "Certification",
    "Agent",
    "AgentTask",
    "Conversation",
    "ConversationMessage",
    "AgentType",
    "AgentState",
    "TaskStatus",
    "JobListing",
    "Platform",
    "LocationType",
    "EmploymentType",
    "ExperienceLevel",
    "GigListing",
    "GigPlatform",
    "BudgetType",
    "GigDuration",
    "GigComplexity",
    "JobApplication",
    "GigProposal",
    "ApplicationStatus",
    "InterviewType",
    "Event",
    "EventAttendee",
    "EventPlatform",
    "EventCategory",
    "EventStatus",
    "RSVPStatus",
    "SocialAccount",
    "SocialPost",
    "NetworkConnection",
    "SocialPlatform",
    "ConnectionStatus",
]
