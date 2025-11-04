"""Task Execution Schemas for Agent API"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TaskRequest(BaseModel):
    """Request to execute a task with an agent"""
    agent_id: str = Field(..., description="ID of the agent to execute the task")
    task_type: str = Field(..., description="Type of task (query, research, analyze, write, etc.)")
    input_text: str = Field(..., min_length=1, description="Input text/query for the task")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    timeout_seconds: Optional[int] = Field(None, description="Override default timeout")
    stream: bool = Field(default=False, description="Stream response chunks")


class TaskResponse(BaseModel):
    """Response from task execution"""
    task_id: str
    agent_id: str
    status: str  # pending, running, completed, failed
    result: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class ChatRequest(BaseModel):
    """Chat with an agent"""
    agent_id: str = Field(..., description="ID of the agent to chat with")
    message: str = Field(..., min_length=1, description="User message")
    conversation_id: Optional[str] = Field(None, description="Continue existing conversation")
    system_prompt_override: Optional[str] = Field(None, description="Override agent's system prompt")


class ChatResponse(BaseModel):
    """Chat response from agent"""
    conversation_id: str
    agent_id: str
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class ModelInferenceRequest(BaseModel):
    """Direct model inference request"""
    prompt: str = Field(..., min_length=1)
    system_prompt: Optional[str] = None
    max_tokens: int = Field(default=1000, ge=1, le=4000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    tools: Optional[List[str]] = Field(None, description="Available tool names")
    context: Optional[Dict[str, Any]] = None


class ModelInferenceResponse(BaseModel):
    """Model inference response"""
    response: str
    model: str
    tokens_used: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskStatusResponse(BaseModel):
    """Status of a running task"""
    task_id: str
    agent_id: str
    status: str
    progress: Optional[float] = Field(None, ge=0.0, le=1.0)
    current_step: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    """List of tasks"""
    tasks: List[TaskStatusResponse]
    total: int
