"""
OAuth 2.0 service for social authentication
Supports Google, LinkedIn, Facebook, and other OAuth providers
"""

import httpx
from typing import Dict, Optional
from urllib.parse import urlencode

from app.core.config import settings


class OAuthProvider:
    """Base OAuth 2.0 provider"""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        authorize_url: str,
        token_url: str,
        userinfo_url: str,
        scope: str,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.authorize_url = authorize_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
        self.scope = scope

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth authorization URL"""
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.scope,
            "state": state,
        }
        return f"{self.authorize_url}?{urlencode(params)}"

    async def exchange_code_for_token(
        self, code: str, redirect_uri: str
    ) -> Dict[str, str]:
        """Exchange authorization code for access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> Dict:
        """Get user information from OAuth provider"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()


class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth 2.0 provider"""

    def __init__(self):
        super().__init__(
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            userinfo_url="https://www.googleapis.com/oauth2/v2/userinfo",
            scope="openid profile email",
        )

    async def get_user_info(self, access_token: str) -> Dict:
        """Get Google user information"""
        user_info = await super().get_user_info(access_token)
        # Normalize Google response
        return {
            "id": user_info.get("id"),
            "email": user_info.get("email"),
            "first_name": user_info.get("given_name"),
            "last_name": user_info.get("family_name"),
            "full_name": user_info.get("name"),
            "avatar_url": user_info.get("picture"),
            "email_verified": user_info.get("verified_email", False),
        }


class LinkedInOAuthProvider(OAuthProvider):
    """LinkedIn OAuth 2.0 provider"""

    def __init__(self):
        super().__init__(
            client_id=settings.LINKEDIN_CLIENT_ID,
            client_secret=settings.LINKEDIN_CLIENT_SECRET,
            authorize_url="https://www.linkedin.com/oauth/v2/authorization",
            token_url="https://www.linkedin.com/oauth/v2/accessToken",
            userinfo_url="https://api.linkedin.com/v2/userinfo",
            scope="openid profile email",
        )

    async def get_user_info(self, access_token: str) -> Dict:
        """Get LinkedIn user information"""
        user_info = await super().get_user_info(access_token)
        # Normalize LinkedIn response
        return {
            "id": user_info.get("sub"),
            "email": user_info.get("email"),
            "first_name": user_info.get("given_name"),
            "last_name": user_info.get("family_name"),
            "full_name": user_info.get("name"),
            "avatar_url": user_info.get("picture"),
            "email_verified": user_info.get("email_verified", False),
        }


class FacebookOAuthProvider(OAuthProvider):
    """Facebook OAuth 2.0 provider"""

    def __init__(self):
        super().__init__(
            client_id=settings.FACEBOOK_CLIENT_ID,
            client_secret=settings.FACEBOOK_CLIENT_SECRET,
            authorize_url="https://www.facebook.com/v18.0/dialog/oauth",
            token_url="https://graph.facebook.com/v18.0/oauth/access_token",
            userinfo_url="https://graph.facebook.com/me",
            scope="email,public_profile",
        )

    async def get_user_info(self, access_token: str) -> Dict:
        """Get Facebook user information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.userinfo_url}?fields=id,name,email,first_name,last_name,picture&access_token={access_token}",
            )
            response.raise_for_status()
            user_info = response.json()

        # Normalize Facebook response
        return {
            "id": user_info.get("id"),
            "email": user_info.get("email"),
            "first_name": user_info.get("first_name"),
            "last_name": user_info.get("last_name"),
            "full_name": user_info.get("name"),
            "avatar_url": user_info.get("picture", {}).get("data", {}).get("url"),
            "email_verified": True,  # Facebook emails are verified
        }


class OAuthService:
    """OAuth service for managing multiple providers"""

    def __init__(self):
        self.providers = {
            "google": GoogleOAuthProvider(),
            "linkedin": LinkedInOAuthProvider(),
            "facebook": FacebookOAuthProvider(),
        }

    def get_provider(self, provider_name: str) -> OAuthProvider:
        """Get OAuth provider by name"""
        provider = self.providers.get(provider_name.lower())
        if not provider:
            raise ValueError(f"Unsupported OAuth provider: {provider_name}")
        return provider

    def get_authorization_url(
        self, provider_name: str, redirect_uri: str, state: str
    ) -> str:
        """Get authorization URL for provider"""
        provider = self.get_provider(provider_name)
        return provider.get_authorization_url(redirect_uri, state)

    async def exchange_code_for_token(
        self, provider_name: str, code: str, redirect_uri: str
    ) -> Dict[str, str]:
        """Exchange authorization code for access token"""
        provider = self.get_provider(provider_name)
        return await provider.exchange_code_for_token(code, redirect_uri)

    async def get_user_info(
        self, provider_name: str, access_token: str
    ) -> Dict:
        """Get user information from OAuth provider"""
        provider = self.get_provider(provider_name)
        return await provider.get_user_info(access_token)


# Singleton instance
oauth_service = OAuthService()


def get_oauth_service() -> OAuthService:
    """Get OAuth service instance"""
    return oauth_service
