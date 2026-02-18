"""
Indeed API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class IndeedService:
    """Service for integrating with Indeed API"""

    BASE_URL = "https://api.indeed.com/ads/apisearch"

    def __init__(self):
        self.api_key = getattr(settings, "INDEED_API_KEY", None)
        self.publisher_id = getattr(settings, "INDEED_PUBLISHER_ID", None)

    def is_configured(self) -> bool:
        """Check if Indeed API credentials are configured."""
        return bool(self.api_key and self.publisher_id)

    async def search_jobs(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        job_type: Optional[str] = None,
        salary_min: Optional[float] = None,
        posted_within_days: int = 30,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for jobs on Indeed

        Args:
            keywords: Job search keywords
            location: Location filter
            job_type: Employment type
            salary_min: Minimum salary
            posted_within_days: Filter jobs posted within X days
            limit: Maximum number of results

        Returns:
            List of job listings
        """
        if not self.is_configured():
            logger.warning("Indeed API not configured. Set INDEED_API_KEY and INDEED_PUBLISHER_ID.")
            return []

        try:
            params = {
                "publisher": self.publisher_id,
                "q": keywords or "",
                "l": location or "",
                "limit": limit,
                "format": "json",
                "v": "2",
            }

            if job_type:
                params["jt"] = job_type
            if salary_min:
                params["salary"] = str(int(salary_min))
            if posted_within_days:
                params["fromage"] = posted_within_days

            logger.info(f"Searching Indeed jobs with params: {params}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.BASE_URL,
                    params=params,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("results", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Indeed API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Indeed jobs: {str(e)}")
            return []
