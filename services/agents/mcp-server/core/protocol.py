"""MCP Protocol Handler"""

from typing import Dict, Any, Optional
import structlog

from .plugin_manager import PluginManager
from .context_builder import ContextBuilder
from ..schemas.protocol import (
    ContextRequest,
    ContextResponse,
    ToolInvocationRequest,
    ToolInvocationResponse,
)

logger = structlog.get_logger(__name__)


class MCPProtocol:
    """
    Handles MCP (Model Context Protocol) requests and responses.

    The protocol defines how LLMs interact with the system:
    - Context requests: Aggregate context from multiple sources
    - Tool invocations: Execute tools provided by plugins
    - Event handling: Broadcast events to plugins
    """

    def __init__(
        self,
        plugin_manager: PluginManager,
        context_builder: ContextBuilder
    ):
        self.plugin_manager = plugin_manager
        self.context_builder = context_builder

    async def handle_context_request(
        self,
        request: ContextRequest
    ) -> ContextResponse:
        """
        Handle a context request.

        Args:
            request: Context request from LLM

        Returns:
            Aggregated context from all relevant sources
        """
        logger.info(
            "handling_context_request",
            request_id=request.request_id,
            user_id=request.user_id
        )

        try:
            # Build context using context builder
            context = await self.context_builder.build_context(
                query=request.query,
                user_id=request.user_id,
                conversation_id=request.conversation_id,
                context_types=request.context_types,
                max_tokens=request.max_tokens,
                filters=request.filters,
            )

            return ContextResponse(
                request_id=request.request_id,
                success=True,
                context=context["context"],
                sources=context["sources"],
                tokens_used=context["tokens_used"],
                latency_ms=context["latency_ms"],
            )

        except Exception as e:
            logger.error(
                "context_request_failed",
                request_id=request.request_id,
                error=str(e),
                exc_info=True
            )

            return ContextResponse(
                request_id=request.request_id,
                success=False,
                error=str(e),
                context={},
                sources=[],
                tokens_used=0,
                latency_ms=0,
            )

    async def handle_tool_invocation(
        self,
        request: ToolInvocationRequest
    ) -> ToolInvocationResponse:
        """
        Handle a tool invocation request.

        Args:
            request: Tool invocation request from LLM

        Returns:
            Tool execution result
        """
        logger.info(
            "handling_tool_invocation",
            request_id=request.request_id,
            tool=request.tool_name,
            user_id=request.user_id
        )

        try:
            # Invoke tool through plugin manager
            result = await self.plugin_manager.invoke_tool(
                tool_name=request.tool_name,
                parameters=request.parameters,
                user_id=request.user_id,
            )

            return ToolInvocationResponse(
                request_id=request.request_id,
                success=True,
                tool_name=request.tool_name,
                result=result,
                execution_time_ms=0,  # Will be set by caller
            )

        except Exception as e:
            logger.error(
                "tool_invocation_failed",
                request_id=request.request_id,
                tool=request.tool_name,
                error=str(e),
                exc_info=True
            )

            return ToolInvocationResponse(
                request_id=request.request_id,
                success=False,
                tool_name=request.tool_name,
                error=str(e),
                execution_time_ms=0,
            )

    async def broadcast_event(
        self,
        event_type: str,
        data: Dict[str, Any]
    ) -> None:
        """
        Broadcast an event to all plugins.

        Args:
            event_type: Type of event (e.g., 'conversation_started')
            data: Event data
        """
        logger.info("broadcasting_event", event_type=event_type)
        await self.plugin_manager.broadcast_event(event_type, data)
