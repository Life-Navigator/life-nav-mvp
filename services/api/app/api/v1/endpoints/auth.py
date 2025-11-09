"""
Authentication endpoints
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import secrets

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    decode_token,
    verify_token_type,
)
from app.models.user import User
from app.models.verification_token import EmailVerificationToken
from app.schemas.user import UserLogin, Token, UserCreate, UserResponse, TokenRefresh
from app.core.config import settings
from app.services.email_service import get_email_service
from app.services.oauth_service import get_oauth_service

router = APIRouter()

# Temporary OAuth state storage (use Redis in production)
oauth_states = {}


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        full_name=user_data.full_name,
        phone=user_data.phone,
        tenant_id=f"tenant_{user_data.email.split('@')[0]}",  # Simple tenant ID generation
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create email verification token
    verification_token = EmailVerificationToken(
        user_id=user.id,
        token=EmailVerificationToken.generate_token(),
        expires_at=EmailVerificationToken.get_expiration_time(hours=24),
    )
    db.add(verification_token)
    await db.commit()

    # Send verification email
    email_service = get_email_service()
    await email_service.send_verification_email(
        to_email=user.email,
        username=user.username or user.email,
        verification_token=verification_token.token,
    )

    return user


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login and get access token"""
    # Get user by email
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your inbox for the verification link."
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    # Create tokens
    access_token = create_access_token(
        {"sub": str(user.id), "tenant_id": user.tenant_id}
    )
    refresh_token = create_refresh_token(
        {"sub": str(user.id), "tenant_id": user.tenant_id}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    token_data: TokenRefresh, db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using a valid refresh token

    This endpoint allows users to get a new access token without re-authenticating,
    as long as they have a valid refresh token.
    """
    # Decode and verify the refresh token
    payload = decode_token(token_data.refresh_token)
    verify_token_type(payload, "refresh")

    # Extract user ID from token
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not verified",
        )

    # Create new tokens
    new_access_token = create_access_token(
        {"sub": str(user.id), "tenant_id": user.tenant_id}
    )
    new_refresh_token = create_refresh_token(
        {"sub": str(user.id), "tenant_id": user.tenant_id}
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify user email address with token"""
    # Find the verification token
    result = await db.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.token == token)
    )
    verification_token = result.scalar_one_or_none()

    if not verification_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification token"
        )

    # Check if token is valid
    if not verification_token.is_valid():
        if verification_token.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has already been used"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired"
            )

    # Get the user
    user_result = await db.execute(
        select(User).where(User.id == verification_token.user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update user as verified
    user.is_verified = True
    user.email_verified_at = datetime.now(timezone.utc)

    # Mark token as used
    verification_token.is_used = True
    verification_token.used_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "success": True,
        "message": "Email verified successfully"
    }


# ============================================================================
# OAuth 2.0 Endpoints
# ============================================================================

@router.get("/oauth/{provider}")
async def oauth_login(provider: str):
    """
    Initiate OAuth 2.0 login flow
    
    Redirects user to OAuth provider (Google, LinkedIn, Facebook) for authentication
    """
    oauth_service = get_oauth_service()
    
    # Generate secure random state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    # Store state temporarily (use Redis in production)
    oauth_states[state] = {"provider": provider, "timestamp": datetime.now(timezone.utc)}
    
    # Get authorization URL from OAuth provider
    try:
        redirect_uri = f"{settings.API_V1_PREFIX}/auth/oauth/{provider}/callback"
        auth_url = oauth_service.get_authorization_url(provider, redirect_uri, state)
        return RedirectResponse(url=auth_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth 2.0 callback endpoint
    
    Handles the OAuth provider callback, exchanges code for tokens,
    creates or updates user, and redirects to frontend with JWT tokens
    """
    oauth_service = get_oauth_service()
    
    # Verify state parameter (CSRF protection)
    if state not in oauth_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    
    stored_state = oauth_states.pop(state)
    if stored_state["provider"] != provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider mismatch"
        )
    
    try:
        # Exchange authorization code for access token
        redirect_uri = f"{settings.API_V1_PREFIX}/auth/oauth/{provider}/callback"
        token_data = await oauth_service.exchange_code_for_token(
            provider, code, redirect_uri
        )
        
        # Get user info from OAuth provider
        user_info = await oauth_service.get_user_info(
            provider, token_data["access_token"]
        )
        
        # Find or create user
        email = user_info["email"]
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            # Create new user from OAuth data
            user = User(
                email=email,
                username=email.split("@")[0],  # Use email prefix as username
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
                first_name=user_info.get("first_name"),
                last_name=user_info.get("last_name"),
                full_name=user_info.get("full_name"),
                avatar_url=user_info.get("avatar_url"),
                tenant_id=f"tenant_{email.split('@')[0]}",
                is_verified=user_info.get("email_verified", True),  # OAuth emails are verified
                is_active=True,
            )
            
            if user.is_verified:
                user.email_verified_at = datetime.now(timezone.utc)
            
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # Update existing user's OAuth data
            user.avatar_url = user_info.get("avatar_url") or user.avatar_url
            user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
        
        # Create JWT tokens
        access_token = create_access_token(
            {"sub": str(user.id), "tenant_id": user.tenant_id}
        )
        refresh_token = create_refresh_token(
            {"sub": str(user.id), "tenant_id": user.tenant_id}
        )
        
        # Redirect to frontend with tokens
        # Frontend will extract tokens from URL and store them
        frontend_url = settings.OAUTH_REDIRECT_URI
        redirect_url = f"{frontend_url}?access_token={access_token}&refresh_token={refresh_token}&token_type=bearer"
        
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        # Redirect to frontend with error
        frontend_url = settings.OAUTH_REDIRECT_URI
        error_url = f"{frontend_url}?error=oauth_failed&message={str(e)}"
        return RedirectResponse(url=error_url)
