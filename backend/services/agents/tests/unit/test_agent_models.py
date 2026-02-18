"""Unit tests for agent models and data structures.

Tests cover:
- Enum value validation
- Pydantic model validation
- Field constraints and defaults
- Computed properties
- State transitions
- Capability definitions
- Task lifecycle
- Metrics calculations
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from models.agent_models import (
    AgentCapability,
    AgentConfig,
    AgentHealthStatus,
    AgentMetrics,
    AgentState,
    AgentStateTransition,
    AgentTask,
    AgentType,
    TaskMetadata,
    TaskPriority,
    TaskStatus,
)


class TestEnums:
    """Tests for enum definitions."""

    def test_agent_type_values(self):
        """Test AgentType enum values."""
        assert AgentType.ORCHESTRATOR == "orchestrator"
        assert AgentType.DOMAIN_MANAGER == "domain_manager"
        assert AgentType.SPECIALIST == "specialist"
        assert AgentType.TOOL_USER == "tool_user"

    def test_agent_state_values(self):
        """Test AgentState enum values."""
        assert AgentState.IDLE == "idle"
        assert AgentState.PROCESSING == "processing"
        assert AgentState.COMPLETED == "completed"
        assert AgentState.ERROR == "error"
        assert AgentState.SHUTDOWN == "shutdown"

    def test_task_priority_values(self):
        """Test TaskPriority enum values."""
        assert TaskPriority.LOW == "low"
        assert TaskPriority.NORMAL == "normal"
        assert TaskPriority.HIGH == "high"
        assert TaskPriority.CRITICAL == "critical"

    def test_task_status_values(self):
        """Test TaskStatus enum values."""
        assert TaskStatus.PENDING == "pending"
        assert TaskStatus.IN_PROGRESS == "in_progress"
        assert TaskStatus.COMPLETED == "completed"
        assert TaskStatus.FAILED == "failed"
        assert TaskStatus.CANCELLED == "cancelled"


class TestAgentCapability:
    """Tests for AgentCapability model."""

    def test_basic_capability(self):
        """Test basic capability creation."""
        cap = AgentCapability(name="budget_analysis", description="Analyze budgets")

        assert cap.name == "budget_analysis"
        assert cap.description == "Analyze budgets"
        assert cap.parameters == {}
        assert cap.confidence == 1.0

    def test_capability_with_parameters(self):
        """Test capability with parameters."""
        params = {"min_amount": 0, "max_amount": 10000}
        cap = AgentCapability(
            name="expense_tracking", description="Track expenses", parameters=params
        )

        assert cap.parameters == params

    def test_capability_with_confidence(self):
        """Test capability with custom confidence."""
        cap = AgentCapability(
            name="tax_calculation", description="Calculate taxes", confidence=0.85
        )

        assert cap.confidence == 0.85

    def test_capability_name_normalization(self):
        """Test capability name is normalized to lowercase."""
        cap = AgentCapability(name="Budget_Analysis", description="Test")

        assert cap.name == "budget_analysis"

    def test_invalid_capability_name(self):
        """Test invalid capability name validation."""
        with pytest.raises(ValidationError):
            AgentCapability(name="budget analysis!", description="Test")

    def test_confidence_bounds(self):
        """Test confidence score bounds."""
        # Valid bounds
        AgentCapability(name="test", description="Test", confidence=0.0)
        AgentCapability(name="test", description="Test", confidence=1.0)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentCapability(name="test", description="Test", confidence=-0.1)

        with pytest.raises(ValidationError):
            AgentCapability(name="test", description="Test", confidence=1.1)


class TestAgentConfig:
    """Tests for AgentConfig model."""

    def test_minimal_config(self):
        """Test minimal agent configuration."""
        config = AgentConfig(
            agent_id="test-001", agent_type=AgentType.SPECIALIST, name="Test Agent"
        )

        assert config.agent_id == "test-001"
        assert config.agent_type == AgentType.SPECIALIST
        assert config.name == "Test Agent"
        assert config.description == ""
        assert config.capabilities == []
        assert config.max_concurrent_tasks == 10
        assert config.timeout_seconds == 300
        assert config.retry_attempts == 3
        assert config.metadata == {}

    def test_full_config(self):
        """Test full agent configuration."""
        cap1 = AgentCapability(name="budget", description="Budget analysis")
        cap2 = AgentCapability(name="forecast", description="Forecasting")

        config = AgentConfig(
            agent_id="budget-specialist-001",
            agent_type=AgentType.SPECIALIST,
            name="Budget Specialist",
            description="Analyzes budgets and forecasts",
            capabilities=[cap1, cap2],
            max_concurrent_tasks=5,
            timeout_seconds=600,
            retry_attempts=5,
            metadata={"version": "1.0", "team": "finance"},
        )

        assert config.agent_id == "budget-specialist-001"
        assert len(config.capabilities) == 2
        assert config.max_concurrent_tasks == 5
        assert config.timeout_seconds == 600
        assert config.retry_attempts == 5
        assert config.metadata["version"] == "1.0"

    def test_agent_id_normalization(self):
        """Test agent ID is normalized to lowercase."""
        config = AgentConfig(
            agent_id="Budget-Specialist-001",
            agent_type=AgentType.SPECIALIST,
            name="Test",
        )

        assert config.agent_id == "budget-specialist-001"

    def test_invalid_agent_id(self):
        """Test invalid agent ID validation."""
        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="budget specialist!",
                agent_type=AgentType.SPECIALIST,
                name="Test",
            )

    def test_max_concurrent_tasks_bounds(self):
        """Test max_concurrent_tasks bounds."""
        # Valid
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            max_concurrent_tasks=1,
        )
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            max_concurrent_tasks=100,
        )

        # Invalid
        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                max_concurrent_tasks=0,
            )

        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                max_concurrent_tasks=101,
            )

    def test_timeout_bounds(self):
        """Test timeout_seconds bounds."""
        # Valid
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            timeout_seconds=1,
        )
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            timeout_seconds=3600,
        )

        # Invalid
        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                timeout_seconds=0,
            )

        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                timeout_seconds=3601,
            )

    def test_retry_attempts_bounds(self):
        """Test retry_attempts bounds."""
        # Valid
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            retry_attempts=0,
        )
        AgentConfig(
            agent_id="test",
            agent_type=AgentType.SPECIALIST,
            name="Test",
            retry_attempts=10,
        )

        # Invalid
        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                retry_attempts=-1,
            )

        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="test",
                agent_type=AgentType.SPECIALIST,
                name="Test",
                retry_attempts=11,
            )


class TestTaskMetadata:
    """Tests for TaskMetadata model."""

    def test_default_task_metadata(self):
        """Test task metadata with defaults."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")

        assert isinstance(metadata.task_id, UUID)
        assert metadata.parent_task_id is None
        assert metadata.user_id == "user-123"
        assert metadata.correlation_id == "corr-456"
        assert metadata.priority == TaskPriority.NORMAL
        assert metadata.status == TaskStatus.PENDING
        assert isinstance(metadata.created_at, datetime)
        assert metadata.started_at is None
        assert metadata.completed_at is None
        assert metadata.error is None
        assert metadata.metadata == {}

    def test_task_metadata_with_parent(self):
        """Test task metadata with parent task."""
        parent_id = uuid4()
        metadata = TaskMetadata(
            user_id="user-123", correlation_id="corr-456", parent_task_id=parent_id
        )

        assert metadata.parent_task_id == parent_id

    def test_task_metadata_timestamps(self):
        """Test task metadata with all timestamps."""
        now = datetime.now(timezone.utc)
        started = now + timedelta(seconds=1)
        completed = now + timedelta(seconds=5)

        metadata = TaskMetadata(
            user_id="user-123",
            correlation_id="corr-456",
            created_at=now,
            started_at=started,
            completed_at=completed,
        )

        assert metadata.created_at == now
        assert metadata.started_at == started
        assert metadata.completed_at == completed

    def test_duration_calculation(self):
        """Test duration_ms property."""
        now = datetime.now(timezone.utc)
        started = now
        completed = now + timedelta(milliseconds=1500)

        metadata = TaskMetadata(
            user_id="user-123",
            correlation_id="corr-456",
            started_at=started,
            completed_at=completed,
        )

        assert metadata.duration_ms is not None
        assert 1400 < metadata.duration_ms < 1600  # Allow some variance

    def test_duration_none_when_incomplete(self):
        """Test duration_ms is None when task not complete."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")

        assert metadata.duration_ms is None

    def test_is_complete_property(self):
        """Test is_complete property."""
        # Pending task
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        assert not metadata.is_complete

        # Completed task
        metadata.status = TaskStatus.COMPLETED
        assert metadata.is_complete

        # Failed task
        metadata.status = TaskStatus.FAILED
        assert metadata.is_complete

        # Cancelled task
        metadata.status = TaskStatus.CANCELLED
        assert metadata.is_complete

        # In progress task
        metadata.status = TaskStatus.IN_PROGRESS
        assert not metadata.is_complete


class TestAgentTask:
    """Tests for AgentTask model."""

    def test_basic_task(self):
        """Test basic agent task."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        task = AgentTask(
            metadata=metadata,
            task_type="budget.analyze",
            payload={"account_id": "acc-789"},
        )

        assert task.metadata == metadata
        assert task.task_type == "budget.analyze"
        assert task.payload == {"account_id": "acc-789"}
        assert task.context == {}
        assert task.assigned_agent_id is None
        assert task.subtasks == []

    def test_task_with_context(self):
        """Test task with execution context."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        context = {"previous_analysis": "data", "user_preferences": {}}
        task = AgentTask(
            metadata=metadata,
            task_type="budget.analyze",
            payload={},
            context=context,
        )

        assert task.context == context

    def test_task_with_assignment(self):
        """Test task with assigned agent."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        task = AgentTask(
            metadata=metadata,
            task_type="budget.analyze",
            payload={},
            assigned_agent_id="budget-specialist-001",
        )

        assert task.assigned_agent_id == "budget-specialist-001"

    def test_task_with_subtasks(self):
        """Test task with subtasks."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        subtask_ids = [uuid4(), uuid4(), uuid4()]
        task = AgentTask(
            metadata=metadata,
            task_type="budget.analyze",
            payload={},
            subtasks=subtask_ids,
        )

        assert len(task.subtasks) == 3
        assert task.subtasks == subtask_ids

    def test_task_type_normalization(self):
        """Test task type normalization."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")
        task = AgentTask(metadata=metadata, task_type="Budget.Analyze", payload={})

        assert task.task_type == "budget.analyze"

    def test_invalid_task_type(self):
        """Test invalid task type validation."""
        metadata = TaskMetadata(user_id="user-123", correlation_id="corr-456")

        with pytest.raises(ValidationError):
            AgentTask(metadata=metadata, task_type="budget analyze!", payload={})


