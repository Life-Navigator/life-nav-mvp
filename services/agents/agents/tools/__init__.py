"""Tools module for agent system.

This module provides tools that agents can use to interact with external systems,
primarily through the MCP (Model Context Protocol) server.
"""

from agents.tools.mcp_client import MCPClient, mcp_client
from agents.tools.mcp_error import (
    MCPError,
    MCPTimeoutError,
    MCPUnauthorizedError,
    MCPToolNotFoundError,
    MCPInvalidArgumentsError,
    MCPExternalAPIError,
    MCPRateLimitError,
    MCPNetworkError,
)

__all__ = [
    # MCP Client
    "MCPClient",
    "mcp_client",
    # Exceptions
    "MCPError",
    "MCPTimeoutError",
    "MCPUnauthorizedError",
    "MCPToolNotFoundError",
    "MCPInvalidArgumentsError",
    "MCPExternalAPIError",
    "MCPRateLimitError",
    "MCPNetworkError",
]
