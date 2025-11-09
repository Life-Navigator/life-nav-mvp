"""
Freelancer.com API integration service
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class FreelancerService:
    """Service for integrating with Freelancer.com API"""

    BASE_URL = "https://www.freelancer.com/api"

    def __init__(self):
        self.api_key = getattr(settings, "FREELANCER_API_KEY", None)

    async def search_gigs(
        self,
        keywords: Optional[str] = None,
        budget_min: Optional[float] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for projects on Freelancer.com"""
        try:
            logger.info(f"Searching Freelancer gigs: {keywords}")
            return self._get_mock_gigs(keywords, limit)
        except Exception as e:
            logger.error(f"Error searching Freelancer gigs: {str(e)}")
            return []

    def _get_mock_gigs(self, keywords: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Generate mock Freelancer gig data"""
        return [
            {
                "id": f"freelancer_gig_{i}",
                "title": f"{keywords or 'Software'} Development Project",
                "description": f"Need {keywords or 'developer'} for project",
                "budget_type": "fixed",
                "budget_amount": 3000 + (i * 500),
                "currency": "USD",
                "client_rating": 4.2 + (i * 0.15) % 0.8,
                "skills_required": ["PHP", "MySQL", "WordPress", "Laravel"][:i % 4 + 1],
                "posted_date": (datetime.utcnow() - timedelta(days=i * 2)).isoformat(),
                "external_url": f"https://www.freelancer.com/projects/{i}",
                "proposals_count": 15 + i * 3,
            }
            for i in range(min(limit, 10))
        ]
