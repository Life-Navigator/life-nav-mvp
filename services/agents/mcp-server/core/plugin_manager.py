"""Plugin Manager - Manages MCP plugin lifecycle"""

import asyncio
import importlib
import importlib.util
from pathlib import Path
from typing import Dict, List, Optional
import structlog

from ..plugins.base import BasePlugin, PluginStatus

logger = structlog.get_logger()


class PluginManager:
    """
    Manages the lifecycle of MCP plugins.

    Responsibilities:
    - Discover plugins from multiple sources
    - Load and initialize plugins
    - Manage plugin lifecycle (start, stop, reload)
    - Route requests to appropriate plugins
    - Handle plugin errors and failures

    Example:
        manager = PluginManager()
        await manager.discover_plugins("./plugins")
        await manager.initialize_all(config)

        # Get context from all plugins
        context = await manager.get_aggregated_context(
            query="What are my tasks?",
            user_id="user_123"
        )

        # Invoke a tool
        result = await manager.invoke_tool(
            tool_name="query_knowledge_graph",
            parameters={"query": "..."},
            user_id="user_123"
        )
    """

    def __init__(self):
        self.plugins: Dict[str, BasePlugin] = {}
        self.tools_registry: Dict[str, tuple[BasePlugin, Any]] = {}
        self._initialization_lock = asyncio.Lock()

    async def register_plugin(
        self,
        plugin: BasePlugin,
        config: Optional[Dict] = None
    ) -> None:
        """
        Register and initialize a plugin.

        Args:
            plugin: Plugin instance
            config: Plugin configuration

        Raises:
            ValueError: If plugin name already registered
            Exception: If plugin initialization fails
        """
        plugin_name = plugin.metadata.name

        if plugin_name in self.plugins:
            raise ValueError(f"Plugin '{plugin_name}' already registered")

        logger.info(
            "registering_plugin",
            name=plugin_name,
            version=plugin.metadata.version
        )

        async with self._initialization_lock:
            try:
                # Set status to initializing
                plugin.set_status(PluginStatus.INITIALIZING)

                # Initialize plugin
                plugin_config = config or {}
                await plugin.initialize(plugin_config)
                plugin.config = plugin_config

                # Register plugin
                self.plugins[plugin_name] = plugin
                plugin.set_status(PluginStatus.READY)

                # Register tools
                tools = plugin.get_tools()
                for tool in tools:
                    tool_name = tool.name
                    if tool_name in self.tools_registry:
                        logger.warning(
                            "tool_already_registered",
                            tool=tool_name,
                            plugin=plugin_name
                        )
                    self.tools_registry[tool_name] = (plugin, tool)

                logger.info(
                    "plugin_registered",
                    name=plugin_name,
                    tools=len(tools)
                )

            except Exception as e:
                plugin.set_status(PluginStatus.ERROR, str(e))
                logger.error(
                    "plugin_registration_failed",
                    name=plugin_name,
                    error=str(e),
                    exc_info=True
                )
                raise

    async def discover_plugins(self, plugins_dir: str) -> List[str]:
        """
        Discover plugins from a directory.

        Looks for plugin modules that contain a class inheriting from BasePlugin.

        Args:
            plugins_dir: Directory containing plugin modules

        Returns:
            List of discovered plugin names
        """
        plugins_path = Path(plugins_dir)
        discovered = []

        if not plugins_path.exists():
            logger.warning("plugins_directory_not_found", path=plugins_dir)
            return discovered

        for plugin_dir in plugins_path.iterdir():
            if not plugin_dir.is_dir() or plugin_dir.name.startswith("_"):
                continue

            plugin_file = plugin_dir / "plugin.py"
            if not plugin_file.exists():
                continue

            try:
                # Load module
                spec = importlib.util.spec_from_file_location(
                    f"plugins.{plugin_dir.name}",
                    plugin_file
                )
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    # Find plugin class
                    for name in dir(module):
                        obj = getattr(module, name)
                        if (
                            isinstance(obj, type)
                            and issubclass(obj, BasePlugin)
                            and obj is not BasePlugin
                        ):
                            discovered.append(plugin_dir.name)
                            logger.info(
                                "plugin_discovered",
                                name=plugin_dir.name,
                                class_name=name
                            )
                            break

            except Exception as e:
                logger.error(
                    "plugin_discovery_failed",
                    plugin=plugin_dir.name,
                    error=str(e)
                )

        return discovered

    async def initialize_all(self, configs: Dict[str, Dict]) -> None:
        """
        Initialize all registered plugins.

        Args:
            configs: Dictionary mapping plugin names to their configs
        """
        logger.info("initializing_plugins", count=len(self.plugins))

        # Sort plugins by priority (higher priority first)
        sorted_plugins = sorted(
            self.plugins.items(),
            key=lambda x: x[1].metadata.priority,
            reverse=True
        )

        for plugin_name, plugin in sorted_plugins:
            if plugin.status != PluginStatus.UNINITIALIZED:
                continue

            config = configs.get(plugin_name, {})
            try:
                await self.register_plugin(plugin, config)
            except Exception as e:
                logger.error(
                    "plugin_initialization_failed",
                    plugin=plugin_name,
                    error=str(e)
                )

    async def get_aggregated_context(
        self,
        query: str,
        user_id: str,
        context_types: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, any]:
        """
        Get aggregated context from all plugins.

        Args:
            query: User query
            user_id: User identifier
            context_types: Types of context to retrieve (None = all)
            **kwargs: Additional parameters passed to plugins

        Returns:
            Aggregated context from all plugins
        """
        context = {}
        metadata = {
            "sources": [],
            "tokens_total": 0,
            "latency_ms": {}
        }

        # Get context from each plugin concurrently
        tasks = []
        for plugin_name, plugin in self.plugins.items():
            if plugin.status != PluginStatus.READY:
                continue
            tasks.append(self._get_plugin_context(plugin, query, user_id, **kwargs))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for plugin_name, result in zip(self.plugins.keys(), results):
            if isinstance(result, Exception):
                logger.error(
                    "context_retrieval_failed",
                    plugin=plugin_name,
                    error=str(result)
                )
                continue

            if result:
                context[plugin_name] = result.get("data", {})
                plugin_metadata = result.get("metadata", {})

                metadata["sources"].append(plugin_metadata.get("source", plugin_name))
                metadata["tokens_total"] += plugin_metadata.get("tokens", 0)
                metadata["latency_ms"][plugin_name] = plugin_metadata.get("latency_ms", 0)

        return {
            "context": context,
            "metadata": metadata
        }

    async def _get_plugin_context(
        self,
        plugin: BasePlugin,
        query: str,
        user_id: str,
        **kwargs
    ) -> Dict:
        """Get context from a single plugin with timing"""
        import time
        start_time = time.time()

        try:
            result = await plugin.get_context(query, user_id, **kwargs)
            latency_ms = (time.time() - start_time) * 1000

            # Ensure metadata includes latency
            if "metadata" not in result:
                result["metadata"] = {}
            result["metadata"]["latency_ms"] = latency_ms

            return result

        except Exception as e:
            logger.error(
                "plugin_context_error",
                plugin=plugin.metadata.name,
                error=str(e),
                exc_info=True
            )
            raise

    async def invoke_tool(
        self,
        tool_name: str,
        parameters: Dict,
        user_id: str
    ) -> any:
        """
        Invoke a registered tool.

        Args:
            tool_name: Name of tool to invoke
            parameters: Tool parameters
            user_id: User identifier

        Returns:
            Tool execution result

        Raises:
            ValueError: If tool not found
            Exception: If tool execution fails
        """
        if tool_name not in self.tools_registry:
            raise ValueError(f"Tool '{tool_name}' not found")

        plugin, tool = self.tools_registry[tool_name]

        logger.info(
            "invoking_tool",
            tool=tool_name,
            plugin=plugin.metadata.name,
            user_id=user_id
        )

        try:
            result = await plugin.on_tool_invocation(
                tool_name,
                parameters,
                user_id
            )
            return result

        except Exception as e:
            logger.error(
                "tool_invocation_failed",
                tool=tool_name,
                plugin=plugin.metadata.name,
                error=str(e),
                exc_info=True
            )
            raise

    async def broadcast_event(self, event_type: str, data: Dict) -> None:
        """
        Broadcast an event to all plugins.

        Args:
            event_type: Type of event
            data: Event data
        """
        logger.debug("broadcasting_event", event_type=event_type)

        tasks = []
        for plugin in self.plugins.values():
            if plugin.status == PluginStatus.READY:
                tasks.append(plugin.on_event(event_type, data))

        await asyncio.gather(*tasks, return_exceptions=True)

    async def cleanup_all(self) -> None:
        """Cleanup all plugins"""
        logger.info("cleaning_up_plugins", count=len(self.plugins))

        tasks = [
            plugin.cleanup()
            for plugin in self.plugins.values()
            if plugin.status == PluginStatus.READY
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

        self.plugins.clear()
        self.tools_registry.clear()

    async def health_check_all(self) -> Dict[str, Dict]:
        """
        Check health of all plugins.

        Returns:
            Dictionary mapping plugin names to health status
        """
        health = {}

        for plugin_name, plugin in self.plugins.items():
            try:
                health[plugin_name] = await plugin.health_check()
            except Exception as e:
                health[plugin_name] = {
                    "status": "error",
                    "message": str(e)
                }

        return health

    def get_plugin(self, name: str) -> Optional[BasePlugin]:
        """Get plugin by name"""
        return self.plugins.get(name)

    def list_plugins(self) -> List[Dict]:
        """List all registered plugins"""
        return [
            {
                "name": plugin.metadata.name,
                "version": plugin.metadata.version,
                "description": plugin.metadata.description,
                "status": plugin.status.value,
                "priority": plugin.metadata.priority,
                "tools_count": len(plugin.get_tools())
            }
            for plugin in self.plugins.values()
        ]

    def list_tools(self) -> List[Dict]:
        """List all registered tools"""
        return [
            {
                "name": tool_name,
                "plugin": plugin.metadata.name,
                "description": tool.description if hasattr(tool, 'description') else None
            }
            for tool_name, (plugin, tool) in self.tools_registry.items()
        ]
