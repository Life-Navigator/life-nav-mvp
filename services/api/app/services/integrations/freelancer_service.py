"""
Freelancer.com API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class FreelancerService:
    """Service for integrating with Freelancer.com API"""

    BASE_URL = "https://www.freelancer.com/api"

    def __init__(self):
        self.api_key = getattr(settings, "FREELANCER_API_KEY", None)

    def is_configured(self) -> bool:
        """Check if Freelancer API credentials are configured."""
        return bool(self.api_key)

    async def search_projects(
        self,
        keywords: Optional[str] = None,
        budget_min: Optional[float] = None,
        budget_max: Optional[float] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for projects on Freelancer.com

        Args:
            keywords: Search keywords
            budget_min: Minimum budget
            budget_max: Maximum budget
            limit: Maximum number of results

        Returns:
            List of project listings
        """
        if not self.is_configured():
            logger.warning("Freelancer API not configured. Set FREELANCER_API_KEY.")
            return []

        try:
            params = {
                "query": keywords or "",
                "limit": limit,
            }

            if budget_min:
                params["min_budget"] = budget_min
            if budget_max:
                params["max_budget"] = budget_max

            logger.info(f"Searching Freelancer projects: {keywords}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/projects/0.1/projects/active",
                    params=params,
                    headers={
                        "freelancer-oauth-v1": self.api_key,
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("result", {}).get("projects", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Freelancer API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Freelancer projects: {str(e)}")
            return []
