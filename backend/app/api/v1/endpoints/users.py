"""
User management endpoints.
Handles user profile, tenant management, and tenant switching.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.core.security import create_access_token, create_refresh_token
from app.models.user import UserTenant, UserTenantStatus
from app.schemas.auth import TokenResponse
from app.schemas.user import TenantResponse, UserResponse, UserTenantResponse, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: CurrentUser):
    """
    Get current user profile.

    Returns the authenticated user's information.
    """
    logger.info("Get current user", user_id=str(current_user.id))
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Update current user profile.

    Allows user to update their own information.
    """
    # Update user fields
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value)

    await db.commit()
    await db.refresh(current_user)

    logger.info("User profile updated", user_id=str(current_user.id))
    return UserResponse.model_validate(current_user)


@router.get("/tenants", response_model=list[UserTenantResponse])
async def list_user_tenants(
    current_user: CurrentUser,
    db: AsyncSession = Depends(DBSession.__class__.__mro__[1]),  # Get base AsyncSession
):
    """
    List all tenants the current user belongs to.

    Returns all tenant memberships for the user.
    """
    result = await db.execute(
        select(UserTenant)
        .where(UserTenant.user_id == current_user.id)
        .order_by(UserTenant.joined_at.desc())
    )
    user_tenants = result.scalars().all()

    logger.info(
        "List user tenants",
        user_id=str(current_user.id),
        tenant_count=len(user_tenants),
    )

    return [UserTenantResponse.model_validate(ut) for ut in user_tenants]


@router.post("/tenants/{tenant_id}/switch", response_model=TokenResponse)
async def switch_tenant(
    tenant_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(DBSession.__class__.__mro__[1]),  # Get base AsyncSession
):
    """
    Switch to a different tenant.

    Generates new tokens with the specified tenant context.
    User must have access to the tenant.
    """
    # Verify user has access to tenant
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.status == UserTenantStatus.ACTIVE,
        )
    )
    user_tenant = result.scalar_one_or_none()

    if not user_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this tenant is forbidden",
        )

    # Generate new tokens with new tenant context
    access_token = create_access_token(
        subject=str(current_user.id),
        tenant_id=str(tenant_id),
    )
    refresh_token = create_refresh_token(
        subject=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    logger.info(
        "Tenant switched",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
    )

    from app.core.config import settings

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
