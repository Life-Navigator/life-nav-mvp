"""
BudgetSpecialist: L2 Specialist Agent for Budget Analysis

Provides comprehensive budget analysis, spending pattern detection,
recommendations, and cash flow forecasting using GraphRAG and LLM integration.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import json

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class BudgetSpecialist(BaseAgent):
    """
    L2 Specialist agent for budget analysis and financial planning.

    Capabilities:
    - Spending pattern analysis
    - Budget recommendations (50/30/20 rule)
    - Cash flow forecasting
    - Category-level insights
    - Natural language summaries via LLM

    Dependencies:
    - GraphRAG: For storing/retrieving financial entities
    - vLLM: For generating natural language insights
    - MessageBus: For communication with FinanceManager
    """

    # Budget recommendation rules
    SAVINGS_RATE_TARGET = 0.20  # 20% savings rate
    EMERGENCY_FUND_MONTHS = 6  # 6 months of expenses

    # Category spending thresholds (as % of income)
    CATEGORY_THRESHOLDS = {
        "housing": 0.30,
        "transportation": 0.15,
        "food": 0.15,
        "utilities": 0.10,
        "entertainment": 0.05,
        "healthcare": 0.10,
        "personal": 0.05,
        "debt": 0.10,
    }

    def __init__(
        self,
        agent_id: str = "budget_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize BudgetSpecialist agent."""

        capabilities = [
            AgentCapability(
                name="spending_analysis",
                description="Analyze spending patterns and trends",
                confidence=0.95,
            ),
            AgentCapability(
                name="budget_recommendations",
                description="Generate personalized budget recommendations",
                confidence=0.90,
            ),
            AgentCapability(
                name="cashflow_forecasting",
                description="Forecast future cash flows",
                confidence=0.85,
            ),
            AgentCapability(
                name="category_insights",
                description="Provide category-level spending insights",
                confidence=0.90,
            ),
        ]

        super().__init__(
            agent_id=agent_id,
            agent_type=AgentType.SPECIALIST,
            capabilities=capabilities,
            message_bus=message_bus,
            graphrag_client=graphrag_client,
            vllm_client=vllm_client,
            mcp_client=mcp_client,
            config=config or {},
        )

        self.logger = get_logger(f"agent.{agent_id}")

    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Handle budget-related tasks.

        Supported task types:
        - spending_analysis: Analyze spending patterns
        - budget_recommendations: Generate budget recommendations
        - cashflow_forecast: Forecast future cash flows
        - category_breakdown: Breakdown spending by category

        Args:
            task: AgentTask with task_type and payload

        Returns:
            Dict with status, data, and optional synthesis

        Raises:
            TaskExecutionError: If task execution fails
        """
        try:
            action = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Handling task: {action} for user {user_id}")

            # Route to appropriate handler
            if action == "spending_analysis":
                result = await self._analyze_spending(user_id, task.payload)
            elif action == "budget_recommendations":
                result = await self._generate_budget_recommendations(user_id, task.payload)
            elif action == "cashflow_forecast":
                result = await self._forecast_cashflow(user_id, task.payload)
            elif action == "category_breakdown":
                result = await self._analyze_category_breakdown(user_id, task.payload)
            else:
                raise TaskExecutionError(f"Unknown task type: {action}")

            # Generate natural language summary if vLLM available
            synthesis = None
            if self.vllm:
                synthesis = await self._generate_natural_language_summary(
                    action, result, task.payload
                )
                result["synthesis"] = synthesis

            # Store analysis in semantic memory
            if self.graphrag:
                await self._store_analysis_memory(user_id, action, result)

            return {
                "status": "success",
                "data": result,
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Task execution failed: {e}", error=e)
            raise TaskExecutionError(f"Budget analysis failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle read-only budget queries.

        Supported query types:
        - get_spending_summary: Get spending summary for period
        - get_category_totals: Get spending totals by category
        - get_savings_rate: Get current savings rate

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        try:
            query_type = query.get("query_type")
            user_id = query.get("user_id")
            params = query.get("parameters", {})

            if query_type == "get_spending_summary":
                return await self._get_spending_summary(user_id, params)
            elif query_type == "get_category_totals":
                return await self._get_category_totals(user_id, params)
            elif query_type == "get_savings_rate":
                return await self._get_savings_rate(user_id, params)
            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Task Handlers ==========

    async def _analyze_spending(self, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze spending patterns for a user.

        Returns spending totals, category breakdown, trends, and insights.
        """
        # Gather financial context from GraphRAG
        context = await self._gather_financial_context(user_id, payload)

        # Calculate spending metrics
        total_spending = sum(t["amount"] for t in context.get("transactions", []))
        total_income = sum(i["amount"] for i in context.get("income", []))

        # Calculate category breakdown
        category_totals = {}
        for txn in context.get("transactions", []):
            category = txn.get("category", "uncategorized")
            category_totals[category] = category_totals.get(category, 0) + txn["amount"]

        # Calculate savings rate
        savings_rate = (total_income - total_spending) / total_income if total_income > 0 else 0

        # Identify top spending categories
        top_categories = sorted(
            category_totals.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        return {
            "total_spending": total_spending,
            "total_income": total_income,
            "savings_rate": round(savings_rate, 2),
            "category_breakdown": category_totals,
            "top_categories": [
                {"category": cat, "amount": amt, "percentage": round(amt/total_spending, 2)}
                for cat, amt in top_categories
            ] if total_spending > 0 else [],
            "period": payload.get("period", "current_month"),
            "transaction_count": len(context.get("transactions", [])),
        }

    async def _generate_budget_recommendations(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate personalized budget recommendations.

        Uses 50/30/20 rule as baseline:
        - 50% needs (housing, utilities, groceries)
        - 30% wants (entertainment, dining, shopping)
        - 20% savings (emergency fund, investments, debt repayment)
        """
        # Get current spending analysis
        spending_analysis = await self._analyze_spending(user_id, payload)

        total_income = spending_analysis["total_income"]
        savings_rate = spending_analysis["savings_rate"]
        category_breakdown = spending_analysis["category_breakdown"]

        recommendations = []

        # Check savings rate
        if savings_rate < self.SAVINGS_RATE_TARGET:
            shortfall = (self.SAVINGS_RATE_TARGET - savings_rate) * total_income
            recommendations.append({
                "type": "increase_savings",
                "priority": "high",
                "description": f"Increase savings by ${shortfall:.2f}/month to reach 20% target",
                "current_rate": round(savings_rate, 2),
                "target_rate": self.SAVINGS_RATE_TARGET,
            })

        # Check emergency fund
        monthly_expenses = spending_analysis["total_spending"]
        emergency_fund_target = monthly_expenses * self.EMERGENCY_FUND_MONTHS
        recommendations.append({
            "type": "emergency_fund",
            "priority": "high",
            "description": f"Build emergency fund of ${emergency_fund_target:.2f} (6 months expenses)",
            "target_amount": emergency_fund_target,
        })

        # Check category spending against thresholds
        for category, threshold in self.CATEGORY_THRESHOLDS.items():
            if category in category_breakdown:
                actual_pct = category_breakdown[category] / total_income if total_income > 0 else 0
                if actual_pct > threshold:
                    overspend = (actual_pct - threshold) * total_income
                    recommendations.append({
                        "type": "reduce_category_spending",
                        "category": category,
                        "priority": "medium",
                        "description": f"Reduce {category} spending by ${overspend:.2f}/month",
                        "current_pct": round(actual_pct, 2),
                        "target_pct": threshold,
                    })

        return {
            "recommendations": recommendations,
            "current_savings_rate": round(savings_rate, 2),
            "target_savings_rate": self.SAVINGS_RATE_TARGET,
            "total_income": total_income,
            "analysis_date": datetime.now(timezone.utc).isoformat(),
        }

    async def _forecast_cashflow(self, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Forecast future cash flows based on historical patterns.

        Simple 3-month projection based on average monthly income/expenses.
        """
        # Get historical data
        context = await self._gather_financial_context(user_id, payload)

        transactions = context.get("transactions", [])
        income = context.get("income", [])

        # Calculate monthly averages
        avg_monthly_income = sum(i["amount"] for i in income) / max(len(income), 1)
        avg_monthly_expenses = sum(t["amount"] for t in transactions) / max(len(transactions), 1)
        avg_monthly_savings = avg_monthly_income - avg_monthly_expenses

        # Generate 3-month forecast
        forecast = []
        current_date = datetime.now(timezone.utc)

        for i in range(3):
            month_date = current_date + timedelta(days=30 * i)
            forecast.append({
                "month": month_date.strftime("%Y-%m"),
                "projected_income": round(avg_monthly_income, 2),
                "projected_expenses": round(avg_monthly_expenses, 2),
                "projected_savings": round(avg_monthly_savings, 2),
                "confidence": 0.75 - (i * 0.1),  # Lower confidence for further out
            })

        return {
            "forecast": forecast,
            "avg_monthly_income": round(avg_monthly_income, 2),
            "avg_monthly_expenses": round(avg_monthly_expenses, 2),
            "avg_monthly_savings": round(avg_monthly_savings, 2),
            "forecast_period_months": 3,
        }

    async def _analyze_category_breakdown(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Provide detailed category-level spending analysis.
        """
        context = await self._gather_financial_context(user_id, payload)
        transactions = context.get("transactions", [])

        # Group by category
        category_data = {}
        for txn in transactions:
            category = txn.get("category", "uncategorized")
            if category not in category_data:
                category_data[category] = {
                    "total": 0,
                    "count": 0,
                    "transactions": [],
                }

            category_data[category]["total"] += txn["amount"]
            category_data[category]["count"] += 1
            category_data[category]["transactions"].append(txn)

        # Calculate averages and percentages
        total_spending = sum(t["amount"] for t in transactions)

        category_analysis = []
        for category, data in category_data.items():
            category_analysis.append({
                "category": category,
                "total": round(data["total"], 2),
                "count": data["count"],
                "average_per_transaction": round(data["total"] / data["count"], 2),
                "percentage_of_total": round(data["total"] / total_spending, 2) if total_spending > 0 else 0,
            })

        # Sort by total spending
        category_analysis.sort(key=lambda x: x["total"], reverse=True)

        return {
            "categories": category_analysis,
            "total_spending": round(total_spending, 2),
            "category_count": len(category_data),
        }

    # ========== Query Handlers ==========

    async def _get_spending_summary(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get spending summary for a period."""
        return await self._analyze_spending(user_id, params)

    async def _get_category_totals(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get spending totals by category."""
        return await self._analyze_category_breakdown(user_id, params)

    async def _get_savings_rate(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get current savings rate."""
        analysis = await self._analyze_spending(user_id, params)
        return {
            "savings_rate": analysis["savings_rate"],
            "total_income": analysis["total_income"],
            "total_spending": analysis["total_spending"],
        }

    # ========== Helper Methods ==========

    async def _gather_financial_context(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Gather financial context from MCP, GraphRAG, or payload.

        Priority order:
        1. MCP - Fetch live data if client available and payload is empty
        2. GraphRAG - Query semantic memory
        3. Payload - Use provided mock/test data

        In production, this would query for:
        - Transaction history
        - Account balances
        - Income records
        - Budget allocations
        """
        # Try MCP first if available and payload doesn't have transactions
        if self.mcp and not payload.get("transactions"):
            try:
                self.logger.info(f"Fetching financial context via MCP for user {user_id}")

                # Extract session_id from payload or generate one
                session_id = payload.get("session_id", f"session_{user_id[:8]}")
                days = payload.get("days", 90)

                # Fetch from MCP
                from uuid import UUID
                mcp_context = await self.mcp.get_financial_context(
                    user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                    session_id=session_id,
                    days=days
                )

                # Transform MCP response to expected format
                return {
                    "transactions": mcp_context.get("transactions", []),
                    "income": [],  # Income is derived from positive transactions
                    "accounts": mcp_context.get("accounts", []),
                    "spending_by_category": mcp_context.get("spending_by_category", []),
                    "recurring_transactions": mcp_context.get("recurring_transactions", []),
                }
            except Exception as e:
                self.logger.warning(f"MCP fetch failed: {e}, falling back to GraphRAG/payload")

        # Try GraphRAG next
        if self.graphrag:
            # Query GraphRAG for financial entities
            try:
                # Semantic search for relevant transactions
                # This is a placeholder - actual implementation would use proper queries
                context = {
                    "transactions": payload.get("transactions", []),
                    "income": payload.get("income", []),
                    "accounts": payload.get("accounts", []),
                }
                return context
            except Exception as e:
                self.logger.warning(f"GraphRAG query failed: {e}, using payload data")

        # Fallback to payload data
        return {
            "transactions": payload.get("transactions", []),
            "income": payload.get("income", []),
            "accounts": payload.get("accounts", []),
        }

    async def _store_analysis_memory(
        self, user_id: str, action: str, result: Dict[str, Any]
    ) -> None:
        """
        Store analysis results in semantic memory for future reference.
        """
        if not self.graphrag:
            return

        try:
            # Create a memory summary
            memory_content = f"Budget analysis ({action}): "

            if "total_spending" in result:
                memory_content += f"Spending ${result['total_spending']:.2f}, "
            if "savings_rate" in result:
                memory_content += f"Savings rate {result['savings_rate']*100:.1f}%, "
            if "recommendations" in result:
                memory_content += f"{len(result['recommendations'])} recommendations"

            # Store in GraphRAG semantic memory
            # This would use embedding generation in production
            await self.graphrag.store_memory(
                user_id=user_id,
                agent_id=self.agent_id,
                content=memory_content,
                embedding=[0.0] * 384,  # Placeholder - would use real embeddings
                context={"action": action, "result_summary": str(result)[:500]},
                metadata={"timestamp": datetime.now(timezone.utc).isoformat()},
            )

        except Exception as e:
            self.logger.warning(f"Failed to store analysis memory: {e}")

    async def _generate_natural_language_summary(
        self, action: str, result: Dict[str, Any], payload: Dict[str, Any]
    ) -> str:
        """
        Generate natural language summary using vLLM.
        """
        if not self.vllm:
            return ""

        try:
            # Construct prompt for LLM
            system_prompt = """You are a financial advisor providing clear, concise budget insights.
Summarize the analysis results in 2-3 sentences that a non-expert can understand.
Focus on key findings and actionable insights."""

            user_prompt = f"""Action: {action}

Analysis Results:
{json.dumps(result, indent=2)[:1000]}

Provide a brief, friendly summary of these results."""

            # Generate response
            response = await self.vllm.chat(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7,
                max_tokens=200,
            )

            return response.strip()

        except Exception as e:
            self.logger.warning(f"Failed to generate NL summary: {e}")
            return ""
