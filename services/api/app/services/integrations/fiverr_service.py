"""
Fiverr API integration service
"""

import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class FiverrService:
    """Service for integrating with Fiverr API"""

    BASE_URL = "https://api.fiverr.com/v1"

    def __init__(self):
        self.api_key = getattr(settings, "FIVERR_API_KEY", None)

    async def search_gigs(
        self,
        keywords: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for gigs on Fiverr"""
        try:
            logger.info(f"Searching Fiverr gigs: {keywords}")
            return self._get_mock_gigs(keywords, category, limit)
        except Exception as e:
            logger.error(f"Error searching Fiverr gigs: {str(e)}")
            return []

    def _get_mock_gigs(
        self, keywords: Optional[str], category: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Generate mock Fiverr gig data"""
        return [
            {
                "id": f"fiverr_gig_{i}",
                "title": f"I will {keywords or 'develop'} for you",
                "description": f"Professional {keywords or 'development'} services",
                "budget_type": "fixed",
                "budget_amount": 500 + (i * 100),
                "currency": "USD",
                "client_rating": 4.0 + (i * 0.2) % 1.0,
                "client_verified": True,
                "skills_required": ["Design", "Development", "Writing"][:i % 3 + 1],
                "posted_date": (datetime.utcnow() - timedelta(days=i * 3)).isoformat(),
                "external_url": f"https://www.fiverr.com/gigs/{i}",
            }
            for i in range(min(limit, 10))
        ]
