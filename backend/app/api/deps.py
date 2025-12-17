"""
FastAPI dependencies for authentication, authorization, and tenant context.
Used across all API routes to enforce security and multi-tenant isolation.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import (
    get_session,
    get_main_session,
    get_financial_session,
    get_supabase_session,
    set_tenant_context
)
from app.core.logging import logger
from app.core.redis import is_token_blacklisted, is_user_blacklisted
from app.core.security import verify_token
from app.models.user import User, UserTenant, UserTenantRole, UserTenantStatus, PilotRole

# Security scheme for Bearer token
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """
    Get the current authenticated user from JWT token.

    Args:
        credentials: Bearer token from Authorization header
        db: Database session

    Returns:
        Current user object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials

    # Check if token is blacklisted
    if await is_token_blacklisted(token):
        logger.warning("Blacklisted token used", token_prefix=token[:20])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify and decode token
    payload = verify_token(token, token_type="access")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user ID from token
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    # Check if all user tokens are blacklisted (e.g., after password change)
    if await is_user_blacklisted(str(user_id)):
        logger.warning("Blacklisted user attempted access", user_id=str(user_id))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="All user sessions have been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status}",
        )

    logger.info("User authenticated", user_id=str(user.id), email=user.email)
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Verify that the current user is active.

    Args:
        current_user: Current user from get_current_user

    Returns:
        Current active user

    Raises:
        HTTPException: If user is not active
    """
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )
    return current_user


async def get_tenant_id_from_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> UUID:
    """
    Extract tenant ID from JWT token.

    Args:
        credentials: Bearer token from Authorization header

    Returns:
        Tenant ID from token

    Raises:
        HTTPException: If token is invalid or tenant ID missing
    """
    token = credentials.credentials
    payload = verify_token(token, token_type="access")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    tenant_id_str = payload.get("tenant_id")
    if tenant_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant context in token",
        )

    try:
        return UUID(tenant_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant ID in token",
        )


async def verify_tenant_access(
    current_user: Annotated[User, Depends(get_current_active_user)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id_from_token)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> UserTenant:
    """
    Verify that the current user has access to the specified tenant.

    Args:
        current_user: Current authenticated user
        tenant_id: Tenant ID to verify access to
        db: Database session

    Returns:
        UserTenant membership record

    Raises:
        HTTPException: If user doesn't have access to tenant
    """
    result = await db.execute(
        select(UserTenant).where(
            UserTenant.user_id == current_user.id,
            UserTenant.tenant_id == tenant_id,
            UserTenant.status == UserTenantStatus.ACTIVE,
        )
    )
    user_tenant = result.scalar_one_or_none()

    if user_tenant is None:
        logger.warning(
            "Tenant access denied",
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this tenant is forbidden",
        )

    return user_tenant


async def set_rls_context(
    current_user: Annotated[User, Depends(get_current_active_user)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id_from_token)],
    user_tenant: Annotated[UserTenant, Depends(verify_tenant_access)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> AsyncSession:
    """
    Set the Row-Level Security context for the database session.

    Args:
        current_user: Current authenticated user
        tenant_id: Tenant ID from token
        user_tenant: User-tenant membership (ensures access verified)
        db: Database session

    Returns:
        Database session with RLS context set
    """
    await set_tenant_context(db, str(tenant_id), str(current_user.id))
    logger.debug(
        "RLS context set",
        user_id=str(current_user.id),
        tenant_id=str(tenant_id),
        role=user_tenant.role,
    )
    return db


async def require_admin(
    user_tenant: Annotated[UserTenant, Depends(verify_tenant_access)],
) -> UserTenant:
    """
    Require that the user has admin or owner role in the tenant.

    Args:
        user_tenant: User-tenant membership

    Returns:
        User-tenant membership

    Raises:
        HTTPException: If user is not admin or owner
    """
    if user_tenant.role not in [UserTenantRole.OWNER, UserTenantRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or owner role required",
        )
    return user_tenant


async def require_owner(
    user_tenant: Annotated[UserTenant, Depends(verify_tenant_access)],
) -> UserTenant:
    """
    Require that the user has owner role in the tenant.

    Args:
        user_tenant: User-tenant membership

    Returns:
        User-tenant membership

    Raises:
        HTTPException: If user is not owner
    """
    if user_tenant.role != UserTenantRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner role required",
        )
    return user_tenant


# =============================================================================
# PILOT ACCESS CONTROL DEPENDENCIES
# =============================================================================


async def require_pilot(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Require that the user has active pilot access.

    Checks:
    - User has pilot or admin role
    - Pilot is enabled (for pilot role)
    - Within pilot access window

    Args:
        current_user: Current authenticated user

    Returns:
        Current user if pilot access is valid

    Raises:
        HTTPException: If user doesn't have pilot access
    """
    if not current_user.can_access_pilot_app():
        # Provide specific error messages
        if current_user.pilot_role not in [PilotRole.PILOT, PilotRole.ADMIN]:
            logger.warning(
                "Non-pilot user attempted pilot access",
                user_id=str(current_user.id),
                pilot_role=current_user.pilot_role.value,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Pilot access required. You are currently on the waitlist.",
            )

        if not current_user.pilot_enabled:
            logger.warning(
                "Disabled pilot user attempted access",
                user_id=str(current_user.id),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your pilot access has been disabled.",
            )

        if not current_user.is_pilot_window_active():
            days_remaining = current_user.get_pilot_days_remaining()
            if days_remaining is not None and days_remaining <= 0:
                logger.warning(
                    "Expired pilot user attempted access",
                    user_id=str(current_user.id),
                    pilot_end_at=str(current_user.pilot_end_at),
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your pilot access has expired.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your pilot access has not started yet.",
                )

    logger.info(
        "Pilot access granted",
        user_id=str(current_user.id),
        pilot_role=current_user.pilot_role.value,
        days_remaining=current_user.get_pilot_days_remaining(),
    )
    return current_user


async def require_investor(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Require that the user has investor or admin access.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user if investor access is valid

    Raises:
        HTTPException: If user doesn't have investor access
    """
    if not current_user.can_access_investor_dashboard():
        logger.warning(
            "Non-investor user attempted investor dashboard access",
            user_id=str(current_user.id),
            pilot_role=current_user.pilot_role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Investor access required.",
        )

    return current_user


async def require_pilot_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Require that the user has pilot admin access.

    Args:
        current_user: Current authenticated user

    Returns:
        Current user if admin access is valid

    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_admin():
        logger.warning(
            "Non-admin user attempted admin access",
            user_id=str(current_user.id),
            pilot_role=current_user.pilot_role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    return current_user


# Common dependency annotations for route handlers
CurrentUser = Annotated[User, Depends(get_current_active_user)]
TenantID = Annotated[UUID, Depends(get_tenant_id_from_token)]
UserTenantMembership = Annotated[UserTenant, Depends(verify_tenant_access)]
DBSession = Annotated[AsyncSession, Depends(set_rls_context)]
HIPAADBSession = Annotated[AsyncSession, Depends(get_main_session)]
FinancialDBSession = Annotated[AsyncSession, Depends(get_financial_session)]
SupabaseDBSession = Annotated[AsyncSession, Depends(get_supabase_session)]
AdminUser = Annotated[UserTenant, Depends(require_admin)]
OwnerUser = Annotated[UserTenant, Depends(require_owner)]

# Pilot access dependency annotations
PilotUser = Annotated[User, Depends(require_pilot)]
InvestorUser = Annotated[User, Depends(require_investor)]
PilotAdminUser = Annotated[User, Depends(require_pilot_admin)]
