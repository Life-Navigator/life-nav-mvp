"""
API Key Management Endpoints.
Allows users to create, list, revoke, and monitor their API keys.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import AuthMiddleware
from app.models.api_key import APIKeyScope, APIKeyStatus
from app.services.api_key_service import APIKeyService

router = APIRouter()


# Pydantic schemas
class APIKeyCreate(BaseModel):
    """Request schema for creating a new API key."""

    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name")
    description: Optional[str] = Field(None, max_length=1000)
    scopes: list[str] = Field(..., min_items=1, description="Permission scopes")
    rate_limit_per_minute: int = Field(100, ge=1, le=10000)
    rate_limit_per_hour: int = Field(5000, ge=1, le=100000)
    allowed_ips: Optional[list[str]] = Field(None, description="IP whitelist (null = all IPs)")
    expires_in_days: Optional[int] = Field(
        None,
        ge=1,
        le=3650,
        description="Expiration in days (null = never expires)",
    )


class APIKeyResponse(BaseModel):
    """Response schema for API key (safe for display)."""

    id: UUID
    name: str
    description: Optional[str]
    key_prefix: str
    status: APIKeyStatus
    scopes: list[str]
    rate_limit_per_minute: int
    rate_limit_per_hour: int
    allowed_ips: Optional[list[str]]
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    last_used_ip: Optional[str]
    total_requests: int
    created_at: datetime
    revoked_at: Optional[datetime]
    revocation_reason: Optional[str]

    class Config:
        from_attributes = True


class APIKeyCreated(BaseModel):
    """Response schema when creating a new API key (includes plaintext key)."""

    api_key: APIKeyResponse
    plaintext_key: str = Field(
        ...,
        description="WARNING: Save this key! It will never be shown again.",
    )


class APIKeyUsageStats(BaseModel):
    """Usage statistics for an API key."""

    total_requests: int
    avg_response_time_ms: float
    error_count: int
    error_rate: float


class RevokeAPIKey(BaseModel):
    """Request schema for revoking an API key."""

    reason: Optional[str] = Field(None, max_length=1000)


# Dependency to get current user ID from JWT
async def get_current_user_id(request) -> UUID:
    """Extract user ID from authenticated request."""
    if not hasattr(request.state, "user_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return UUID(request.state.user_id)


@router.post(
    "/keys",
    response_model=APIKeyCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Create API Key",
    description="Generate a new API key with specified permissions and rate limits",
)
async def create_api_key(
    key_data: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Create a new API key.

    **WARNING**: The plaintext key is returned ONLY ONCE.
    You must save it immediately - it cannot be retrieved later!

    **Scopes**: Choose from the following permissions:
    - `finance:accounts:read` - Read financial accounts
    - `finance:accounts:write` - Create/update accounts
    - `finance:transactions:read` - Read transactions
    - `finance:transactions:write` - Create/update transactions
    - `finance:investments:read` - Read investments
    - `finance:investments:write` - Create/update investments
    - `finance:documents:read` - Read documents
    - `finance:documents:write` - Upload documents
    - `finance:ocr:process` - Process OCR on documents
    - `finance:market:read` - Read market data
    - `admin:*` - Full admin access (use with caution!)

    **Rate Limits**:
    - Default: 100 requests/minute, 5000 requests/hour
    - Adjust based on your integration needs

    **IP Whitelisting**:
    - Leave null to allow all IPs
    - Provide array of IPs to restrict access

    **Expiration**:
    - Leave null for no expiration
    - Set expiration in days (1-3650)
    """
    service = APIKeyService(db)

    # Validate scopes
    valid_scopes = {scope.value for scope in APIKeyScope}
    invalid_scopes = set(key_data.scopes) - valid_scopes
    if invalid_scopes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scopes: {', '.join(invalid_scopes)}",
        )

    # Create the key
    api_key, plaintext_key = await service.create_api_key(
        user_id=user_id,
        name=key_data.name,
        scopes=key_data.scopes,
        description=key_data.description,
        rate_limit_per_minute=key_data.rate_limit_per_minute,
        rate_limit_per_hour=key_data.rate_limit_per_hour,
        allowed_ips=key_data.allowed_ips,
        expires_in_days=key_data.expires_in_days,
    )

    return APIKeyCreated(
        api_key=APIKeyResponse.model_validate(api_key),
        plaintext_key=plaintext_key,
    )


