"""
Chat endpoints for the multi-agent AI system.

Proxies requests to the ln-core service in ln-core-prod for:
- Chat conversations with AI agents
- Task execution
- Agent management
"""

from typing import Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, TenantID
from app.clients.ln_core_client import (
    get_ln_core_client,
    LNCoreClientError,
)
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()


# =============================================================================
# Request/Response Schemas
# =============================================================================

class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str = Field(min_length=1, max_length=10000, description="User message")
    agent_id: str | None = Field(default=None, description="Agent ID (uses default if not provided)")
    conversation_id: str | None = Field(default=None, description="Conversation ID to continue")
    system_prompt_override: str | None = Field(default=None, description="Optional system prompt override")
    temperature: float | None = Field(default=None, ge=0.0, le=2.0, description="Temperature (0-2)")
    max_tokens: int | None = Field(default=None, ge=1, le=8192, description="Max tokens for response")


class ChatResponse(BaseModel):
    """Chat response schema."""
    conversation_id: str = Field(description="Conversation ID")
    message_id: str = Field(description="Message ID")
    agent_id: str = Field(description="Agent that responded")
    message: str = Field(description="Agent's response message")
    tokens_used: int | None = Field(default=None, description="Tokens consumed")
    model_name: str | None = Field(default=None, description="Model used")
    confidence_score: float | None = Field(default=None, description="Response confidence (0-1)")
    reasoning_steps: list[str] | None = Field(default=None, description="Reasoning steps")
    sources: list[dict[str, Any]] | None = Field(default=None, description="Source citations")
    disclaimers: list[str] | None = Field(default=None, description="Required disclaimers")


class TaskRequest(BaseModel):
    """Task execution request schema."""
    agent_id: str = Field(description="Agent ID to execute the task")
    task_type: str = Field(description="Type of task (analysis, planning, research, etc.)")
    input_text: str = Field(min_length=1, max_length=20000, description="Task input/instructions")
    context: dict[str, Any] | None = Field(default=None, description="Additional context")


class TaskResponse(BaseModel):
    """Task execution response schema."""
    task_id: str = Field(description="Task ID")
    agent_id: str = Field(description="Agent that executed the task")
    status: str = Field(description="Task status (completed, failed, etc.)")
    result: str | None = Field(default=None, description="Task result")
    tokens_used: int | None = Field(default=None, description="Tokens consumed")
    duration_ms: float | None = Field(default=None, description="Execution time in milliseconds")
    error_message: str | None = Field(default=None, description="Error message if failed")


class AgentInfo(BaseModel):
    """Agent information schema."""
    id: str = Field(description="Agent ID")
    name: str = Field(description="Agent name")
    agent_type: str = Field(description="Agent type")
    description: str | None = Field(default=None, description="Agent description")
    is_active: bool = Field(description="Whether agent is active")


class ConversationInfo(BaseModel):
    """Conversation information schema."""
    id: str = Field(description="Conversation ID")
    agent_id: str = Field(description="Agent ID")
    title: str | None = Field(default=None, description="Conversation title")
    message_count: int = Field(description="Number of messages")
    last_message_at: str | None = Field(default=None, description="Last message timestamp")


class ServiceStatus(BaseModel):
    """Service status response."""
    available: bool = Field(description="Whether ln-core service is available")
    url: str | None = Field(default=None, description="Service URL (redacted)")
    status: str = Field(description="Service status")
    error: str | None = Field(default=None, description="Error message if unavailable")


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/status", response_model=ServiceStatus)
async def get_chat_service_status(
    current_user: CurrentUser,
):
    """
    Check if the AI chat service is available.

    Returns the status of the ln-core multi-agent system.
    """
    if not settings.LN_CORE_URL:
        return ServiceStatus(
            available=False,
            url=None,
            status="not_configured",
            error="LN_CORE_URL not configured",
        )

    try:
        client = get_ln_core_client()
        health = await client.health_check()

        return ServiceStatus(
            available=health.get("status") in ("healthy", "ok"),
            url="configured",  # Don't expose actual URL
            status=health.get("status", "unknown"),
            error=health.get("error"),
        )

    except Exception as e:
        logger.error("Chat service status check failed", error=str(e))
        return ServiceStatus(
            available=False,
            url="configured",
            status="error",
            error=str(e),
        )


