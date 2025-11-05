"""
Agent schemas for request/response validation
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4, Field

from app.schemas.base import BaseResponseSchema
from app.models.agent import AgentType, AgentState, TaskStatus


# Agent Schemas
class AgentBase(BaseModel):
    """Base agent schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: AgentType
    system_prompt: Optional[str] = None


class AgentCreate(AgentBase):
    """Agent creation schema"""
    capabilities: Optional[List[Dict[str, Any]]] = []
    max_concurrent_tasks: int = Field(default=5, ge=1, le=100)
    timeout_seconds: float = Field(default=30.0, ge=1.0, le=300.0)
    retry_attempts: int = Field(default=3, ge=0, le=10)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=500, ge=1, le=4096)
    metadata: Optional[Dict[str, Any]] = None


class AgentUpdate(BaseModel):
    """Agent update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    capabilities: Optional[List[Dict[str, Any]]] = None
    max_concurrent_tasks: Optional[int] = Field(None, ge=1, le=100)
    timeout_seconds: Optional[float] = Field(None, ge=1.0, le=300.0)
    retry_attempts: Optional[int] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=4096)
    metadata: Optional[Dict[str, Any]] = None


class AgentResponse(BaseResponseSchema):
    """Agent response schema"""
    name: str
    description: Optional[str]
    agent_type: AgentType
    system_prompt: Optional[str]
    capabilities: List[Dict[str, Any]]
    max_concurrent_tasks: int
    timeout_seconds: float
    retry_attempts: int
    current_state: AgentState
    is_active: bool
    model_name: str
    temperature: float
    max_tokens: int
    last_active_at: Optional[datetime]


# Task Schemas
class TaskBase(BaseModel):
    """Base task schema"""
    task_type: str = Field(..., min_length=1, max_length=100)
    input_text: str = Field(..., min_length=1)


class TaskCreate(TaskBase):
    """Task creation schema"""
    agent_id: UUID4
    context: Optional[Dict[str, Any]] = None


class TaskExecute(TaskBase):
    """Task execution schema (without agent_id)"""
    context: Optional[Dict[str, Any]] = None


class TaskResponse(BaseResponseSchema):
    """Task response schema"""
    agent_id: UUID4
    task_type: str
    input_text: str
    context: Optional[Dict[str, Any]]
    status: TaskStatus
    result: Optional[str]
    error_message: Optional[str]
    duration_ms: Optional[float]
    tokens_used: Optional[int]
    retries: int
    reasoning_steps: Optional[List[Dict[str, Any]]]
    confidence_score: Optional[float]
    sources: Optional[List[Dict[str, Any]]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


# Conversation Schemas
class ConversationBase(BaseModel):
    """Base conversation schema"""
    title: Optional[str] = Field(None, max_length=500)


class ConversationCreate(ConversationBase):
    """Conversation creation schema"""
    agent_id: UUID4


class ConversationUpdate(BaseModel):
    """Conversation update schema"""
    title: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = None
    is_active: Optional[bool] = None


class MessageBase(BaseModel):
    """Base message schema"""
    content: str = Field(..., min_length=1)


class MessageCreate(MessageBase):
    """Message creation schema"""
    role: str = Field(default="user", pattern="^(user|assistant|system)$")


class MessageResponse(BaseModel):
    """Message response schema"""
    id: UUID4
    conversation_id: UUID4
    role: str
    content: str
    tokens_used: Optional[int]
    model_name: Optional[str]
    confidence_score: Optional[float]
    reasoning_steps: Optional[List[Dict[str, Any]]]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseResponseSchema):
    """Conversation response schema"""
    agent_id: UUID4
    title: Optional[str]
    summary: Optional[str]
    is_active: bool
    message_count: int
    total_tokens: int
    last_message_at: Optional[datetime]
    messages: List[MessageResponse] = []


# Chat Schemas
class ChatRequest(BaseModel):
    """Chat request schema"""
    message: str = Field(..., min_length=1)
    conversation_id: Optional[UUID4] = None
    system_prompt_override: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=4096)


class ChatResponse(BaseModel):
    """Chat response schema"""
    conversation_id: UUID4
    message_id: UUID4
    agent_id: UUID4
    message: str
    tokens_used: Optional[int]
    model_name: str
    confidence_score: Optional[float]
    reasoning_steps: Optional[List[Dict[str, Any]]]
    timestamp: datetime


# Metrics Schemas
class AgentMetrics(BaseModel):
    """Agent performance metrics"""
    agent_id: UUID4
    agent_name: str
    current_state: AgentState
    is_active: bool
    total_tasks: int
    successful_tasks: int
    failed_tasks: int
    average_duration_ms: float
    average_tokens: float
    total_tokens: int
    active_conversations: int
    uptime_seconds: Optional[float]
    last_active_at: Optional[datetime]


class AgentStats(BaseModel):
    """Aggregate agent statistics"""
    total_agents: int
    active_agents: int
    total_tasks_today: int
    total_conversations: int
    total_messages_today: int
    average_response_time_ms: float
    total_tokens_today: int