class TestAgentMetrics:
    """Tests for AgentMetrics model."""

    def test_default_metrics(self):
        """Test default agent metrics."""
        metrics = AgentMetrics(agent_id="test-001")

        assert metrics.agent_id == "test-001"
        assert metrics.total_tasks_processed == 0
        assert metrics.successful_tasks == 0
        assert metrics.failed_tasks == 0
        assert metrics.average_duration_ms == 0.0
        assert metrics.current_state == AgentState.IDLE
        assert metrics.active_tasks == 0
        assert metrics.uptime_seconds == 0.0
        assert isinstance(metrics.last_activity, datetime)
        assert metrics.metadata == {}

    def test_metrics_with_values(self):
        """Test metrics with custom values."""
        now = datetime.now(timezone.utc)
        metrics = AgentMetrics(
            agent_id="test-001",
            total_tasks_processed=100,
            successful_tasks=95,
            failed_tasks=5,
            average_duration_ms=250.5,
            current_state=AgentState.PROCESSING,
            active_tasks=3,
            uptime_seconds=3600.0,
            last_activity=now,
        )

        assert metrics.total_tasks_processed == 100
        assert metrics.successful_tasks == 95
        assert metrics.failed_tasks == 5
        assert metrics.average_duration_ms == 250.5
        assert metrics.current_state == AgentState.PROCESSING
        assert metrics.active_tasks == 3
        assert metrics.uptime_seconds == 3600.0
        assert metrics.last_activity == now

    def test_success_rate_calculation(self):
        """Test success_rate property."""
        metrics = AgentMetrics(
            agent_id="test-001", total_tasks_processed=100, successful_tasks=85
        )

        assert metrics.success_rate == 85.0

    def test_success_rate_zero_tasks(self):
        """Test success_rate with zero tasks."""
        metrics = AgentMetrics(agent_id="test-001")

        assert metrics.success_rate == 0.0

    def test_failure_rate_calculation(self):
        """Test failure_rate property."""
        metrics = AgentMetrics(
            agent_id="test-001", total_tasks_processed=100, failed_tasks=15
        )

        assert metrics.failure_rate == 15.0

    def test_failure_rate_zero_tasks(self):
        """Test failure_rate with zero tasks."""
        metrics = AgentMetrics(agent_id="test-001")

        assert metrics.failure_rate == 0.0


