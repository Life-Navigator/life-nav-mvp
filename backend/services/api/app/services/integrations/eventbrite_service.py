"""
Eventbrite API integration service
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class EventbriteService:
    """Service for integrating with Eventbrite API"""

    BASE_URL = "https://www.eventbriteapi.com/v3"

    def __init__(self):
        self.api_key = getattr(settings, "EVENTBRITE_API_KEY", None)

    def is_configured(self) -> bool:
        """Check if Eventbrite API credentials are configured."""
        return bool(self.api_key)

    async def search_events(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        is_free: Optional[bool] = None,
        start_date_from: Optional[datetime] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for events on Eventbrite

        Args:
            keywords: Search keywords
            location: Location/city
            category: Event category
            is_free: Filter for free events
            start_date_from: Filter events starting from this date
            limit: Maximum number of results

        Returns:
            List of event listings
        """
        if not self.is_configured():
            logger.warning("Eventbrite API not configured. Set EVENTBRITE_API_KEY.")
            return []

        try:
            params = {
                "q": keywords or "",
                "page_size": limit,
            }

            if location:
                params["location.address"] = location
            if category:
                params["categories"] = category
            if is_free is not None:
                params["price"] = "free" if is_free else "paid"
            if start_date_from:
                params["start_date.range_start"] = start_date_from.isoformat()

            logger.info(f"Searching Eventbrite events: {keywords}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/events/search",
                    params=params,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("events", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Eventbrite API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Eventbrite events: {str(e)}")
            return []

    async def get_event_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific event

        Args:
            event_id: Eventbrite event ID

        Returns:
            Event details
        """
        if not self.is_configured():
            logger.warning("Eventbrite API not configured.")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/events/{event_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Eventbrite API HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Eventbrite event details: {str(e)}")
            return None
