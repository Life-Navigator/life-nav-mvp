"""Agent Hierarchy Factory.

Creates and wires together the complete agent hierarchy:
- L0: Orchestrator (root)
- L1: Domain Managers (Finance, Career)
- L2: Specialists (Budget, Investment, Tax, Debt, Savings, JobSearch, Resume)

All agents are instantiated with proper dependencies (MCP, GraphRAG, vLLM, MessageBus).
"""

from typing import Optional, Dict, Any

from agents.orchestration.orchestrator import Orchestrator
from agents.domain.finance_manager import FinanceManager
from agents.domain.career_manager import CareerManager
from agents.specialists.finance.budget_agent import BudgetSpecialist
from agents.specialists.finance.investment_agent import InvestmentSpecialist
from agents.specialists.finance.tax_agent import TaxSpecialist
from agents.specialists.finance.debt_agent import DebtSpecialist
from agents.specialists.finance.savings_agent import SavingsSpecialist
from agents.specialists.career.job_search_agent import JobSearchSpecialist
from agents.specialists.career.resume_agent import ResumeSpecialist
from utils.logging import get_logger

logger = get_logger(__name__)


async def create_agent_hierarchy(
    mcp_client=None,
    vllm_client=None,
    graphrag_client=None,
    message_bus=None,
    config: Optional[Dict[str, Any]] = None,
) -> Orchestrator:
    """
    Create complete agent hierarchy with all specialists.

    This factory function instantiates all agents in the hierarchy and
    wires them together with proper dependencies.

    Architecture:
        L0: Orchestrator
            ├─ L1: FinanceManager
            │   ├─ L2: BudgetSpecialist
            │   ├─ L2: InvestmentSpecialist
            │   ├─ L2: TaxSpecialist
            │   ├─ L2: DebtSpecialist
            │   └─ L2: SavingsSpecialist
            └─ L1: CareerManager
                ├─ L2: JobSearchSpecialist
                └─ L2: ResumeSpecialist

    Args:
        mcp_client: MCP client for fetching data from app layer
        vllm_client: vLLM client for LLM inference
        graphrag_client: GraphRAG client for semantic memory
        message_bus: Message bus for agent communication
        config: Optional configuration dict

    Returns:
        Orchestrator: Fully wired root agent with all children

    Example:
        >>> from agents.tools.mcp_client import mcp_client
        >>> orchestrator = await create_agent_hierarchy(
        ...     mcp_client=mcp_client,
        ...     vllm_client=vllm_client,
        ...     graphrag_client=graphrag_client,
        ...     message_bus=message_bus
        ... )
        >>> # Now orchestrator can route to any specialist
        >>> result = await orchestrator.handle_task(task)
    """
    logger.info("Creating agent hierarchy...")

    # =========================================================================
    # L2: Financial Specialists
    # =========================================================================

    logger.info("Instantiating financial specialists...")

    budget_specialist = BudgetSpecialist(
        agent_id="budget_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    investment_specialist = InvestmentSpecialist(
        agent_id="investment_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    tax_specialist = TaxSpecialist(
        agent_id="tax_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    debt_specialist = DebtSpecialist(
        agent_id="debt_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    savings_specialist = SavingsSpecialist(
        agent_id="savings_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    logger.info("Financial specialists created: 5")

    # =========================================================================
    # L2: Career Specialists
    # =========================================================================

    logger.info("Instantiating career specialists...")

    job_search_specialist = JobSearchSpecialist(
        agent_id="job_search_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    resume_specialist = ResumeSpecialist(
        agent_id="resume_specialist",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        mcp_client=mcp_client,
        config=config,
    )

    logger.info("Career specialists created: 2")

    # =========================================================================
    # L1: Domain Managers
    # =========================================================================

    logger.info("Instantiating domain managers...")

    finance_manager = FinanceManager(
        agent_id="finance_manager",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        config=config,
    )

    # Register specialists with finance manager
    finance_manager.specialists = {
        "budget_specialist": budget_specialist,
        "investment_specialist": investment_specialist,
        "tax_specialist": tax_specialist,
        "debt_specialist": debt_specialist,
        "savings_specialist": savings_specialist,
    }

    career_manager = CareerManager(
        agent_id="career_manager",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        config=config,
    )

    # Register specialists with career manager
    career_manager.specialists = {
        "job_search_specialist": job_search_specialist,
        "resume_specialist": resume_specialist,
    }

    logger.info("Domain managers created: 2")

    # =========================================================================
    # L0: Orchestrator
    # =========================================================================

    logger.info("Instantiating orchestrator...")

    orchestrator = Orchestrator(
        agent_id="orchestrator",
        message_bus=message_bus,
        graphrag_client=graphrag_client,
        vllm_client=vllm_client,
        config=config,
    )

    # Register domain managers with orchestrator
    orchestrator.domain_managers = {
        "finance": finance_manager,
        "career": career_manager,
    }

    logger.info(
        "Agent hierarchy created successfully: "
        "1 orchestrator, 2 managers, 7 specialists (9 agents total)"
    )

    return orchestrator


async def create_minimal_hierarchy(
    mcp_client=None,
    config: Optional[Dict[str, Any]] = None,
) -> Orchestrator:
    """
    Create minimal agent hierarchy for testing (MCP only, no vLLM/GraphRAG).

    Useful for:
    - Integration testing with MockMCPClient
    - Local development without GPU infrastructure
    - Quick validation of routing logic

    Args:
        mcp_client: MCP client (can be MockMCPClient for testing)
        config: Optional configuration dict

    Returns:
        Orchestrator with all specialists (MCP-enabled, no LLM features)

    Example:
        >>> from tests.mocks.mock_mcp_client import MockMCPClient
        >>> mock_mcp = MockMCPClient()
        >>> orchestrator = await create_minimal_hierarchy(mcp_client=mock_mcp)
    """
    logger.info("Creating minimal agent hierarchy (MCP only)...")

    return await create_agent_hierarchy(
        mcp_client=mcp_client,
        vllm_client=None,
        graphrag_client=None,
        message_bus=None,
        config=config,
    )


def get_agent_registry(orchestrator: Orchestrator) -> Dict[str, Any]:
    """
    Get registry of all agents in the hierarchy.

    Useful for:
    - Health checks (verify all agents instantiated)
    - Debugging (inspect agent states)
    - Metrics (track agent performance)

    Args:
        orchestrator: Root orchestrator instance

    Returns:
        Dict mapping agent IDs to agent instances

    Example:
        >>> orchestrator = await create_agent_hierarchy(...)
        >>> registry = get_agent_registry(orchestrator)
        >>> print(list(registry.keys()))
        ['orchestrator', 'finance_manager', 'career_manager',
         'budget_specialist', 'investment_specialist', ...]
    """
    registry = {orchestrator.agent_id: orchestrator}

    # Add domain managers
    for manager_id, manager in orchestrator.domain_managers.items():
        registry[manager.agent_id] = manager

        # Add specialists under each manager
        for specialist_id, specialist in manager.specialists.items():
            registry[specialist.agent_id] = specialist

    return registry


async def health_check_hierarchy(orchestrator: Orchestrator) -> Dict[str, Any]:
    """
    Perform health check on entire agent hierarchy.

    Args:
        orchestrator: Root orchestrator instance

    Returns:
        Dict with health status for each agent

    Example:
        >>> orchestrator = await create_agent_hierarchy(...)
        >>> health = await health_check_hierarchy(orchestrator)
        >>> print(health["overall_status"])
        'healthy'
    """
    registry = get_agent_registry(orchestrator)
    health_status = {}

    for agent_id, agent in registry.items():
        health_status[agent_id] = {
            "agent_type": agent.agent_type.value,
            "capabilities": len(agent.capabilities),
            "has_mcp": hasattr(agent, "mcp") and agent.mcp is not None,
            "has_vllm": hasattr(agent, "vllm") and agent.vllm is not None,
            "has_graphrag": hasattr(agent, "graphrag") and agent.graphrag is not None,
        }

    # Determine overall health
    total_agents = len(health_status)
    overall_status = "healthy" if total_agents == 9 else "degraded"

    return {
        "overall_status": overall_status,
        "total_agents": total_agents,
        "expected_agents": 9,
        "agents": health_status,
    }