class TestAgentStateTransition:
    """Tests for AgentStateTransition model."""

    def test_basic_transition(self):
        """Test basic state transition."""
        transition = AgentStateTransition(
            agent_id="test-001",
            from_state=AgentState.IDLE,
            to_state=AgentState.PROCESSING,
            trigger="task_received",
        )

        assert transition.agent_id == "test-001"
        assert transition.from_state == AgentState.IDLE
        assert transition.to_state == AgentState.PROCESSING
        assert transition.trigger == "task_received"
        assert isinstance(transition.timestamp, datetime)
        assert transition.metadata == {}

    def test_transition_with_metadata(self):
        """Test transition with metadata."""
        metadata = {"task_id": "task-123", "priority": "high"}
        transition = AgentStateTransition(
            agent_id="test-001",
            from_state=AgentState.IDLE,
            to_state=AgentState.PROCESSING,
            trigger="task_received",
            metadata=metadata,
        )

        assert transition.metadata == metadata

    def test_error_transition(self):
        """Test error state transition."""
        transition = AgentStateTransition(
            agent_id="test-001",
            from_state=AgentState.PROCESSING,
            to_state=AgentState.ERROR,
            trigger="task_failed",
            metadata={"error": "Timeout exceeded"},
        )

        assert transition.from_state == AgentState.PROCESSING
        assert transition.to_state == AgentState.ERROR
        assert transition.trigger == "task_failed"


