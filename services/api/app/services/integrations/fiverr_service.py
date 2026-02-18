"""
Fiverr API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class FiverrService:
    """Service for integrating with Fiverr API"""

    BASE_URL = "https://api.fiverr.com/v1"

    def __init__(self):
        self.api_key = getattr(settings, "FIVERR_API_KEY", None)

    def is_configured(self) -> bool:
        """Check if Fiverr API credentials are configured."""
        return bool(self.api_key)

    async def search_gigs(
        self,
        keywords: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for gigs on Fiverr

        Args:
            keywords: Search keywords
            category: Gig category
            limit: Maximum number of results

        Returns:
            List of gig listings
        """
        if not self.is_configured():
            logger.warning("Fiverr API not configured. Set FIVERR_API_KEY.")
            return []

        try:
            params = {
                "query": keywords or "",
                "limit": limit,
            }

            if category:
                params["category"] = category

            logger.info(f"Searching Fiverr gigs: {keywords}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/gigs/search",
                    params=params,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("gigs", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Fiverr API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Fiverr gigs: {str(e)}")
            return []
