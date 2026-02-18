"""
InvestmentSpecialist: L2 Specialist Agent for Investment Management

Handles:
- Portfolio analysis (asset allocation, diversification)
- Investment recommendations
- Rebalancing strategies
- Risk assessment
- Performance tracking
- Tax-efficient investing
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class InvestmentSpecialist(BaseAgent):
    """
    L2 Specialist Agent for investment management.

    Capabilities:
    - Portfolio analysis and optimization
    - Asset allocation recommendations
    - Rebalancing strategies
    - Risk assessment and profiling
    - Performance tracking and attribution
    - Tax-loss harvesting opportunities

    Data Requirements (from frontend):
    - Holdings: [{symbol, quantity, cost_basis, current_price}]
    - Accounts: [{account_type, balance, tax_status}]
    - Risk profile: {risk_tolerance, time_horizon, goals}
    - Market data: {prices, historical_returns}
    """

    def __init__(
        self,
        agent_id: str = "investment_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize InvestmentSpecialist agent."""

        capabilities = [
            AgentCapability(
                name="portfolio_analysis",
                description="Analyze portfolio allocation and diversification",
                confidence=0.95,
            ),
            AgentCapability(
                name="investment_recommendations",
                description="Generate personalized investment recommendations",
                confidence=0.90,
            ),
            AgentCapability(
                name="rebalancing",
                description="Create portfolio rebalancing strategies",
                confidence=0.92,
            ),
            AgentCapability(
                name="risk_assessment",
                description="Assess portfolio risk and alignment with goals",
                confidence=0.88,
            ),
            AgentCapability(
                name="performance_tracking",
                description="Track and attribute portfolio performance",
                confidence=0.93,
            ),
            AgentCapability(
                name="tax_optimization",
                description="Identify tax-loss harvesting opportunities",
                confidence=0.85,
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

        # Target allocations by risk profile
        self.TARGET_ALLOCATIONS = {
            "conservative": {"stocks": 0.40, "bonds": 0.50, "cash": 0.10},
            "moderate": {"stocks": 0.60, "bonds": 0.35, "cash": 0.05},
            "aggressive": {"stocks": 0.80, "bonds": 0.18, "cash": 0.02},
        }

    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Handle investment-related tasks.

        Args:
            task: AgentTask with task_type and payload

        Returns:
            Dict with investment analysis and recommendations

        Task Types:
        - portfolio_analysis: Analyze current portfolio
        - investment_recommendations: Suggest investment changes
        - rebalancing: Generate rebalancing plan
        - risk_assessment: Assess portfolio risk
        - performance_tracking: Track portfolio performance
        - tax_optimization: Find tax-loss harvesting opportunities
        """
        try:
            task_type = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Processing {task_type} for user {user_id}")

            # Route to appropriate handler
            if task_type == "portfolio_analysis":
                result = await self._analyze_portfolio(user_id, task.payload)
            elif task_type == "investment_recommendations":
                result = await self._generate_recommendations(user_id, task.payload)
            elif task_type == "rebalancing":
                result = await self._create_rebalancing_plan(user_id, task.payload)
            elif task_type == "risk_assessment":
                result = await self._assess_risk(user_id, task.payload)
            elif task_type == "performance_tracking":
                result = await self._track_performance(user_id, task.payload)
            elif task_type == "tax_optimization":
                result = await self._find_tax_opportunities(user_id, task.payload)
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
            raise TaskExecutionError(f"Investment specialist task failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle investment-related queries.

        Args:
            query: Query dict with query_type and parameters

        Returns:
            Dict with query results
        """
        try:
            query_type = query.get("query_type")

            if query_type == "get_target_allocation":
                risk_profile = query.get("risk_profile", "moderate")
                return {"allocation": self.TARGET_ALLOCATIONS.get(risk_profile)}

            elif query_type == "get_asset_classes":
                return {
                    "asset_classes": ["stocks", "bonds", "cash", "real_estate", "commodities"]
                }

            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Portfolio Analysis ==========

    async def _analyze_portfolio(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze portfolio allocation and diversification.

        Expected payload:
        {
            "holdings": [
                {
                    "symbol": "AAPL",
                    "quantity": 100,
                    "cost_basis": 150.00,
                    "current_price": 180.00,
                    "asset_class": "stocks",
                    "sector": "technology"
                },
                ...
            ],
            "risk_profile": "moderate"
        }
        """
        # Fetch holdings via MCP if available and not provided
        if self.mcp and not payload.get("holdings"):
            context = await self._fetch_investment_context_via_mcp(user_id, payload)
            payload = {**payload, **context}

        holdings = payload.get("holdings", [])
        risk_profile = payload.get("risk_profile", "moderate")

        if not holdings:
            return {
                "total_value": 0,
                "allocation": {},
                "message": "No holdings found",
            }

        # Calculate current allocation
        total_value = sum(
            h["quantity"] * h["current_price"] for h in holdings
        )

        allocation = {}
        sector_allocation = {}

        for holding in holdings:
            asset_class = holding.get("asset_class", "unknown")
            sector = holding.get("sector", "unknown")
            value = holding["quantity"] * holding["current_price"]

            allocation[asset_class] = allocation.get(asset_class, 0) + value
            sector_allocation[sector] = sector_allocation.get(sector, 0) + value

        # Convert to percentages
        allocation = {k: v / total_value for k, v in allocation.items()}
        sector_allocation = {k: v / total_value for k, v in sector_allocation.items()}

        # Get target allocation
        target = self.TARGET_ALLOCATIONS.get(risk_profile, self.TARGET_ALLOCATIONS["moderate"])

        # Calculate allocation drift
        drift = {}
        for asset_class, target_pct in target.items():
            current_pct = allocation.get(asset_class, 0)
            drift[asset_class] = current_pct - target_pct

        # Calculate diversification score (1 = perfect, 0 = concentrated)
        diversification_score = self._calculate_diversification(holdings, total_value)

        # Use LLM for insights
        insights = await self._generate_portfolio_insights(
            allocation, target, drift, sector_allocation, diversification_score
        )

        return {
            "total_value": round(total_value, 2),
            "current_allocation": {k: round(v, 4) for k, v in allocation.items()},
            "target_allocation": target,
            "allocation_drift": {k: round(v, 4) for k, v in drift.items()},
            "sector_allocation": {k: round(v, 4) for k, v in sector_allocation.items()},
            "diversification_score": round(diversification_score, 2),
            "holdings_count": len(holdings),
            "insights": insights,
        }

    def _calculate_diversification(
        self, holdings: List[Dict[str, Any]], total_value: float
    ) -> float:
        """
        Calculate portfolio diversification using Herfindahl index.

        Returns score from 0 (concentrated) to 1 (diversified).
        """
        if not holdings or total_value == 0:
            return 0.0

        # Calculate concentration (Herfindahl index)
        concentration = sum(
            ((h["quantity"] * h["current_price"]) / total_value) ** 2
            for h in holdings
        )

        # Convert to diversification score (inverse of concentration)
        # Perfect diversification with N holdings = 1/N
        # We normalize to 0-1 scale
        max_concentration = 1.0  # All in one holding
        min_concentration = 1 / len(holdings)  # Perfectly diversified

        if concentration >= max_concentration:
            return 0.0
        elif concentration <= min_concentration:
            return 1.0
        else:
            return 1 - ((concentration - min_concentration) / (max_concentration - min_concentration))

    async def _generate_portfolio_insights(
        self,
        allocation: Dict[str, float],
        target: Dict[str, float],
        drift: Dict[str, float],
        sector_allocation: Dict[str, float],
        diversification_score: float,
    ) -> str:
        """Generate human-readable insights using LLM"""
        if not self.vllm:
            return "LLM not available for insights generation"

        prompt = f"""
You are a certified financial advisor analyzing a client's investment portfolio.

Current Allocation:
{self._format_allocation(allocation)}

Target Allocation:
{self._format_allocation(target)}

Allocation Drift:
{self._format_allocation(drift)}

Sector Allocation:
{self._format_allocation(sector_allocation)}

Diversification Score: {diversification_score:.2f} (0=concentrated, 1=diversified)

Provide 3-5 specific, actionable insights about this portfolio:
1. How well is it aligned with the target allocation?
2. What are the main risks (concentration, sector exposure)?
3. What actions should the investor consider?

Keep insights brief and specific to the numbers provided.
"""

        try:
            response = await self.vllm.chat(
                prompt=prompt,
                temperature=0.3,  # Lower for more factual
                max_tokens=512,
            )
            return response
        except Exception as e:
            self.logger.warning(f"LLM insights generation failed: {e}")
            return "Portfolio analysis complete. Consider rebalancing if drift exceeds 5%."

    def _format_allocation(self, allocation: Dict[str, float]) -> str:
        """Format allocation dict for display"""
        return "\n".join(
            f"  {asset}: {pct*100:.1f}%" for asset, pct in allocation.items()
        )

    # ========== Investment Recommendations ==========

    async def _generate_recommendations(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate personalized investment recommendations.

        Expected payload:
        {
            "portfolio_analysis": {...},  # From analyze_portfolio
            "risk_profile": "moderate",
            "goals": ["retirement", "house_down_payment"],
            "time_horizon_years": 20
        }
        """
        portfolio = payload.get("portfolio_analysis", {})
        risk_profile = payload.get("risk_profile", "moderate")
        goals = payload.get("goals", [])
        time_horizon = payload.get("time_horizon_years", 10)

        recommendations = []

        # Check if rebalancing needed
        drift = portfolio.get("allocation_drift", {})
        needs_rebalancing = any(abs(d) > 0.05 for d in drift.values())

        if needs_rebalancing:
            recommendations.append({
                "type": "rebalancing",
                "priority": "high",
                "description": "Portfolio has drifted more than 5% from target allocation",
                "action": "Rebalance to target allocation",
                "impact": "Restore risk profile to target level"
            })

        # Check diversification
        diversification_score = portfolio.get("diversification_score", 0)
        if diversification_score < 0.7:
            recommendations.append({
                "type": "diversification",
                "priority": "medium",
                "description": f"Portfolio diversification score is {diversification_score:.2f}",
                "action": "Increase number of holdings or use index funds",
                "impact": "Reduce concentration risk"
            })

        # Tax optimization opportunities
        if payload.get("tax_optimization_available"):
            recommendations.append({
                "type": "tax_optimization",
                "priority": "medium",
                "description": "Tax-loss harvesting opportunities identified",
                "action": "Review tax-loss harvesting suggestions",
                "impact": "Reduce tax liability while maintaining exposure"
            })

        # Use LLM for additional personalized recommendations
        if self.vllm:
            llm_recommendations = await self._generate_llm_recommendations(
                portfolio, risk_profile, goals, time_horizon
            )
            recommendations.append({
                "type": "personalized",
                "priority": "low",
                "description": "AI-generated recommendations",
                "action": llm_recommendations,
                "impact": "Optimize for your specific goals"
            })

        return {
            "recommendations": recommendations,
            "needs_rebalancing": needs_rebalancing,
            "recommendation_count": len(recommendations),
        }

    async def _generate_llm_recommendations(
        self,
        portfolio: Dict[str, Any],
        risk_profile: str,
        goals: List[str],
        time_horizon: int,
    ) -> str:
        """Generate personalized recommendations using LLM"""
        prompt = f"""
You are a certified financial advisor providing investment recommendations.

Client Profile:
- Risk Profile: {risk_profile}
- Investment Goals: {', '.join(goals)}
- Time Horizon: {time_horizon} years

Current Portfolio:
- Total Value: ${portfolio.get('total_value', 0):,.2f}
- Allocation: {self._format_allocation(portfolio.get('current_allocation', {}))}
- Diversification: {portfolio.get('diversification_score', 0):.2f}

Provide 2-3 specific investment recommendations for this client.
Focus on actionable steps they can take to improve their portfolio.
"""

        try:
            response = await self.vllm.chat(
                prompt=prompt,
                temperature=0.4,
                max_tokens=400,
            )
            return response
        except Exception as e:
            self.logger.warning(f"LLM recommendation generation failed: {e}")
            return "Consider consulting with a financial advisor for personalized recommendations."

    # ========== Rebalancing ==========

    async def _create_rebalancing_plan(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create portfolio rebalancing plan.

        Expected payload:
        {
            "holdings": [...],
            "target_allocation": {"stocks": 0.6, "bonds": 0.35, "cash": 0.05},
            "rebalancing_threshold": 0.05  # 5%
        }
        """
        holdings = payload.get("holdings", [])
        target = payload.get("target_allocation", self.TARGET_ALLOCATIONS["moderate"])
        threshold = payload.get("rebalancing_threshold", 0.05)

        # Current allocation
        total_value = sum(h["quantity"] * h["current_price"] for h in holdings)

        current_allocation = {}
        for holding in holdings:
            asset_class = holding.get("asset_class", "unknown")
            value = holding["quantity"] * holding["current_price"]
            current_allocation[asset_class] = current_allocation.get(asset_class, 0) + value

        current_allocation = {k: v / total_value for k, v in current_allocation.items()}

        # Calculate trades needed
        trades = []
        for asset_class, target_pct in target.items():
            current_pct = current_allocation.get(asset_class, 0)
            drift = current_pct - target_pct

            if abs(drift) > threshold:
                target_value = total_value * target_pct
                current_value = current_allocation.get(asset_class, 0) * total_value
                trade_amount = target_value - current_value

                action = "buy" if trade_amount > 0 else "sell"
                trades.append({
                    "asset_class": asset_class,
                    "action": action,
                    "amount": abs(trade_amount),
                    "current_percentage": round(current_pct * 100, 2),
                    "target_percentage": round(target_pct * 100, 2),
                    "drift_percentage": round(drift * 100, 2),
                })

        return {
            "needs_rebalancing": len(trades) > 0,
            "trades": trades,
            "total_value": round(total_value, 2),
            "estimated_trades": len(trades),
        }

    # ========== Risk Assessment ==========

    async def _assess_risk(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Assess portfolio risk level.

        Expected payload:
        {
            "holdings": [...],
            "risk_tolerance": "moderate",
            "time_horizon_years": 20
        }
        """
        holdings = payload.get("holdings", [])
        risk_tolerance = payload.get("risk_tolerance", "moderate")

        # Calculate volatility-based risk score
        # Simplified: stocks=high risk, bonds=medium, cash=low
        risk_weights = {
            "stocks": 1.0,
            "bonds": 0.4,
            "cash": 0.1,
            "real_estate": 0.7,
            "commodities": 0.8,
        }

        total_value = sum(h["quantity"] * h["current_price"] for h in holdings)
        weighted_risk = 0

        for holding in holdings:
            asset_class = holding.get("asset_class", "stocks")
            value = holding["quantity"] * holding["current_price"]
            weight = value / total_value if total_value > 0 else 0
            risk = risk_weights.get(asset_class, 1.0)
            weighted_risk += weight * risk

        # Normalize to 0-100 scale
        risk_score = int(weighted_risk * 100)

        # Assess alignment
        risk_ranges = {
            "conservative": (0, 50),
            "moderate": (40, 70),
            "aggressive": (65, 100),
        }

        min_risk, max_risk = risk_ranges.get(risk_tolerance, (40, 70))
        aligned = min_risk <= risk_score <= max_risk

        return {
            "risk_score": risk_score,
            "risk_level": self._risk_score_to_level(risk_score),
            "target_risk_tolerance": risk_tolerance,
            "aligned": aligned,
            "message": (
                "Portfolio risk aligns with tolerance"
                if aligned
                else f"Portfolio risk ({risk_score}) outside target range ({min_risk}-{max_risk})"
            ),
        }

    def _risk_score_to_level(self, score: int) -> str:
        """Convert risk score to level"""
        if score < 40:
            return "conservative"
        elif score < 70:
            return "moderate"
        else:
            return "aggressive"

    # ========== Performance Tracking ==========

    async def _track_performance(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Track portfolio performance.

        Expected payload:
        {
            "holdings": [...],
            "period_days": 30
        }
        """
        holdings = payload.get("holdings", [])

        total_value = 0
        total_cost_basis = 0
        total_gain = 0

        for holding in holdings:
            quantity = holding["quantity"]
            cost_basis = holding["cost_basis"]
            current_price = holding["current_price"]

            value = quantity * current_price
            cost = quantity * cost_basis
            gain = value - cost

            total_value += value
            total_cost_basis += cost
            total_gain += gain

        # Calculate returns
        total_return_pct = (
            (total_gain / total_cost_basis * 100) if total_cost_basis > 0 else 0
        )

        return {
            "total_value": round(total_value, 2),
            "total_cost_basis": round(total_cost_basis, 2),
            "total_gain": round(total_gain, 2),
            "total_return_percentage": round(total_return_pct, 2),
            "holdings_count": len(holdings),
        }

    # ========== Tax Optimization ==========

    async def _find_tax_opportunities(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Identify tax-loss harvesting opportunities.

        Expected payload:
        {
            "holdings": [...]
        }
        """
        holdings = payload.get("holdings", [])

        opportunities = []

        for holding in holdings:
            quantity = holding["quantity"]
            cost_basis = holding["cost_basis"]
            current_price = holding["current_price"]

            value = quantity * current_price
            cost = quantity * cost_basis
            loss = cost - value

            # Tax-loss harvesting opportunity if loss > $100
            if loss > 100:
                opportunities.append({
                    "symbol": holding["symbol"],
                    "quantity": quantity,
                    "cost_basis": round(cost_basis, 2),
                    "current_price": round(current_price, 2),
                    "unrealized_loss": round(loss, 2),
                    "tax_savings_estimate": round(loss * 0.25, 2),  # Assume 25% tax rate
                })

        opportunities.sort(key=lambda x: x["unrealized_loss"], reverse=True)

        total_loss = sum(o["unrealized_loss"] for o in opportunities)
        total_savings = sum(o["tax_savings_estimate"] for o in opportunities)

        return {
            "opportunities": opportunities,
            "opportunity_count": len(opportunities),
            "total_unrealized_loss": round(total_loss, 2),
            "estimated_tax_savings": round(total_savings, 2),
        }

    # ========== MCP Integration ==========

    async def _fetch_investment_context_via_mcp(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Fetch investment portfolio data via MCP.

        Returns:
            Dict with holdings and crypto_holdings (if requested)
        """
        if not self.mcp:
            return {}

        try:
            self.logger.info(f"Fetching investment context via MCP for user {user_id}")

            # Extract parameters
            session_id = payload.get("session_id", f"session_{user_id[:8]}")
            include_crypto = payload.get("include_crypto", True)

            # Fetch from MCP
            from uuid import UUID
            mcp_context = await self.mcp.get_investment_context(
                user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                session_id=session_id,
                include_crypto=include_crypto
            )

            # Transform MCP response to expected format
            # MCP returns: {"portfolio": {...}, "crypto_holdings": {...}}
            # We need to extract holdings array
            return {
                "holdings": mcp_context.get("portfolio", {}).get("holdings", []),
                "crypto_holdings": mcp_context.get("crypto_holdings", []),
            }

        except Exception as e:
            self.logger.warning(f"MCP fetch failed: {e}, using payload data")
            return {}