@router.post("/", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Send a message to the AI chat system.

    Routes the message to the ln-core multi-agent system for processing.
    If no agent_id is provided, uses the default agent for the user.
    """
    if not settings.LN_CORE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat service not configured",
        )

    logger.info(
        "Chat request received",
        user_id=str(current_user.id),
        agent_id=request.agent_id,
        conversation_id=request.conversation_id,
        message_length=len(request.message),
    )

    try:
        client = get_ln_core_client()

        # Use default agent if not specified
        agent_id = request.agent_id or "default"

        response = await client.chat(
            agent_id=agent_id,
            message=request.message,
            user_id=str(current_user.id),
            conversation_id=request.conversation_id,
            system_prompt_override=request.system_prompt_override,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        logger.info(
            "Chat response received",
            user_id=str(current_user.id),
            conversation_id=response.get("conversation_id"),
            tokens_used=response.get("tokens_used"),
        )

        return ChatResponse(
            conversation_id=response.get("conversation_id", ""),
            message_id=response.get("message_id", ""),
            agent_id=response.get("agent_id", agent_id),
            message=response.get("message", ""),
            tokens_used=response.get("tokens_used"),
            model_name=response.get("model_name"),
            confidence_score=response.get("confidence_score"),
            reasoning_steps=response.get("reasoning_steps"),
            sources=response.get("sources"),
            disclaimers=response.get("disclaimers"),
        )

    except LNCoreClientError as e:
        logger.error(
            "Chat request failed",
            user_id=str(current_user.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI chat service error: {e}",
        )
    except Exception as e:
        logger.error(
            "Unexpected chat error",
            user_id=str(current_user.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


@router.post("/tasks", response_model=TaskResponse)
async def execute_task(
    request: TaskRequest,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Execute a task with an AI agent.

    Tasks are longer-running operations that may involve multiple steps,
    research, analysis, or planning.
    """
    if not settings.LN_CORE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI task service not configured",
        )

    logger.info(
        "Task request received",
        user_id=str(current_user.id),
        agent_id=request.agent_id,
        task_type=request.task_type,
    )

    try:
        client = get_ln_core_client()

        response = await client.execute_task(
            agent_id=request.agent_id,
            task_type=request.task_type,
            input_text=request.input_text,
            user_id=str(current_user.id),
            context=request.context,
        )

        return TaskResponse(
            task_id=response.get("id", ""),
            agent_id=response.get("agent_id", request.agent_id),
            status=response.get("status", "unknown"),
            result=response.get("result"),
            tokens_used=response.get("tokens_used"),
            duration_ms=response.get("duration_ms"),
            error_message=response.get("error_message"),
        )

    except LNCoreClientError as e:
        logger.error(
            "Task execution failed",
            user_id=str(current_user.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI task service error: {e}",
        )


@router.get("/agents", response_model=list[AgentInfo])
async def list_agents(
    current_user: CurrentUser,
):
    """
    List available AI agents for the current user.

    Returns the agents that the user can chat with or assign tasks to.
    """
    if not settings.LN_CORE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI agent service not configured",
        )

    try:
        client = get_ln_core_client()
        agents = await client.list_agents(str(current_user.id))

        return [
            AgentInfo(
                id=agent.get("id", ""),
                name=agent.get("name", "Unknown"),
                agent_type=agent.get("agent_type", "general"),
                description=agent.get("description"),
                is_active=agent.get("is_active", True),
            )
            for agent in agents
        ]

    except LNCoreClientError as e:
        logger.error("List agents failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI agent service error: {e}",
        )


@router.get("/conversations", response_model=list[ConversationInfo])
async def list_conversations(
    agent_id: str | None = None,
    skip: int = 0,
    limit: int = 20,
    current_user: CurrentUser = None,
):
    """
    List chat conversations for the current user.

    Optionally filter by agent_id.
    """
    if not settings.LN_CORE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat service not configured",
        )

    if not agent_id:
        # For now, require agent_id - could be enhanced to list all
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="agent_id is required",
        )

    try:
        client = get_ln_core_client()
        conversations = await client.get_conversations(
            agent_id=agent_id,
            user_id=str(current_user.id),
            skip=skip,
            limit=limit,
        )

        return [
            ConversationInfo(
                id=conv.get("id", ""),
                agent_id=conv.get("agent_id", agent_id),
                title=conv.get("title"),
                message_count=conv.get("message_count", 0),
                last_message_at=conv.get("last_message_at"),
            )
            for conv in conversations
        ]

    except LNCoreClientError as e:
        logger.error("List conversations failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI chat service error: {e}",
        )
