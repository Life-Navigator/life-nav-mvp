"""
Social account schemas
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponseSchema
from app.models.social_account import SocialPlatform, ConnectionStatus


# Social Account Schemas
class SocialAccountBase(BaseModel):
    """Base social account schema"""

    platform: SocialPlatform
    username: Optional[str] = None
    display_name: Optional[str] = None


class SocialAccountConnect(BaseModel):
    """Connect social account schema"""

    platform: SocialPlatform
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None


class SocialAccountUpdate(BaseModel):
    """Update social account schema"""

    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    status: Optional[ConnectionStatus] = None
    sync_enabled: Optional[bool] = None


class SocialAccountResponse(BaseResponseSchema):
    """Social account response schema"""

    user_id: UUID
    platform: SocialPlatform
    platform_user_id: Optional[str]
    username: Optional[str]
    display_name: Optional[str]
    profile_url: Optional[str]
    avatar_url: Optional[str]
    status: ConnectionStatus
    followers_count: int
    following_count: int
    posts_count: int
    connections_count: Optional[int]
    scopes: Optional[List[str]]
    last_synced_at: Optional[datetime]
    sync_enabled: bool
    connected_at: datetime

    class Config:
        from_attributes = True


class SocialAccountList(BaseModel):
    """Social account list response"""

    items: List[SocialAccountResponse]
    total: int


# Social Post Schemas
class SocialPostBase(BaseModel):
    """Base social post schema"""

    content: str
    media_urls: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    platforms: List[SocialPlatform]


class SocialPostCreate(SocialPostBase):
    """Create social post schema"""

    scheduled_at: Optional[datetime] = None
    is_draft: bool = False


class SocialPostUpdate(BaseModel):
    """Update social post schema"""

    content: Optional[str] = None
    media_urls: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    is_draft: Optional[bool] = None


class SocialPostResponse(BaseResponseSchema):
    """Social post response schema"""

    user_id: UUID
    content: str
    media_urls: Optional[List[str]]
    hashtags: Optional[List[str]]
    platforms: List[SocialPlatform]
    scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    is_draft: bool
    linkedin_post_id: Optional[str]
    twitter_post_id: Optional[str]
    instagram_post_id: Optional[str]
    tiktok_post_id: Optional[str]
    facebook_post_id: Optional[str]
    total_likes: int
    total_comments: int
    total_shares: int
    total_views: int

    class Config:
        from_attributes = True


class SocialPostList(BaseModel):
    """Social post list response"""

    items: List[SocialPostResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class CrossPostRequest(BaseModel):
    """Request to cross-post content"""

    content: str
    platforms: List[SocialPlatform]
    media_urls: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None


# Network Connection Schemas
class NetworkConnectionCreate(BaseModel):
    """Create network connection schema"""

    platform: SocialPlatform
    connection_name: str
    connection_title: Optional[str] = None
    connection_company: Optional[str] = None
    connection_location: Optional[str] = None
    connection_profile_url: Optional[str] = None
    connection_avatar_url: Optional[str] = None
    platform_connection_id: Optional[str] = None
    relationship_note: Optional[str] = None


class NetworkConnectionUpdate(BaseModel):
    """Update network connection schema"""

    relationship_note: Optional[str] = None
    tags: Optional[List[str]] = None
    last_interaction_date: Optional[datetime] = None


class NetworkConnectionResponse(BaseResponseSchema):
    """Network connection response schema"""

    user_id: UUID
    platform: SocialPlatform
    connection_name: str
    connection_title: Optional[str]
    connection_company: Optional[str]
    connection_location: Optional[str]
    connection_profile_url: Optional[str]
    connection_avatar_url: Optional[str]
    platform_connection_id: Optional[str]
    relationship_note: Optional[str]
    connection_strength: Optional[float]
    last_interaction_date: Optional[datetime]
    interaction_count: int
    tags: Optional[List[str]]
    connected_at: datetime

    class Config:
        from_attributes = True


class NetworkConnectionList(BaseModel):
    """Network connection list response"""

    items: List[NetworkConnectionResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


# Analytics Schemas
class SocialAnalytics(BaseModel):
    """Social media analytics"""

    platform: SocialPlatform
    followers_count: int
    following_count: int
    posts_count: int
    engagement_rate: float
    total_likes: int
    total_comments: int
    total_shares: int
    total_views: int
    follower_growth_30d: int
    top_posts: List[dict]


class NetworkAnalytics(BaseModel):
    """Network analytics"""

    total_connections: int
    connections_by_platform: dict
    new_connections_30d: int
    connection_strength_avg: float
    industry_breakdown: dict
    location_breakdown: dict
    top_companies: List[str]


class InfluenceScore(BaseModel):
    """Influence score calculation"""

    overall_score: float  # 0-100
    linkedin_score: Optional[float]
    twitter_score: Optional[float]
    instagram_score: Optional[float]
    tiktok_score: Optional[float]
    factors: dict  # breakdown of score components
    recommendations: List[str]
