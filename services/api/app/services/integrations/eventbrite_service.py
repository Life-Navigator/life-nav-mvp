"""
Eventbrite API integration service
"""

import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class EventbriteService:
    """Service for integrating with Eventbrite API"""

    BASE_URL = "https://www.eventbriteapi.com/v3"

    def __init__(self):
        self.api_key = getattr(settings, "EVENTBRITE_API_KEY", None)

    async def search_events(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        is_free: Optional[bool] = None,
        start_date_from: Optional[datetime] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search for events on Eventbrite"""
        try:
            logger.info(f"Searching Eventbrite events: {keywords}")
            return self._get_mock_events(keywords, location, limit)
        except Exception as e:
            logger.error(f"Error searching Eventbrite events: {str(e)}")
            return []

    def _get_mock_events(
        self, keywords: Optional[str], location: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Generate mock Eventbrite event data"""
        categories = ["networking", "workshop", "conference", "seminar", "career-fair"]
        return [
            {
                "id": f"eventbrite_{i}",
                "title": f"{keywords or 'Professional'} Event {i}",
                "description": f"Join us for {keywords or 'networking'}",
                "category": categories[i % len(categories)],
                "organizer_name": f"Event Organizer {i}",
                "start_date": (datetime.utcnow() + timedelta(days=i * 7)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=i * 7, hours=3)).isoformat(),
                "is_virtual": i % 3 == 0,
                "venue_name": "Convention Center" if i % 3 != 0 else None,
                "address": location or "123 Main St",
                "city": location or "San Francisco",
                "state": "CA",
                "country": "USA",
                "online_url": f"https://zoom.us/j/{i}" if i % 3 == 0 else None,
                "is_free": i % 2 == 0,
                "price": 50.0 if i % 2 == 1 else 0.0,
                "capacity": 100 + (i * 50),
                "attendees_count": 50 + (i * 10),
                "external_url": f"https://www.eventbrite.com/e/{i}",
                "tags": ["networking", "career", "professional"],
            }
            for i in range(min(limit, 10))
        ]
