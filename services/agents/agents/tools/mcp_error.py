"""MCP Error Classes.

Custom exception hierarchy for Model Context Protocol (MCP) client errors.
"""


class MCPError(Exception):
    """Base exception for all MCP-related errors.

    Attributes:
        message: Human-readable error message.
        tool_name: Name of the tool that failed.
        request_id: MCP request ID for tracing.
        error_code: Standardized error code from MCP server.
    """

    def __init__(
        self,
        message: str,
        tool_name: str | None = None,
        request_id: str | None = None,
        error_code: str | None = None,
    ):
        self.message = message
        self.tool_name = tool_name
        self.request_id = request_id
        self.error_code = error_code
        super().__init__(message)

    def __str__(self) -> str:
        parts = [self.message]
        if self.tool_name:
            parts.append(f"tool={self.tool_name}")
        if self.request_id:
            parts.append(f"request_id={self.request_id}")
        if self.error_code:
            parts.append(f"error_code={self.error_code}")
        return " | ".join(parts)


class MCPTimeoutError(MCPError):
    """MCP request timed out."""

    def __init__(self, tool_name: str, request_id: str, timeout_seconds: float):
        super().__init__(
            message=f"MCP request timed out after {timeout_seconds}s",
            tool_name=tool_name,
            request_id=request_id,
            error_code="TIMEOUT",
        )
        self.timeout_seconds = timeout_seconds


class MCPUnauthorizedError(MCPError):
    """User not authorized to access requested data (RLS violation)."""

    def __init__(self, tool_name: str, request_id: str, user_id: str):
        super().__init__(
            message=f"Unauthorized access for user {user_id}",
            tool_name=tool_name,
            request_id=request_id,
            error_code="UNAUTHORIZED",
        )
        self.user_id = user_id


class MCPToolNotFoundError(MCPError):
    """Requested tool does not exist on MCP server."""

    def __init__(self, tool_name: str, request_id: str):
        super().__init__(
            message=f"Tool '{tool_name}' not found on MCP server",
            tool_name=tool_name,
            request_id=request_id,
            error_code="TOOL_NOT_FOUND",
        )


class MCPInvalidArgumentsError(MCPError):
    """Tool arguments failed validation."""

    def __init__(self, tool_name: str, request_id: str, validation_errors: list[str]):
        super().__init__(
            message=f"Invalid arguments: {', '.join(validation_errors)}",
            tool_name=tool_name,
            request_id=request_id,
            error_code="INVALID_ARGUMENTS",
        )
        self.validation_errors = validation_errors


class MCPExternalAPIError(MCPError):
    """External service (Plaid, Coinbase, etc.) returned an error."""

    def __init__(self, tool_name: str, request_id: str, service_name: str, service_error: str):
        super().__init__(
            message=f"{service_name} error: {service_error}",
            tool_name=tool_name,
            request_id=request_id,
            error_code="EXTERNAL_API_ERROR",
        )
        self.service_name = service_name
        self.service_error = service_error


class MCPRateLimitError(MCPError):
    """Rate limit exceeded for this tool."""

    def __init__(self, tool_name: str, request_id: str, retry_after_seconds: int):
        super().__init__(
            message=f"Rate limit exceeded. Retry after {retry_after_seconds}s",
            tool_name=tool_name,
            request_id=request_id,
            error_code="RATE_LIMIT_EXCEEDED",
        )
        self.retry_after_seconds = retry_after_seconds


class MCPNetworkError(MCPError):
    """Network error communicating with MCP server."""

    def __init__(self, message: str, tool_name: str, request_id: str):
        super().__init__(
            message=f"Network error: {message}",
            tool_name=tool_name,
            request_id=request_id,
            error_code="NETWORK_ERROR",
        )


# Error code to exception class mapping
ERROR_CODE_MAP = {
    "TIMEOUT": MCPTimeoutError,
    "UNAUTHORIZED": MCPUnauthorizedError,
    "TOOL_NOT_FOUND": MCPToolNotFoundError,
    "INVALID_ARGUMENTS": MCPInvalidArgumentsError,
    "EXTERNAL_API_ERROR": MCPExternalAPIError,
    "RATE_LIMIT_EXCEEDED": MCPRateLimitError,
}


def create_mcp_error(
    error_code: str,
    message: str,
    tool_name: str,
    request_id: str,
    **kwargs
) -> MCPError:
    """Factory function to create appropriate MCPError subclass.

    Args:
        error_code: Error code from MCP server.
        message: Error message.
        tool_name: Tool that failed.
        request_id: Request ID.
        **kwargs: Additional error-specific parameters.

    Returns:
        Appropriate MCPError subclass instance.
    """
    error_class = ERROR_CODE_MAP.get(error_code, MCPError)

    # Create instance with appropriate parameters
    if error_code == "TIMEOUT":
        return error_class(tool_name, request_id, kwargs.get("timeout_seconds", 30.0))
    elif error_code == "UNAUTHORIZED":
        return error_class(tool_name, request_id, kwargs.get("user_id", "unknown"))
    elif error_code == "TOOL_NOT_FOUND":
        return error_class(tool_name, request_id)
    elif error_code == "INVALID_ARGUMENTS":
        return error_class(tool_name, request_id, kwargs.get("validation_errors", []))
    elif error_code == "EXTERNAL_API_ERROR":
        return error_class(
            tool_name,
            request_id,
            kwargs.get("service_name", "unknown"),
            kwargs.get("service_error", message),
        )
    elif error_code == "RATE_LIMIT_EXCEEDED":
        return error_class(tool_name, request_id, kwargs.get("retry_after_seconds", 60))
    else:
        # Generic MCPError
        return MCPError(message, tool_name, request_id, error_code)
