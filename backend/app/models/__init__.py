"""SQLAlchemy models for all domains."""

from app.models.career import CareerProfile, Interview, JobApplication
from app.models.education import Course, EducationCredential
from app.models.finance import Budget, FinancialAccount, Transaction
from app.models.goals import Goal, Milestone
from app.models.health import HealthCondition, Medication
from app.models.integration import (
    OAuthConnection,
    PlaidItem,
    WearableConnection,
    WebhookEvent,
)
from app.models.mixins import (
    BaseModel,
    BaseSoftDeleteModel,
    BaseTenantModel,
    MetadataMixin,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
    UserOwnedMixin,
    UUIDMixin,
)
from app.models.relationships import Contact, ContactInteraction
from app.models.user import (
    AuditLog,
    Organization,
    Tenant,
    User,
    UserTenant,
)

__all__ = [
    # Mixins
    "UUIDMixin",
    "TimestampMixin",
    "SoftDeleteMixin",
    "TenantMixin",
    "UserOwnedMixin",
    "MetadataMixin",
    "BaseModel",
    "BaseSoftDeleteModel",
    "BaseTenantModel",
    # User & Tenant
    "Organization",
    "Tenant",
    "User",
    "UserTenant",
    "AuditLog",
    # Finance
    "FinancialAccount",
    "Transaction",
    "Budget",
    # Career
    "CareerProfile",
    "JobApplication",
    "Interview",
    # Education
    "EducationCredential",
    "Course",
    # Goals
    "Goal",
    "Milestone",
    # Health
    "HealthCondition",
    "Medication",
    # Relationships
    "Contact",
    "ContactInteraction",
    # Integrations
    "OAuthConnection",
    "PlaidItem",
    "WearableConnection",
    "WebhookEvent",
]
