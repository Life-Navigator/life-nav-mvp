"""Savings Specialist Agent.

This L2 specialist agent handles all savings-related tasks including goal tracking,
savings rate analysis, emergency fund recommendations, and savings vehicle optimization.

Capabilities:
    - goal_tracking: Set and monitor savings goals with progress tracking
    - savings_analysis: Analyze savings rate and patterns
    - emergency_fund: Calculate and recommend emergency fund targets
    - vehicle_optimization: Recommend optimal savings vehicles (HYSA, CDs, etc.)
    - progress_monitoring: Track progress toward savings milestones
    - savings_planning: Create comprehensive savings plans

Dependencies:
    - LLM for generating personalized insights and recommendations
    - AdminTracker for metrics collection
    - BaseAgent for core agent functionality

Example usage:
    >>> agent = SavingsSpecialist()
    >>> task = AgentTask(
    ...     task_id="save_001",
    ...     task_type="goal_tracking",
    ...     user_id="user_123",
    ...     payload={
    ...         "goals": [
    ...             {
    ...                 "name": "Emergency Fund",
    ...                 "target_amount": 15000,
    ...                 "current_amount": 8000,
    ...                 "target_date": "2026-12-31"
    ...             }
    ...         ]
    ...     }
    ... )
    >>> result = await agent.handle_task(task)
    >>> print(result["goals"][0]["progress_percentage"])
    53.33
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from agents.core.base_agent import BaseAgent
from models.agent_models import AgentCapability, AgentTask, AgentType
from utils.admin_tracker import track_metrics
from utils.logging import get_logger


class SavingsSpecialist(BaseAgent):
    """L2 Specialist Agent for savings management and goal tracking.

    This agent provides comprehensive savings analysis, goal tracking, and
    recommendations for optimal savings strategies. It analyzes savings rates,
    tracks progress toward goals, and suggests appropriate savings vehicles.

    Attributes:
        llm_client: Client for LLM-based insight generation.
        capabilities: List of agent capabilities with confidence scores.
    """

    def __init__(
        self,
        agent_id: str = "savings_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize the SavingsSpecialist agent.

        Args:
            agent_id: Unique identifier for this agent instance.
            message_bus: Optional message bus for agent communication.
            graphrag_client: Optional GraphRAG client.
            vllm_client: Optional vLLM client for generating insights.
            mcp_client: Optional MCP client for fetching live data.
            config: Optional configuration dict.
        """
        capabilities = [
            AgentCapability(
                name="goal_tracking",
                description="Set and monitor savings goals with progress tracking",
                confidence=0.95,
            ),
            AgentCapability(
                name="savings_analysis",
                description="Analyze savings rate, patterns, and efficiency",
                confidence=0.92,
            ),
            AgentCapability(
                name="emergency_fund",
                description="Calculate and recommend emergency fund targets",
                confidence=0.94,
            ),
            AgentCapability(
                name="vehicle_optimization",
                description="Recommend optimal savings vehicles (HYSA, CDs, etc.)",
                confidence=0.90,
            ),
            AgentCapability(
                name="progress_monitoring",
                description="Track progress toward savings milestones",
                confidence=0.93,
            ),
            AgentCapability(
                name="savings_planning",
                description="Create comprehensive savings plans",
                confidence=0.91,
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

    @track_metrics
    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """Route and handle savings-related tasks.

        Args:
            task: The task to handle with type and payload.

        Returns:
            Dict containing task results.

        Raises:
            ValueError: If task_type is not supported.
        """
        task_type = task.task_type
        user_id = task.user_id

        if task_type == "goal_tracking":
            return await self._track_goals(user_id, task.payload)
        elif task_type == "savings_analysis":
            return await self._analyze_savings(user_id, task.payload)
        elif task_type == "emergency_fund":
            return await self._recommend_emergency_fund(user_id, task.payload)
        elif task_type == "vehicle_optimization":
            return await self._optimize_savings_vehicles(user_id, task.payload)
        elif task_type == "progress_monitoring":
            return await self._monitor_progress(user_id, task.payload)
        elif task_type == "savings_planning":
            return await self._create_savings_plan(user_id, task.payload)
        else:
            raise ValueError(f"Unsupported task type: {task_type}")

    # -------------------------------------------------------------------------
    # Goal Tracking
    # -------------------------------------------------------------------------

    async def _track_goals(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Track savings goals and calculate progress.

        Expected payload:
            {
                "goals": [
                    {
                        "name": str,
                        "target_amount": float,
                        "current_amount": float,
                        "target_date": str (YYYY-MM-DD),
                        "priority": str (optional: "high", "medium", "low")
                    }
                ]
            }

        Returns:
            Dict with goal progress, required monthly savings, and insights.
        """
        goals = payload.get("goals", [])

        if not goals:
            return {
                "success": False,
                "error": "No goals provided",
                "goals": [],
            }

        enriched_goals = []
        today = datetime.now()

        for goal in goals:
            name = goal.get("name", "Unnamed Goal")
            target_amount = float(goal.get("target_amount", 0))
            current_amount = float(goal.get("current_amount", 0))
            target_date_str = goal.get("target_date")
            priority = goal.get("priority", "medium")

            # Parse target date
            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                # Default to 1 year from now if invalid
                target_date = today + timedelta(days=365)

            # Calculate progress
            remaining_amount = max(0, target_amount - current_amount)
            progress_percentage = (
                (current_amount / target_amount * 100)
                if target_amount > 0
                else 0
            )

            # Calculate time remaining
            days_remaining = max(0, (target_date - today).days)
            months_remaining = max(1, days_remaining / 30.44)  # Avg days per month

            # Calculate required monthly savings
            required_monthly = (
                remaining_amount / months_remaining if months_remaining > 0 else 0
            )

            # Determine status
            if current_amount >= target_amount:
                status = "completed"
            elif days_remaining <= 0 and current_amount < target_amount:
                status = "overdue"
            elif required_monthly > current_amount * 0.5:  # More than 50% of current
                status = "at_risk"
            else:
                status = "on_track"

            # Calculate estimated completion date based on current savings rate
            if remaining_amount > 0 and required_monthly > 0:
                # Assume they continue saving at the required rate
                estimated_months = remaining_amount / required_monthly
                estimated_completion = today + timedelta(days=estimated_months * 30.44)
            else:
                estimated_completion = target_date

            enriched_goal = {
                "name": name,
                "target_amount": target_amount,
                "current_amount": current_amount,
                "remaining_amount": remaining_amount,
                "progress_percentage": round(progress_percentage, 2),
                "target_date": target_date.strftime("%Y-%m-%d"),
                "days_remaining": days_remaining,
                "required_monthly_savings": round(required_monthly, 2),
                "status": status,
                "priority": priority,
                "estimated_completion": estimated_completion.strftime("%Y-%m-%d"),
            }

            enriched_goals.append(enriched_goal)

        # Sort goals by priority and status
        priority_order = {"high": 1, "medium": 2, "low": 3}
        status_order = {"overdue": 1, "at_risk": 2, "on_track": 3, "completed": 4}

        enriched_goals.sort(
            key=lambda g: (
                priority_order.get(g["priority"], 2),
                status_order.get(g["status"], 3),
            )
        )

        # Generate LLM insights
        insights = await self._generate_goal_insights(user_id, enriched_goals)

        return {
            "success": True,
            "goals": enriched_goals,
            "total_goals": len(enriched_goals),
            "completed_goals": sum(1 for g in enriched_goals if g["status"] == "completed"),
            "at_risk_goals": sum(1 for g in enriched_goals if g["status"] == "at_risk"),
            "insights": insights,
        }

    async def _generate_goal_insights(
        self, user_id: str, goals: List[Dict[str, Any]]
    ) -> str:
        """Generate personalized insights about savings goals using LLM.

        Args:
            user_id: User identifier.
            goals: List of enriched goal data.

        Returns:
            Human-readable insights about goals.
        """
        if not goals:
            return "No savings goals to analyze."

        # Prepare context for LLM
        goal_summaries = []
        for goal in goals[:5]:  # Limit to top 5 goals
            goal_summaries.append(
                f"- {goal['name']}: ${goal['current_amount']:,.2f} / "
                f"${goal['target_amount']:,.2f} ({goal['progress_percentage']:.1f}% complete), "
                f"Status: {goal['status']}, Priority: {goal['priority']}"
            )

        goal_context = "\n".join(goal_summaries)

        prompt = f"""You are a financial advisor analyzing savings goals. Provide a brief, actionable summary (2-3 sentences) focusing on:
1. Overall progress across goals
2. Any at-risk or overdue goals that need attention
3. One specific recommendation to improve savings outcomes

Savings Goals:
{goal_context}

Provide concise, actionable advice:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback to rule-based insights
            at_risk = [g for g in goals if g["status"] == "at_risk"]
            completed = [g for g in goals if g["status"] == "completed"]

            if at_risk:
                return (
                    f"You have {len(at_risk)} goal(s) at risk of missing their target date. "
                    f"Consider increasing monthly savings or adjusting target dates. "
                    f"Focus on high-priority goals first."
                )
            elif completed:
                return (
                    f"Great job! You've completed {len(completed)} goal(s). "
                    f"Consider setting new goals to maintain momentum. "
                    f"Keep up the excellent savings discipline."
                )
            else:
                return (
                    f"You're tracking {len(goals)} savings goal(s). "
                    f"Stay consistent with your monthly contributions to reach your targets on time."
                )

    # -------------------------------------------------------------------------
    # Savings Analysis
    # -------------------------------------------------------------------------

    async def _analyze_savings(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze savings rate and patterns.

        Expected payload:
            {
                "monthly_income": float,
                "monthly_expenses": float,
                "current_savings": float,
                "historical_savings": [  # Optional
                    {"month": "2025-01", "amount": 500},
                    {"month": "2025-02", "amount": 600}
                ]
            }

        Returns:
            Dict with savings rate analysis and recommendations.
        """
        monthly_income = float(payload.get("monthly_income", 0))
        monthly_expenses = float(payload.get("monthly_expenses", 0))
        current_savings = float(payload.get("current_savings", 0))
        historical_savings = payload.get("historical_savings", [])

        if monthly_income <= 0:
            return {
                "success": False,
                "error": "Monthly income must be greater than 0",
            }

        # Calculate current savings rate
        monthly_surplus = monthly_income - monthly_expenses
        savings_rate = (monthly_surplus / monthly_income * 100) if monthly_income > 0 else 0

        # Analyze historical savings if available
        avg_monthly_savings = 0
        savings_trend = "stable"
        consistency_score = 0

        if historical_savings and len(historical_savings) >= 2:
            amounts = [float(entry.get("amount", 0)) for entry in historical_savings]
            avg_monthly_savings = sum(amounts) / len(amounts)

            # Calculate trend
            if len(amounts) >= 3:
                recent_avg = sum(amounts[-3:]) / 3
                older_avg = sum(amounts[:3]) / 3
                if recent_avg > older_avg * 1.1:
                    savings_trend = "increasing"
                elif recent_avg < older_avg * 0.9:
                    savings_trend = "decreasing"

            # Calculate consistency (coefficient of variation)
            if avg_monthly_savings > 0:
                variance = sum((x - avg_monthly_savings) ** 2 for x in amounts) / len(amounts)
                std_dev = variance ** 0.5
                cv = std_dev / avg_monthly_savings
                # Convert to 0-100 score (lower CV = higher consistency)
                consistency_score = max(0, min(100, 100 - (cv * 100)))
        else:
            avg_monthly_savings = monthly_surplus

        # Benchmark against recommendations
        # Financial experts recommend 20% savings rate
        recommended_rate = 20.0
        rate_comparison = "excellent" if savings_rate >= 20 else (
            "good" if savings_rate >= 10 else "needs_improvement"
        )

        # Calculate projections
        annual_savings = avg_monthly_savings * 12
        five_year_projection = current_savings + (annual_savings * 5)
        ten_year_projection = current_savings + (annual_savings * 10)

        # Assuming 4% annual growth with compound interest
        five_year_with_interest = self._calculate_future_value(
            current_savings, avg_monthly_savings, 0.04, 5
        )
        ten_year_with_interest = self._calculate_future_value(
            current_savings, avg_monthly_savings, 0.04, 10
        )

        # Generate insights
        insights = await self._generate_savings_insights(
            user_id,
            savings_rate,
            avg_monthly_savings,
            savings_trend,
            consistency_score,
        )

        return {
            "success": True,
            "current_savings_rate": round(savings_rate, 2),
            "recommended_savings_rate": recommended_rate,
            "rate_comparison": rate_comparison,
            "monthly_surplus": round(monthly_surplus, 2),
            "avg_monthly_savings": round(avg_monthly_savings, 2),
            "savings_trend": savings_trend,
            "consistency_score": round(consistency_score, 2),
            "projections": {
                "annual_savings": round(annual_savings, 2),
                "five_year_simple": round(five_year_projection, 2),
                "five_year_with_interest": round(five_year_with_interest, 2),
                "ten_year_simple": round(ten_year_projection, 2),
                "ten_year_with_interest": round(ten_year_with_interest, 2),
            },
            "insights": insights,
        }

    def _calculate_future_value(
        self,
        present_value: float,
        monthly_contribution: float,
        annual_rate: float,
        years: int,
    ) -> float:
        """Calculate future value with compound interest.

        Args:
            present_value: Starting balance.
            monthly_contribution: Monthly deposit amount.
            annual_rate: Annual interest rate (e.g., 0.04 for 4%).
            years: Number of years.

        Returns:
            Future value with compound interest.
        """
        monthly_rate = annual_rate / 12
        months = years * 12

        # Future value of present amount
        fv_present = present_value * ((1 + monthly_rate) ** months)

        # Future value of monthly contributions (annuity)
        if monthly_rate > 0:
            fv_contributions = monthly_contribution * (
                ((1 + monthly_rate) ** months - 1) / monthly_rate
            )
        else:
            fv_contributions = monthly_contribution * months

        return fv_present + fv_contributions

    async def _generate_savings_insights(
        self,
        user_id: str,
        savings_rate: float,
        avg_monthly: float,
        trend: str,
        consistency: float,
    ) -> str:
        """Generate insights about savings patterns using LLM.

        Args:
            user_id: User identifier.
            savings_rate: Current savings rate percentage.
            avg_monthly: Average monthly savings amount.
            trend: Savings trend (increasing/decreasing/stable).
            consistency: Consistency score (0-100).

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a financial advisor analyzing savings behavior. Provide brief, actionable advice (2-3 sentences):

Savings Rate: {savings_rate:.1f}% (Recommended: 20%)
Average Monthly Savings: ${avg_monthly:,.2f}
Trend: {trend}
Consistency Score: {consistency:.0f}/100

Provide specific recommendations to improve savings:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if savings_rate >= 20:
                return f"Excellent savings rate of {savings_rate:.1f}%! You're exceeding the recommended 20% benchmark. Consider investing surplus for long-term growth."
            elif savings_rate >= 10:
                return f"Good savings rate of {savings_rate:.1f}%, but aim for 20% to build wealth faster. Review expenses to find areas to cut back."
            else:
                return f"Your {savings_rate:.1f}% savings rate needs improvement. Start with the 50/30/20 rule: 50% needs, 30% wants, 20% savings. Cut discretionary spending first."

    # -------------------------------------------------------------------------
    # Emergency Fund
    # -------------------------------------------------------------------------

    async def _recommend_emergency_fund(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate and recommend emergency fund target.

        Expected payload:
            {
                "monthly_expenses": float,
                "current_emergency_fund": float,
                "employment_stability": str (optional: "stable", "variable", "self_employed"),
                "dependents": int (optional)
            }

        Returns:
            Dict with emergency fund recommendation and timeline.
        """
        monthly_expenses = float(payload.get("monthly_expenses", 0))
        current_fund = float(payload.get("current_emergency_fund", 0))
        employment_stability = payload.get("employment_stability", "stable")
        dependents = int(payload.get("dependents", 0))

        if monthly_expenses <= 0:
            return {
                "success": False,
                "error": "Monthly expenses must be greater than 0",
            }

        # Determine target months based on situation
        if employment_stability == "self_employed" or dependents >= 2:
            target_months = 12  # 12 months for self-employed or families
        elif employment_stability == "variable" or dependents == 1:
            target_months = 6  # 6 months for variable income
        else:
            target_months = 3  # 3-6 months for stable employment (using minimum)

        target_amount = monthly_expenses * target_months
        remaining_needed = max(0, target_amount - current_fund)
        progress_percentage = (
            (current_fund / target_amount * 100) if target_amount > 0 else 0
        )

        # Determine status
        if current_fund >= target_amount:
            status = "fully_funded"
        elif current_fund >= target_amount * 0.75:
            status = "nearly_there"
        elif current_fund >= target_amount * 0.5:
            status = "in_progress"
        elif current_fund >= target_amount * 0.25:
            status = "started"
        else:
            status = "needs_attention"

        # Calculate timeline to reach target
        # Recommend 10-20% of monthly expenses toward emergency fund
        suggested_monthly_contribution = monthly_expenses * 0.15  # 15% of expenses
        months_to_target = (
            remaining_needed / suggested_monthly_contribution
            if suggested_monthly_contribution > 0
            else 0
        )

        # Generate insights
        insights = await self._generate_emergency_fund_insights(
            user_id, status, target_months, current_fund, target_amount
        )

        return {
            "success": True,
            "target_months": target_months,
            "target_amount": round(target_amount, 2),
            "current_amount": round(current_fund, 2),
            "remaining_needed": round(remaining_needed, 2),
            "progress_percentage": round(progress_percentage, 2),
            "status": status,
            "recommended_monthly_contribution": round(suggested_monthly_contribution, 2),
            "months_to_target": round(months_to_target, 1),
            "insights": insights,
        }

    async def _generate_emergency_fund_insights(
        self,
        user_id: str,
        status: str,
        target_months: int,
        current: float,
        target: float,
    ) -> str:
        """Generate emergency fund insights using LLM.

        Args:
            user_id: User identifier.
            status: Fund status.
            target_months: Target months of expenses.
            current: Current fund amount.
            target: Target fund amount.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a financial advisor discussing emergency funds. Provide brief, motivating advice (2-3 sentences):

Status: {status}
Current Fund: ${current:,.2f}
Target Fund: ${target:,.2f} ({target_months} months of expenses)
Progress: {(current/target*100) if target > 0 else 0:.1f}%

Provide specific next steps:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if status == "fully_funded":
                return f"Congratulations! Your emergency fund of ${current:,.2f} fully covers {target_months} months of expenses. Keep it in a high-yield savings account and only touch it for true emergencies."
            elif status == "nearly_there":
                return f"You're almost there! Just ${target - current:,.2f} more to reach your {target_months}-month emergency fund goal. Stay focused and you'll have complete financial security soon."
            else:
                return f"Building an emergency fund is crucial for financial stability. Aim to save {target_months} months of expenses (${target:,.2f}). Start with $1,000 as a mini emergency fund, then build from there."

    # -------------------------------------------------------------------------
    # Vehicle Optimization
    # -------------------------------------------------------------------------

    async def _optimize_savings_vehicles(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Recommend optimal savings vehicles based on goals and timeline.

        Expected payload:
            {
                "amount": float,
                "time_horizon": str ("short" < 1yr, "medium" 1-5yr, "long" > 5yr),
                "liquidity_needs": str ("high", "medium", "low"),
                "risk_tolerance": str ("conservative", "moderate", "aggressive")
            }

        Returns:
            Dict with recommended savings vehicles and their characteristics.
        """
        amount = float(payload.get("amount", 0))
        time_horizon = payload.get("time_horizon", "medium")
        liquidity_needs = payload.get("liquidity_needs", "medium")
        payload.get("risk_tolerance", "conservative")

        if amount <= 0:
            return {
                "success": False,
                "error": "Amount must be greater than 0",
            }

        # Define savings vehicles with current approximate rates (2025)
        vehicles = {
            "high_yield_savings": {
                "name": "High-Yield Savings Account",
                "typical_rate": 4.5,
                "liquidity": "high",
                "risk": "very_low",
                "min_amount": 0,
                "best_for": "Emergency funds, short-term goals",
            },
            "money_market": {
                "name": "Money Market Account",
                "typical_rate": 4.3,
                "liquidity": "high",
                "risk": "very_low",
                "min_amount": 1000,
                "best_for": "Short-term savings with easy access",
            },
            "cd_6month": {
                "name": "6-Month Certificate of Deposit",
                "typical_rate": 4.8,
                "liquidity": "low",
                "risk": "very_low",
                "min_amount": 500,
                "best_for": "Short-term savings with fixed timeline",
            },
            "cd_1year": {
                "name": "1-Year Certificate of Deposit",
                "typical_rate": 5.0,
                "liquidity": "low",
                "risk": "very_low",
                "min_amount": 500,
                "best_for": "Medium-term savings with known timeline",
            },
            "cd_5year": {
                "name": "5-Year Certificate of Deposit",
                "typical_rate": 4.5,
                "liquidity": "very_low",
                "risk": "very_low",
                "min_amount": 500,
                "best_for": "Long-term savings with fixed timeline",
            },
            "treasury_bills": {
                "name": "Treasury Bills (T-Bills)",
                "typical_rate": 4.7,
                "liquidity": "medium",
                "risk": "very_low",
                "min_amount": 100,
                "best_for": "Short-term, safe government-backed savings",
            },
            "i_bonds": {
                "name": "I Bonds (Inflation-Protected)",
                "typical_rate": 3.5,  # Base + inflation adjustment
                "liquidity": "low",
                "risk": "very_low",
                "min_amount": 25,
                "best_for": "Long-term inflation protection (10k/year max)",
            },
        }

        # Score and recommend vehicles based on criteria
        recommendations = []

        for vehicle_id, vehicle in vehicles.items():
            score = 0

            # Time horizon matching
            if time_horizon == "short":
                if vehicle_id in ["high_yield_savings", "money_market", "cd_6month", "treasury_bills"]:
                    score += 3
            elif time_horizon == "medium":
                if vehicle_id in ["cd_1year", "high_yield_savings", "money_market"]:
                    score += 3
            else:  # long
                if vehicle_id in ["cd_5year", "i_bonds"]:
                    score += 3

            # Liquidity matching
            if liquidity_needs == "high":
                if vehicle["liquidity"] in ["high", "medium"]:
                    score += 2
            elif liquidity_needs == "medium":
                if vehicle["liquidity"] == "medium":
                    score += 2
                elif vehicle["liquidity"] == "high":
                    score += 1
            else:  # low
                score += 1  # All vehicles acceptable

            # Amount suitability
            if amount >= vehicle["min_amount"]:
                score += 1

            # Rate competitiveness
            if vehicle["typical_rate"] >= 4.5:
                score += 1

            # Calculate projected earnings
            years = 0.5 if time_horizon == "short" else (3 if time_horizon == "medium" else 5)
            projected_earnings = amount * (vehicle["typical_rate"] / 100) * years

            recommendations.append({
                "vehicle": vehicle["name"],
                "score": score,
                "typical_rate": vehicle["typical_rate"],
                "liquidity": vehicle["liquidity"],
                "risk": vehicle["risk"],
                "best_for": vehicle["best_for"],
                "projected_earnings": round(projected_earnings, 2),
                "time_period_years": years,
            })

        # Sort by score (descending)
        recommendations.sort(key=lambda x: x["score"], reverse=True)

        # Take top 3 recommendations
        top_recommendations = recommendations[:3]

        # Generate insights
        insights = await self._generate_vehicle_insights(
            user_id, amount, time_horizon, liquidity_needs, top_recommendations
        )

        return {
            "success": True,
            "amount": amount,
            "time_horizon": time_horizon,
            "liquidity_needs": liquidity_needs,
            "recommendations": top_recommendations,
            "insights": insights,
        }

    async def _generate_vehicle_insights(
        self,
        user_id: str,
        amount: float,
        time_horizon: str,
        liquidity: str,
        recommendations: List[Dict[str, Any]],
    ) -> str:
        """Generate savings vehicle insights using LLM.

        Args:
            user_id: User identifier.
            amount: Amount to save.
            time_horizon: Time horizon for savings.
            liquidity: Liquidity requirement.
            recommendations: Top recommended vehicles.

        Returns:
            Human-readable insights.
        """
        top_vehicle = recommendations[0]
        prompt = f"""You are a financial advisor recommending savings vehicles. Provide brief advice (2-3 sentences):

Amount: ${amount:,.2f}
Time Horizon: {time_horizon}
Liquidity Needs: {liquidity}

Top Recommendation: {top_vehicle['vehicle']} at {top_vehicle['typical_rate']:.2f}% APY
Projected Earnings: ${top_vehicle['projected_earnings']:,.2f} over {top_vehicle['time_period_years']} years

Explain why this is the best choice:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            return (
                f"For your {time_horizon}-term savings of ${amount:,.2f} with {liquidity} liquidity needs, "
                f"consider a {top_vehicle['vehicle']} at {top_vehicle['typical_rate']:.2f}% APY. "
                f"This could earn approximately ${top_vehicle['projected_earnings']:,.2f} over "
                f"{top_vehicle['time_period_years']} years while maintaining appropriate access to your funds."
            )

    # -------------------------------------------------------------------------
    # Progress Monitoring
    # -------------------------------------------------------------------------

    async def _monitor_progress(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Monitor progress toward savings milestones.

        Expected payload:
            {
                "goal_name": str,
                "target_amount": float,
                "current_amount": float,
                "start_date": str (YYYY-MM-DD),
                "target_date": str (YYYY-MM-DD),
                "historical_balances": [  # Optional
                    {"date": "2025-01-01", "balance": 5000},
                    {"date": "2025-02-01", "balance": 5500}
                ]
            }

        Returns:
            Dict with progress metrics, velocity, and milestone alerts.
        """
        goal_name = payload.get("goal_name", "Savings Goal")
        target_amount = float(payload.get("target_amount", 0))
        current_amount = float(payload.get("current_amount", 0))
        start_date_str = payload.get("start_date")
        target_date_str = payload.get("target_date")
        historical_balances = payload.get("historical_balances", [])

        if target_amount <= 0:
            return {
                "success": False,
                "error": "Target amount must be greater than 0",
            }

        # Parse dates
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            start_date = datetime.now() - timedelta(days=365)

        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            target_date = datetime.now() + timedelta(days=365)

        today = datetime.now()

        # Calculate time metrics
        total_days = (target_date - start_date).days
        days_elapsed = (today - start_date).days
        days_remaining = (target_date - today).days

        time_progress_percentage = (
            (days_elapsed / total_days * 100) if total_days > 0 else 0
        )
        amount_progress_percentage = (
            (current_amount / target_amount * 100) if target_amount > 0 else 0
        )

        # Calculate savings velocity
        if historical_balances and len(historical_balances) >= 2:
            # Sort by date
            historical_balances.sort(key=lambda x: x.get("date", ""))

            # Calculate average monthly growth
            total_growth = 0
            months_counted = 0

            for i in range(1, len(historical_balances)):
                prev_balance = float(historical_balances[i - 1].get("balance", 0))
                curr_balance = float(historical_balances[i].get("balance", 0))
                growth = curr_balance - prev_balance

                total_growth += growth
                months_counted += 1

            avg_monthly_velocity = total_growth / months_counted if months_counted > 0 else 0
        else:
            # Estimate based on current progress
            months_elapsed = max(1, days_elapsed / 30.44)
            avg_monthly_velocity = current_amount / months_elapsed if months_elapsed > 0 else 0

        # Project completion date based on current velocity
        remaining_amount = target_amount - current_amount
        if avg_monthly_velocity > 0:
            months_to_completion = remaining_amount / avg_monthly_velocity
            projected_completion_date = today + timedelta(days=months_to_completion * 30.44)
        else:
            projected_completion_date = None

        # Determine if on track
        if amount_progress_percentage >= time_progress_percentage:
            on_track = True
            pace = "ahead"
        else:
            on_track = False
            pace = "behind"

        # Identify milestone alerts
        milestones = []
        milestone_percentages = [25, 50, 75, 90, 100]

        for pct in milestone_percentages:
            milestone_amount = target_amount * (pct / 100)
            if current_amount >= milestone_amount:
                milestones.append({
                    "percentage": pct,
                    "amount": round(milestone_amount, 2),
                    "achieved": True,
                    "date_achieved": today.strftime("%Y-%m-%d"),  # Approximate
                })
            else:
                # Project when milestone will be reached
                if avg_monthly_velocity > 0:
                    months_to_milestone = (milestone_amount - current_amount) / avg_monthly_velocity
                    projected_date = today + timedelta(days=months_to_milestone * 30.44)
                    milestones.append({
                        "percentage": pct,
                        "amount": round(milestone_amount, 2),
                        "achieved": False,
                        "projected_date": projected_date.strftime("%Y-%m-%d"),
                    })
                else:
                    milestones.append({
                        "percentage": pct,
                        "amount": round(milestone_amount, 2),
                        "achieved": False,
                        "projected_date": None,
                    })

        # Generate insights
        insights = await self._generate_progress_insights(
            user_id, goal_name, on_track, pace, amount_progress_percentage
        )

        result = {
            "success": True,
            "goal_name": goal_name,
            "current_amount": round(current_amount, 2),
            "target_amount": round(target_amount, 2),
            "amount_progress_percentage": round(amount_progress_percentage, 2),
            "time_progress_percentage": round(time_progress_percentage, 2),
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "on_track": on_track,
            "pace": pace,
            "avg_monthly_velocity": round(avg_monthly_velocity, 2),
            "milestones": milestones,
            "insights": insights,
        }

        if projected_completion_date:
            result["projected_completion_date"] = projected_completion_date.strftime("%Y-%m-%d")

        return result

    async def _generate_progress_insights(
        self,
        user_id: str,
        goal_name: str,
        on_track: bool,
        pace: str,
        progress_pct: float,
    ) -> str:
        """Generate progress monitoring insights using LLM.

        Args:
            user_id: User identifier.
            goal_name: Name of the goal.
            on_track: Whether on track to meet goal.
            pace: Pace relative to timeline (ahead/behind).
            progress_pct: Progress percentage.

        Returns:
            Human-readable insights.
        """
        prompt = f"""You are a financial advisor monitoring savings progress. Provide brief, encouraging feedback (2-3 sentences):

Goal: {goal_name}
Progress: {progress_pct:.1f}%
Status: {'On track' if on_track else 'Behind schedule'}
Pace: {pace}

Provide motivating feedback and specific advice:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if pace == "ahead":
                return f"Excellent work on '{goal_name}'! You're {progress_pct:.1f}% complete and ahead of schedule. Your disciplined savings approach is paying off. Consider increasing contributions to reach your goal even sooner."
            else:
                return f"You're {progress_pct:.1f}% of the way to '{goal_name}', but running behind schedule. Review your budget to find areas to increase monthly savings. Small adjustments now can help you get back on track."

    # -------------------------------------------------------------------------
    # Savings Planning
    # -------------------------------------------------------------------------

    async def _create_savings_plan(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a comprehensive savings plan.

        Expected payload:
            {
                "monthly_income": float,
                "monthly_expenses": float,
                "goals": [
                    {
                        "name": str,
                        "target_amount": float,
                        "priority": str ("high", "medium", "low"),
                        "target_date": str (YYYY-MM-DD)
                    }
                ],
                "current_savings": float
            }

        Returns:
            Dict with savings plan including allocation recommendations.
        """
        monthly_income = float(payload.get("monthly_income", 0))
        monthly_expenses = float(payload.get("monthly_expenses", 0))
        goals = payload.get("goals", [])
        float(payload.get("current_savings", 0))

        if monthly_income <= 0:
            return {
                "success": False,
                "error": "Monthly income must be greater than 0",
            }

        # Calculate available monthly savings
        monthly_surplus = monthly_income - monthly_expenses

        if monthly_surplus <= 0:
            return {
                "success": False,
                "error": "Monthly expenses exceed income. Cannot create savings plan without surplus.",
                "recommendation": "Review budget to reduce expenses or increase income before creating a savings plan.",
            }

        # Sort goals by priority
        priority_order = {"high": 1, "medium": 2, "low": 3}
        sorted_goals = sorted(
            goals, key=lambda g: priority_order.get(g.get("priority", "medium"), 2)
        )

        # Allocate savings across goals
        allocations = []
        today = datetime.now()
        total_allocated = 0

        # First, calculate what each goal needs monthly
        goal_requirements = []
        for goal in sorted_goals:
            name = goal.get("name", "Unnamed Goal")
            target_amount = float(goal.get("target_amount", 0))
            priority = goal.get("priority", "medium")
            target_date_str = goal.get("target_date")

            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                target_date = today + timedelta(days=365)

            months_to_goal = max(1, (target_date - today).days / 30.44)
            required_monthly = target_amount / months_to_goal

            goal_requirements.append({
                "name": name,
                "target_amount": target_amount,
                "priority": priority,
                "required_monthly": required_monthly,
                "months_to_goal": months_to_goal,
                "target_date": target_date.strftime("%Y-%m-%d"),
            })

        # Allocate proportionally based on priority weights
        priority_weights = {"high": 0.5, "medium": 0.3, "low": 0.2}
        remaining_surplus = monthly_surplus

        for goal_req in goal_requirements:
            if remaining_surplus <= 0:
                break

            priority = goal_req["priority"]
            weight = priority_weights.get(priority, 0.3)

            # Calculate allocation (don't exceed what's needed)
            weighted_allocation = monthly_surplus * weight
            needed = goal_req["required_monthly"]
            allocation = min(weighted_allocation, needed, remaining_surplus)

            months_to_complete = (
                goal_req["target_amount"] / allocation if allocation > 0 else float("inf")
            )

            allocations.append({
                "goal_name": goal_req["name"],
                "target_amount": goal_req["target_amount"],
                "priority": goal_req["priority"],
                "monthly_allocation": round(allocation, 2),
                "required_monthly": round(goal_req["required_monthly"], 2),
                "target_date": goal_req["target_date"],
                "estimated_months_to_complete": round(months_to_complete, 1),
                "fully_funded": allocation >= goal_req["required_monthly"],
            })

            total_allocated += allocation
            remaining_surplus -= allocation

        # Calculate savings rate
        savings_rate = (total_allocated / monthly_income * 100) if monthly_income > 0 else 0

        # Generate insights
        insights = await self._generate_plan_insights(
            user_id, savings_rate, allocations, remaining_surplus
        )

        return {
            "success": True,
            "monthly_income": round(monthly_income, 2),
            "monthly_expenses": round(monthly_expenses, 2),
            "monthly_surplus": round(monthly_surplus, 2),
            "total_allocated": round(total_allocated, 2),
            "unallocated_surplus": round(remaining_surplus, 2),
            "savings_rate": round(savings_rate, 2),
            "goal_allocations": allocations,
            "insights": insights,
        }

    async def _generate_plan_insights(
        self,
        user_id: str,
        savings_rate: float,
        allocations: List[Dict[str, Any]],
        unallocated: float,
    ) -> str:
        """Generate savings plan insights using LLM.

        Args:
            user_id: User identifier.
            savings_rate: Overall savings rate percentage.
            allocations: List of goal allocations.
            unallocated: Unallocated surplus amount.

        Returns:
            Human-readable insights.
        """
        underfunded = [a for a in allocations if not a["fully_funded"]]

        prompt = f"""You are a financial advisor creating a savings plan. Provide brief, actionable advice (2-3 sentences):

Savings Rate: {savings_rate:.1f}%
Number of Goals: {len(allocations)}
Fully Funded Goals: {len(allocations) - len(underfunded)}/{len(allocations)}
Unallocated Surplus: ${unallocated:,.2f}

Provide specific recommendations for optimizing this plan:"""

        try:
            insights = await self.llm_client.generate(
                prompt=prompt,
                user_id=user_id,
                max_tokens=200,
                temperature=0.7,
            )
            return insights.strip()
        except Exception:
            # Fallback insights
            if unallocated > 100:
                return (
                    f"Your savings plan allocates {savings_rate:.1f}% of income across {len(allocations)} goals. "
                    f"You have ${unallocated:,.2f} in unallocated surplus—consider directing it to high-priority goals "
                    f"or building an emergency fund."
                )
            elif underfunded:
                return (
                    f"Your {savings_rate:.1f}% savings rate covers {len(allocations)} goals, but {len(underfunded)} "
                    f"are underfunded. Consider reducing expenses or adjusting goal timelines to fully fund all priorities."
                )
            else:
                return (
                    f"Excellent savings plan! Your {savings_rate:.1f}% savings rate fully funds all {len(allocations)} goals. "
                    f"Stay disciplined with your monthly contributions to achieve your financial objectives on schedule."
                )

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle read-only savings queries.

        Supported query types:
        - get_savings_rate: Get current savings rate
        - get_goals_summary: Get summary of all savings goals
        - get_emergency_fund_status: Get emergency fund status

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        query_type = query.get("query_type")
        params = query.get("parameters", {})

        if query_type == "get_savings_rate":
            return await self._analyze_savings(params.get("user_id"), params)
        elif query_type == "get_goals_summary":
            return await self._track_goals(params.get("user_id"), params)
        elif query_type == "get_emergency_fund_status":
            return await self._recommend_emergency_fund(params.get("user_id"), params)
        else:
            return {
                "success": False,
                "error": f"Unsupported query type: {query_type}",
                "supported_types": [
                    "get_savings_rate",
                    "get_goals_summary",
                    "get_emergency_fund_status"
                ]
            }
