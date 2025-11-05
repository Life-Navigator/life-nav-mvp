"""Integration Tests for Complete Agent Hierarchy.

Tests the full agent hierarchy created by the factory:
- All 9 agents are instantiated correctly
- Specialists are wired to managers
- Managers are wired to orchestrator
- MCP clients are properly passed down
"""

import pytest
from uuid import uuid4

from agents.orchestration.factory import (
    create_agent_hierarchy,
    create_minimal_hierarchy,
    get_agent_registry,
    health_check_hierarchy,
)
from tests.mocks.mock_mcp_client import MockMCPClient


class TestAgentHierarchyFactory:
    """Test agent hierarchy creation and wiring."""

    @pytest.mark.asyncio
    async def test_create_complete_hierarchy(self):
        """Test that all 9 agents are created in the hierarchy."""
        mock_mcp = MockMCPClient()

        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

        # Verify orchestrator
        assert orchestrator is not None
        assert orchestrator.agent_id == "orchestrator"

        # Verify domain managers
        assert "finance" in orchestrator.domain_managers
        assert "career" in orchestrator.domain_managers

        finance_manager = orchestrator.domain_managers["finance"]
        career_manager = orchestrator.domain_managers["career"]

        # Verify financial specialists
        assert "budget_specialist" in finance_manager.specialists
        assert "investment_specialist" in finance_manager.specialists
        assert "tax_specialist" in finance_manager.specialists
        assert "debt_specialist" in finance_manager.specialists
        assert "savings_specialist" in finance_manager.specialists

        # Verify career specialists
        assert "job_search_specialist" in career_manager.specialists
        assert "resume_specialist" in career_manager.specialists

    @pytest.mark.asyncio
    async def test_mcp_client_propagation(self):
        """Test that MCP client is passed to all specialists."""
        mock_mcp = MockMCPClient()

        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

        registry = get_agent_registry(orchestrator)

        # All specialists should have MCP client
        for agent_id, agent in registry.items():
            if "specialist" in agent_id:
                assert hasattr(agent, "mcp")
                assert agent.mcp is mock_mcp

    @pytest.mark.asyncio
    async def test_get_agent_registry(self):
        """Test agent registry contains all agents."""
        mock_mcp = MockMCPClient()

        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)
        registry = get_agent_registry(orchestrator)

        # Should have exactly 9 agents
        assert len(registry) == 9

        # Check all expected agents exist
        expected_agents = [
            "orchestrator",
            "finance_manager",
            "career_manager",
            "budget_specialist",
            "investment_specialist",
            "tax_specialist",
            "debt_specialist",
            "savings_specialist",
            "job_search_specialist",
            "resume_specialist",
        ]

        for agent_id in expected_agents:
            assert agent_id in registry

    @pytest.mark.asyncio
    async def test_health_check_hierarchy(self):
        """Test health check reports correct status."""
        mock_mcp = MockMCPClient()

        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)
        health = await health_check_hierarchy(orchestrator)

        # Should be healthy
        assert health["overall_status"] == "healthy"
        assert health["total_agents"] == 9
        assert health["expected_agents"] == 9

        # All agents should have MCP
        for agent_id, status in health["agents"].items():
            if "specialist" in agent_id:
                assert status["has_mcp"] is True

    @pytest.mark.asyncio
    async def test_minimal_hierarchy(self):
        """Test minimal hierarchy creation (MCP only)."""
        mock_mcp = MockMCPClient()

        orchestrator = await create_minimal_hierarchy(mcp_client=mock_mcp)

        # Should still have all agents
        registry = get_agent_registry(orchestrator)
        assert len(registry) == 9

        # But vLLM and GraphRAG should be None
        for agent in registry.values():
            assert agent.vllm is None
            assert agent.graphrag is None


class TestEndToEndHierarchyRouting:
    """Test that requests route correctly through the hierarchy."""

    @pytest.mark.asyncio
    async def test_finance_request_routing(self):
        """Test finance request routes to correct specialist."""
        from models.agent_models import AgentTask, TaskMetadata
        from datetime import datetime, timezone

        mock_mcp = MockMCPClient()
        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

        # Create a budget analysis task
        user_id = str(uuid4())
        task = AgentTask(
            task_id="test_budget_001",
            task_type="spending_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={"session_id": "test_session"}
        )

        # Execute through orchestrator
        result = await orchestrator.handle_task(task)

        # Should succeed
        assert result["status"] == "success"

        # MCP should have been called
        assert mock_mcp.call_counts.get("get_financial_context", 0) >= 1

    @pytest.mark.asyncio
    async def test_career_request_routing(self):
        """Test career request routes to correct specialist."""
        from models.agent_models import AgentTask, TaskMetadata
        from datetime import datetime, timezone

        mock_mcp = MockMCPClient()
        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

        # Create a portfolio analysis task
        user_id = str(uuid4())
        task = AgentTask(
            task_id="test_investment_001",
            task_type="portfolio_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={"session_id": "test_session", "risk_profile": "moderate"}
        )

        # Execute through orchestrator
        result = await orchestrator.handle_task(task)

        # Should succeed
        assert result["status"] == "success"

        # MCP should have been called
        assert mock_mcp.call_counts.get("get_investment_context", 0) >= 1


class TestHierarchyScaling:
    """Test hierarchy can handle concurrent requests."""

    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test hierarchy handles multiple concurrent requests."""
        import asyncio
        from models.agent_models import AgentTask, TaskMetadata
        from datetime import datetime, timezone

        mock_mcp = MockMCPClient()
        orchestrator = await create_agent_hierarchy(mcp_client=mock_mcp)

        # Create multiple tasks
        user_id = str(uuid4())
        tasks = []

        for i in range(10):
            task = AgentTask(
                task_id=f"concurrent_task_{i}",
                task_type="spending_analysis" if i % 2 == 0 else "portfolio_analysis",
                user_id=user_id,
                metadata=TaskMetadata(
                    user_id=user_id,
                    session_id=f"session_{i}",
                    timestamp=datetime.now(timezone.utc)
                ),
                payload={"session_id": f"session_{i}"}
            )
            tasks.append(task)

        # Execute all concurrently
        results = await asyncio.gather(
            *[orchestrator.handle_task(task) for task in tasks]
        )

        # All should succeed
        assert len(results) == 10
        for result in results:
            assert result["status"] == "success"
