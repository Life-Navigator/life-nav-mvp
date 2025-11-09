"""
LinkedIn API integration service for profile and networking
"""

import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class LinkedInAPIService:
    """Service for integrating with LinkedIn API (OAuth, Profile, Connections)"""

    BASE_URL = "https://api.linkedin.com/v2"
    OAUTH_URL = "https://www.linkedin.com/oauth/v2"

    def __init__(self):
        self.client_id = getattr(settings, "LINKEDIN_CLIENT_ID", None)
        self.client_secret = getattr(settings, "LINKEDIN_CLIENT_SECRET", None)

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Get LinkedIn OAuth authorization URL"""
        scopes = ["r_liteprofile", "r_emailaddress", "w_member_social"]
        scope_string = "%20".join(scopes)
        return (
            f"{self.OAUTH_URL}/authorization"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
            f"&scope={scope_string}"
        )

    async def exchange_code_for_token(
        self, code: str, redirect_uri: str
    ) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.OAUTH_URL}/accessToken",
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error exchanging LinkedIn code for token: {str(e)}")
            return None

    async def get_profile(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user's LinkedIn profile"""
        try:
            # Mock response for development
            return {
                "id": "mock_linkedin_id",
                "firstName": {"localized": {"en_US": "John"}},
                "lastName": {"localized": {"en_US": "Doe"}},
                "profilePicture": {
                    "displayImage": "https://example.com/profile.jpg"
                },
            }
        except Exception as e:
            logger.error(f"Error fetching LinkedIn profile: {str(e)}")
            return None

    async def get_connections(
        self, access_token: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get user's LinkedIn connections"""
        try:
            # Mock response for development
            return [
                {
                    "id": f"connection_{i}",
                    "name": f"Connection {i}",
                    "title": "Software Engineer",
                    "company": "Tech Corp",
                    "profile_url": f"https://linkedin.com/in/user{i}",
                }
                for i in range(min(limit, 20))
            ]
        except Exception as e:
            logger.error(f"Error fetching LinkedIn connections: {str(e)}")
            return []

    async def post_share(
        self, access_token: str, content: str, media_urls: Optional[List[str]] = None
    ) -> Optional[str]:
        """Post content to LinkedIn"""
        try:
            logger.info(f"Posting to LinkedIn: {content[:50]}...")
            # Return mock post ID
            return f"linkedin_post_{datetime.utcnow().timestamp()}"
        except Exception as e:
            logger.error(f"Error posting to LinkedIn: {str(e)}")
            return None
