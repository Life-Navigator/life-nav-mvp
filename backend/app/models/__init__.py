"""SQLAlchemy models for all domains."""

from app.models.finance import Budget, FinancialAccount, Transaction
from app.models.mixins import (
    BaseModel,
    BaseSoftDeleteModel,
    BaseTenantModel,
    MetadataMixin,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
    UUIDMixin,
    UserOwnedMixin,
)
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
    # Career (to be added)
    # Education (to be added)
    # Goals (to be added)
    # Health (to be added)
    # Relationships (to be added)
]
