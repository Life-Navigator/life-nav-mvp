"""MCP Protocol Schemas"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RequestType(str, Enum):
    """MCP request types"""
    CONTEXT = "context"
    TOOL_INVOCATION = "tool_invocation"
    HEALTH_CHECK = "health_check"


class MCPRequest(BaseModel):
    """Base MCP request"""
    request_id: str = Field(..., description="Unique request identifier")
    request_type: RequestType
    user_id: str = Field(..., description="User identifier")
    timestamp: Optional[float] = None


class MCPResponse(BaseModel):
    """Base MCP response"""
    request_id: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ContextRequest(MCPRequest):
    """Request for context aggregation"""
    request_type: RequestType = RequestType.CONTEXT
    query: str = Field(..., description="User query or prompt")
    conversation_id: Optional[str] = None
    context_types: List[str] = Field(
        default=["conversational", "semantic", "graph"],
        description="Types of context to retrieve"
    )
    max_tokens: int = Field(default=2000, ge=100, le=10000)
    filters: Optional[Dict[str, Any]] = None


class ContextResponse(MCPResponse):
    """Response with aggregated context"""
    context: Dict[str, Any] = Field(default_factory=dict)
    sources: List[str] = Field(default_factory=list)
    tokens_used: int = 0
    latency_ms: float = 0.0


class ToolInvocationRequest(MCPRequest):
    """Request to invoke a tool"""
    request_type: RequestType = RequestType.TOOL_INVOCATION
    tool_name: str = Field(..., description="Name of tool to invoke")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: Optional[int] = Field(default=30, ge=1, le=300)


class ToolInvocationResponse(MCPResponse):
    """Response from tool invocation"""
    tool_name: str
    result: Any = None
    execution_time_ms: float = 0.0
    retry_count: int = 0
