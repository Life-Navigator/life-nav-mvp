"""
Agent models for AI agent system
"""

from datetime import datetime
import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class AgentType(str, enum.Enum):
    """Agent hierarchy levels"""

    ORCHESTRATOR = "orchestrator"  # L0 - Strategic planning
    DOMAIN_MANAGER = "domain_manager"  # L1 - Domain coordination
    SPECIALIST = "specialist"  # L2 - Task execution
    TOOL_USER = "tool_user"  # L3 - External APIs


class AgentState(str, enum.Enum):
    """Agent execution states"""

    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    SHUTDOWN = "shutdown"


class TaskStatus(str, enum.Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Agent(Base):
    """Agent configuration and metadata - uses string IDs to match Prisma"""

    __tablename__ = "agents"

    # Primary key
    id = Column(String(255), primary_key=True)

    # Multi-tenancy
    user_id = Column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Agent identity
    agent_type = Column(SQLEnum(AgentType), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Configuration
    system_prompt = Column(Text)
    capabilities = Column(JSONB)  # List of capabilities
    max_concurrent_tasks = Column(Integer, default=5)
    timeout_seconds = Column(Float, default=30.0)
    retry_attempts = Column(Integer, default=3)

    # State
    current_state = Column(SQLEnum(AgentState), default=AgentState.IDLE)
    is_active = Column(Boolean, default=True)

    # Model configuration
    model_name = Column(String(100), default="maverick")  # Maverick LLM
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=500)

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active_at = Column(DateTime)

    # Relationships
    tasks = relationship(
        "AgentTask", back_populates="agent", cascade="all, delete-orphan"
    )
    conversations = relationship(
        "Conversation", back_populates="agent", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Agent {self.name} ({self.agent_type})>"


class AgentTask(Base):
    """Agent task execution tracking - uses string IDs to match Prisma"""

    __tablename__ = "agent_tasks"

    # Primary key
    id = Column(String(255), primary_key=True)

    # Multi-tenancy
    user_id = Column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Agent reference
    agent_id = Column(
        String(255),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Task details
    task_type = Column(
        String(100), nullable=False
    )  # "query", "research", "analysis", etc.
    input_text = Column(Text, nullable=False)
    context = Column(JSONB)  # Additional context data

    # Execution
    status = Column(
        SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False, index=True
    )
    result = Column(Text)
    error_message = Column(Text)

    # Performance metrics
    duration_ms = Column(Float)
    tokens_used = Column(Integer)
    retries = Column(Integer, default=0)

    # Reasoning & provenance
    reasoning_steps = Column(JSONB)  # Chain-of-thought
    confidence_score = Column(Float)  # 0.0-1.0
    sources = Column(JSONB)  # Data sources used

    # Metadata
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    agent = relationship("Agent", back_populates="tasks")

    def __repr__(self):
        return f"<AgentTask {self.id} - {self.status}>"


class Conversation(Base):
    """Agent conversation history - uses string IDs to match Prisma"""

    __tablename__ = "conversations"

    # Primary key
    id = Column(String(255), primary_key=True)

    # Multi-tenancy
    user_id = Column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Agent reference
    agent_id = Column(
        String(255),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Conversation details
    title = Column(String(500))
    summary = Column(Text)
    is_active = Column(Boolean, default=True)

    # Metadata
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at = Column(DateTime)

    # Relationships
    agent = relationship("Agent", back_populates="conversations")
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )

    def __repr__(self):
        return f"<Conversation {self.id} - {self.title}>"


class ConversationMessage(Base):
    """Individual messages in a conversation - uses string IDs to match Prisma"""

    __tablename__ = "conversation_messages"

    # Primary key
    id = Column(String(255), primary_key=True)

    # Conversation reference
    conversation_id = Column(
        String(255),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Multi-tenancy (denormalized for query performance)
    user_id = Column(
        String(255),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(String(255), nullable=False, index=True)

    # Message content
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)

    # Metadata
    tokens_used = Column(Integer)
    model_name = Column(String(100))
    confidence_score = Column(Float)
    reasoning_steps = Column(JSONB)
    extra_data = Column("metadata", JSONB)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    def __repr__(self):
        return f"<Message {self.role}: {self.content[:50]}...>"
