"""
Upwork API integration service
"""

import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class UpworkService:
    """Service for integrating with Upwork API"""

    BASE_URL = "https://www.upwork.com/api/v3"

    def __init__(self):
        self.api_key = getattr(settings, "UPWORK_API_KEY", None)
        self.api_secret = getattr(settings, "UPWORK_API_SECRET", None)

    async def search_gigs(
        self,
        keywords: Optional[str] = None,
        category: Optional[str] = None,
        budget_min: Optional[float] = None,
        budget_max: Optional[float] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for gigs on Upwork"""
        try:
            logger.info(f"Searching Upwork gigs: {keywords}")
            return self._get_mock_gigs(keywords, category, limit)
        except Exception as e:
            logger.error(f"Error searching Upwork gigs: {str(e)}")
            return []

    def _get_mock_gigs(
        self, keywords: Optional[str], category: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Generate mock Upwork gig data"""
        return [
            {
                "id": f"upwork_gig_{i}",
                "title": f"{keywords or 'Development'} Project {i}",
                "description": f"Looking for expert in {keywords or 'software development'}",
                "budget_type": ["fixed", "hourly"][i % 2],
                "budget_amount": 5000 + (i * 500) if i % 2 == 0 else None,
                "budget_min": 50 + (i * 10) if i % 2 == 1 else None,
                "budget_max": 100 + (i * 10) if i % 2 == 1 else None,
                "currency": "USD",
                "client_rating": 4.5 + (i * 0.1) % 0.5,
                "client_verified": i % 2 == 0,
                "skills_required": ["Python", "JavaScript", "React", "Node.js"][:i % 4 + 1],
                "posted_date": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "external_url": f"https://www.upwork.com/jobs/{i}",
                "proposals_count": 10 + i * 2,
            }
            for i in range(min(limit, 10))
        ]
