"""
DebtSpecialist: L2 Specialist Agent for Debt Management

Handles:
- Debt analysis and tracking
- Payoff strategies (avalanche, snowball, hybrid)
- Refinancing opportunities
- Consolidation recommendations
- Credit score optimization
- Payment planning
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import math

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class DebtSpecialist(BaseAgent):
    """
    L2 Specialist Agent for debt management.

    Capabilities:
    - Comprehensive debt analysis
    - Payoff strategy optimization
    - Refinancing opportunity identification
    - Debt consolidation recommendations
    - Credit score impact analysis
    - Payment optimization

    Data Requirements (from frontend):
    - Debts: [{type, balance, interest_rate, minimum_payment, lender}]
    - Income: monthly_income
    - Credit score: for refinancing analysis
    """

    def __init__(
        self,
        agent_id: str = "debt_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize DebtSpecialist agent."""

        capabilities = [
            AgentCapability(
                name="debt_analysis",
                description="Analyze total debt and debt-to-income ratio",
                confidence=0.95,
            ),
            AgentCapability(
                name="payoff_strategy",
                description="Generate optimal debt payoff strategies",
                confidence=0.93,
            ),
            AgentCapability(
                name="refinancing_analysis",
                description="Identify refinancing opportunities",
                confidence=0.88,
            ),
            AgentCapability(
                name="consolidation",
                description="Recommend debt consolidation options",
                confidence=0.85,
            ),
            AgentCapability(
                name="credit_optimization",
                description="Optimize payments for credit score",
                confidence=0.87,
            ),
            AgentCapability(
                name="payment_planning",
                description="Create optimized payment schedules",
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
        Handle debt-related tasks.

        Args:
            task: AgentTask with task_type and payload

        Returns:
            Dict with debt analysis and recommendations

        Task Types:
        - debt_analysis: Analyze total debt situation
        - payoff_strategy: Generate payoff strategies
        - refinancing_analysis: Find refinancing opportunities
        - consolidation: Recommend consolidation options
        - credit_optimization: Optimize for credit score
        - payment_planning: Create payment schedule
        """
        try:
            task_type = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Processing {task_type} for user {user_id}")

            # Route to appropriate handler
            if task_type == "debt_analysis":
                result = await self._analyze_debt(user_id, task.payload)
            elif task_type == "payoff_strategy":
                result = await self._generate_payoff_strategy(user_id, task.payload)
            elif task_type == "refinancing_analysis":
                result = await self._analyze_refinancing(user_id, task.payload)
            elif task_type == "consolidation":
                result = await self._recommend_consolidation(user_id, task.payload)
            elif task_type == "credit_optimization":
                result = await self._optimize_credit(user_id, task.payload)
            elif task_type == "payment_planning":
                result = await self._create_payment_plan(user_id, task.payload)
            else:
                raise TaskExecutionError(f"Unknown task type: {task_type}")

            return {
                "status": "success",
                "data": result,
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Task execution failed: {e}", error=e)
            raise TaskExecutionError(f"Debt specialist task failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Handle debt-related queries."""
        try:
            query_type = query.get("query_type")

            if query_type == "get_debt_types":
                return {
                    "debt_types": [
                        "credit_card",
                        "student_loan",
                        "mortgage",
                        "auto_loan",
                        "personal_loan",
                        "medical",
                        "other",
                    ]
                }

            elif query_type == "get_payoff_methods":
                return {
                    "methods": [
                        {
                            "name": "avalanche",
                            "description": "Pay off highest interest rate first (saves most money)",
                        },
                        {
                            "name": "snowball",
                            "description": "Pay off smallest balance first (psychological wins)",
                        },
                        {
                            "name": "hybrid",
                            "description": "Balance between savings and motivation",
                        },
                    ]
                }

            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Debt Analysis ==========

    async def _analyze_debt(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze total debt situation.

        Expected payload:
        {
            "debts": [
                {
                    "name": "Chase Freedom",
                    "type": "credit_card",
                    "balance": 5000,
                    "interest_rate": 0.1899,
                    "minimum_payment": 150,
                    "credit_limit": 10000
                },
                {
                    "name": "Student Loan",
                    "type": "student_loan",
                    "balance": 35000,
                    "interest_rate": 0.0525,
                    "minimum_payment": 350
                }
            ],
            "monthly_income": 6000
        }
        """
        debts = payload.get("debts", [])
        monthly_income = payload.get("monthly_income", 0)

        if not debts:
            return {
                "total_debt": 0,
                "message": "No debts found",
            }

        # Calculate totals
        total_debt = sum(d["balance"] for d in debts)
        total_minimum_payment = sum(d["minimum_payment"] for d in debts)
        weighted_avg_rate = (
            sum(d["balance"] * d["interest_rate"] for d in debts) / total_debt
            if total_debt > 0
            else 0
        )

        # Debt-to-income ratio
        dti_ratio = (
            (total_minimum_payment / monthly_income)
            if monthly_income > 0
            else 0
        )

        # Credit utilization (for credit cards only)
        credit_cards = [d for d in debts if d["type"] == "credit_card"]
        total_credit_limit = sum(d.get("credit_limit", 0) for d in credit_cards)
        total_credit_balance = sum(d["balance"] for d in credit_cards)
        credit_utilization = (
            (total_credit_balance / total_credit_limit)
            if total_credit_limit > 0
            else 0
        )

        # Categorize debts
        debt_by_type = {}
        for debt in debts:
            debt_type = debt["type"]
            if debt_type not in debt_by_type:
                debt_by_type[debt_type] = {
                    "count": 0,
                    "total_balance": 0,
                    "total_payment": 0,
                }

            debt_by_type[debt_type]["count"] += 1
            debt_by_type[debt_type]["total_balance"] += debt["balance"]
            debt_by_type[debt_type]["total_payment"] += debt["minimum_payment"]

        # Calculate payoff timeline (minimum payments only)
        months_to_payoff = self._calculate_payoff_months(debts)

        # Health assessment
        health_score = self._calculate_debt_health_score(
            dti_ratio, credit_utilization, weighted_avg_rate
        )

        # Generate insights
        insights = await self._generate_debt_insights(
            total_debt, dti_ratio, credit_utilization, health_score
        )

        return {
            "total_debt": round(total_debt, 2),
            "total_minimum_payment": round(total_minimum_payment, 2),
            "weighted_average_rate": round(weighted_avg_rate * 100, 2),
            "debt_to_income_ratio": round(dti_ratio * 100, 2),
            "credit_utilization": round(credit_utilization * 100, 2),
            "debt_by_type": {
                k: {
                    "count": v["count"],
                    "total_balance": round(v["total_balance"], 2),
                    "total_payment": round(v["total_payment"], 2),
                }
                for k, v in debt_by_type.items()
            },
            "months_to_payoff_minimum": months_to_payoff,
            "debt_health_score": health_score,
            "insights": insights,
        }

    def _calculate_payoff_months(self, debts: List[Dict[str, Any]]) -> int:
        """Calculate months to pay off all debts with minimum payments"""
        max_months = 0

        for debt in debts:
            balance = debt["balance"]
            rate = debt["interest_rate"] / 12  # Monthly rate
            payment = debt["minimum_payment"]

            if payment <= balance * rate:
                # Payment doesn't cover interest
                max_months = max(max_months, 999)  # Effectively infinite
            else:
                # Calculate months to payoff
                months = math.ceil(
                    -math.log(1 - (balance * rate / payment)) / math.log(1 + rate)
                )
                max_months = max(max_months, months)

        return min(max_months, 999)  # Cap at 999 months

    def _calculate_debt_health_score(
        self, dti_ratio: float, credit_utilization: float, avg_rate: float
    ) -> int:
        """
        Calculate debt health score (0-100).

        Factors:
        - DTI ratio (lower is better)
        - Credit utilization (lower is better)
        - Average interest rate (lower is better)
        """
        score = 100

        # DTI penalty (ideal < 36%)
        if dti_ratio > 0.50:
            score -= 40
        elif dti_ratio > 0.43:
            score -= 30
        elif dti_ratio > 0.36:
            score -= 20

        # Credit utilization penalty (ideal < 30%)
        if credit_utilization > 0.70:
            score -= 30
        elif credit_utilization > 0.50:
            score -= 20
        elif credit_utilization > 0.30:
            score -= 10

        # Interest rate penalty (ideal < 7%)
        if avg_rate > 0.15:
            score -= 20
        elif avg_rate > 0.10:
            score -= 10
        elif avg_rate > 0.07:
            score -= 5

        return max(0, score)

    async def _generate_debt_insights(
        self, total_debt: float, dti_ratio: float, credit_utilization: float, health_score: int
    ) -> str:
        """Generate human-readable debt insights using LLM"""
        if not self.vllm:
            return "Debt analysis complete. Consider speaking with a financial advisor."

        prompt = f"""
You are a debt counselor analyzing a client's debt situation.

Debt Situation:
- Total Debt: ${total_debt:,.2f}
- Debt-to-Income Ratio: {dti_ratio*100:.1f}%
- Credit Utilization: {credit_utilization*100:.1f}%
- Debt Health Score: {health_score}/100

Provide 3 specific, actionable insights:
1. Assessment of debt situation (healthy, manageable, concerning, critical)
2. Primary area of concern (if any)
3. One immediate action they should take

Keep insights brief and specific to the numbers provided.
"""

        try:
            response = await self.vllm.chat(
                prompt=prompt,
                temperature=0.3,
                max_tokens=300,
            )
            return response
        except Exception as e:
            self.logger.warning(f"LLM debt insights generation failed: {e}")
            return "Consider focusing on high-interest debt first and maintaining payments."

    # ========== Payoff Strategy ==========

    async def _generate_payoff_strategy(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate optimal debt payoff strategy.

        Expected payload:
        {
            "debts": [...],
            "extra_payment": 500,  # Extra monthly payment available
            "strategy": "avalanche"  # or "snowball" or "hybrid"
        }
        """
        debts = payload.get("debts", [])
        extra_payment = payload.get("extra_payment", 0)
        strategy = payload.get("strategy", "avalanche")

        if not debts:
            return {"message": "No debts to pay off"}

        # Sort debts based on strategy
        if strategy == "avalanche":
            # Highest interest rate first
            sorted_debts = sorted(debts, key=lambda d: d["interest_rate"], reverse=True)
        elif strategy == "snowball":
            # Lowest balance first
            sorted_debts = sorted(debts, key=lambda d: d["balance"])
        else:  # hybrid
            # Score combining both factors
            sorted_debts = sorted(
                debts,
                key=lambda d: (d["balance"] / 1000) - (d["interest_rate"] * 10),
            )

        # Calculate payoff plan
        payoff_plan = []
        remaining_debts = [d.copy() for d in sorted_debts]
        total_paid = 0
        month = 0
        extra_available = extra_payment

        while remaining_debts and month < 600:  # Cap at 50 years
            month += 1
            month_total = 0

            # Make minimum payments on all debts
            for debt in remaining_debts:
                payment = min(debt["minimum_payment"], debt["balance"])
                debt["balance"] -= payment
                month_total += payment

            # Apply extra payment to first debt
            if remaining_debts and extra_available > 0:
                target_debt = remaining_debts[0]
                extra_applied = min(extra_available, target_debt["balance"])
                target_debt["balance"] -= extra_applied
                month_total += extra_applied

            total_paid += month_total

            # Remove paid-off debts
            paid_off = [d for d in remaining_debts if d["balance"] <= 0]
            remaining_debts = [d for d in remaining_debts if d["balance"] > 0]

            # Record milestone
            if paid_off:
                for debt in paid_off:
                    payoff_plan.append({
                        "month": month,
                        "debt_name": debt["name"],
                        "debt_type": debt["type"],
                        "payoff_amount": round(debt["balance"] + sum(
                            p["amount"] for p in payoff_plan if p.get("debt_name") == debt["name"]
                        ), 2),
                    })

        # Calculate total interest paid
        total_interest = total_paid - sum(d["balance"] for d in debts)

        # Compare strategies
        comparison = await self._compare_payoff_strategies(debts, extra_payment)

        return {
            "strategy": strategy,
            "payoff_plan": payoff_plan,
            "total_months": month,
            "total_paid": round(total_paid, 2),
            "total_interest": round(total_interest, 2),
            "monthly_payment": round(
                sum(d["minimum_payment"] for d in debts) + extra_payment, 2
            ),
            "comparison": comparison,
        }

    async def _compare_payoff_strategies(
        self, debts: List[Dict[str, Any]], extra_payment: float
    ) -> Dict[str, Any]:
        """Compare avalanche vs snowball strategies"""
        # Simplified comparison
        return {
            "avalanche": {
                "method": "Highest interest first",
                "pros": "Saves most on interest",
                "estimated_savings": "Calculate actual",
            },
            "snowball": {
                "method": "Smallest balance first",
                "pros": "Quick psychological wins",
                "estimated_savings": "Calculate actual",
            },
        }

    # ========== Refinancing Analysis ==========

    async def _analyze_refinancing(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze refinancing opportunities.

        Expected payload:
        {
            "debts": [...],
            "credit_score": 720
        }
        """
        debts = payload.get("debts", [])
        credit_score = payload.get("credit_score", 0)

        opportunities = []

        for debt in debts:
            current_rate = debt["interest_rate"]
            balance = debt["balance"]

            # Estimate potential new rate based on credit score and debt type
            potential_rate = self._estimate_refinance_rate(
                debt["type"], credit_score
            )

            if potential_rate and potential_rate < current_rate:
                # Calculate savings
                months_remaining = 60  # Assume 5 years
                current_payment = self._calculate_payment(
                    balance, current_rate / 12, months_remaining
                )
                new_payment = self._calculate_payment(
                    balance, potential_rate / 12, months_remaining
                )

                monthly_savings = current_payment - new_payment
                total_savings = monthly_savings * months_remaining

                opportunities.append({
                    "debt_name": debt["name"],
                    "debt_type": debt["type"],
                    "current_rate": round(current_rate * 100, 2),
                    "potential_rate": round(potential_rate * 100, 2),
                    "rate_reduction": round((current_rate - potential_rate) * 100, 2),
                    "monthly_savings": round(monthly_savings, 2),
                    "total_savings": round(total_savings, 2),
                    "balance": round(balance, 2),
                })

        opportunities.sort(key=lambda x: x["total_savings"], reverse=True)

        total_savings = sum(o["total_savings"] for o in opportunities)

        return {
            "opportunities": opportunities,
            "opportunity_count": len(opportunities),
            "total_potential_savings": round(total_savings, 2),
            "credit_score": credit_score,
        }

    def _estimate_refinance_rate(self, debt_type: str, credit_score: int) -> Optional[float]:
        """Estimate potential refinance rate based on credit score"""
        if credit_score == 0:
            return None

        # Simplified rate estimation
        rate_by_type = {
            "credit_card": {
                "excellent": 0.12,  # 750+
                "good": 0.15,  # 700-749
                "fair": 0.18,  # 650-699
                "poor": 0.22,  # <650
            },
            "personal_loan": {
                "excellent": 0.06,
                "good": 0.09,
                "fair": 0.14,
                "poor": 0.18,
            },
            "auto_loan": {
                "excellent": 0.04,
                "good": 0.06,
                "fair": 0.08,
                "poor": 0.11,
            },
        }

        if debt_type not in rate_by_type:
            return None

        if credit_score >= 750:
            tier = "excellent"
        elif credit_score >= 700:
            tier = "good"
        elif credit_score >= 650:
            tier = "fair"
        else:
            tier = "poor"

        return rate_by_type[debt_type].get(tier)

    def _calculate_payment(
        self, balance: float, monthly_rate: float, months: int
    ) -> float:
        """Calculate monthly payment for a loan"""
        if monthly_rate == 0:
            return balance / months

        return balance * (monthly_rate * (1 + monthly_rate) ** months) / (
            (1 + monthly_rate) ** months - 1
        )

    # ========== Consolidation ==========

    async def _recommend_consolidation(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Recommend debt consolidation options.

        Expected payload:
        {
            "debts": [...],
            "credit_score": 720,
            "monthly_income": 6000
        }
        """
        debts = payload.get("debts", [])
        credit_score = payload.get("credit_score", 0)

        # Only consider high-interest debts for consolidation
        high_interest_debts = [d for d in debts if d["interest_rate"] > 0.10]

        if not high_interest_debts:
            return {
                "recommended": False,
                "reason": "No high-interest debts to consolidate",
            }

        total_balance = sum(d["balance"] for d in high_interest_debts)
        avg_rate = sum(
            d["balance"] * d["interest_rate"] for d in high_interest_debts
        ) / total_balance

        # Estimate consolidation loan rate
        consolidation_rate = self._estimate_refinance_rate("personal_loan", credit_score)

        if not consolidation_rate or consolidation_rate >= avg_rate:
            return {
                "recommended": False,
                "reason": "Consolidation rate not better than current average",
                "current_avg_rate": round(avg_rate * 100, 2),
                "consolidation_rate": (
                    round(consolidation_rate * 100, 2) if consolidation_rate else None
                ),
            }

        # Calculate savings
        months = 60  # 5-year loan
        current_payments = sum(d["minimum_payment"] for d in high_interest_debts)
        consolidated_payment = self._calculate_payment(
            total_balance, consolidation_rate / 12, months
        )

        monthly_savings = current_payments - consolidated_payment
        total_savings = monthly_savings * months

        return {
            "recommended": True,
            "debts_to_consolidate": len(high_interest_debts),
            "total_balance": round(total_balance, 2),
            "current_avg_rate": round(avg_rate * 100, 2),
            "consolidation_rate": round(consolidation_rate * 100, 2),
            "rate_reduction": round((avg_rate - consolidation_rate) * 100, 2),
            "current_monthly_payment": round(current_payments, 2),
            "consolidated_monthly_payment": round(consolidated_payment, 2),
            "monthly_savings": round(monthly_savings, 2),
            "total_savings": round(total_savings, 2),
            "loan_term_months": months,
        }

    # ========== Credit Optimization ==========

    async def _optimize_credit(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Optimize payments for credit score improvement.

        Expected payload:
        {
            "debts": [...],
            "credit_score": 680,
            "extra_payment": 500
        }
        """
        debts = payload.get("debts", [])
        credit_score = payload.get("credit_score", 680)
        payload.get("extra_payment", 0)

        credit_cards = [d for d in debts if d["type"] == "credit_card"]

        recommendations = []

        # Focus on credit utilization
        for card in credit_cards:
            utilization = card["balance"] / card.get("credit_limit", card["balance"])

            if utilization > 0.30:
                target_balance = card.get("credit_limit", card["balance"]) * 0.30
                paydown_needed = card["balance"] - target_balance

                recommendations.append({
                    "type": "utilization",
                    "debt_name": card["name"],
                    "current_utilization": round(utilization * 100, 1),
                    "target_utilization": 30.0,
                    "paydown_needed": round(paydown_needed, 2),
                    "impact": "High - reduces utilization",
                })

        # Payment history optimization
        if any(d["balance"] > 0 for d in debts):
            recommendations.append({
                "type": "payment_history",
                "description": "Make all minimum payments on time",
                "impact": "High - payment history is 35% of score",
            })

        return {
            "current_credit_score": credit_score,
            "recommendations": recommendations,
            "estimated_score_improvement": len(recommendations) * 10,  # Simplified
        }

    # ========== Payment Planning ==========

    async def _create_payment_plan(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create optimized payment schedule.

        Expected payload:
        {
            "debts": [...],
            "extra_payment": 500,
            "months": 36
        }
        """
        debts = payload.get("debts", [])
        extra_payment = payload.get("extra_payment", 0)
        target_months = payload.get("months", 36)

        # Simple payment plan
        monthly_minimum = sum(d["minimum_payment"] for d in debts)
        total_payment = monthly_minimum + extra_payment

        plan = {
            "monthly_payment": round(total_payment, 2),
            "minimum_payment": round(monthly_minimum, 2),
            "extra_payment": round(extra_payment, 2),
            "target_months": target_months,
            "payment_breakdown": [
                {
                    "debt_name": d["name"],
                    "amount": round(d["minimum_payment"], 2),
                }
                for d in debts
            ],
        }

        return plan
