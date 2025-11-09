"""
Agent endpoints - AI agent management, task execution, and chat
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.agent import (
    Agent,
    AgentTask,
    Conversation,
    ConversationMessage,
    AgentState,
    TaskStatus,
)
from app.schemas.agent import *
from app.services.maverick_client import get_maverick_client, MaverickClient

router = APIRouter()


# Agent CRUD Operations
@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    skip: int = 0,
    limit: int = 20,
    agent_type: Optional[AgentType] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agents for the current user"""
    query = select(Agent).where(Agent.user_id == current_user.id)

    if agent_type:
        query = query.where(Agent.agent_type == agent_type)
    if is_active is not None:
        query = query.where(Agent.is_active == is_active)

    query = query.offset(skip).limit(limit).order_by(Agent.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent"""
    agent = Agent(
        **agent_data.model_dump(), user_id=current_user.id, tenant_id=current_user.tenant_id
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get agent by ID"""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update agent configuration"""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Update fields
    for key, value in agent_data.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)

    agent.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete agent"""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.delete(agent)
    await db.commit()


# Task Execution
@router.post(
    "/{agent_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_task(
    agent_id: str,
    task_data: TaskExecute,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    maverick: MaverickClient = Depends(get_maverick_client),
):
    """Execute a task with the specified agent"""
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agent is not active")

    # Create task record
    task = AgentTask(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        agent_id=agent.id,
        task_type=task_data.task_type,
        input_text=task_data.input_text,
        context=task_data.context,
        status=TaskStatus.RUNNING,
        started_at=datetime.utcnow(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Execute with Maverick
    try:
        start_time = datetime.utcnow()

        # Build prompt
        prompt = f"{agent.system_prompt or 'You are a helpful AI assistant.'}\n\nTask: {task_data.input_text}"

        # Call Maverick
        response = await maverick.completion(
            prompt=prompt, n_predict=agent.max_tokens, temperature=agent.temperature
        )

        # Calculate duration
        duration = (datetime.utcnow() - start_time).total_seconds() * 1000

        # Update task with result
        task.status = TaskStatus.COMPLETED
        task.result = response.get("content", "").strip()
        task.tokens_used = response.get("tokens_predicted", 0)
        task.duration_ms = duration
        task.completed_at = datetime.utcnow()

        # Update agent state
        agent.current_state = AgentState.COMPLETED
        agent.last_active_at = datetime.utcnow()

        await db.commit()
        await db.refresh(task)
        return task

    except Exception as e:
        # Mark task as failed
        task.status = TaskStatus.FAILED
        task.error_message = str(e)
        task.completed_at = datetime.utcnow()
        agent.current_state = AgentState.ERROR
        await db.commit()
        await db.refresh(task)
        raise HTTPException(status_code=500, detail=f"Task execution failed: {str(e)}")


@router.get("/{agent_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    agent_id: str,
    skip: int = 0,
    limit: int = 20,
    status_filter: Optional[TaskStatus] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tasks for an agent"""
    query = select(AgentTask).where(
        AgentTask.agent_id == agent_id, AgentTask.user_id == current_user.id
    )

    if status_filter:
        query = query.where(AgentTask.status == status_filter)

    query = query.offset(skip).limit(limit).order_by(AgentTask.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{agent_id}/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    agent_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get task by ID"""
    result = await db.execute(
        select(AgentTask).where(
            AgentTask.id == task_id,
            AgentTask.agent_id == agent_id,
            AgentTask.user_id == current_user.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# Chat & Conversations
@router.post("/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: str,
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    maverick: MaverickClient = Depends(get_maverick_client),
):
    """Chat with an agent using Maverick LLM"""
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agent is not active")

    # Get or create conversation
    conversation = None
    if chat_request.conversation_id:
        result = await db.execute(
            select(Conversation)
            .where(
                Conversation.id == chat_request.conversation_id,
                Conversation.user_id == current_user.id,
                Conversation.agent_id == agent.id,
            )
            .options(selectinload(Conversation.messages))
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new conversation
        conversation = Conversation(
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            agent_id=agent.id,
            title=(
                chat_request.message[:100]
                if len(chat_request.message) > 100
                else chat_request.message
            ),
        )
        db.add(conversation)
        await db.flush()

    # Add user message to conversation
    user_message = ConversationMessage(
        conversation_id=conversation.id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        role="user",
        content=chat_request.message,
    )
    db.add(user_message)
    await db.flush()

    # Build message history for context
    messages = []
    for msg in conversation.messages[-10:]:  # Last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})

    # Add current message
    messages.append({"role": "user", "content": chat_request.message})

    # Call Maverick with chat
    try:
        system_prompt = (
            chat_request.system_prompt_override
            or agent.system_prompt
            or "You are a helpful AI assistant."
        )
        temperature = (
            chat_request.temperature
            if chat_request.temperature is not None
            else agent.temperature
        )
        max_tokens = (
            chat_request.max_tokens
            if chat_request.max_tokens is not None
            else agent.max_tokens
        )

        response = await maverick.chat(
            messages=messages,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Save assistant response
        assistant_message = ConversationMessage(
            conversation_id=conversation.id,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            role="assistant",
            content=response.get("content", ""),
            tokens_used=response.get("tokens_predicted", 0),
            model_name=agent.model_name,
        )
        db.add(assistant_message)

        # Update conversation stats
        conversation.message_count += 2  # User + assistant
        conversation.total_tokens += response.get("tokens_predicted", 0)
        conversation.last_message_at = datetime.utcnow()
        conversation.updated_at = datetime.utcnow()

        # Update agent state
        agent.current_state = AgentState.COMPLETED
        agent.last_active_at = datetime.utcnow()

        await db.commit()
        await db.refresh(assistant_message)

        return ChatResponse(
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            agent_id=agent.id,
            message=response.get("content", ""),
            tokens_used=response.get("tokens_predicted", 0),
            model_name=agent.model_name,
            confidence_score=None,
            reasoning_steps=None,
            timestamp=assistant_message.created_at,
        )

    except Exception as e:
        agent.current_state = AgentState.ERROR
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/{agent_id}/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    agent_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List conversations for an agent"""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.agent_id == agent_id, Conversation.user_id == current_user.id
        )
        .options(selectinload(Conversation.messages))
        .offset(skip)
        .limit(limit)
        .order_by(Conversation.last_message_at.desc())
    )
    return result.scalars().all()


@router.get(
    "/{agent_id}/conversations/{conversation_id}", response_model=ConversationResponse
)
async def get_conversation(
    agent_id: str,
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get conversation with full message history"""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.agent_id == agent_id,
            Conversation.user_id == current_user.id,
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


# Metrics & Stats
@router.get("/{agent_id}/metrics", response_model=AgentMetrics)
async def get_agent_metrics(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get performance metrics for an agent"""
    # Get agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Calculate metrics
    total_tasks_result = await db.execute(
        select(func.count(AgentTask.id)).where(AgentTask.agent_id == agent.id)
    )
    total_tasks = total_tasks_result.scalar() or 0

    successful_tasks_result = await db.execute(
        select(func.count(AgentTask.id)).where(
            AgentTask.agent_id == agent.id, AgentTask.status == TaskStatus.COMPLETED
        )
    )
    successful_tasks = successful_tasks_result.scalar() or 0

    failed_tasks_result = await db.execute(
        select(func.count(AgentTask.id)).where(
            AgentTask.agent_id == agent.id, AgentTask.status == TaskStatus.FAILED
        )
    )
    failed_tasks = failed_tasks_result.scalar() or 0

    avg_duration_result = await db.execute(
        select(func.avg(AgentTask.duration_ms)).where(
            AgentTask.agent_id == agent.id, AgentTask.status == TaskStatus.COMPLETED
        )
    )
    avg_duration = avg_duration_result.scalar() or 0.0

    avg_tokens_result = await db.execute(
        select(func.avg(AgentTask.tokens_used)).where(
            AgentTask.agent_id == agent.id, AgentTask.status == TaskStatus.COMPLETED
        )
    )
    avg_tokens = avg_tokens_result.scalar() or 0.0

    total_tokens_result = await db.execute(
        select(func.sum(AgentTask.tokens_used)).where(AgentTask.agent_id == agent.id)
    )
    total_tokens = total_tokens_result.scalar() or 0

    active_conversations_result = await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.agent_id == agent.id, Conversation.is_active is True
        )
    )
    active_conversations = active_conversations_result.scalar() or 0

    # Calculate uptime
    uptime_seconds = None
    if agent.created_at:
        uptime_seconds = (datetime.utcnow() - agent.created_at).total_seconds()

    return AgentMetrics(
        agent_id=agent.id,
        agent_name=agent.name,
        current_state=agent.current_state,
        is_active=agent.is_active,
        total_tasks=total_tasks,
        successful_tasks=successful_tasks,
        failed_tasks=failed_tasks,
        average_duration_ms=float(avg_duration),
        average_tokens=float(avg_tokens),
        total_tokens=total_tokens,
        active_conversations=active_conversations,
        uptime_seconds=uptime_seconds,
        last_active_at=agent.last_active_at,
    )


@router.get("/stats/aggregate", response_model=AgentStats)
async def get_aggregate_stats(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get aggregate statistics across all user's agents"""
    # Total agents
    total_agents_result = await db.execute(
        select(func.count(Agent.id)).where(Agent.user_id == current_user.id)
    )
    total_agents = total_agents_result.scalar() or 0

    # Active agents
    active_agents_result = await db.execute(
        select(func.count(Agent.id)).where(
            Agent.user_id == current_user.id, Agent.is_active is True
        )
    )
    active_agents = active_agents_result.scalar() or 0

    # Tasks today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tasks_today_result = await db.execute(
        select(func.count(AgentTask.id)).where(
            AgentTask.user_id == current_user.id, AgentTask.created_at >= today_start
        )
    )
    tasks_today = tasks_today_result.scalar() or 0

    # Total conversations
    total_conversations_result = await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.user_id == current_user.id
        )
    )
    total_conversations = total_conversations_result.scalar() or 0

    # Messages today
    messages_today_result = await db.execute(
        select(func.count(ConversationMessage.id)).where(
            ConversationMessage.user_id == current_user.id,
            ConversationMessage.created_at >= today_start,
        )
    )
    messages_today = messages_today_result.scalar() or 0

    # Average response time
    avg_response_result = await db.execute(
        select(func.avg(AgentTask.duration_ms)).where(
            AgentTask.user_id == current_user.id,
            AgentTask.status == TaskStatus.COMPLETED,
        )
    )
    avg_response = avg_response_result.scalar() or 0.0

    # Tokens today
    tokens_today_result = await db.execute(
        select(func.sum(AgentTask.tokens_used)).where(
            AgentTask.user_id == current_user.id, AgentTask.created_at >= today_start
        )
    )
    tokens_today = tokens_today_result.scalar() or 0

    return AgentStats(
        total_agents=total_agents,
        active_agents=active_agents,
        total_tasks_today=tasks_today,
        total_conversations=total_conversations,
        total_messages_today=messages_today,
        average_response_time_ms=float(avg_response),
        total_tokens_today=tokens_today,
    )
