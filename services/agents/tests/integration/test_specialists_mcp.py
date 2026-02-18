"""Integration Tests for Specialists with MCP Client.

Tests that all specialist agents can successfully fetch data via MCP
and process it correctly. Uses MockMCPClient to simulate MCP server.

These tests verify:
- Specialists can fetch data when mcp_client is provided
- Specialists fall back to payload when mcp_client is not provided
- MCP methods are called correctly
- Results are formatted properly
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone

from agents.specialists.finance.budget_agent import BudgetSpecialist
from agents.specialists.finance.investment_agent import InvestmentSpecialist
from agents.specialists.finance.tax_agent import TaxSpecialist
from models.agent_models import AgentTask, TaskMetadata
from tests.mocks.mock_mcp_client import MockMCPClient


class TestBudgetSpecialistMCP:
    """Test BudgetSpecialist with MCP integration."""

    @pytest.fixture
    def mock_mcp(self):
        """Create mock MCP client."""
        return MockMCPClient()

    @pytest.fixture
    def budget_agent_with_mcp(self, mock_mcp):
        """Create BudgetSpecialist with MCP client."""
        return BudgetSpecialist(
            agent_id="test_budget",
            mcp_client=mock_mcp
        )

    @pytest.fixture
    def budget_agent_without_mcp(self):
        """Create BudgetSpecialist without MCP client."""
        return BudgetSpecialist(agent_id="test_budget_no_mcp")

    @pytest.mark.asyncio
    async def test_budget_analysis_with_mcp(self, budget_agent_with_mcp, mock_mcp):
        """Test budget analysis fetches data via MCP."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_001",
            task_type="spending_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "session_id": "test_session",
                "days": 90
            }
        )

        # Execute task
        result = await budget_agent_with_mcp.handle_task(task)

        # Verify MCP was called
        assert mock_mcp.call_counts.get("get_financial_context", 0) == 1

        # Verify result structure
        assert result["status"] == "success"
        assert "data" in result
        assert "total_spending" in result["data"]
        assert "savings_rate" in result["data"]

    @pytest.mark.asyncio
    async def test_budget_analysis_without_mcp(self, budget_agent_without_mcp):
        """Test budget analysis works with payload data (no MCP)."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_002",
            task_type="spending_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "transactions": [
                    {"amount": -100, "category": "food"},
                    {"amount": -200, "category": "housing"},
                ],
                "income": [
                    {"amount": 5000}
                ],
            }
        )

        # Execute task
        result = await budget_agent_without_mcp.handle_task(task)

        # Verify result structure
        assert result["status"] == "success"
        assert "data" in result
        assert result["data"]["total_spending"] == 300

    @pytest.mark.asyncio
    async def test_budget_recommendations_with_mcp(self, budget_agent_with_mcp, mock_mcp):
        """Test budget recommendations fetches and analyzes data via MCP."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_003",
            task_type="budget_recommendations",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "session_id": "test_session",
                "days": 90
            }
        )

        # Execute task
        result = await budget_agent_with_mcp.handle_task(task)

        # Verify MCP was called (twice - once for spending_analysis, once internally)
        assert mock_mcp.call_counts.get("get_financial_context", 0) >= 1

        # Verify result structure
        assert result["status"] == "success"
        assert "recommendations" in result["data"]


class TestInvestmentSpecialistMCP:
    """Test InvestmentSpecialist with MCP integration."""

    @pytest.fixture
    def mock_mcp(self):
        """Create mock MCP client."""
        return MockMCPClient()

    @pytest.fixture
    def investment_agent_with_mcp(self, mock_mcp):
        """Create InvestmentSpecialist with MCP client."""
        return InvestmentSpecialist(
            agent_id="test_investment",
            mcp_client=mock_mcp
        )

    @pytest.mark.asyncio
    async def test_portfolio_analysis_with_mcp(self, investment_agent_with_mcp, mock_mcp):
        """Test portfolio analysis fetches data via MCP."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_004",
            task_type="portfolio_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "session_id": "test_session",
                "risk_profile": "moderate"
            }
        )

        # Execute task
        result = await investment_agent_with_mcp.handle_task(task)

        # Verify MCP was called
        assert mock_mcp.call_counts.get("get_investment_context", 0) == 1

        # Verify result structure
        assert result["status"] == "success"
        assert "data" in result

    @pytest.mark.asyncio
    async def test_portfolio_analysis_without_mcp(self, investment_agent_with_mcp):
        """Test portfolio analysis works with payload data."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_005",
            task_type="portfolio_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "holdings": [
                    {
                        "symbol": "AAPL",
                        "quantity": 100,
                        "cost_basis": 150.00,
                        "current_price": 180.00,
                        "asset_class": "stocks",
                        "sector": "technology"
                    }
                ],
                "risk_profile": "moderate"
            }
        )

        # Execute task - should use payload, not MCP
        result = await investment_agent_with_mcp.handle_task(task)

        # Verify result structure
        assert result["status"] == "success"
        assert "total_value" in result["data"]
        assert result["data"]["total_value"] == 18000.00  # 100 * 180


