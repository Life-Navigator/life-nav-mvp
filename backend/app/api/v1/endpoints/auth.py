"""
Authentication endpoints.
Handles user registration, login, logout, and token refresh.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.logging import logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from app.models.user import Organization, Tenant, User, UserTenant, UserTenantRole
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse

router = APIRouter()


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Register a new user with a new tenant/workspace.

    Creates:
    1. Organization
    2. Tenant
    3. User
    4. User-tenant membership (as owner)

    Returns user info and authentication tokens.
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    # Hash password
    hashed_password = get_password_hash(request.password)

    # Create organization
    org = Organization(
        name=request.tenant_name,
        slug=request.tenant_name.lower().replace(" ", "-"),
        email=request.email,
    )
    db.add(org)
    await db.flush()  # Get org.id

    # Create tenant
    tenant = Tenant(
        organization_id=org.id,
        name=request.tenant_name,
        slug=request.tenant_name.lower().replace(" ", "-"),
    )
    db.add(tenant)
    await db.flush()  # Get tenant.id

    # Create user
    user = User(
        email=request.email,
        password_hash=hashed_password,
        first_name=request.first_name,
        last_name=request.last_name,
        display_name=f"{request.first_name} {request.last_name}",
    )
    db.add(user)
    await db.flush()  # Get user.id

    # Create user-tenant membership with owner role
    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=tenant.id,
        role=UserTenantRole.OWNER,
        joined_at=datetime.utcnow(),
    )
    db.add(user_tenant)

    await db.commit()
    await db.refresh(user)
    await db.refresh(tenant)

    # Generate tokens
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(tenant.id),
    )
    refresh_token = create_refresh_token(
        subject=str(user.id),
        tenant_id=str(tenant.id),
    )

    logger.info(
        "User registered",
        user_id=str(user.id),
        email=user.email,
        tenant_id=str(tenant.id),
    )

    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Login with email and password.

    Returns user info and authentication tokens with tenant context.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Verify password
    if not verify_password(request.password, user.password_hash):
        logger.warning("Failed login attempt", email=request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check user status
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status}",
        )

    # Get first active tenant for user
    result = await db.execute(
        select(UserTenant)
        .where(
            UserTenant.user_id == user.id,
            UserTenant.status == "active",
        )
        .order_by(UserTenant.joined_at)
        .limit(1)
    )
    user_tenant = result.scalar_one_or_none()

    if not user_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no active tenant membership",
        )

    # Generate tokens with tenant context
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(user_tenant.tenant_id),
    )
    refresh_token = create_refresh_token(
        subject=str(user.id),
        tenant_id=str(user_tenant.tenant_id),
    )

    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    logger.info(
        "User logged in",
        user_id=str(user.id),
        email=user.email,
        tenant_id=str(user_tenant.tenant_id),
    )

    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.

    Validates refresh token and generates new access token.
    """
    # Verify refresh token
    payload = verify_token(request.refresh_token, token_type="refresh")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Extract user_id and tenant_id
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Generate new access token
    access_token = create_access_token(
        subject=user_id,
        tenant_id=tenant_id,
    )

    logger.info("Token refreshed", user_id=user_id, tenant_id=tenant_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=request.refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    """
    Logout current user.

    Token invalidation is handled client-side.
    This endpoint exists for consistency and future server-side token blacklisting.
    """
    # In a stateless JWT setup, logout is primarily client-side
    # (client discards the tokens)
    # Future enhancement: maintain token blacklist in Redis
    logger.info("User logged out")
    return None
