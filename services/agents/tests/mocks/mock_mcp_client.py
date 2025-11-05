"""Mock MCP Client for Testing.

Provides a mock implementation of MCPClient that loads fixture data
from JSON files instead of making real HTTP requests.

This allows testing agents with realistic data without requiring
a running MCP server.

Example:
    >>> from tests.mocks.mock_mcp_client import MockMCPClient
    >>> mock_mcp = MockMCPClient()
    >>> context = await mock_mcp.get_financial_context(
    ...     user_id=UUID("..."),
    ...     session_id="test_session"
    ... )
    >>> assert len(context["transactions"]) > 0
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID


class MockMCPClient:
    """
    Mock MCP client for testing.

    Loads fixture data from tests/fixtures/mcp_responses/ instead of
    making real HTTP requests. Tracks method calls for test assertions.

    Attributes:
        fixtures_dir: Directory containing JSON fixture files.
        call_log: List of method calls for assertion.
        call_counts: Dict tracking how many times each method was called.
    """

    def __init__(self, fixtures_dir: Optional[Path] = None):
        """Initialize mock MCP client.

        Args:
            fixtures_dir: Path to fixtures directory. Defaults to
                         tests/fixtures/mcp_responses/
        """
        if fixtures_dir is None:
            # Default to project fixtures directory
            self.fixtures_dir = (
                Path(__file__).parent.parent / "fixtures" / "mcp_responses"
            )
        else:
            self.fixtures_dir = fixtures_dir

        # Track method calls for assertions
        self.call_log: List[Dict[str, Any]] = []
        self.call_counts: Dict[str, int] = {}

    def _load_fixture(self, fixture_name: str) -> Dict[str, Any]:
        """Load a fixture file and return its contents.

        Args:
            fixture_name: Name of fixture file (without .json extension)

        Returns:
            Dict containing fixture data

        Raises:
            FileNotFoundError: If fixture file doesn't exist
        """
        fixture_path = self.fixtures_dir / f"{fixture_name}.json"

        if not fixture_path.exists():
            raise FileNotFoundError(
                f"Fixture not found: {fixture_path}. "
                f"Available fixtures: {list(self.fixtures_dir.glob('*.json'))}"
            )

        with open(fixture_path, "r") as f:
            data = json.load(f)

        # Return the nested context if it exists, otherwise return data
        return data.get("context", data)

    def _track_call(self, method_name: str, **kwargs):
        """Track a method call for test assertions.

        Args:
            method_name: Name of method that was called
            **kwargs: Arguments passed to method
        """
        self.call_log.append({"method": method_name, "args": kwargs})
        self.call_counts[method_name] = self.call_counts.get(method_name, 0) + 1

    def reset_call_tracking(self):
        """Reset call tracking (useful between tests)."""
        self.call_log.clear()
        self.call_counts.clear()

    # =========================================================================
    # Core MCP Methods
    # =========================================================================

    async def call_tool(
        self,
        tool_name: str,
        user_id: UUID,
        session_id: str,
        **arguments
    ) -> Any:
        """
        Mock implementation of call_tool.

        Loads corresponding fixture file based on tool_name.

        Args:
            tool_name: Name of MCP tool (e.g., "get_user_accounts")
            user_id: User ID (tracked but not used)
            session_id: Session ID (tracked but not used)
            **arguments: Tool arguments (tracked but not used)

        Returns:
            Fixture data for the requested tool
        """
        self._track_call(
            "call_tool",
            tool_name=tool_name,
            user_id=str(user_id),
            session_id=session_id,
            **arguments
        )

        # Map tool names to fixture files
        tool_fixture_map = {
            "get_user_accounts": "financial_accounts",
            "get_user_transactions": "financial_transactions",
            "get_spending_by_category": "spending_by_category",
            "get_recurring_transactions": "recurring_transactions",
            "get_investment_portfolio": "investment_portfolio",
            "get_crypto_holdings": "crypto_holdings",
            "get_paystubs": "paystubs",
            "get_user_resume": "career_resume",
            "get_job_search_history": "job_search_history",
        }

        fixture_name = tool_fixture_map.get(tool_name, tool_name)

        try:
            fixture_data = self._load_fixture(fixture_name)
            # Return the response data if it's wrapped
            if isinstance(fixture_data, dict) and "response" in fixture_data:
                return fixture_data["response"].get("data", fixture_data["response"])
            return fixture_data
        except FileNotFoundError:
            # Return empty data for unknown tools
            return []

    async def close(self):
        """Mock close method (no-op)."""
        self._track_call("close")

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    # =========================================================================
    # Convenience Methods
    # =========================================================================

    async def get_financial_context(
        self,
        user_id: UUID,
        session_id: str,
        days: int = 90,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_financial_context.

        Loads complete_financial_context.json fixture.

        Args:
            user_id: User ID
            session_id: Session ID
            days: Lookback period (tracked but not used)

        Returns:
            Dict containing complete financial context
        """
        self._track_call(
            "get_financial_context",
            user_id=str(user_id),
            session_id=session_id,
            days=days
        )

        return self._load_fixture("complete_financial_context")

    async def get_investment_context(
        self,
        user_id: UUID,
        session_id: str,
        include_crypto: bool = True,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_investment_context.

        Args:
            user_id: User ID
            session_id: Session ID
            include_crypto: Whether to include crypto holdings

        Returns:
            Dict containing portfolio and crypto_holdings
        """
        self._track_call(
            "get_investment_context",
            user_id=str(user_id),
            session_id=session_id,
            include_crypto=include_crypto
        )

        portfolio = self._load_fixture("investment_portfolio")
        result = {"portfolio": portfolio}

        if include_crypto:
            crypto = self._load_fixture("crypto_holdings")
            result["crypto_holdings"] = crypto

        return result

    async def get_career_context(
        self,
        user_id: UUID,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_career_context.

        Args:
            user_id: User ID
            session_id: Session ID

        Returns:
            Dict containing resume and job_applications
        """
        self._track_call(
            "get_career_context",
            user_id=str(user_id),
            session_id=session_id
        )

        resume = self._load_fixture("career_resume")
        job_history = self._load_fixture("job_search_history")

        return {
            "resume": resume,
            "job_applications": job_history,
        }

    async def get_tax_context(
        self,
        user_id: UUID,
        session_id: str,
        tax_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_tax_context.

        Args:
            user_id: User ID
            session_id: Session ID
            tax_year: Tax year (defaults to current year)

        Returns:
            Dict containing paystubs and investment_portfolio
        """
        from datetime import datetime

        if tax_year is None:
            tax_year = datetime.now().year

        self._track_call(
            "get_tax_context",
            user_id=str(user_id),
            session_id=session_id,
            tax_year=tax_year
        )

        paystubs = self._load_fixture("paystubs")
        portfolio = self._load_fixture("investment_portfolio")

        return {
            "paystubs": paystubs,
            "investment_portfolio": portfolio,
            "tax_year": tax_year,
        }

    async def get_education_context(
        self,
        user_id: UUID,
        session_id: str,
        days_ahead: int = 14,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_education_context.

        Args:
            user_id: User ID
            session_id: Session ID
            days_ahead: How many days ahead to look

        Returns:
            Dict containing courses and upcoming_assignments
        """
        self._track_call(
            "get_education_context",
            user_id=str(user_id),
            session_id=session_id,
            days_ahead=days_ahead
        )

        # Education fixtures may not exist yet
        return {
            "courses": [],
            "upcoming_assignments": [],
        }

    async def get_health_context(
        self,
        user_id: UUID,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Mock implementation of get_health_context.

        Args:
            user_id: User ID
            session_id: Session ID

        Returns:
            Dict containing health_summary and insurance_coverage
        """
        self._track_call(
            "get_health_context",
            user_id=str(user_id),
            session_id=session_id
        )

        # Health fixtures may not exist yet
        return {
            "health_summary": {},
            "insurance_coverage": [],
        }

    # =========================================================================
    # Introspection Methods
    # =========================================================================

    async def list_tools(self) -> Dict[str, Dict[str, Any]]:
        """
        Mock implementation of list_tools.

        Returns:
            Dict of available tools (simplified)
        """
        self._track_call("list_tools")

        return {
            "get_user_accounts": {
                "description": "Get user's financial accounts",
                "category": "financial"
            },
            "get_user_transactions": {
                "description": "Get user's transactions",
                "category": "financial"
            },
            "get_investment_portfolio": {
                "description": "Get investment portfolio",
                "category": "financial"
            },
            "get_user_resume": {
                "description": "Get user's resume",
                "category": "career"
            },
        }

    async def health_check(self) -> bool:
        """
        Mock implementation of health_check.

        Returns:
            Always returns True
        """
        self._track_call("health_check")
        return True
