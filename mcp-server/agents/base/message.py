"""Message System for Agent Communication"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Types of inter-agent messages"""
    TASK_REQUEST = "task_request"
    TASK_RESPONSE = "task_response"
    QUERY = "query"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    ERROR = "error"
    STATUS_UPDATE = "status_update"
    COLLABORATION_REQUEST = "collaboration_request"
    RESULT = "result"


class MessagePriority(str, Enum):
    """Message priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class Message(BaseModel):
    """
    Message for agent-to-agent communication.

    Messages flow through the MessageBus and can be:
    - Direct (agent → agent)
    - Broadcast (agent → all agents)
    - Topic-based (agent → subscribers)
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: MessageType
    sender: str  # Agent ID
    recipient: Optional[str] = None  # Agent ID (None = broadcast)
    topic: Optional[str] = None  # For topic-based messaging

    content: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    priority: MessagePriority = MessagePriority.NORMAL
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # For request-response patterns
    reply_to: Optional[str] = None  # Original message ID
    requires_response: bool = False
    timeout_seconds: Optional[int] = None

    # Tracking
    trace_id: Optional[str] = None  # For distributed tracing
    correlation_id: Optional[str] = None  # For request correlation

    def create_response(
        self,
        sender: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> "Message":
        """Create a response message to this message"""
        return Message(
            type=MessageType.RESPONSE,
            sender=sender,
            recipient=self.sender,
            content=content,
            metadata=metadata or {},
            reply_to=self.id,
            correlation_id=self.correlation_id,
            trace_id=self.trace_id,
        )

    def create_error(
        self,
        sender: str,
        error: str,
        details: Optional[Dict[str, Any]] = None
    ) -> "Message":
        """Create an error response"""
        return Message(
            type=MessageType.ERROR,
            sender=sender,
            recipient=self.sender,
            content={
                "error": error,
                "details": details or {},
                "original_message_id": self.id
            },
            reply_to=self.id,
            correlation_id=self.correlation_id,
            trace_id=self.trace_id,
        )

    def is_broadcast(self) -> bool:
        """Check if message is a broadcast"""
        return self.recipient is None

    def is_for_topic(self, topic: str) -> bool:
        """Check if message is for a specific topic"""
        return self.topic == topic

    def __repr__(self) -> str:
        return (
            f"<Message(id={self.id[:8]}, type={self.type}, "
            f"sender={self.sender}, recipient={self.recipient or 'broadcast'})>"
        )


class TaskRequest(BaseModel):
    """Structured task request for agents"""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_type: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    requirements: List[str] = Field(default_factory=list)  # Required capabilities
    priority: MessagePriority = MessagePriority.NORMAL
    deadline: Optional[datetime] = None
    context: Dict[str, Any] = Field(default_factory=dict)

    def to_message(
        self,
        sender: str,
        recipient: Optional[str] = None
    ) -> Message:
        """Convert task request to message"""
        return Message(
            type=MessageType.TASK_REQUEST,
            sender=sender,
            recipient=recipient,
            content={
                "task_id": self.task_id,
                "task_type": self.task_type,
                "description": self.description,
                "parameters": self.parameters,
                "requirements": self.requirements,
                "context": self.context,
            },
            metadata={
                "deadline": self.deadline.isoformat() if self.deadline else None
            },
            priority=self.priority,
            requires_response=True,
        )


class TaskResponse(BaseModel):
    """Structured task response from agents"""
    task_id: str
    status: str  # "success", "failed", "partial"
    result: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: float = 0.0

    def to_message(
        self,
        sender: str,
        recipient: str,
        reply_to: str
    ) -> Message:
        """Convert task response to message"""
        return Message(
            type=MessageType.TASK_RESPONSE,
            sender=sender,
            recipient=recipient,
            content={
                "task_id": self.task_id,
                "status": self.status,
                "result": self.result,
                "error": self.error,
                "execution_time_ms": self.execution_time_ms,
            },
            metadata=self.metadata,
            reply_to=reply_to,
        )
