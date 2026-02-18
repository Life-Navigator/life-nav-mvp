"""Base Plugin Interface"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PluginStatus(str, Enum):
    """Plugin lifecycle status"""
    UNINITIALIZED = "uninitialized"
    INITIALIZING = "initializing"
    READY = "ready"
    ERROR = "error"
    STOPPED = "stopped"


class PluginMetadata(BaseModel):
    """Plugin metadata"""
    name: str = Field(..., description="Unique plugin name")
    version: str = Field(..., description="Plugin version")
    description: str = Field(..., description="Plugin description")
    author: Optional[str] = None
    requires: List[str] = Field(default_factory=list, description="Required dependencies")
    priority: int = Field(default=50, description="Plugin priority (higher = earlier)")
    tags: List[str] = Field(default_factory=list)


class BasePlugin(ABC):
    """
    Base class for all MCP plugins.

    Plugins extend MCP capabilities by:
    - Providing context from various sources
    - Registering tools for LLM invocation
    - Handling events and lifecycle hooks
    - Managing resources and connections

    Example:
        class MyPlugin(BasePlugin):
            def __init__(self):
                super().__init__(
                    metadata=PluginMetadata(
                        name="my_plugin",
                        version="1.0.0",
                        description="My custom plugin"
                    )
                )

            async def initialize(self, config: dict):
                # Initialize resources
                self.client = await create_client(config)

            async def get_context(self, query: str, user_id: str) -> dict:
                # Provide context for query
                results = await self.client.search(query)
                return {"results": results}

            def get_tools(self) -> list:
                # Register tools
                return [...]

            async def cleanup(self):
                # Cleanup resources
                await self.client.close()
    """

    def __init__(self, metadata: PluginMetadata):
        self.metadata = metadata
        self.status = PluginStatus.UNINITIALIZED
        self.config: Dict[str, Any] = {}
        self.initialized_at: Optional[datetime] = None
        self.error: Optional[str] = None

    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initialize plugin with configuration.

        This is called once when the plugin is loaded. Use this to:
        - Set up connections to external services
        - Load necessary data
        - Initialize caches
        - Validate configuration

        Args:
            config: Plugin configuration from config file or environment

        Raises:
            Exception: If initialization fails
        """
        pass

    @abstractmethod
    async def get_context(
        self,
        query: str,
        user_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Provide context for a user query.

        This is called when an LLM requests context. Return relevant
        information that will help the LLM generate a better response.

        Args:
            query: The user's query or prompt
            user_id: User identifier for personalization
            **kwargs: Additional parameters (conversation_id, filters, etc.)

        Returns:
            Dictionary with context data. Format:
            {
                "data": { ... },  # Context data
                "metadata": {
                    "source": str,  # Plugin name
                    "relevance_score": float,  # 0.0-1.0
                    "tokens": int  # Estimated token count
                }
            }
        """
        pass

    def get_tools(self) -> List[Any]:
        """
        Register tools that LLMs can invoke.

        Tools are functions that LLMs can call to perform actions:
        - Query databases
        - Search information
        - Update data
        - Execute operations

        Returns:
            List of Tool objects (see tools.base.Tool)
        """
        return []

    async def on_tool_invocation(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: str
    ) -> Any:
        """
        Handle tool invocation.

        This is called when an LLM invokes one of the plugin's tools.

        Args:
            tool_name: Name of the tool being invoked
            parameters: Tool parameters
            user_id: User identifier

        Returns:
            Tool execution result

        Raises:
            NotImplementedError: If tool is not implemented
        """
        raise NotImplementedError(f"Tool {tool_name} not implemented")

    async def on_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Handle system events.

        Plugins can react to events like:
        - conversation_started
        - conversation_ended
        - user_login
        - data_updated

        Args:
            event_type: Type of event
            data: Event data
        """
        pass

    async def cleanup(self) -> None:
        """
        Cleanup plugin resources.

        Called when:
        - Server is shutting down
        - Plugin is being reloaded
        - Plugin encounters an error

        Use this to:
        - Close connections
        - Save state
        - Release resources
        """
        pass

    async def health_check(self) -> Dict[str, Any]:
        """
        Check plugin health status.

        Returns:
            Dictionary with health information:
            {
                "status": "ok" | "degraded" | "error",
                "message": str,
                "details": { ... }
            }
        """
        return {
            "status": "ok" if self.status == PluginStatus.READY else "error",
            "message": self.error or "Plugin is healthy",
            "details": {
                "name": self.metadata.name,
                "version": self.metadata.version,
                "status": self.status.value,
                "initialized_at": self.initialized_at.isoformat() if self.initialized_at else None
            }
        }

    def set_status(self, status: PluginStatus, error: Optional[str] = None) -> None:
        """Update plugin status"""
        self.status = status
        self.error = error
        if status == PluginStatus.READY and not self.initialized_at:
            self.initialized_at = datetime.utcnow()

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name={self.metadata.name}, status={self.status.value})>"
