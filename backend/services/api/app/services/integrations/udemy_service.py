"""Udemy API integration service."""

from typing import List, Dict, Optional
from .base_platform import BasePlatformIntegration


class UdemyService(BasePlatformIntegration):
    """Integration with Udemy API."""

    def get_base_url(self) -> str:
        """Get Udemy API base URL."""
        return "https://www.udemy.com/api-2.0"

    async def get_enrolled_courses(self, user_id: str) -> List[Dict]:
        """Fetch enrolled courses from Udemy."""
        # TODO: Implement actual API call
        return []

    async def get_course_progress(self, course_id: str) -> Dict:
        """Fetch course progress from Udemy."""
        # TODO: Implement actual API call
        return {}

    async def get_certificates(self, user_id: str) -> List[Dict]:
        """Fetch certificates from Udemy."""
        # TODO: Implement actual API call
        return []

    async def search_courses(
        self, query: str, filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Search courses on Udemy."""
        # TODO: Implement actual API call
        return []

    async def get_course_details(self, course_id: str) -> Dict:
        """Get course details from Udemy."""
        # TODO: Implement actual API call
        return {}
