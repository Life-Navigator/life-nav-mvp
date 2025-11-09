"""
LinkedIn Jobs API integration service
"""

import asyncio
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class LinkedInJobsService:
    """Service for integrating with LinkedIn Jobs API"""

    BASE_URL = "https://api.linkedin.com/v2"

    def __init__(self):
        self.api_key = getattr(settings, "LINKEDIN_API_KEY", None)
        self.client_id = getattr(settings, "LINKEDIN_CLIENT_ID", None)
        self.client_secret = getattr(settings, "LINKEDIN_CLIENT_SECRET", None)

    async def search_jobs(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        job_type: Optional[str] = None,
        experience_level: Optional[str] = None,
        posted_within_days: int = 30,
        limit: int = 20,
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

        Returns:
            List of job listings
        """
        try:
            # Note: This is a placeholder implementation
            # In production, use official LinkedIn Jobs API or RapidAPI

            params = {
                "keywords": keywords or "",
                "location": location or "",
                "datePosted": f"past{posted_within_days}Days",
                "limit": limit,
            }

            if job_type:
                params["jobType"] = job_type
            if experience_level:
                params["experienceLevel"] = experience_level

            # Simulate API call with mock data for now
            logger.info(f"Searching LinkedIn jobs with params: {params}")

            # In production, replace with actual API call:
            # async with httpx.AsyncClient() as client:
            #     headers = {"Authorization": f"Bearer {self.api_key}"}
            #     response = await client.get(f"{self.BASE_URL}/jobs", params=params, headers=headers)
            #     response.raise_for_status()
            #     return response.json().get("elements", [])

            return self._get_mock_jobs(keywords, location, limit)

        except Exception as e:
            logger.error(f"Error searching LinkedIn jobs: {str(e)}")
            return []

    async def get_job_details(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific job

        Args:
            job_id: LinkedIn job ID

        Returns:
            Job details
        """
        try:
            logger.info(f"Fetching LinkedIn job details for: {job_id}")

            # In production, replace with actual API call:
            # async with httpx.AsyncClient() as client:
            #     headers = {"Authorization": f"Bearer {self.api_key}"}
            #     response = await client.get(f"{self.BASE_URL}/jobs/{job_id}", headers=headers)
            #     response.raise_for_status()
            #     return response.json()

            return None

        except Exception as e:
            logger.error(f"Error fetching LinkedIn job details: {str(e)}")
            return None

    def _get_mock_jobs(
        self, keywords: Optional[str], location: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """
        Generate mock job data for development/testing

        Args:
            keywords: Search keywords
            location: Location filter
            limit: Number of jobs to return

        Returns:
            List of mock job listings
        """
        mock_jobs = [
            {
                "id": f"linkedin_job_{i}",
                "title": f"Software Engineer - {keywords or 'Technology'}" if i % 3 == 0 else f"Senior Developer",
                "company": ["Google", "Microsoft", "Amazon", "Meta", "Apple"][i % 5],
                "location": location or "San Francisco, CA",
                "location_type": ["remote", "hybrid", "onsite"][i % 3],
                "employment_type": ["full-time", "part-time", "contract"][i % 3],
                "description": f"Exciting opportunity for a {keywords or 'tech'} professional...",
                "requirements": [
                    "Bachelor's degree in Computer Science or related field",
                    "3+ years of experience",
                    "Strong problem-solving skills",
                ],
                "skills": ["Python", "JavaScript", "React", "Node.js", "AWS"],
                "salary_min": 120000 + (i * 10000),
                "salary_max": 180000 + (i * 10000),
                "salary_currency": "USD",
                "salary_period": "yearly",
                "posted_date": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "external_url": f"https://www.linkedin.com/jobs/view/{i}",
                "applicants": 50 + (i * 10),
                "experience_level": ["entry-level", "mid-level", "senior-level"][i % 3],
            }
            for i in range(min(limit, 10))
        ]
        return mock_jobs

    async def get_recommended_jobs(
        self, user_skills: List[str], user_experience: int, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get job recommendations based on user profile

        Args:
            user_skills: List of user skills
            user_experience: Years of experience
            limit: Maximum number of results

        Returns:
            List of recommended jobs
        """
        try:
            # Build search based on user profile
            keywords = " OR ".join(user_skills[:3]) if user_skills else None

            jobs = await self.search_jobs(
                keywords=keywords,
                experience_level=self._map_experience_to_level(user_experience),
                limit=limit,
            )

            # Calculate match scores
            for job in jobs:
                job["match_score"] = self._calculate_match_score(
                    job, user_skills, user_experience
                )

            # Sort by match score
            jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)

            return jobs

        except Exception as e:
            logger.error(f"Error getting recommended jobs: {str(e)}")
            return []

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
        """
        Calculate how well a job matches user profile

        Args:
            job: Job data
            user_skills: User's skills
            user_experience: User's years of experience

        Returns:
            Match score (0-100)
        """
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
        elif abs(
            ["entry-level", "mid-level", "senior-level"].index(job_experience_level)
            - ["entry-level", "mid-level", "senior-level"].index(user_level)
        ) == 1:
            score += 20

        return min(score, 100.0)
