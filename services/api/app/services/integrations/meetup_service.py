"""
Meetup API integration service
"""

from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class MeetupService:
    """Service for integrating with Meetup API"""

    BASE_URL = "https://api.meetup.com"

    def __init__(self):
        self.api_key = getattr(settings, "MEETUP_API_KEY", None)

    def is_configured(self) -> bool:
        """Check if Meetup API credentials are configured."""
        return bool(self.api_key)

    async def search_events(
        self,
        keywords: Optional[str] = None,
        location: Optional[str] = None,
        category: Optional[str] = None,
        radius: int = 25,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for events on Meetup

        Args:
            keywords: Search keywords
            location: Location/city
            category: Event category
            radius: Search radius in miles
            limit: Maximum number of results

        Returns:
            List of event listings
        """
        if not self.is_configured():
            logger.warning("Meetup API not configured. Set MEETUP_API_KEY.")
            return []

        try:
            params = {
                "text": keywords or "",
                "page": limit,
                "radius": radius,
            }

            if location:
                params["location"] = location
            if category:
                params["category"] = category

            logger.info(f"Searching Meetup events: {keywords}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/find/upcoming_events",
                    params=params,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("events", [])

        except httpx.HTTPStatusError as e:
            logger.error(f"Meetup API HTTP error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            logger.error(f"Error searching Meetup events: {str(e)}")
            return []

    async def get_event_details(self, event_id: str, group_urlname: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific event

        Args:
            event_id: Meetup event ID
            group_urlname: URL name of the group hosting the event

        Returns:
            Event details
        """
        if not self.is_configured():
            logger.warning("Meetup API not configured.")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/{group_urlname}/events/{event_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Meetup API HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Meetup event details: {str(e)}")
            return None
