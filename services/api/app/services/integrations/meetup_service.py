"""
Meetup API integration service
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class MeetupService:
    """Service for integrating with Meetup API"""

    BASE_URL = "https://api.meetup.com"

    def __init__(self):
        self.api_key = getattr(settings, "MEETUP_API_KEY", None)

    async def search_events(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for meetup events"""
        try:
            logger.info(f"Searching Meetup events: {keywords}")
            return self._get_mock_events(keywords, location, limit)
        except Exception as e:
            logger.error(f"Error searching Meetup events: {str(e)}")
            return []

    def _get_mock_events(
        self, keywords: Optional[str], location: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Generate mock Meetup event data"""
        return [
            {
                "id": f"meetup_{i}",
                "title": f"{keywords or 'Tech'} Meetup {i}",
                "description": f"Monthly {keywords or 'tech'} meetup",
                "category": "meetup",
                "organizer_name": f"Meetup Group {i}",
                "start_date": (datetime.utcnow() + timedelta(days=i * 5)).isoformat(),
                "is_virtual": i % 4 == 0,
                "venue_name": "Coffee Shop" if i % 4 != 0 else None,
                "city": location or "Austin",
                "state": "TX",
                "online_url": f"https://meet.google.com/{i}" if i % 4 == 0 else None,
                "is_free": True,
                "attendees_count": 20 + (i * 5),
                "external_url": f"https://www.meetup.com/events/{i}",
                "topics": ["technology", "networking", "startups"],
            }
            for i in range(min(limit, 10))
        ]
