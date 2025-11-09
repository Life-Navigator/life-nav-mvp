"""
Indeed API integration service
"""

import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class IndeedService:
    """Service for integrating with Indeed API"""

    BASE_URL = "https://api.indeed.com/ads/apisearch"

    def __init__(self):
        self.api_key = getattr(settings, "INDEED_API_KEY", None)
        self.publisher_id = getattr(settings, "INDEED_PUBLISHER_ID", None)

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

            # Mock data for development
            return self._get_mock_jobs(keywords, location, limit)

        except Exception as e:
            logger.error(f"Error searching Indeed jobs: {str(e)}")
            return []

    def _get_mock_jobs(
        self, keywords: Optional[str], location: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Generate mock Indeed job data"""
        mock_jobs = [
            {
                "id": f"indeed_job_{i}",
                "title": f"{keywords or 'Developer'} - Position {i}",
                "company": ["TechCorp", "InnoSoft", "DataSystems", "CloudWorks", "DevHub"][i % 5],
                "location": location or "Remote",
                "location_type": ["remote", "hybrid", "onsite"][i % 3],
                "employment_type": "full-time",
                "description": f"Great opportunity for {keywords or 'professionals'}...",
                "requirements": ["Experience required", "Strong communication skills"],
                "skills": ["Programming", "Problem Solving", "Teamwork"],
                "salary_min": 90000 + (i * 5000),
                "salary_max": 140000 + (i * 5000),
                "salary_currency": "USD",
                "salary_period": "yearly",
                "posted_date": (datetime.utcnow() - timedelta(days=i * 2)).isoformat(),
                "external_url": f"https://www.indeed.com/viewjob?jk=indeed_{i}",
                "applicants": 30 + (i * 5),
            }
            for i in range(min(limit, 10))
        ]
        return mock_jobs
