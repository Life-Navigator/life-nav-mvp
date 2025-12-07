"""
LinkedIn Jobs API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class LinkedInJobsService:
    """Service for integrating with LinkedIn Jobs API"""

    BASE_URL = "https://api.linkedin.com/v2"

    def __init__(self):
        self.client_id = getattr(settings, "LINKEDIN_CLIENT_ID", None)
        self.client_secret = getattr(settings, "LINKEDIN_CLIENT_SECRET", None)

    def is_configured(self) -> bool:
        """Check if LinkedIn API credentials are configured."""
        return bool(self.client_id and self.client_secret)

    async def search_jobs(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        job_type: Optional[str] = None,
        experience_level: Optional[str] = None,
        posted_within_days: int = 30,
        limit: int = 20,
        access_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for jobs on LinkedIn

        Args:
            keywords: Job search keywords
            location: Location filter
            job_type: Employment type (full-time, part-time, etc.)
            experience_level: Experience level required
            posted_within_days: Filter jobs posted within X days
            limit: Maximum number of results
            access_token: User's OAuth access token

        Returns:
            List of job listings
        """
        if not self.is_configured():
            logger.warning("LinkedIn API not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.")
            return []

        if not access_token:
            logger.warning("LinkedIn access token required for job search.")
            return []

        try:
            params = {
                "keywords": keywords or "",
                "location": location or "",
                "count": limit,
            }

            if job_type:
                params["jobType"] = job_type
            if experience_level:
                params["experienceLevel"] = experience_level

            logger.info(f"Searching LinkedIn jobs with params: {params}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/jobSearch",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("elements", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"LinkedIn API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching LinkedIn jobs: {str(e)}")
            return []

    async def get_job_details(self, job_id: str, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific job

        Args:
            job_id: LinkedIn job ID
            access_token: User's OAuth access token

        Returns:
            Job details
        """
        if not self.is_configured():
            logger.warning("LinkedIn API not configured.")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/jobs/{job_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"LinkedIn API HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching LinkedIn job details: {str(e)}")
            return None

    async def get_recommended_jobs(
        self,
        user_skills: List[str],
        user_experience: int,
        access_token: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get job recommendations based on user profile

        Args:
            user_skills: List of user skills
            user_experience: Years of experience
            access_token: User's OAuth access token
            limit: Maximum number of results

        Returns:
            List of recommended jobs with match scores
        """
        keywords = " OR ".join(user_skills[:3]) if user_skills else None
        experience_level = self._map_experience_to_level(user_experience)

        jobs = await self.search_jobs(
            keywords=keywords,
            experience_level=experience_level,
            limit=limit,
            access_token=access_token,
        )

        # Calculate match scores
        for job in jobs:
            job["match_score"] = self._calculate_match_score(
                job, user_skills, user_experience
            )

        # Sort by match score
        jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        return jobs

    def _map_experience_to_level(self, years: int) -> str:
        """Map years of experience to experience level"""
        if years < 2:
            return "entry-level"
        elif years < 5:
            return "mid-level"
        else:
            return "senior-level"

    def _calculate_match_score(
        self, job: Dict[str, Any], user_skills: List[str], user_experience: int
    ) -> float:
        """Calculate how well a job matches user profile (0-100)"""
        score = 0.0

        # Skill matching (60% weight)
        job_skills = job.get("skills", [])
        if job_skills and user_skills:
            matching_skills = set(
                [s.lower() for s in job_skills]
            ) & set([s.lower() for s in user_skills])
            skill_match_rate = len(matching_skills) / len(job_skills)
            score += skill_match_rate * 60

        # Experience level matching (40% weight)
        job_experience_level = job.get("experience_level", "")
        user_level = self._map_experience_to_level(user_experience)
        if job_experience_level == user_level:
            score += 40
        elif job_experience_level and user_level:
            levels = ["entry-level", "mid-level", "senior-level"]
            if job_experience_level in levels and user_level in levels:
                if abs(levels.index(job_experience_level) - levels.index(user_level)) == 1:
                    score += 20

        return min(score, 100.0)