class TestTaxSpecialistMCP:
    """Test TaxSpecialist with MCP integration."""

    @pytest.fixture
    def mock_mcp(self):
        """Create mock MCP client."""
        return MockMCPClient()

    @pytest.fixture
    def tax_agent_with_mcp(self, mock_mcp):
        """Create TaxSpecialist with MCP client."""
        return TaxSpecialist(
            agent_id="test_tax",
            mcp_client=mock_mcp
        )

    @pytest.mark.asyncio
    async def test_tax_estimation_with_payload(self, tax_agent_with_mcp):
        """Test tax estimation with payload data."""
        user_id = str(uuid4())

        task = AgentTask(
            task_id="test_task_006",
            task_type="tax_estimation",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "income": 100000,
                "filing_status": "single",
                "deductions": 14600,  # Standard deduction
                "state": "CA"
            }
        )

        # Execute task
        result = await tax_agent_with_mcp.handle_task(task)

        # Verify result structure
        assert result["status"] == "success"
        assert "federal_tax" in result["data"]
        assert "effective_rate" in result["data"]


class TestMCPFallbackBehavior:
    """Test that all specialists properly fall back when MCP fails or is unavailable."""

    @pytest.mark.asyncio
    async def test_budget_agent_fallback_to_payload(self):
        """Test BudgetSpecialist falls back to payload when MCP unavailable."""
        # Create agent without MCP
        agent = BudgetSpecialist(agent_id="test_fallback")

        user_id = str(uuid4())
        task = AgentTask(
            task_id="test_fallback_001",
            task_type="spending_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "transactions": [{"amount": -500, "category": "food"}],
                "income": [{"amount": 5000}],
            }
        )

        result = await agent.handle_task(task)

        assert result["status"] == "success"
        assert result["data"]["total_spending"] == 500

    @pytest.mark.asyncio
    async def test_investment_agent_fallback_to_payload(self):
        """Test InvestmentSpecialist falls back to payload when MCP unavailable."""
        agent = InvestmentSpecialist(agent_id="test_fallback")

        user_id = str(uuid4())
        task = AgentTask(
            task_id="test_fallback_002",
            task_type="portfolio_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id="test_session",
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "holdings": [
                    {
                        "symbol": "TSLA",
                        "quantity": 50,
                        "cost_basis": 200.00,
                        "current_price": 250.00,
                        "asset_class": "stocks",
                        "sector": "automotive"
                    }
                ],
                "risk_profile": "aggressive"
            }
        )

        result = await agent.handle_task(task)

        assert result["status"] == "success"
        assert result["data"]["total_value"] == 12500.00  # 50 * 250


class TestMCPCallTracking:
    """Test that MockMCPClient properly tracks calls for assertions."""

    @pytest.mark.asyncio
    async def test_call_tracking(self):
        """Test MockMCPClient tracks method calls correctly."""
        mock_mcp = MockMCPClient()

        user_id = uuid4()
        session_id = "test_session"

        # Make several calls
        await mock_mcp.get_financial_context(user_id, session_id)
        await mock_mcp.get_investment_context(user_id, session_id)
        await mock_mcp.health_check()

        # Verify call counts
        assert mock_mcp.call_counts["get_financial_context"] == 1
        assert mock_mcp.call_counts["get_investment_context"] == 1
        assert mock_mcp.call_counts["health_check"] == 1

        # Verify call log
        assert len(mock_mcp.call_log) == 3
        assert mock_mcp.call_log[0]["method"] == "get_financial_context"
        assert mock_mcp.call_log[1]["method"] == "get_investment_context"
        assert mock_mcp.call_log[2]["method"] == "health_check"

        # Test reset
        mock_mcp.reset_call_tracking()
        assert len(mock_mcp.call_log) == 0
        assert len(mock_mcp.call_counts) == 0

    @pytest.mark.asyncio
    async def test_fixture_loading(self):
        """Test MockMCPClient loads fixtures correctly."""
        mock_mcp = MockMCPClient()

        # Test financial context
        context = await mock_mcp.get_financial_context(
            user_id=uuid4(),
            session_id="test"
        )

        assert "accounts" in context
        assert "transactions" in context or "transactions_count" in context
        assert "spending_by_category" in context

        # Test investment context
        inv_context = await mock_mcp.get_investment_context(
            user_id=uuid4(),
            session_id="test",
            include_crypto=True
        )

        assert "portfolio" in inv_context
        assert "crypto_holdings" in inv_context


class TestEndToEndMCPIntegration:
    """End-to-end integration tests with multiple specialists."""

    @pytest.mark.asyncio
    async def test_budget_and_investment_workflow(self):
        """Test workflow using both Budget and Investment specialists with MCP."""
        mock_mcp = MockMCPClient()
        user_id = str(uuid4())
        session_id = "test_workflow"

        # Step 1: Analyze budget
        budget_agent = BudgetSpecialist(
            agent_id="budget_workflow",
            mcp_client=mock_mcp
        )

        budget_task = AgentTask(
            task_id="workflow_001",
            task_type="spending_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id=session_id,
                timestamp=datetime.now(timezone.utc)
            ),
            payload={"session_id": session_id}
        )

        budget_result = await budget_agent.handle_task(budget_task)
        assert budget_result["status"] == "success"

        # Step 2: Analyze investments
        investment_agent = InvestmentSpecialist(
            agent_id="investment_workflow",
            mcp_client=mock_mcp
        )

        investment_task = AgentTask(
            task_id="workflow_002",
            task_type="portfolio_analysis",
            user_id=user_id,
            metadata=TaskMetadata(
                user_id=user_id,
                session_id=session_id,
                timestamp=datetime.now(timezone.utc)
            ),
            payload={
                "session_id": session_id,
                "risk_profile": "moderate"
            }
        )

        investment_result = await investment_agent.handle_task(investment_task)
        assert investment_result["status"] == "success"

        # Verify both specialists used MCP
        assert mock_mcp.call_counts["get_financial_context"] >= 1
        assert mock_mcp.call_counts["get_investment_context"] >= 1
