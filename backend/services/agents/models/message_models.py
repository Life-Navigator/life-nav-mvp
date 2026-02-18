"""Pydantic models for message bus communication.

This module provides type-safe message models for the messaging system:
- Message types and routing
- Request/response patterns
- Event notifications
- Agent-to-agent communication
- Task delegation messages

Example usage:
    >>> from models.message_models import AgentMessage, MessageType
    >>> message = AgentMessage(
    ...     message_type=MessageType.TASK_REQUEST,
    ...     sender_id="orchestrator-001",
    ...     recipient_id="finance-manager-001",
    ...     payload={"action": "analyze_budget"}
    ... )
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Message type classification.

    Attributes:
        TASK_REQUEST: Request to execute a task.
        TASK_RESPONSE: Response with task results.
        QUERY_REQUEST: Request for information.
        QUERY_RESPONSE: Response with query results.
        EVENT: Notification of an event occurrence.
        COMMAND: Direct command to an agent.
        STATUS_UPDATE: Agent status update.
        HEARTBEAT: Agent heartbeat/keepalive.
        ERROR: Error notification.
        ACK: Acknowledgment of message receipt.
    """

    TASK_REQUEST = "task_request"
    TASK_RESPONSE = "task_response"
    QUERY_REQUEST = "query_request"
    QUERY_RESPONSE = "query_response"
    EVENT = "event"
    COMMAND = "command"
    STATUS_UPDATE = "status_update"
    HEARTBEAT = "heartbeat"
    ERROR = "error"
    ACK = "ack"


class MessagePriority(str, Enum):
    """Message priority levels.

    Attributes:
        LOW: Non-urgent messages.
        NORMAL: Standard priority.
        HIGH: Important messages requiring faster processing.
        CRITICAL: Urgent messages requiring immediate attention.
    """

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class RoutingStrategy(str, Enum):
    """Message routing strategy.

    Attributes:
        DIRECT: Direct message to specific recipient.
        BROADCAST: Broadcast to all subscribers of a topic.
        ROUND_ROBIN: Distribute to one of multiple workers.
        FANOUT: Send to all registered handlers.
    """

    DIRECT = "direct"
    BROADCAST = "broadcast"
    ROUND_ROBIN = "round_robin"
    FANOUT = "fanout"


