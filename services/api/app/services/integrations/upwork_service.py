"""
Upwork API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class UpworkService:
    """Service for integrating with Upwork API"""

    BASE_URL = "https://www.upwork.com/api/v3"

    def __init__(self):
        self.api_key = getattr(settings, "UPWORK_API_KEY", None)
        self.api_secret = getattr(settings, "UPWORK_API_SECRET", None)

    def is_configured(self) -> bool:
        """Check if Upwork API credentials are configured."""
        return bool(self.api_key and self.api_secret)

    async def search_gigs(
        self,
        keywords: Optional[str] = None,
        category: Optional[str] = None,
        budget_min: Optional[float] = None,
        budget_max: Optional[float] = None,
        limit: int = 20,
        access_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for gigs on Upwork

        Args:
            keywords: Search keywords
            category: Job category
            budget_min: Minimum budget
            budget_max: Maximum budget
            limit: Maximum number of results
            access_token: User's OAuth access token

        Returns:
            List of gig listings
        """
        if not self.is_configured():
            logger.warning("Upwork API not configured. Set UPWORK_API_KEY and UPWORK_API_SECRET.")
            return []

        if not access_token:
            logger.warning("Upwork access token required for gig search.")
            return []

        try:
            params = {
                "q": keywords or "",
                "paging": f"0;{limit}",
            }

            if category:
                params["category2"] = category
            if budget_min:
                params["budget"] = f"[{budget_min} TO {budget_max or '*'}]"

            logger.info(f"Searching Upwork gigs: {keywords}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/profiles/v2/search/jobs.json",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("jobs", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Upwork API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Upwork gigs: {str(e)}")
            return []
