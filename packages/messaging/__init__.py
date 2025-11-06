"""
Messaging infrastructure for Life Navigator Agents.

Provides Redis + RabbitMQ message bus for agent communication.
"""

from messaging.message_bus import (
    MessageBus,
    TransportType,
    get_message_bus,
    cleanup_message_bus
)

__all__ = [
    "MessageBus",
    "TransportType",
    "get_message_bus",
    "cleanup_message_bus"
]
