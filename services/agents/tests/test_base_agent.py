"""
Test suite for BaseAgent functionality

Tests the core BaseAgent framework without requiring external dependencies.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
    TaskMetadata,
    TaskPriority,
    TaskStatus
)


class SimpleTestAgent(BaseAgent):
    """
    Simple test agent that echoes input back.
    Used to verify BaseAgent functionality without external dependencies.
    """

    async def handle_task(self, task: AgentTask) -> dict:
        """
        Echo task payload back with a simple transformation.

        Args:
            task: Task to handle

        Returns:
            Dictionary with echoed data
        """
        # Simulate some work
        await asyncio.sleep(0.1)

        # Extract payload
        message = task.payload.get("message", "No message")

        # Return result
        return {
            "status": "success",
            "data": {
                "original_message": message,
                "processed_message": f"Processed: {message}",
                "agent_id": self.agent_id
            },
            "summary": f"Successfully processed message: {message}"
        }

    async def handle_query(self, query: dict) -> dict:
        """
        Handle simple queries.

        Args:
            query: Query to handle

        Returns:
            Dictionary with query result
        """
        query_type = query.get("query_type", "unknown")

        return {
            "status": "success",
            "data": {
                "query_type": query_type,
                "agent_type": self.agent_type.value,
                "agent_id": self.agent_id
            },
            "summary": f"Query '{query_type}' handled successfully"
        }


@pytest.mark.asyncio
async def test_agent_initialization():
    """Test basic agent initialization"""
    agent = SimpleTestAgent(
        agent_id="test-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(
                name="test_capability",
                description="Test capability for simple agent",
                confidence=1.0
            )
        ]
    )

    assert agent.agent_id == "test-agent-001"
    assert agent.agent_type == AgentType.SPECIALIST
    assert len(agent.capabilities) == 1
    assert agent.capabilities[0].name == "test_capability"


@pytest.mark.asyncio
async def test_agent_lifecycle():
    """Test agent startup and shutdown"""
    agent = SimpleTestAgent(
        agent_id="test-agent-002",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="lifecycle_test", description="Test", confidence=1.0)
        ]
    )

    # Test startup
    await agent.startup()
    assert agent.state.value == "idle"

    # Test health check
    is_healthy = await agent.health_check()
    assert is_healthy is True

    # Test shutdown
    await agent.shutdown()
    assert agent.state.value == "shutdown"


@pytest.mark.asyncio
async def test_task_execution_success():
    """Test successful task execution"""
    agent = SimpleTestAgent(
        agent_id="test-agent-003",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="task_execution", description="Test", confidence=1.0)
        ]
    )

    await agent.startup()

    # Create a test task
    task = AgentTask(
        metadata=TaskMetadata(
            user_id="test-user-001",
            correlation_id="test-correlation-001",
            priority=TaskPriority.NORMAL
        ),
        task_type="echo_test",
        payload={"message": "Hello, World!"},
        assigned_agent_id=agent.agent_id
    )

    # Execute task
    result = await agent.execute_task(task)

    # Verify result
    assert result["status"] == "success"
    assert "data" in result
    assert result["data"]["original_message"] == "Hello, World!"
    assert result["data"]["processed_message"] == "Processed: Hello, World!"
    assert result["data"]["agent_id"] == agent.agent_id
    assert "duration_ms" in result
    assert "task_id" in result

    # Verify metrics
    metrics = agent.get_metrics()
    assert metrics.successful_tasks == 1
    assert metrics.failed_tasks == 0
    assert metrics.total_tasks_processed == 1
    assert metrics.average_duration_ms > 0

    await agent.shutdown()


@pytest.mark.asyncio
async def test_task_execution_with_retry():
    """Test task execution with retry on failure"""

    class FlakeyAgent(BaseAgent):
        """Agent that fails first attempt, succeeds on second"""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.attempt_count = 0

        async def handle_task(self, task: AgentTask) -> dict:
            self.attempt_count += 1
            if self.attempt_count == 1:
                # First attempt fails
                raise ValueError("Simulated failure")
            else:
                # Second attempt succeeds
                return {
                    "status": "success",
                    "data": {"attempts": self.attempt_count},
                    "summary": f"Succeeded after {self.attempt_count} attempts"
                }

        async def handle_query(self, query: dict) -> dict:
            return {"status": "success"}

    agent = FlakeyAgent(
        agent_id="flakey-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="retry_test", description="Test", confidence=1.0)
        ],
        config={"max_retries": 3}
    )

    await agent.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            user_id="test-user-002",
            correlation_id="test-correlation-002"
        ),
        task_type="retry_test",
        payload={"test": "retry"},
        assigned_agent_id=agent.agent_id
    )

    # Execute task - should succeed on second attempt
    result = await agent.execute_task(task)

    assert result["status"] == "success"
    assert result["data"]["attempts"] == 2
    assert agent.attempt_count == 2

    # Verify metrics
    metrics = agent.get_metrics()
    assert metrics.successful_tasks == 1
    assert metrics.failed_tasks == 0

    await agent.shutdown()


@pytest.mark.asyncio
async def test_task_execution_timeout():
    """Test task execution timeout"""

    class SlowAgent(BaseAgent):
        """Agent that takes too long"""

        async def handle_task(self, task: AgentTask) -> dict:
            # Simulate slow processing
            await asyncio.sleep(5.0)
            return {"status": "success"}

        async def handle_query(self, query: dict) -> dict:
            return {"status": "success"}

    agent = SlowAgent(
        agent_id="slow-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="timeout_test", description="Test", confidence=1.0)
        ],
        config={"task_timeout": 0.5}  # 500ms timeout
    )

    await agent.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            user_id="test-user-003",
            correlation_id="test-correlation-003"
        ),
        task_type="slow_test",
        payload={"test": "timeout"},
        assigned_agent_id=agent.agent_id
    )

    # Execute task - should timeout
    result = await agent.execute_task(task)

    assert result["status"] == "failed"
    assert "timeout" in result["error"].lower()

    # Verify metrics
    metrics = agent.get_metrics()
    assert metrics.failed_tasks == 1
    assert metrics.successful_tasks == 0

    await agent.shutdown()


@pytest.mark.asyncio
async def test_task_execution_all_retries_fail():
    """Test task execution when all retries fail"""

    class AlwaysFailAgent(BaseAgent):
        """Agent that always fails"""

        async def handle_task(self, task: AgentTask) -> dict:
            raise RuntimeError("Permanent failure")

        async def handle_query(self, query: dict) -> dict:
            return {"status": "success"}

    agent = AlwaysFailAgent(
        agent_id="fail-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="fail_test", description="Test", confidence=1.0)
        ],
        config={"max_retries": 2}
    )

    await agent.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            user_id="test-user-004",
            correlation_id="test-correlation-004"
        ),
        task_type="fail_test",
        payload={"test": "permanent_failure"},
        assigned_agent_id=agent.agent_id
    )

    # Execute task - should fail after all retries
    result = await agent.execute_task(task)

    assert result["status"] == "failed"
    assert "Permanent failure" in result["error"]

    # Verify metrics
    metrics = agent.get_metrics()
    assert metrics.failed_tasks == 1
    assert metrics.successful_tasks == 0

    await agent.shutdown()


@pytest.mark.asyncio
async def test_metrics_tracking():
    """Test that metrics are tracked correctly"""
    agent = SimpleTestAgent(
        agent_id="metrics-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="metrics_test", description="Test", confidence=1.0)
        ]
    )

    await agent.startup()

    # Execute multiple tasks
    for i in range(5):
        task = AgentTask(
            metadata=TaskMetadata(
                user_id=f"test-user-{i}",
                correlation_id=f"test-correlation-{i}"
            ),
            task_type="metrics_test",
            payload={"message": f"Message {i}"},
            assigned_agent_id=agent.agent_id
        )
        result = await agent.execute_task(task)
        assert result["status"] == "success"

    # Check metrics
    metrics = agent.get_metrics()
    assert metrics.total_tasks_processed == 5
    assert metrics.successful_tasks == 5
    assert metrics.failed_tasks == 0
    assert metrics.average_duration_ms > 0
    assert metrics.success_rate == 100.0
    assert metrics.failure_rate == 0.0

    await agent.shutdown()


@pytest.mark.asyncio
async def test_query_handling():
    """Test query handling"""
    agent = SimpleTestAgent(
        agent_id="query-agent-001",
        agent_type=AgentType.SPECIALIST,
        capabilities=[
            AgentCapability(name="query_test", description="Test", confidence=1.0)
        ]
    )

    await agent.startup()

    # Create and handle a query
    query = {
        "query_id": str(uuid4()),
        "query_type": "test_query",
        "user_id": "test-user-005",
        "parameters": {"key": "value"}
    }

    result = await agent.handle_query(query)

    assert result["status"] == "success"
    assert result["data"]["query_type"] == "test_query"
    assert result["data"]["agent_id"] == agent.agent_id

    await agent.shutdown()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
