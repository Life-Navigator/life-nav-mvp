"""
MCP Server Core Module

This module contains the core MCP protocol implementation including:
- Protocol handlers
- Plugin management
- Context aggregation
- Server application
"""

__version__ = "1.0.0"

from .server import create_app
from .protocol import MCPProtocol
from .plugin_manager import PluginManager
from .context_builder import ContextBuilder

__all__ = [
    "create_app",
    "MCPProtocol",
    "PluginManager",
    "ContextBuilder",
]