class TestAgentHealthStatus:
    """Tests for AgentHealthStatus model."""

    def test_healthy_agent(self):
        """Test healthy agent status."""
        health = AgentHealthStatus(agent_id="test-001", state=AgentState.IDLE)

        assert health.agent_id == "test-001"
        assert health.is_healthy is True
        assert health.state == AgentState.IDLE
        assert health.active_tasks == 0
        assert isinstance(health.last_heartbeat, datetime)
        assert health.errors == []
        assert health.warnings == []
        assert health.checks == {}

    def test_unhealthy_agent(self):
        """Test unhealthy agent with errors."""
        health = AgentHealthStatus(
            agent_id="test-001",
            is_healthy=False,
            state=AgentState.ERROR,
            errors=["Connection timeout", "Memory limit exceeded"],
            warnings=["High CPU usage"],
        )

        assert health.is_healthy is False
        assert health.state == AgentState.ERROR
        assert len(health.errors) == 2
        assert len(health.warnings) == 1

    def test_health_checks(self):
        """Test health check results."""
        checks = {
            "llm_connection": True,
            "graphrag_connection": True,
            "message_bus": False,
        }
        health = AgentHealthStatus(
            agent_id="test-001", state=AgentState.IDLE, checks=checks
        )

        assert health.checks["llm_connection"] is True
        assert health.checks["graphrag_connection"] is True
        assert health.checks["message_bus"] is False

    def test_has_errors_property(self):
        """Test has_errors property."""
        health = AgentHealthStatus(agent_id="test-001", state=AgentState.IDLE)
        assert not health.has_errors

        health.errors.append("Test error")
        assert health.has_errors

    def test_has_warnings_property(self):
        """Test has_warnings property."""
        health = AgentHealthStatus(agent_id="test-001", state=AgentState.IDLE)
        assert not health.has_warnings

        health.warnings.append("Test warning")
        assert health.has_warnings


class TestModelSerialization:
    """Tests for model serialization and deserialization."""

    def test_agent_config_serialization(self):
        """Test AgentConfig JSON serialization."""
        config = AgentConfig(
            agent_id="test-001",
            agent_type=AgentType.SPECIALIST,
            name="Test Agent",
            capabilities=[AgentCapability(name="test", description="Test capability")],
        )

        # Serialize to dict
        config_dict = config.model_dump()
        assert config_dict["agent_id"] == "test-001"
        assert config_dict["agent_type"] == "specialist"

        # Deserialize from dict
        config2 = AgentConfig(**config_dict)
        assert config2.agent_id == config.agent_id
        assert config2.agent_type == config.agent_type

    def test_task_metadata_serialization(self):
        """Test TaskMetadata JSON serialization."""
        metadata = TaskMetadata(
            user_id="user-123",
            correlation_id="corr-456",
            priority=TaskPriority.HIGH,
            status=TaskStatus.COMPLETED,
        )

        # Serialize to dict
        metadata_dict = metadata.model_dump()
        assert metadata_dict["user_id"] == "user-123"
        assert metadata_dict["priority"] == "high"
        assert metadata_dict["status"] == "completed"

        # Deserialize from dict
        metadata2 = TaskMetadata(**metadata_dict)
        assert metadata2.user_id == metadata.user_id
        assert metadata2.priority == metadata.priority

    def test_agent_metrics_serialization(self):
        """Test AgentMetrics JSON serialization."""
        metrics = AgentMetrics(
            agent_id="test-001",
            total_tasks_processed=100,
            successful_tasks=95,
            current_state=AgentState.PROCESSING,
        )

        # Serialize to dict
        metrics_dict = metrics.model_dump()
        assert metrics_dict["agent_id"] == "test-001"
        assert metrics_dict["total_tasks_processed"] == 100
        assert metrics_dict["current_state"] == "processing"

        # Deserialize from dict
        metrics2 = AgentMetrics(**metrics_dict)
        assert metrics2.agent_id == metrics.agent_id
        assert metrics2.total_tasks_processed == metrics.total_tasks_processed
