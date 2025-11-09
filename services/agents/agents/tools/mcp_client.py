"""MCP Client for Agent System.

Production-ready client for requesting data from Life Navigator app layer
via Model Context Protocol (MCP).

Key Features:
- HTTP/JSON communication with MCP server
- Automatic request ID generation for tracing
- Structured error handling
- Convenience methods for common multi-tool requests
- Connection pooling and timeouts
- Exponential backoff on rate limits

Example:
    >>> from agents.tools.mcp_client import mcp_client
    >>> accounts = await mcp_client.call_tool(
    ...     tool_name="get_user_accounts",
    ...     user_id=UUID("..."),
    ...     session_id="sess_abc123"
    ... )
"""

import asyncio
import os
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict
from uuid import UUID

import httpx

from agents.tools.mcp_error import (
    MCPError,
    MCPNetworkError,
    MCPRateLimitError,
    MCPTimeoutError,
    create_mcp_error,
)


class MCPClient:
    """
    Client for agents to request data from Life Navigator app via MCP.

    This client never handles OAuth tokens or makes direct API calls to external
    services. All data access goes through the app layer's MCP server, which
    enforces Row-Level Security (RLS) and sanitizes responses.

    Attributes:
        base_url: MCP server base URL.
        timeout: Request timeout in seconds.
        max_retries: Maximum retry attempts for rate limits.
        client: Async HTTP client with connection pooling.
    """

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        """Initialize MCP client.

        Args:
            base_url: MCP server URL (defaults to MCP_SERVER_URL env var).
            timeout: Request timeout in seconds.
            max_retries: Max retries for rate limit errors.
        """
        self.base_url = base_url or os.getenv("MCP_SERVER_URL", "http://app:8000")
        self.timeout = timeout
        self.max_retries = max_retries

        # Create async HTTP client with connection pooling
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100,
            ),
            headers={
                "User-Agent": "LifeNavigator-AgentSystem/1.0",
                "Accept": "application/json",
            },
        )

    async def close(self):
        """Close HTTP client and release connections."""
        await self.client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

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
        Call a tool on the MCP server.

        This is the core method that all other methods build upon.

        Args:
            tool_name: Name of the MCP tool to call (e.g., "get_user_accounts").
            user_id: User ID for RLS enforcement.
            session_id: Session ID for request tracking.
            **arguments: Tool-specific arguments as keyword arguments.

        Returns:
            Tool result data (structure varies by tool).

        Raises:
            MCPError: If tool execution fails.
            MCPTimeoutError: If request times out.
            MCPUnauthorizedError: If user not authorized.
            MCPRateLimitError: If rate limit exceeded.
            MCPNetworkError: If network communication fails.

        Example:
            >>> accounts = await client.call_tool(
            ...     tool_name="get_user_accounts",
            ...     user_id=UUID("..."),
            ...     session_id="sess_123",
            ...     include_closed=False
            ... )
        """
        request_id = self._generate_request_id()

        # Build MCP request payload
        payload = {
            "tool_name": tool_name,
            "user_id": str(user_id),
            "session_id": session_id,
            "arguments": arguments,
            "request_id": request_id,
        }

        # Attempt request with exponential backoff on rate limits
        for attempt in range(self.max_retries):
            try:
                response = await self.client.post("/mcp/execute", json=payload)
                response.raise_for_status()

                result = response.json()

                # Check MCP response success
                if not result.get("success"):
                    error_code = result.get("error", "UNKNOWN_ERROR")
                    error_message = result.get("error_message", "Unknown error")

                    # Create appropriate exception
                    raise create_mcp_error(
                        error_code=error_code,
                        message=error_message,
                        tool_name=tool_name,
                        request_id=request_id,
                        user_id=str(user_id),
                        **result.get("metadata", {}),
                    )

                # Return data from successful response
                return result.get("data")

            except httpx.TimeoutException:
                raise MCPTimeoutError(tool_name, request_id, self.timeout)

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limit
                    retry_after = int(e.response.headers.get("Retry-After", 60))

                    if attempt < self.max_retries - 1:
                        # Exponential backoff
                        wait_time = min(retry_after * (2 ** attempt), 300)  # Max 5 min
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise MCPRateLimitError(tool_name, request_id, retry_after)
                else:
                    raise MCPNetworkError(str(e), tool_name, request_id)

            except httpx.RequestError as e:
                raise MCPNetworkError(str(e), tool_name, request_id)

        # Should not reach here
        raise MCPError("Max retries exceeded", tool_name, request_id)

    def _generate_request_id(self) -> str:
        """Generate unique request ID for tracing.

        Format: mcp_{12_char_hex}

        Returns:
            Unique request ID.
        """
        return f"mcp_{uuid.uuid4().hex[:12]}"

    # =========================================================================
    # Convenience Methods for Common Multi-Tool Requests
    # =========================================================================

    async def get_financial_context(
        self,
        user_id: UUID,
        session_id: str,
        days: int = 90,
    ) -> Dict[str, Any]:
        """
        Fetch complete financial context for budget/investment/tax analysis.

        Makes parallel requests to multiple tools for performance.

        Args:
            user_id: User ID.
            session_id: Session ID.
            days: Lookback period in days.

        Returns:
            Dict containing:
            - accounts: List of user's financial accounts
            - transactions: List of recent transactions
            - spending_by_category: Aggregated spending analysis
            - recurring_transactions: Identified recurring bills
            - period_days: Lookback period

        Example:
            >>> context = await client.get_financial_context(
            ...     user_id=UUID("..."),
            ...     session_id="sess_123",
            ...     days=90
            ... )
            >>> print(len(context["transactions"]))
            142
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        # Parallel requests for performance
        accounts, transactions, spending, recurring = await asyncio.gather(
            self.call_tool(
                tool_name="get_user_accounts",
                user_id=user_id,
                session_id=session_id,
            ),
            self.call_tool(
                tool_name="get_user_transactions",
                user_id=user_id,
                session_id=session_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            ),
            self.call_tool(
                tool_name="get_spending_by_category",
                user_id=user_id,
                session_id=session_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            ),
            self.call_tool(
                tool_name="get_recurring_transactions",
                user_id=user_id,
                session_id=session_id,
                lookback_days=days,
            ),
        )

        return {
            "accounts": accounts,
            "transactions": transactions,
            "spending_by_category": spending,
            "recurring_transactions": recurring,
            "period_days": days,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
        }

    async def get_investment_context(
        self,
        user_id: UUID,
        session_id: str,
        include_crypto: bool = True,
    ) -> Dict[str, Any]:
        """
        Fetch investment portfolio data for analysis.

        Args:
            user_id: User ID.
            session_id: Session ID.
            include_crypto: Whether to include cryptocurrency holdings.

        Returns:
            Dict containing:
            - portfolio: Traditional investment holdings
            - crypto_holdings: Cryptocurrency balances (if requested)
        """
        tasks = [
            self.call_tool(
                tool_name="get_investment_portfolio",
                user_id=user_id,
                session_id=session_id,
                include_historical=True,
            ),
        ]

        if include_crypto:
            tasks.append(
                self.call_tool(
                    tool_name="get_crypto_holdings",
                    user_id=user_id,
                    session_id=session_id,
                )
            )

        results = await asyncio.gather(*tasks)

        context = {"portfolio": results[0]}
        if include_crypto:
            context["crypto_holdings"] = results[1]

        return context

    async def get_career_context(
        self,
        user_id: UUID,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Fetch career-related data for job search and resume optimization.

        Args:
            user_id: User ID.
            session_id: Session ID.

        Returns:
            Dict containing:
            - resume: User's resume data
            - job_applications: Application tracking history
        """
        resume, job_applications = await asyncio.gather(
            self.call_tool(
                tool_name="get_user_resume",
                user_id=user_id,
                session_id=session_id,
            ),
            self.call_tool(
                tool_name="get_job_search_history",
                user_id=user_id,
                session_id=session_id,
            ),
        )

        return {
            "resume": resume,
            "job_applications": job_applications,
        }

    async def get_tax_context(
        self,
        user_id: UUID,
        session_id: str,
        tax_year: int | None = None,
    ) -> Dict[str, Any]:
        """
        Fetch data needed for tax planning and estimation.

        Args:
            user_id: User ID.
            session_id: Session ID.
            tax_year: Tax year (defaults to current year).

        Returns:
            Dict containing:
            - paystubs: YTD income data
            - investment_income: Capital gains, dividends
            - crypto_transactions: Crypto trades (if applicable)
        """
        if tax_year is None:
            tax_year = datetime.now().year

        start_date = date(tax_year, 1, 1)
        end_date = date(tax_year, 12, 31)

        paystubs, investment_portfolio = await asyncio.gather(
            self.call_tool(
                tool_name="get_paystubs",
                user_id=user_id,
                session_id=session_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            ),
            self.call_tool(
                tool_name="get_investment_portfolio",
                user_id=user_id,
                session_id=session_id,
                include_historical=True,
            ),
        )

        return {
            "paystubs": paystubs,
            "investment_portfolio": investment_portfolio,
            "tax_year": tax_year,
        }

    async def get_education_context(
        self,
        user_id: UUID,
        session_id: str,
        days_ahead: int = 14,
    ) -> Dict[str, Any]:
        """
        Fetch education data from LMS.

        Args:
            user_id: User ID.
            session_id: Session ID.
            days_ahead: How many days ahead to look for assignments.

        Returns:
            Dict containing:
            - courses: Active courses
            - upcoming_assignments: Assignments due soon
        """
        courses, assignments = await asyncio.gather(
            self.call_tool(
                tool_name="get_courses",
                user_id=user_id,
                session_id=session_id,
                active_only=True,
            ),
            self.call_tool(
                tool_name="get_assignments",
                user_id=user_id,
                session_id=session_id,
                days_ahead=days_ahead,
            ),
        )

        return {
            "courses": courses,
            "upcoming_assignments": assignments,
        }

    async def get_health_context(
        self,
        user_id: UUID,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Fetch health summary (HIPAA-compliant, no direct PHI).

        Args:
            user_id: User ID.
            session_id: Session ID.

        Returns:
            Dict containing:
            - health_summary: High-level health status
            - insurance_coverage: Active insurance policies
        """
        summary, coverage = await asyncio.gather(
            self.call_tool(
                tool_name="get_health_summary",
                user_id=user_id,
                session_id=session_id,
            ),
            self.call_tool(
                tool_name="get_insurance_coverage",
                user_id=user_id,
                session_id=session_id,
            ),
        )

        return {
            "health_summary": summary,
            "insurance_coverage": coverage,
        }

    # =========================================================================
    # Introspection Methods
    # =========================================================================

    async def list_tools(self) -> Dict[str, Dict[str, Any]]:
        """
        Get list of available tools from MCP server.

        Returns:
            Dict mapping tool names to their metadata.

        Example:
            >>> tools = await client.list_tools()
            >>> print(tools.keys())
            dict_keys(['get_user_accounts', 'get_user_transactions', ...])
        """
        try:
            response = await self.client.get("/mcp/tools")
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            raise MCPNetworkError(str(e), "list_tools", "mcp_list_tools")

    async def health_check(self) -> bool:
        """
        Check if MCP server is reachable and healthy.

        Returns:
            True if server is healthy, False otherwise.
        """
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except Exception as e:
            # Log health check failure for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.debug(f"MCP health check failed: {e}")
            return False


# ============================================================================
# Global Singleton Instance
# ============================================================================

# Configured via MCP_SERVER_URL environment variable
mcp_client = MCPClient()

# For graceful shutdown
async def shutdown_mcp_client():
    """Close global MCP client on application shutdown."""
    await mcp_client.close()
