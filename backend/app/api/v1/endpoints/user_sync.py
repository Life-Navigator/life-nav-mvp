"""
User Synchronization API Endpoints.
Handles user creation and synchronization between Supabase, Prisma, and Backend databases.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)
from app.models.user import (
    AuthProvider,
    Organization,
    OrganizationStatus,
    PilotRole,
    SubscriptionTier,
    Tenant,
    TenantStatus,
    TenantType,
    User,
    UserStatus,
    UserTenant,
    UserType,
)

router = APIRouter()


class UserSyncRequest(BaseModel):
    """Request to sync a new user from Supabase."""
    supabase_user_id: str = Field(..., description="Supabase auth.users UUID")
    email: EmailStr
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str = "EMAIL"
    auth_provider_id: Optional[str] = None
    user_type: str = "CIVILIAN"
    pilot_role: str = "WAITLIST"
    timezone: str = "America/New_York"
    locale: str = "en-US"


class UserSyncResponse(BaseModel):
    """Response from user sync operation."""
    success: bool
    backend_user_id: str
    tenant_id: str
    organization_id: str
    message: str


class UserLookupResponse(BaseModel):
    """Response from user lookup."""
    exists: bool
    backend_user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    organization_id: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    pilot_role: Optional[str] = None
    pilot_enabled: Optional[bool] = None


async def get_or_create_default_organization(db: AsyncSession) -> Organization:
    """Get or create the default organization for individual users."""
    stmt = select(Organization).where(Organization.slug == "personal")
    result = await db.execute(stmt)
    org = result.scalar_one_or_none()

    if not org:
        org = Organization(
            name="Personal Users",
            slug="personal",
            email="support@lifenavigator.app",
            status=OrganizationStatus.ACTIVE,
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(org)
        await db.flush()

    return org


async def get_or_create_user_tenant(
    db: AsyncSession, org: Organization, user_email: str
) -> Tenant:
    """Create a personal tenant for a user."""
    # Create a unique slug from email
    email_prefix = user_email.split("@")[0].lower()
    slug = f"personal-{email_prefix}"[:100]

    # Check if tenant exists
    stmt = select(Tenant).where(
        Tenant.organization_id == org.id,
        Tenant.slug == slug
    )
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()

    if not tenant:
        tenant = Tenant(
            organization_id=org.id,
            name=f"Personal Workspace",
            slug=slug,
            type=TenantType.WORKSPACE,
            status=TenantStatus.ACTIVE,
            hipaa_enabled=True,
            encryption_at_rest=True,
            audit_log_enabled=True,
        )
        db.add(tenant)
        await db.flush()

    return tenant


@router.post("/sync", response_model=UserSyncResponse)
@limiter.limit("10/minute")
async def sync_user_from_supabase(
    request: Request,
    sync_request: UserSyncRequest,
    db: DBSession,
):
    """
    Sync a user from Supabase to the backend database.

    This endpoint is called after a user registers in Supabase to create
    the corresponding backend user record with proper tenant setup.

    Security: This endpoint should be called from a trusted service account
    with proper authentication (service-to-service token).
    """
    try:
        # Check if user already exists by email
        stmt = select(User).where(User.email == sync_request.email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # User already exists, return existing info
            user_tenant = existing_user.user_tenants[0] if existing_user.user_tenants else None
            if user_tenant:
                tenant = user_tenant.tenant
                return UserSyncResponse(
                    success=True,
                    backend_user_id=str(existing_user.id),
                    tenant_id=str(tenant.id),
                    organization_id=str(tenant.organization_id),
                    message="User already exists in backend",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User exists but has no tenant association",
                )

        # Get or create default organization
        org = await get_or_create_default_organization(db)

        # Create personal tenant for user
        tenant = await get_or_create_user_tenant(db, org, sync_request.email)

        # Map auth provider
        auth_provider_map = {
            "EMAIL": AuthProvider.EMAIL,
            "GOOGLE": AuthProvider.GOOGLE,
            "MICROSOFT": AuthProvider.MICROSOFT,
            "APPLE": AuthProvider.APPLE,
        }
        auth_provider = auth_provider_map.get(
            sync_request.auth_provider.upper(), AuthProvider.EMAIL
        )

        # Map user type
        user_type_map = {
            "CIVILIAN": UserType.CIVILIAN,
            "MILITARY": UserType.MILITARY,
            "VETERAN": UserType.VETERAN,
        }
        user_type = user_type_map.get(sync_request.user_type.upper(), UserType.CIVILIAN)

        # Map pilot role
        pilot_role_map = {
            "WAITLIST": PilotRole.WAITLIST,
            "INVESTOR": PilotRole.INVESTOR,
            "PILOT": PilotRole.PILOT,
            "ADMIN": PilotRole.ADMIN,
        }
        pilot_role = pilot_role_map.get(sync_request.pilot_role.upper(), PilotRole.WAITLIST)

        # Create backend user
        user = User(
            email=sync_request.email,
            email_verified=False,
            first_name=sync_request.first_name,
            last_name=sync_request.last_name,
            display_name=sync_request.display_name or sync_request.email.split("@")[0],
            avatar_url=sync_request.avatar_url,
            timezone=sync_request.timezone,
            locale=sync_request.locale,
            auth_provider=auth_provider,
            auth_provider_id=sync_request.supabase_user_id,
            status=UserStatus.ACTIVE,
            pilot_role=pilot_role,
            pilot_enabled=pilot_role in [PilotRole.PILOT, PilotRole.ADMIN],
            user_type=user_type,
            metadata_={"supabase_user_id": sync_request.supabase_user_id},
        )
        db.add(user)
        await db.flush()

        # Create user-tenant association
        user_tenant = UserTenant(
            user_id=user.id,
            tenant_id=tenant.id,
            role="OWNER",
            status="ACTIVE",
            joined_at=datetime.utcnow(),
        )
        db.add(user_tenant)

        await db.commit()

        return UserSyncResponse(
            success=True,
            backend_user_id=str(user.id),
            tenant_id=str(tenant.id),
            organization_id=str(org.id),
            message="User synced successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync user: {str(e)}",
        )


@router.get("/lookup/{supabase_user_id}", response_model=UserLookupResponse)
@limiter.limit("30/minute")
async def lookup_user_by_supabase_id(
    request: Request,
    supabase_user_id: str,
    db: DBSession,
):
    """
    Look up a backend user by their Supabase user ID.

    Used to resolve the backend user ID when making API calls from the frontend.
    """
    # Query using the metadata field containing supabase_user_id
    stmt = select(User).where(
        User.auth_provider_id == supabase_user_id
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return UserLookupResponse(exists=False)

    # Get tenant info
    tenant_id = None
    org_id = None
    if user.user_tenants:
        user_tenant = user.user_tenants[0]
        tenant_id = str(user_tenant.tenant_id)
        if user_tenant.tenant:
            org_id = str(user_tenant.tenant.organization_id)

    return UserLookupResponse(
        exists=True,
        backend_user_id=str(user.id),
        tenant_id=tenant_id,
        organization_id=org_id,
        email=user.email,
        display_name=user.display_name,
        pilot_role=user.pilot_role.value if user.pilot_role else None,
        pilot_enabled=user.pilot_enabled,
    )


@router.get("/lookup/email/{email}", response_model=UserLookupResponse)
@limiter.limit("30/minute")
async def lookup_user_by_email(
    request: Request,
    email: str,
    db: DBSession,
):
    """
    Look up a backend user by their email address.
    """
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return UserLookupResponse(exists=False)

    # Get tenant info
    tenant_id = None
    org_id = None
    if user.user_tenants:
        user_tenant = user.user_tenants[0]
        tenant_id = str(user_tenant.tenant_id)
        if user_tenant.tenant:
            org_id = str(user_tenant.tenant.organization_id)

    return UserLookupResponse(
        exists=True,
        backend_user_id=str(user.id),
        tenant_id=tenant_id,
        organization_id=org_id,
        email=user.email,
        display_name=user.display_name,
        pilot_role=user.pilot_role.value if user.pilot_role else None,
        pilot_enabled=user.pilot_enabled,
    )


class UpdatePilotStatusRequest(BaseModel):
    """Request to update pilot status."""
    pilot_role: str
    pilot_enabled: bool
    pilot_start_at: Optional[datetime] = None
    pilot_end_at: Optional[datetime] = None


@router.patch("/pilot-status/{backend_user_id}")
@limiter.limit("10/minute")
async def update_pilot_status(
    request: Request,
    backend_user_id: str,
    pilot_request: UpdatePilotStatusRequest,
    db: DBSession,
):
    """
    Update a user's pilot status.

    Used by admin dashboard to manage pilot access.
    """
    try:
        user_uuid = UUID(backend_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )

    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Map pilot role
    pilot_role_map = {
        "WAITLIST": PilotRole.WAITLIST,
        "INVESTOR": PilotRole.INVESTOR,
        "PILOT": PilotRole.PILOT,
        "ADMIN": PilotRole.ADMIN,
    }
    pilot_role = pilot_role_map.get(pilot_request.pilot_role.upper())

    if pilot_role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pilot role",
        )

    user.pilot_role = pilot_role
    user.pilot_enabled = pilot_request.pilot_enabled
    user.pilot_start_at = pilot_request.pilot_start_at
    user.pilot_end_at = pilot_request.pilot_end_at

    await db.commit()

    return {
        "success": True,
        "message": "Pilot status updated",
        "user_id": str(user.id),
        "pilot_role": user.pilot_role.value,
        "pilot_enabled": user.pilot_enabled,
    }
