"""Pydantic models for agent state, configuration, and lifecycle management.

This module provides type-safe data models for the multi-agent system:
- Agent state management and lifecycle
- Agent configuration and metadata
- Task execution tracking
- Performance metrics

Example usage:
    >>> from models.agent_models import AgentConfig, AgentState
    >>> config = AgentConfig(
    ...     agent_id="budget-001",
    ...     agent_type=AgentType.SPECIALIST,
    ...     capabilities=["budget_analysis", "expense_tracking"]
    ... )
    >>> state = AgentState.IDLE
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class AgentType(str, Enum):
    """Agent types in the hierarchical system.

    Attributes:
        ORCHESTRATOR: L0 - Strategic planning and task decomposition.
        DOMAIN_MANAGER: L1 - Domain-specific coordination (Finance, Career, etc.).
        SPECIALIST: L2 - Specialized task execution.
        TOOL_USER: L3 - External API integration.
    """

    ORCHESTRATOR = "orchestrator"
    DOMAIN_MANAGER = "domain_manager"
    SPECIALIST = "specialist"
    TOOL_USER = "tool_user"


class AgentState(str, Enum):
    """Agent lifecycle states.

    Attributes:
        IDLE: Waiting for tasks.
        PROCESSING: Actively working on a task.
        COMPLETED: Task finished successfully.
        ERROR: Task failed with an error.
        SHUTDOWN: Agent is terminating.
    """

    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    SHUTDOWN = "shutdown"


class TaskPriority(str, Enum):
    """Task priority levels.

    Attributes:
        LOW: Non-urgent tasks.
        NORMAL: Standard priority.
        HIGH: Important tasks requiring faster execution.
        CRITICAL: Urgent tasks requiring immediate attention.
    """

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    """Task execution status.

    Attributes:
        PENDING: Task queued, not started.
        IN_PROGRESS: Task currently executing.
        COMPLETED: Task finished successfully.
        FAILED: Task execution failed.
        CANCELLED: Task was cancelled before completion.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentCapability(BaseModel):
    """Agent capability definition.

    Describes a specific capability an agent possesses.

    Attributes:
        name: Capability identifier (e.g., "budget_analysis").
        description: Human-readable description.
        parameters: Optional parameter schema.
        confidence: Agent's confidence in this capability (0.0-1.0).
    """

    name: str = Field(..., description="Capability identifier", min_length=1)
    description: str = Field(..., description="Capability description")
    parameters: dict[str, Any] = Field(
        default_factory=dict, description="Parameter schema"
    )
    confidence: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Confidence score"
    )

    @field_validator("name")
    @classmethod
    def validate_capability_name(cls, v: str) -> str:
        """Validate capability name format."""
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError(
                f"Capability name must be alphanumeric with underscores/hyphens: {v}"
            )
        return v.lower()


class AgentConfig(BaseModel):
    """Agent configuration and metadata.

    Complete configuration for an agent instance.

    Attributes:
        agent_id: Unique agent identifier.
        agent_type: Agent type (L0, L1, L2, L3).
        name: Human-readable agent name.
        description: Agent purpose and responsibilities.
        capabilities: List of agent capabilities.
        max_concurrent_tasks: Maximum tasks to process simultaneously.
        timeout_seconds: Default task timeout.
        retry_attempts: Number of retry attempts for failed tasks.
        metadata: Additional agent-specific metadata.
    """

    agent_id: str = Field(..., description="Unique agent ID", min_length=1)
    agent_type: AgentType = Field(..., description="Agent type in hierarchy")
    name: str = Field(..., description="Agent name", min_length=1)
    description: str = Field(default="", description="Agent description")
    capabilities: list[AgentCapability] = Field(
        default_factory=list, description="Agent capabilities"
    )
    max_concurrent_tasks: int = Field(
        default=10, ge=1, le=100, description="Max concurrent tasks"
    )
    timeout_seconds: int = Field(
        default=300, ge=1, le=3600, description="Default task timeout in seconds"
    )
    retry_attempts: int = Field(
        default=3, ge=0, le=10, description="Retry attempts for failed tasks"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @field_validator("agent_id")
    @classmethod
    def validate_agent_id(cls, v: str) -> str:
        """Validate agent ID format."""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                f"Agent ID must be alphanumeric with underscores/hyphens: {v}"
            )
        return v.lower()


class TaskMetadata(BaseModel):
    """Task execution metadata and tracking.

    Attributes:
        task_id: Unique task identifier.
        parent_task_id: Parent task ID (for subtasks).
        user_id: User who initiated the task.
        correlation_id: Request correlation ID for tracing.
        priority: Task priority level.
        status: Current task status.
        created_at: Task creation timestamp.
        started_at: Task start timestamp.
        completed_at: Task completion timestamp.
        error: Error message if task failed.
        metadata: Additional task-specific data.
    """

    task_id: UUID = Field(default_factory=uuid4, description="Unique task ID")
    parent_task_id: UUID | None = Field(
        default=None, description="Parent task ID for subtasks"
    )
    user_id: str = Field(..., description="User ID", min_length=1)
    correlation_id: str = Field(..., description="Correlation ID", min_length=1)
    priority: TaskPriority = Field(
        default=TaskPriority.NORMAL, description="Task priority"
    )
    status: TaskStatus = Field(default=TaskStatus.PENDING, description="Task status")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Creation timestamp",
    )
    started_at: datetime | None = Field(
        default=None, description="Start timestamp (when processing began)"
    )
    completed_at: datetime | None = Field(
        default=None, description="Completion timestamp"
    )
    error: str | None = Field(default=None, description="Error message if failed")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional task data"
    )

    @property
    def duration_ms(self) -> float | None:
        """Calculate task duration in milliseconds.

        Returns:
            Duration in milliseconds, or None if not yet completed.
        """
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return delta.total_seconds() * 1000
        return None

    @property
    def is_complete(self) -> bool:
        """Check if task is in a terminal state.

        Returns:
            True if task is completed, failed, or cancelled.
        """
        return self.status in (
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
        )


