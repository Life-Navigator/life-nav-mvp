"""
Integration schemas
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class IntegrationPlatformBase(BaseModel):
    """Base integration platform schema"""

    id: str
    name: str
    description: str
    category: str
    logo: str
    coming_soon: bool = False
    permissions: List[str]
    modal_description: Optional[str] = None
    api_docs_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class IntegrationPlatformResponse(IntegrationPlatformBase):
    """Integration platform response"""

    class Config:
        from_attributes = True


class IntegrationPlatformList(BaseModel):
    """List of integration platforms"""

    platforms: List[IntegrationPlatformResponse]
    total: int


class UserIntegrationBase(BaseModel):
    """Base user integration schema"""

    platform_id: str


class UserIntegrationCreate(UserIntegrationBase):
    """Create user integration"""

    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class UserIntegrationUpdate(BaseModel):
    """Update user integration"""

    status: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class UserIntegrationResponse(BaseModel):
    """User integration response"""

    id: str
    user_id: str
    platform_id: str
    status: str
    connected_at: datetime
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    # Include platform info
    platform: Optional[IntegrationPlatformResponse] = None

    class Config:
        from_attributes = True


class ConnectedServiceResponse(BaseModel):
    """Connected service response for dashboard"""

    id: str
    provider_id: str
    name: str
    logo_url: str
    status: str  # active, needs_attention, expired
    connected_date: datetime
    last_sync_date: Optional[datetime]
    domain: str


class SyncStatusResponse(BaseModel):
    """Sync status response"""

    status: str  # success, in_progress, failed
    last_sync: Optional[datetime]
    domains: Dict[str, str]  # category -> status


class IntegrationOAuthStartRequest(BaseModel):
    """Request to start OAuth flow"""

    platform_id: str
    redirect_uri: str


class IntegrationOAuthStartResponse(BaseModel):
    """Response with OAuth URL"""

    authorization_url: str
    state: str


class IntegrationOAuthCallbackRequest(BaseModel):
    """OAuth callback data"""

    platform_id: str
    code: str
    state: str