class MessageStatus(str, Enum):
    """Message processing status.

    Attributes:
        PENDING: Message queued, not yet delivered.
        DELIVERED: Message delivered to recipient.
        PROCESSING: Recipient is processing the message.
        COMPLETED: Message processing completed successfully.
        FAILED: Message processing failed.
        EXPIRED: Message expired before delivery.
    """

    PENDING = "pending"
    DELIVERED = "delivered"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class MessageHeader(BaseModel):
    """Message header with routing and tracking information.

    Attributes:
        message_id: Unique message identifier.
        message_type: Type of message.
        priority: Message priority level.
        correlation_id: Request correlation ID for tracing.
        reply_to: Queue/topic for responses.
        timestamp: Message creation timestamp.
        ttl_seconds: Time-to-live in seconds.
        routing_strategy: How to route this message.
        metadata: Additional header metadata.
    """

    message_id: UUID = Field(default_factory=uuid4, description="Unique message ID")
    message_type: MessageType = Field(..., description="Message type")
    priority: MessagePriority = Field(
        default=MessagePriority.NORMAL, description="Message priority"
    )
    correlation_id: str = Field(..., description="Correlation ID", min_length=1)
    reply_to: str | None = Field(
        default=None, description="Reply queue/topic (optional)"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Creation timestamp",
    )
    ttl_seconds: int | None = Field(
        default=300, ge=1, le=86400, description="Time-to-live in seconds"
    )
    routing_strategy: RoutingStrategy = Field(
        default=RoutingStrategy.DIRECT, description="Routing strategy"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @property
    def is_expired(self) -> bool:
        """Check if message has exceeded TTL.

        Returns:
            True if message has expired.
        """
        if self.ttl_seconds is None:
            return False
        now = datetime.now(timezone.utc)
        age = (now - self.timestamp).total_seconds()
        return age > self.ttl_seconds


class AgentMessage(BaseModel):
    """Core message model for agent communication.

    Attributes:
        header: Message header with routing info.
        sender_id: Agent ID of message sender.
        recipient_id: Agent ID of message recipient (optional for broadcast).
        payload: Message payload data.
        status: Current message status.
        error: Error message if processing failed.
    """

    header: MessageHeader = Field(..., description="Message header")
    sender_id: str = Field(..., description="Sender agent ID", min_length=1)
    recipient_id: str | None = Field(
        default=None, description="Recipient agent ID (optional for broadcast)"
    )
    payload: dict[str, Any] = Field(..., description="Message payload")
    status: MessageStatus = Field(
        default=MessageStatus.PENDING, description="Message status"
    )
    error: str | None = Field(default=None, description="Error message if failed")


class TaskRequestMessage(BaseModel):
    """Task execution request message.

    Attributes:
        task_id: Unique task identifier.
        task_type: Type of task to execute.
        payload: Task input data.
        context: Additional execution context.
        timeout_seconds: Task timeout.
        retry_attempts: Number of retry attempts allowed.
        callback_queue: Queue for task completion notification.
    """

    task_id: UUID = Field(default_factory=uuid4, description="Task ID")
    task_type: str = Field(..., description="Task type", min_length=1)
    payload: dict[str, Any] = Field(..., description="Task input data")
    context: dict[str, Any] = Field(
        default_factory=dict, description="Execution context"
    )
    timeout_seconds: int = Field(default=300, ge=1, le=3600, description="Task timeout")
    retry_attempts: int = Field(default=3, ge=0, le=10, description="Retry attempts")
    callback_queue: str | None = Field(
        default=None, description="Callback queue for completion"
    )


class TaskResponseMessage(BaseModel):
    """Task execution response message.

    Attributes:
        task_id: Task identifier from request.
        success: Whether task completed successfully.
        result: Task result data.
        error: Error information if task failed.
        duration_ms: Task execution duration in milliseconds.
        metadata: Additional response metadata.
    """

    task_id: UUID = Field(..., description="Task ID from request")
    success: bool = Field(..., description="Task success status")
    result: dict[str, Any] | None = Field(default=None, description="Task result")
    error: str | None = Field(default=None, description="Error message if failed")
    duration_ms: float | None = Field(
        default=None, ge=0.0, description="Execution duration"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )


class QueryRequestMessage(BaseModel):
    """Query information request message.

    Attributes:
        query_id: Unique query identifier.
        query_type: Type of query.
        query: Query text or structured query.
        parameters: Query parameters.
        timeout_seconds: Query timeout.
    """

    query_id: UUID = Field(default_factory=uuid4, description="Query ID")
    query_type: str = Field(..., description="Query type", min_length=1)
    query: str | dict[str, Any] = Field(..., description="Query text or structure")
    parameters: dict[str, Any] = Field(
        default_factory=dict, description="Query parameters"
    )
    timeout_seconds: int = Field(default=30, ge=1, le=300, description="Query timeout")


class QueryResponseMessage(BaseModel):
    """Query response message.

    Attributes:
        query_id: Query identifier from request.
        success: Whether query completed successfully.
        data: Query result data.
        error: Error information if query failed.
        duration_ms: Query execution duration.
        metadata: Additional response metadata.
    """

    query_id: UUID = Field(..., description="Query ID from request")
    success: bool = Field(..., description="Query success status")
    data: list[dict[str, Any]] | dict[str, Any] | None = Field(
        default=None, description="Query result data"
    )
    error: str | None = Field(default=None, description="Error message if failed")
    duration_ms: float | None = Field(
        default=None, ge=0.0, description="Execution duration"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )


class EventMessage(BaseModel):
    """Event notification message.

    Attributes:
        event_id: Unique event identifier.
        event_type: Type of event.
        source: Event source identifier.
        timestamp: Event occurrence timestamp.
        data: Event data payload.
        severity: Event severity level.
    """

    event_id: UUID = Field(default_factory=uuid4, description="Event ID")
    event_type: str = Field(..., description="Event type", min_length=1)
    source: str = Field(..., description="Event source", min_length=1)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Event time"
    )
    data: dict[str, Any] = Field(..., description="Event data")
    severity: str = Field(
        default="info", description="Event severity (info, warning, error, critical)"
    )


class CommandMessage(BaseModel):
    """Direct command message to an agent.

    Attributes:
        command_id: Unique command identifier.
        command: Command name.
        arguments: Command arguments.
        timeout_seconds: Command timeout.
    """

    command_id: UUID = Field(default_factory=uuid4, description="Command ID")
    command: str = Field(..., description="Command name", min_length=1)
    arguments: dict[str, Any] = Field(
        default_factory=dict, description="Command arguments"
    )
    timeout_seconds: int = Field(
        default=60, ge=1, le=600, description="Command timeout"
    )


class StatusUpdateMessage(BaseModel):
    """Agent status update message.

    Attributes:
        agent_id: Agent identifier.
        state: Current agent state.
        active_tasks: Number of active tasks.
        uptime_seconds: Agent uptime.
        timestamp: Update timestamp.
        metadata: Additional status data.
    """

    agent_id: str = Field(..., description="Agent ID", min_length=1)
    state: str = Field(..., description="Agent state", min_length=1)
    active_tasks: int = Field(default=0, ge=0, description="Active task count")
    uptime_seconds: float = Field(default=0.0, ge=0.0, description="Agent uptime")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Update time"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional status info"
    )