class AgentTask(BaseModel):
    """Agent task definition.

    Complete task specification for agent execution.

    Attributes:
        metadata: Task metadata and tracking.
        task_type: Task type identifier.
        payload: Task-specific input data.
        context: Additional context for task execution.
        assigned_agent_id: Agent currently assigned to this task.
        subtasks: Child tasks spawned from this task.
    """

    metadata: TaskMetadata = Field(..., description="Task metadata")
    task_type: str = Field(..., description="Task type identifier", min_length=1)
    payload: dict[str, Any] = Field(..., description="Task input data")
    context: dict[str, Any] = Field(
        default_factory=dict, description="Execution context"
    )
    assigned_agent_id: str | None = Field(default=None, description="Assigned agent ID")
    subtasks: list[UUID] = Field(
        default_factory=list, description="Subtask IDs spawned from this task"
    )

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        """Validate task type format."""
        if not v.replace("_", "").replace(".", "").isalnum():
            raise ValueError(
                f"Task type must be alphanumeric with underscores/periods: {v}"
            )
        return v.lower()


class AgentMetrics(BaseModel):
    """Agent performance metrics.

    Tracks agent performance over time.

    Attributes:
        agent_id: Agent identifier.
        total_tasks_processed: Total tasks completed.
        successful_tasks: Successfully completed tasks.
        failed_tasks: Failed tasks.
        average_duration_ms: Average task duration in milliseconds.
        current_state: Current agent state.
        active_tasks: Number of currently active tasks.
        uptime_seconds: Agent uptime in seconds.
        last_activity: Timestamp of last activity.
        metadata: Additional metrics data.
    """

    agent_id: str = Field(..., description="Agent ID", min_length=1)
    total_tasks_processed: int = Field(default=0, ge=0, description="Total tasks")
    successful_tasks: int = Field(default=0, ge=0, description="Successful tasks")
    failed_tasks: int = Field(default=0, ge=0, description="Failed tasks")
    average_duration_ms: float = Field(
        default=0.0, ge=0.0, description="Average task duration"
    )
    current_state: AgentState = Field(
        default=AgentState.IDLE, description="Current agent state"
    )
    active_tasks: int = Field(default=0, ge=0, description="Active task count")
    uptime_seconds: float = Field(default=0.0, ge=0.0, description="Agent uptime")
    last_activity: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Last activity timestamp",
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Extra metrics")

    @property
    def success_rate(self) -> float:
        """Calculate task success rate.

        Returns:
            Success rate as a percentage (0.0-100.0).
        """
        if self.total_tasks_processed == 0:
            return 0.0
        return (self.successful_tasks / self.total_tasks_processed) * 100

    @property
    def failure_rate(self) -> float:
        """Calculate task failure rate.

        Returns:
            Failure rate as a percentage (0.0-100.0).
        """
        if self.total_tasks_processed == 0:
            return 0.0
        return (self.failed_tasks / self.total_tasks_processed) * 100


class AgentStateTransition(BaseModel):
    """Agent state transition record.

    Records state changes for audit and debugging.

    Attributes:
        agent_id: Agent identifier.
        from_state: Previous state.
        to_state: New state.
        timestamp: Transition timestamp.
        trigger: What triggered the transition.
        metadata: Additional transition data.
    """

    agent_id: str = Field(..., description="Agent ID", min_length=1)
    from_state: AgentState = Field(..., description="Previous state")
    to_state: AgentState = Field(..., description="New state")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Transition timestamp",
    )
    trigger: str = Field(..., description="Transition trigger", min_length=1)
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Transition metadata"
    )


class AgentHealthStatus(BaseModel):
    """Agent health check status.

    Current health status of an agent.

    Attributes:
        agent_id: Agent identifier.
        is_healthy: Overall health status.
        state: Current agent state.
        active_tasks: Number of active tasks.
        last_heartbeat: Last heartbeat timestamp.
        errors: Recent error messages.
        warnings: Recent warning messages.
        checks: Individual health check results.
    """

    agent_id: str = Field(..., description="Agent ID", min_length=1)
    is_healthy: bool = Field(default=True, description="Overall health")
    state: AgentState = Field(..., description="Current state")
    active_tasks: int = Field(default=0, ge=0, description="Active tasks")
    last_heartbeat: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Last heartbeat",
    )
    errors: list[str] = Field(default_factory=list, description="Recent errors")
    warnings: list[str] = Field(default_factory=list, description="Recent warnings")
    checks: dict[str, bool] = Field(
        default_factory=dict, description="Health check results"
    )

    @property
    def has_errors(self) -> bool:
        """Check if agent has any errors.

        Returns:
            True if errors list is not empty.
        """
        return len(self.errors) > 0

    @property
    def has_warnings(self) -> bool:
        """Check if agent has any warnings.

        Returns:
            True if warnings list is not empty.
        """
        return len(self.warnings) > 0
