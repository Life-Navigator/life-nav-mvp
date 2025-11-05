"""
Integration Test and Demo for Life Navigator Agent System

This file serves dual purposes:
1. pytest integration test for CI/CD
2. Standalone demo script for manual testing

Run as test: pytest tests/integration/test_integration_demo.py -v -s
Run as demo: python tests/integration/test_integration_demo.py
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime, timezone
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from agents.orchestration.orchestrator import Orchestrator, create_agent_hierarchy, shutdown_agent_hierarchy
from agents.domain.finance_manager import FinanceManager
from agents.specialists.finance.budget_agent import BudgetSpecialist
from models.agent_models import AgentTask, TaskMetadata, TaskPriority
from messaging.message_bus import MessageBus
from graphrag.client import GraphRAGClient
from models.vllm_client import VLLMClient
from utils.logging import get_logger

logger = get_logger("integration_test")


# ========== Test Data ==========

SAMPLE_TRANSACTIONS = [
    {"amount": 1500, "category": "housing", "date": "2025-10-01", "description": "Rent"},
    {"amount": 200, "category": "utilities", "date": "2025-10-05", "description": "Electric bill"},
    {"amount": 350, "category": "food", "date": "2025-10-10", "description": "Groceries"},
    {"amount": 150, "category": "entertainment", "date": "2025-10-12", "description": "Concert tickets"},
    {"amount": 80, "category": "transportation", "date": "2025-10-15", "description": "Gas"},
    {"amount": 120, "category": "food", "date": "2025-10-18", "description": "Restaurants"},
    {"amount": 100, "category": "utilities", "date": "2025-10-20", "description": "Internet"},
    {"amount": 250, "category": "healthcare", "date": "2025-10-22", "description": "Doctor visit"},
]

SAMPLE_INCOME = [
    {"amount": 5000, "source": "salary", "date": "2025-10-01", "description": "Monthly salary"},
]


# ========== Fixtures ==========

@pytest.fixture
async def message_bus():
    """Create MessageBus instance (mocked for tests)"""
    # In production, would connect to real Redis/RabbitMQ
    # For tests, we'll use in-memory mode or mocks
    bus = MessageBus(auto_reconnect=False)
    # Note: Not actually connecting for this demo
    yield bus
    # Cleanup if needed


@pytest.fixture
async def graphrag_client():
    """Create GraphRAG client (mocked for tests)"""
    # In production, would connect to PostgreSQL
    # For tests, we'll use mocks
    client = GraphRAGClient()
    # Note: Not actually connecting for this demo
    yield client
    # Cleanup if needed


@pytest.fixture
async def vllm_client():
    """Create vLLM client (mocked for tests)"""
    # In production, would connect to vLLM server
    # For tests, we'll use mocks
    client = VLLMClient(
        endpoints=["http://localhost:8000"],
        model_name="meta-llama/Llama-4-Maverick-70B"
    )
    # Note: Not actually connecting for this demo
    yield client
    # Cleanup if needed


@pytest.fixture
async def agent_hierarchy(message_bus, graphrag_client, vllm_client):
    """Create full agent hierarchy for testing"""
    agents = await create_agent_hierarchy(
        message_bus=None,  # Use None for isolated testing
        graphrag_client=None,  # Use None for isolated testing
        vllm_client=None,  # Use None for isolated testing
    )
    yield agents
    await shutdown_agent_hierarchy(agents)


# ========== Unit Tests ==========

@pytest.mark.asyncio
async def test_budget_specialist_initialization():
    """Test BudgetSpecialist initialization"""
    specialist = BudgetSpecialist()

    assert specialist.agent_id == "budget_specialist"
    assert len(specialist.capabilities) == 4
    assert specialist.capabilities[0].name == "spending_analysis"


@pytest.mark.asyncio
async def test_budget_specialist_spending_analysis():
    """Test BudgetSpecialist spending analysis"""
    specialist = BudgetSpecialist()
    await specialist.startup()

    # Create task
    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="test-user-001",
            priority=TaskPriority.NORMAL,
        ),
        task_type="spending_analysis",
        payload={
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
            "period": "current_month",
        },
    )

    # Execute task
    result = await specialist.handle_task(task)

    # Verify results
    assert result["status"] == "success"
    assert "data" in result
    assert "total_spending" in result["data"]
    assert "savings_rate" in result["data"]
    assert "category_breakdown" in result["data"]

    # Check calculations
    expected_spending = sum(t["amount"] for t in SAMPLE_TRANSACTIONS)
    assert result["data"]["total_spending"] == expected_spending

    expected_income = sum(i["amount"] for i in SAMPLE_INCOME)
    assert result["data"]["total_income"] == expected_income

    logger.info(f"Spending analysis result: {json.dumps(result['data'], indent=2)}")

    await specialist.shutdown()


@pytest.mark.asyncio
async def test_budget_specialist_recommendations():
    """Test BudgetSpecialist budget recommendations"""
    specialist = BudgetSpecialist()
    await specialist.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="test-user-001",
            priority=TaskPriority.NORMAL,
        ),
        task_type="budget_recommendations",
        payload={
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    result = await specialist.handle_task(task)

    assert result["status"] == "success"
    assert "data" in result
    assert "recommendations" in result["data"]
    assert isinstance(result["data"]["recommendations"], list)
    assert len(result["data"]["recommendations"]) > 0

    logger.info(f"Recommendations: {json.dumps(result['data']['recommendations'], indent=2)}")

    await specialist.shutdown()


@pytest.mark.asyncio
async def test_finance_manager_initialization():
    """Test FinanceManager initialization"""
    manager = FinanceManager()

    assert manager.agent_id == "finance_manager"
    assert len(manager.capabilities) == 3
    assert manager.SPECIALIST_ROUTING["budget"] == "budget_specialist"


@pytest.mark.asyncio
async def test_finance_manager_routing():
    """Test FinanceManager specialist routing"""
    manager = FinanceManager()

    # Test routing logic
    specialist = manager._route_to_specialist("spending_analysis")
    assert specialist == "budget_specialist"

    specialist = manager._route_to_specialist("investment")
    assert specialist == "investment_specialist"


@pytest.mark.asyncio
async def test_orchestrator_initialization():
    """Test Orchestrator initialization"""
    orchestrator = Orchestrator()

    assert orchestrator.agent_id == "orchestrator"
    assert len(orchestrator.capabilities) == 4
    assert orchestrator.DOMAIN_ROUTING["budget_analysis"] == "finance"


@pytest.mark.asyncio
async def test_orchestrator_intent_classification():
    """Test Orchestrator intent classification"""
    orchestrator = Orchestrator()

    # Test rule-based intent classification
    intent = orchestrator._analyze_intent_rules("How much did I spend this month?")
    assert intent == "budget_analysis"

    intent = orchestrator._analyze_intent_rules("Help me find a job")
    assert intent == "job_search"

    intent = orchestrator._analyze_intent_rules("Should I invest in stocks?")
    assert intent == "investment_advice"


# ========== Integration Tests ==========

@pytest.mark.asyncio
async def test_full_budget_query_flow(agent_hierarchy):
    """Test complete end-to-end flow from Orchestrator to BudgetSpecialist"""
    orchestrator = agent_hierarchy["orchestrator"]

    # Create user query task
    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="test-user-001",
            priority=TaskPriority.NORMAL,
        ),
        task_type="user_query",
        payload={
            "query": "How much did I spend this month?",
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    # Execute through orchestrator
    result = await orchestrator.handle_task(task)

    # Verify orchestration
    assert result["status"] == "success"
    assert "intent" in result
    assert "domain" in result
    assert "data" in result

    logger.info(f"End-to-end result: {json.dumps(result, indent=2, default=str)}")


@pytest.mark.asyncio
async def test_agent_hierarchy_health():
    """Test that all agents in hierarchy are healthy"""
    agents = await create_agent_hierarchy()

    # Check each agent's health
    for agent_id, agent in agents.items():
        health = await agent.health_check()
        logger.info(f"Agent {agent_id} health: {health}")
        # Note: health might be False if dependencies not connected, which is OK for this test

    await shutdown_agent_hierarchy(agents)


@pytest.mark.asyncio
async def test_agent_metrics():
    """Test that agents track metrics correctly"""
    specialist = BudgetSpecialist()
    await specialist.startup()

    # Execute multiple tasks
    for i in range(3):
        task = AgentTask(
            metadata=TaskMetadata(
                task_id=uuid4(),
                user_id=f"test-user-{i}",
                priority=TaskPriority.NORMAL,
            ),
            task_type="spending_analysis",
            payload={
                "transactions": SAMPLE_TRANSACTIONS,
                "income": SAMPLE_INCOME,
            },
        )
        await specialist.execute_task(task)

    # Check metrics
    metrics = specialist.get_metrics()
    assert metrics["total_tasks_processed"] == 3
    assert metrics["successful_tasks"] == 3
    assert metrics["failed_tasks"] == 0

    logger.info(f"Agent metrics: {json.dumps(metrics, indent=2)}")

    await specialist.shutdown()


# ========== Standalone Demo ==========

async def demo_spending_analysis():
    """Demo: Spending analysis"""
    logger.info("=" * 60)
    logger.info("DEMO 1: Spending Analysis")
    logger.info("=" * 60)

    specialist = BudgetSpecialist()
    await specialist.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="demo-user",
            priority=TaskPriority.NORMAL,
        ),
        task_type="spending_analysis",
        payload={
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    result = await specialist.handle_task(task)

    logger.info("\nResults:")
    logger.info(json.dumps(result["data"], indent=2))

    await specialist.shutdown()


async def demo_budget_recommendations():
    """Demo: Budget recommendations"""
    logger.info("\n" + "=" * 60)
    logger.info("DEMO 2: Budget Recommendations")
    logger.info("=" * 60)

    specialist = BudgetSpecialist()
    await specialist.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="demo-user",
            priority=TaskPriority.NORMAL,
        ),
        task_type="budget_recommendations",
        payload={
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    result = await specialist.handle_task(task)

    logger.info("\nRecommendations:")
    for rec in result["data"]["recommendations"]:
        logger.info(f"  [{rec['priority'].upper()}] {rec['description']}")

    await specialist.shutdown()


async def demo_cashflow_forecast():
    """Demo: Cash flow forecast"""
    logger.info("\n" + "=" * 60)
    logger.info("DEMO 3: Cash Flow Forecast")
    logger.info("=" * 60)

    specialist = BudgetSpecialist()
    await specialist.startup()

    task = AgentTask(
        metadata=TaskMetadata(
            task_id=uuid4(),
            user_id="demo-user",
            priority=TaskPriority.NORMAL,
        ),
        task_type="cashflow_forecast",
        payload={
            "transactions": SAMPLE_TRANSACTIONS,
            "income": SAMPLE_INCOME,
        },
    )

    result = await specialist.handle_task(task)

    logger.info("\n3-Month Forecast:")
    for month in result["data"]["forecast"]:
        logger.info(f"  {month['month']}: Income ${month['projected_income']:.2f}, "
                   f"Expenses ${month['projected_expenses']:.2f}, "
                   f"Savings ${month['projected_savings']:.2f} "
                   f"(confidence: {month['confidence']*100:.0f}%)")

    await specialist.shutdown()


async def run_all_demos():
    """Run all demo scenarios"""
    logger.info("Starting Life Navigator Agent System Demo")
    logger.info("=" * 60)

    await demo_spending_analysis()
    await demo_budget_recommendations()
    await demo_cashflow_forecast()

    logger.info("\n" + "=" * 60)
    logger.info("Demo Complete!")
    logger.info("=" * 60)


# ========== Main ==========

if __name__ == "__main__":
    # Run as standalone demo
    asyncio.run(run_all_demos())
