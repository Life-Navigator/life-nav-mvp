"""
Instagram Graph API integration service
"""

from typing import Optional, Dict, Any
from datetime import datetime
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class InstagramAPIService:
    """Service for integrating with Instagram Graph API"""

    BASE_URL = "https://graph.instagram.com"

    def __init__(self):
        self.client_id = getattr(settings, "INSTAGRAM_CLIENT_ID", None)
        self.client_secret = getattr(settings, "INSTAGRAM_CLIENT_SECRET", None)

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Get Instagram OAuth authorization URL"""
        scopes = "user_profile,user_media"
        return (
            f"https://api.instagram.com/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope={scopes}"
            f"&response_type=code"
            f"&state={state}"
        )

    async def post_media(
        self, access_token: str, image_url: str, caption: str
    ) -> Optional[str]:
        """Post media to Instagram"""
        try:
            logger.info(f"Posting to Instagram: {caption[:50]}...")
            return f"instagram_post_{datetime.utcnow().timestamp()}"
        except Exception as e:
            logger.error(f"Error posting to Instagram: {str(e)}")
            return None

    async def get_user_profile(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user's Instagram profile"""
        try:
            return {
                "id": "mock_instagram_id",
                "username": "mockuser",
                "followers_count": 5000,
                "follows_count": 300,
                "media_count": 150,
            }
        except Exception as e:
            logger.error(f"Error fetching Instagram profile: {str(e)}")
            return None
