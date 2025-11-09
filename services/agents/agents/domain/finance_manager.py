"""
FinanceManager: L1 Domain Manager for Finance

Coordinates financial domain tasks by routing to appropriate specialists
(budget, investment, tax, debt) and aggregating their results.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import asyncio

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class FinanceManager(BaseAgent):
    """
    L1 Domain Manager for financial operations.

    Responsibilities:
    - Route tasks to financial specialists (budget, investment, tax, debt, savings)
    - Coordinate multi-specialist workflows
    - Aggregate results from specialists
    - Provide domain-level oversight

    Specialist Routing:
    - budget → BudgetSpecialist
    - investment → InvestmentSpecialist
    - tax → TaxSpecialist
    - debt → DebtSpecialist
    - savings → SavingsSpecialist
    """

    # Specialist routing table
    SPECIALIST_ROUTING = {
        # Budget Specialist
        "budget": "budget_specialist",
        "spending_analysis": "budget_specialist",
        "budget_recommendations": "budget_specialist",
        "cashflow_forecast": "budget_specialist",
        "category_breakdown": "budget_specialist",

        # Investment Specialist
        "investment": "investment_specialist",
        "portfolio_analysis": "investment_specialist",
        "investment_recommendations": "investment_specialist",
        "rebalancing": "investment_specialist",
        "risk_assessment": "investment_specialist",
        "performance_tracking": "investment_specialist",
        "tax_loss_harvesting": "investment_specialist",

        # Tax Specialist
        "tax": "tax_specialist",
        "tax_optimization": "tax_specialist",
        "tax_estimation": "tax_specialist",
        "deduction_optimization": "tax_specialist",
        "tax_planning": "tax_specialist",
        "bracket_analysis": "tax_specialist",
        "withholding_adjustment": "tax_specialist",
        "estimated_taxes": "tax_specialist",

        # Debt Specialist
        "debt": "debt_specialist",
        "debt_payoff": "debt_specialist",
        "debt_analysis": "debt_specialist",
        "payoff_strategy": "debt_specialist",
        "refinancing_analysis": "debt_specialist",
        "consolidation": "debt_specialist",
        "credit_optimization": "debt_specialist",
        "payment_planning": "debt_specialist",

        # Savings Specialist
        "savings": "savings_specialist",
        "goal_tracking": "savings_specialist",
        "savings_analysis": "savings_specialist",
        "emergency_fund": "savings_specialist",
        "vehicle_optimization": "savings_specialist",
        "progress_monitoring": "savings_specialist",
        "savings_planning": "savings_specialist",
    }

    def __init__(
        self,
        agent_id: str = "finance_manager",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize FinanceManager agent."""

        capabilities = [
            AgentCapability(
                name="task_routing",
                description="Route tasks to appropriate financial specialists",
                confidence=0.95,
            ),
            AgentCapability(
                name="workflow_coordination",
                description="Coordinate multi-specialist workflows",
                confidence=0.90,
            ),
            AgentCapability(
                name="result_aggregation",
                description="Aggregate and synthesize specialist results",
                confidence=0.85,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.DOMAIN_MANAGER,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            config=config or {},
        )

        self.logger = get_logger(f"agent.{agent_id}")
        self._pending_tasks: Dict[str, asyncio.Future] = {}

    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Handle financial domain tasks by routing to specialists.

        Args:
            task: AgentTask with task_type indicating specialist needed

        Returns:
            Dict with aggregated results from specialist(s)

        Raises:
            TaskExecutionError: If routing or execution fails
        """
        try:
            task_type = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Routing task: {task_type} for user {user_id}")

            # Determine which specialist to route to
            specialist_id = self._route_to_specialist(task_type)

            if not specialist_id:
                raise TaskExecutionError(f"No specialist found for task type: {task_type}")

            # Route to specialist via message bus
            result = await self._delegate_to_specialist(specialist_id, task)

            return {
                "status": "success",
                "data": result,
                "specialist": specialist_id,
                "manager_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Task routing failed: {e}", error=e)
            raise TaskExecutionError(f"Finance manager routing failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle domain-level queries.

        Supported queries:
        - get_available_specialists: List available financial specialists
        - get_specialist_status: Check specialist health status

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        try:
            query_type = query.get("query_type")

            if query_type == "get_available_specialists":
                return {
                    "specialists": list(set(self.SPECIALIST_ROUTING.values())),
                    "routing_table": self.SPECIALIST_ROUTING,
                }
            elif query_type == "get_specialist_status":
                # In production, would check actual specialist health
                return {
                    "status": "healthy",
                    "specialists": list(set(self.SPECIALIST_ROUTING.values())),
                }
            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Routing Methods ==========

    def _route_to_specialist(self, task_type: str) -> Optional[str]:
        """
        Determine which specialist should handle the task.

        Args:
            task_type: Task type identifier

        Returns:
            Specialist agent ID, or None if no match
        """
        # Direct lookup
        if task_type in self.SPECIALIST_ROUTING:
            return self.SPECIALIST_ROUTING[task_type]

        # Fallback: use keyword matching
        task_lower = task_type.lower()

        if any(keyword in task_lower for keyword in ["budget", "spend", "expense"]):
            return "budget_specialist"
        elif any(keyword in task_lower for keyword in ["invest", "portfolio", "stock", "rebalance"]):
            return "investment_specialist"
        elif any(keyword in task_lower for keyword in ["tax", "deduction", "bracket"]):
            return "tax_specialist"
        elif any(keyword in task_lower for keyword in ["debt", "loan", "credit", "refinanc", "payoff"]):
            return "debt_specialist"
        elif any(keyword in task_lower for keyword in ["saving", "goal", "emergency", "fund"]):
            return "savings_specialist"

        # Default to budget specialist
        return "budget_specialist"

    async def _delegate_to_specialist(
        self, specialist_id: str, task: AgentTask
    ) -> Dict[str, Any]:
        """
        Delegate task to a specialist agent.

        Args:
            specialist_id: Target specialist agent ID
            task: Task to delegate

        Returns:
            Result from specialist

        Raises:
            TaskExecutionError: If delegation fails
        """
        if not self.message_bus:
            # If no message bus, return mock result
            self.logger.warning("No message bus available, returning mock result")
            return {
                "status": "success",
                "message": f"Task would be routed to {specialist_id}",
                "mock": True,
            }

        try:
            # Create subtask for specialist
            subtask_id = str(uuid4())

            # Prepare task message
            task_message = {
                "task_id": subtask_id,
                "parent_task_id": str(task.metadata.task_id),
                "user_id": task.metadata.user_id,
                "task_type": task.task_type,
                "payload": task.payload,
                "context": task.context,
                "assigned_agent_id": specialist_id,
                "priority": task.metadata.priority.value,
            }

            # Create future to await result
            result_future = asyncio.Future()
            self._pending_tasks[subtask_id] = result_future

            # Publish task to specialist via message bus
            await self.message_bus.publish(
                topic=f"agent.{specialist_id}.tasks",
                payload=task_message,
                reliable=True,
            )

            self.logger.info(f"Delegated task {subtask_id} to {specialist_id}")

            # Wait for result with timeout
            try:
                result = await asyncio.wait_for(result_future, timeout=30.0)
                return result
            except asyncio.TimeoutError:
                raise TaskExecutionError(f"Specialist {specialist_id} timed out")

        except Exception as e:
            self.logger.error(f"Delegation to {specialist_id} failed: {e}", error=e)
            raise TaskExecutionError(f"Failed to delegate to specialist: {str(e)}")
        finally:
            # Clean up pending task
            self._pending_tasks.pop(subtask_id, None)

    async def _handle_specialist_result(self, result_message: Dict[str, Any]) -> None:
        """
        Handle result message from a specialist.

        This would be called by the message bus subscription handler.

        Args:
            result_message: Result from specialist
        """
        task_id = result_message.get("task_id")

        if task_id in self._pending_tasks:
            future = self._pending_tasks[task_id]
            if not future.done():
                future.set_result(result_message.get("data", {}))

    # ========== Workflow Coordination ==========

    async def _coordinate_multi_specialist_workflow(
        self, specialists: List[str], task: AgentTask
    ) -> Dict[str, Any]:
        """
        Coordinate a workflow involving multiple specialists.

        Example: Comprehensive financial review might involve
        budget, investment, and debt specialists.

        Args:
            specialists: List of specialist IDs to coordinate
            task: Original task

        Returns:
            Aggregated results from all specialists
        """
        results = {}

        # Execute specialists in parallel
        tasks = [
            self._delegate_to_specialist(specialist_id, task)
            for specialist_id in specialists
        ]

        specialist_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results
        for specialist_id, result in zip(specialists, specialist_results):
            if isinstance(result, Exception):
                self.logger.error(f"Specialist {specialist_id} failed: {result}")
                results[specialist_id] = {"status": "error", "message": str(result)}
            else:
                results[specialist_id] = result

        return {
            "workflow": "multi_specialist",
            "specialists": specialists,
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