class HeartbeatMessage(BaseModel):
    """Agent heartbeat/keepalive message.

    Attributes:
        agent_id: Agent identifier.
        timestamp: Heartbeat timestamp.
        sequence: Heartbeat sequence number.
        metadata: Additional heartbeat data.
    """

    agent_id: str = Field(..., description="Agent ID", min_length=1)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Heartbeat time"
    )
    sequence: int = Field(default=0, ge=0, description="Heartbeat sequence number")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )


class ErrorMessage(BaseModel):
    """Error notification message.

    Attributes:
        error_id: Unique error identifier.
        error_code: Error code.
        error_message: Human-readable error message.
        source: Error source identifier.
        timestamp: Error occurrence timestamp.
        context: Error context information.
        stack_trace: Stack trace if available.
    """

    error_id: UUID = Field(default_factory=uuid4, description="Error ID")
    error_code: str = Field(..., description="Error code", min_length=1)
    error_message: str = Field(..., description="Error message", min_length=1)
    source: str = Field(..., description="Error source", min_length=1)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Error time"
    )
    context: dict[str, Any] = Field(default_factory=dict, description="Error context")
    stack_trace: str | None = Field(default=None, description="Stack trace")


class AckMessage(BaseModel):
    """Message acknowledgment.

    Attributes:
        ack_id: Acknowledgment identifier.
        original_message_id: ID of acknowledged message.
        timestamp: Acknowledgment timestamp.
        status: Acknowledgment status.
    """

    ack_id: UUID = Field(default_factory=uuid4, description="Acknowledgment ID")
    original_message_id: UUID = Field(..., description="Original message ID")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Ack time"
    )
    status: str = Field(
        default="received", description="Acknowledgment status (received, processed)"
    )


class MessageEnvelope(BaseModel):
    """Complete message envelope for serialization/transmission.

    Wraps any message type with common header and routing information.

    Attributes:
        header: Message header.
        sender_id: Sender agent ID.
        recipient_id: Recipient agent ID (optional).
        message_type: Type of wrapped message.
        payload: Wrapped message payload.
    """

    header: MessageHeader = Field(..., description="Message header")
    sender_id: str = Field(..., description="Sender agent ID", min_length=1)
    recipient_id: str | None = Field(default=None, description="Recipient agent ID")
    message_type: MessageType = Field(..., description="Type of wrapped message")
    payload: dict[str, Any] = Field(..., description="Wrapped message payload")

    @classmethod
    def create(
        cls,
        sender_id: str,
        message_type: MessageType,
        payload: dict[str, Any],
        recipient_id: str | None = None,
        priority: MessagePriority = MessagePriority.NORMAL,
        correlation_id: str | None = None,
        reply_to: str | None = None,
        ttl_seconds: int | None = 300,
        routing_strategy: RoutingStrategy = RoutingStrategy.DIRECT,
    ) -> "MessageEnvelope":
        """Create a message envelope with auto-generated header.

        Args:
            sender_id: Sender agent ID.
            message_type: Message type.
            payload: Message payload.
            recipient_id: Recipient agent ID (optional).
            priority: Message priority.
            correlation_id: Correlation ID (auto-generated if None).
            reply_to: Reply queue/topic.
            ttl_seconds: Time-to-live.
            routing_strategy: Routing strategy.

        Returns:
            MessageEnvelope instance.
        """
        from uuid import uuid4

        if correlation_id is None:
            correlation_id = str(uuid4())

        header = MessageHeader(
            message_type=message_type,
            priority=priority,
            correlation_id=correlation_id,
            reply_to=reply_to,
            ttl_seconds=ttl_seconds,
            routing_strategy=routing_strategy,
        )

        return cls(
            header=header,
            sender_id=sender_id,
            recipient_id=recipient_id,
            message_type=message_type,
            payload=payload,
        )


class MessageBatch(BaseModel):
    """Batch of messages for bulk operations.

    Attributes:
        batch_id: Unique batch identifier.
        messages: List of message envelopes.
        timestamp: Batch creation timestamp.
        metadata: Additional batch metadata.
    """

    batch_id: UUID = Field(default_factory=uuid4, description="Batch ID")
    messages: list[MessageEnvelope] = Field(..., description="Messages in batch")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Batch creation time",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Batch metadata")

    @property
    def size(self) -> int:
        """Get number of messages in batch.

        Returns:
            Number of messages.
        """
        return len(self.messages)
