"""Base class for learning platform integrations."""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime


class BasePlatformIntegration(ABC):
    """Base class for all learning platform integrations."""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        """Initialize the platform integration.

        Args:
            api_key: API key for the platform
            api_secret: API secret for the platform
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = self.get_base_url()

    @abstractmethod
    def get_base_url(self) -> str:
        """Get the base URL for the platform API."""
        pass

    @abstractmethod
    async def get_enrolled_courses(self, user_id: str) -> List[Dict]:
        """Fetch enrolled courses for a user.

        Args:
            user_id: Platform-specific user ID

        Returns:
            List of course dictionaries
        """
        pass

    @abstractmethod
    async def get_course_progress(self, course_id: str) -> Dict:
        """Fetch progress for a specific course.

        Args:
            course_id: Platform-specific course ID

        Returns:
            Dictionary containing progress information
        """
        pass

    @abstractmethod
    async def get_certificates(self, user_id: str) -> List[Dict]:
        """Fetch certificates earned by a user.

        Args:
            user_id: Platform-specific user ID

        Returns:
            List of certificate dictionaries
        """
        pass

    @abstractmethod
    async def search_courses(
        self, query: str, filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Search for courses on the platform.

        Args:
            query: Search query string
            filters: Optional filters (difficulty, subject, etc.)

        Returns:
            List of course dictionaries
        """
        pass

    @abstractmethod
    async def get_course_details(self, course_id: str) -> Dict:
        """Get detailed information about a course.

        Args:
            course_id: Platform-specific course ID

        Returns:
            Dictionary containing course details
        """
        pass

    def normalize_course_data(self, raw_data: Dict) -> Dict:
        """Normalize platform-specific course data to standard format.

        Args:
            raw_data: Platform-specific course data

        Returns:
            Normalized course data
        """
        return {
            "title": raw_data.get("title", ""),
            "description": raw_data.get("description", ""),
            "instructor": raw_data.get("instructor", ""),
            "thumbnail": raw_data.get("thumbnail", ""),
            "estimated_hours": raw_data.get("duration", 0),
            "skills": raw_data.get("skills", []),
            "difficulty": raw_data.get("difficulty", "beginner"),
        }

    def normalize_progress_data(self, raw_data: Dict) -> Dict:
        """Normalize platform-specific progress data to standard format.

        Args:
            raw_data: Platform-specific progress data

        Returns:
            Normalized progress data
        """
        return {
            "progress_percentage": raw_data.get("progress", 0),
            "lessons_completed": raw_data.get("completed_lessons", 0),
            "total_lessons": raw_data.get("total_lessons", 0),
            "last_accessed": raw_data.get("last_accessed"),
        }