@router.get(
    "/keys",
    response_model=list[APIKeyResponse],
    summary="List API Keys",
    description="List all API keys for the authenticated user",
)
async def list_api_keys(
    include_revoked: bool = False,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    List all API keys for the current user.

    By default, only shows active and suspended keys.
    Set `include_revoked=true` to see revoked keys as well.
    """
    service = APIKeyService(db)
    keys = await service.list_user_keys(user_id, include_revoked=include_revoked)

    return [APIKeyResponse.model_validate(key) for key in keys]


@router.get(
    "/keys/{key_id}",
    response_model=APIKeyResponse,
    summary="Get API Key",
    description="Get details of a specific API key",
)
async def get_api_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Get details of a specific API key."""
    service = APIKeyService(db)

    from sqlalchemy import select
    from app.models.api_key import APIKey

    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == user_id,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    return APIKeyResponse.model_validate(api_key)


@router.get(
    "/keys/{key_id}/usage",
    response_model=APIKeyUsageStats,
    summary="Get Usage Statistics",
    description="Get usage statistics for a specific API key",
)
async def get_api_key_usage(
    key_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Get usage statistics for an API key.

    Optionally filter by date range.
    """
    service = APIKeyService(db)

    # Verify ownership
    from sqlalchemy import select
    from app.models.api_key import APIKey

    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == user_id,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    stats = await service.get_usage_stats(key_id, start_date, end_date)
    return APIKeyUsageStats(**stats)


@router.post(
    "/keys/{key_id}/revoke",
    response_model=dict,
    summary="Revoke API Key",
    description="Revoke an API key (cannot be undone)",
)
async def revoke_api_key(
    key_id: UUID,
    revoke_data: RevokeAPIKey,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Revoke an API key.

    **WARNING**: This action cannot be undone!
    The key will immediately stop working and cannot be reactivated.

    Create a new key if you need API access again.
    """
    service = APIKeyService(db)

    # Verify ownership
    from sqlalchemy import select
    from app.models.api_key import APIKey

    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == user_id,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    if api_key.status == APIKeyStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key is already revoked",
        )

    success = await service.revoke_api_key(
        api_key_id=key_id,
        revoked_by=user_id,
        reason=revoke_data.reason,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke API key",
        )

    return {
        "message": "API key revoked successfully",
        "key_id": str(key_id),
        "revoked_at": datetime.utcnow().isoformat(),
    }


@router.get(
    "/scopes",
    response_model=list[dict],
    summary="List Available Scopes",
    description="List all available API key permission scopes",
)
async def list_scopes():
    """
    List all available permission scopes.

    Use these scopes when creating API keys to grant specific permissions.
    """
    scopes = [
        {
            "scope": scope.value,
            "description": {
                "finance:accounts:read": "Read financial accounts",
                "finance:accounts:write": "Create and update financial accounts",
                "finance:transactions:read": "Read transactions",
                "finance:transactions:write": "Create and update transactions",
                "finance:investments:read": "Read investment data",
                "finance:investments:write": "Create and update investments",
                "finance:documents:read": "Read financial documents",
                "finance:documents:write": "Upload and manage documents",
                "finance:ocr:process": "Process OCR on documents",
                "finance:market:read": "Read market data",
                "admin:*": "Full administrative access",
                "admin:keys:manage": "Manage API keys for other users",
            }.get(scope.value, ""),
        }
        for scope in APIKeyScope
    ]

    return scopes
