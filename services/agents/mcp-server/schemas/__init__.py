"""MCP Server Schemas"""

from .protocol import (
    MCPRequest,
    MCPResponse,
    ContextRequest,
    ContextResponse,
    ToolInvocationRequest,
    ToolInvocationResponse,
)
from .context import (
    ContextType,
    ContextMetadata,
    ConversationalContext,
    SemanticContext,
    GraphContext,
    TemporalContext,
    UserProfileContext,
)
from .tools import (
    ToolParameter,
    ToolSchema,
    ToolResult,
    ToolError,
)

__all__ = [
    # Protocol
    "MCPRequest",
    "MCPResponse",
    "ContextRequest",
    "ContextResponse",
    "ToolInvocationRequest",
    "ToolInvocationResponse",
    # Context
    "ContextType",
    "ContextMetadata",
    "ConversationalContext",
    "SemanticContext",
    "GraphContext",
    "TemporalContext",
    "UserProfileContext",
    # Tools
    "ToolParameter",
    "ToolSchema",
    "ToolResult",
    "ToolError",
]
