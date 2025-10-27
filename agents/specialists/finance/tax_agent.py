"""
TaxSpecialist: L2 Specialist Agent for Tax Planning and Optimization

Handles:
- Tax estimation (federal, state, local)
- Deduction optimization
- Tax planning strategies
- Tax bracket analysis
- Withholding adjustments
- Estimated tax payments
- Tax document preparation guidance
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from agents.core.base_agent import BaseAgent
from models.agent_models import (
    AgentTask,
    AgentType,
    AgentCapability,
)
from utils.logging import get_logger
from utils.errors import TaskExecutionError


class TaxSpecialist(BaseAgent):
    """
    L2 Specialist Agent for tax planning and optimization.

    Capabilities:
    - Tax estimation and liability calculation
    - Deduction identification and optimization
    - Tax bracket analysis and planning
    - Withholding recommendation
    - Estimated tax payment calculation
    - Tax-advantaged account guidance

    Data Requirements (from frontend):
    - Income: [{type, amount, source, frequency}]
    - Deductions: [{type, amount, category}]
    - Credits: [{type, amount}]
    - Filing status: single, married, head_of_household
    - State: for state tax calculation
    """

    # 2025 Federal Tax Brackets (updated annually)
    FEDERAL_BRACKETS_2025 = {
        "single": [
            (11600, 0.10),
            (47150, 0.12),
            (100525, 0.22),
            (191950, 0.24),
            (243725, 0.32),
            (609350, 0.35),
            (float("inf"), 0.37),
        ],
        "married_jointly": [
            (23200, 0.10),
            (94300, 0.12),
            (201050, 0.22),
            (383900, 0.24),
            (487450, 0.32),
            (731200, 0.35),
            (float("inf"), 0.37),
        ],
        "head_of_household": [
            (16550, 0.10),
            (63100, 0.12),
            (100500, 0.22),
            (191950, 0.24),
            (243700, 0.32),
            (609350, 0.35),
            (float("inf"), 0.37),
        ],
    }

    # Standard deductions for 2025
    STANDARD_DEDUCTIONS_2025 = {
        "single": 14600,
        "married_jointly": 29200,
        "head_of_household": 21900,
    }

    def __init__(
        self,
        agent_id: str = "tax_specialist",
        message_bus=None,
        graphrag_client=None,
        vllm_client=None,
        mcp_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """Initialize TaxSpecialist agent."""

        capabilities = [
            AgentCapability(
                name="tax_estimation",
                description="Estimate federal and state tax liability",
                confidence=0.93,
            ),
            AgentCapability(
                name="deduction_optimization",
                description="Identify and optimize tax deductions",
                confidence=0.90,
            ),
            AgentCapability(
                name="tax_planning",
                description="Create tax planning strategies",
                confidence=0.88,
            ),
            AgentCapability(
                name="bracket_analysis",
                description="Analyze tax brackets and marginal rates",
                confidence=0.92,
            ),
            AgentCapability(
                name="withholding_adjustment",
                description="Recommend W-4 withholding adjustments",
                confidence=0.85,
            ),
            AgentCapability(
                name="estimated_taxes",
                description="Calculate quarterly estimated tax payments",
                confidence=0.87,
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
        Handle tax-related tasks.

        Args:
            task: AgentTask with task_type and payload

        Returns:
            Dict with tax analysis and recommendations

        Task Types:
        - tax_estimation: Estimate tax liability
        - deduction_optimization: Find deduction opportunities
        - tax_planning: Create tax planning strategy
        - bracket_analysis: Analyze tax brackets
        - withholding_adjustment: Recommend withholding changes
        - estimated_taxes: Calculate quarterly estimated payments
        """
        try:
            task_type = task.task_type
            user_id = task.metadata.user_id

            self.logger.info(f"Processing {task_type} for user {user_id}")

            # Route to appropriate handler
            if task_type == "tax_estimation":
                result = await self._estimate_tax(user_id, task.payload)
            elif task_type == "deduction_optimization":
                result = await self._optimize_deductions(user_id, task.payload)
            elif task_type == "tax_planning":
                result = await self._create_tax_plan(user_id, task.payload)
            elif task_type == "bracket_analysis":
                result = await self._analyze_brackets(user_id, task.payload)
            elif task_type == "withholding_adjustment":
                result = await self._recommend_withholding(user_id, task.payload)
            elif task_type == "estimated_taxes":
                result = await self._calculate_estimated_taxes(user_id, task.payload)
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
            raise TaskExecutionError(f"Tax specialist task failed: {str(e)}")

    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tax-related queries."""
        try:
            query_type = query.get("query_type")

            if query_type == "get_tax_brackets":
                filing_status = query.get("filing_status", "single")
                return {"brackets": self.FEDERAL_BRACKETS_2025.get(filing_status)}

            elif query_type == "get_standard_deduction":
                filing_status = query.get("filing_status", "single")
                return {"deduction": self.STANDARD_DEDUCTIONS_2025.get(filing_status)}

            else:
                return {"status": "error", "message": f"Unknown query type: {query_type}"}

        except Exception as e:
            self.logger.error(f"Query execution failed: {e}", error=e)
            return {"status": "error", "message": str(e)}

    # ========== Tax Estimation ==========

    async def _estimate_tax(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Estimate federal tax liability.

        Expected payload:
        {
            "income": [
                {"type": "w2_wages", "amount": 85000},
                {"type": "interest", "amount": 1200},
                {"type": "dividends", "amount": 3000}
            ],
            "filing_status": "single",
            "deductions": [
                {"type": "mortgage_interest", "amount": 12000},
                {"type": "property_tax", "amount": 8000},
                {"type": "charitable", "amount": 5000}
            ],
            "credits": [
                {"type": "child_tax_credit", "amount": 2000}
            ],
            "state": "CA"  # For state tax estimation
        }
        """
        income_items = payload.get("income", [])
        filing_status = payload.get("filing_status", "single")
        deduction_items = payload.get("deductions", [])
        credit_items = payload.get("credits", [])

        # Calculate total income
        total_income = sum(item["amount"] for item in income_items)

        # Calculate deductions
        itemized_deductions = sum(item["amount"] for item in deduction_items)
        standard_deduction = self.STANDARD_DEDUCTIONS_2025.get(filing_status, 14600)

        # Use higher of standard or itemized
        deduction = max(itemized_deductions, standard_deduction)
        using_itemized = itemized_deductions > standard_deduction

        # Calculate AGI and taxable income
        agi = total_income  # Simplified (would include above-the-line deductions)
        taxable_income = max(0, agi - deduction)

        # Calculate federal tax
        federal_tax = self._calculate_federal_tax(taxable_income, filing_status)

        # Apply credits
        total_credits = sum(item["amount"] for item in credit_items)
        federal_tax_after_credits = max(0, federal_tax - total_credits)

        # Calculate effective rate
        effective_rate = (
            (federal_tax_after_credits / total_income * 100)
            if total_income > 0
            else 0
        )

        # Get marginal rate
        marginal_rate = self._get_marginal_rate(taxable_income, filing_status)

        # Generate tax-saving recommendations
        recommendations = await self._generate_tax_recommendations(
            total_income,
            taxable_income,
            using_itemized,
            itemized_deductions,
            standard_deduction,
        )

        return {
            "total_income": round(total_income, 2),
            "agi": round(agi, 2),
            "deduction_used": round(deduction, 2),
            "deduction_type": "itemized" if using_itemized else "standard",
            "taxable_income": round(taxable_income, 2),
            "federal_tax": round(federal_tax, 2),
            "total_credits": round(total_credits, 2),
            "federal_tax_after_credits": round(federal_tax_after_credits, 2),
            "effective_tax_rate": round(effective_rate, 2),
            "marginal_tax_rate": round(marginal_rate * 100, 2),
            "recommendations": recommendations,
        }

    def _calculate_federal_tax(
        self, taxable_income: float, filing_status: str
    ) -> float:
        """Calculate federal tax using brackets"""
        brackets = self.FEDERAL_BRACKETS_2025.get(filing_status, self.FEDERAL_BRACKETS_2025["single"])

        tax = 0
        previous_bracket = 0

        for bracket_limit, rate in brackets:
            if taxable_income <= previous_bracket:
                break

            taxable_in_bracket = min(taxable_income, bracket_limit) - previous_bracket
            tax += taxable_in_bracket * rate

            if taxable_income <= bracket_limit:
                break

            previous_bracket = bracket_limit

        return tax

    def _get_marginal_rate(self, taxable_income: float, filing_status: str) -> float:
        """Get marginal tax rate for given income"""
        brackets = self.FEDERAL_BRACKETS_2025.get(filing_status, self.FEDERAL_BRACKETS_2025["single"])

        for bracket_limit, rate in brackets:
            if taxable_income <= bracket_limit:
                return rate

        return brackets[-1][1]  # Highest rate

    async def _generate_tax_recommendations(
        self,
        total_income: float,
        taxable_income: float,
        using_itemized: bool,
        itemized_total: float,
        standard_deduction: float,
    ) -> List[Dict[str, Any]]:
        """Generate tax-saving recommendations"""
        recommendations = []

        # Itemized vs standard deduction
        if not using_itemized and (standard_deduction - itemized_total) < 2000:
            recommendations.append({
                "category": "deductions",
                "priority": "medium",
                "description": f"You're ${standard_deduction - itemized_total:.2f} away from itemizing",
                "action": "Consider additional deductible expenses (charitable, mortgage interest)",
                "potential_savings": round((standard_deduction - itemized_total) * 0.22, 2),
            })

        # Tax-advantaged accounts
        if total_income > 50000:
            max_401k = 23000  # 2025 limit
            potential_savings = min(total_income * 0.15, max_401k) * 0.22

            recommendations.append({
                "category": "retirement",
                "priority": "high",
                "description": "Maximize 401(k) contributions",
                "action": f"Contribute up to ${max_401k:,} to reduce taxable income",
                "potential_savings": round(potential_savings, 2),
            })

        # HSA contribution
        if total_income > 30000:
            hsa_limit = 4150  # 2025 individual limit
            recommendations.append({
                "category": "healthcare",
                "priority": "medium",
                "description": "Health Savings Account (HSA) offers triple tax advantage",
                "action": f"Contribute up to ${hsa_limit:,} if eligible",
                "potential_savings": round(hsa_limit * 0.22, 2),
            })

        # Use LLM for additional personalized recommendations
        if self.vllm:
            try:
                llm_recommendation = await self._get_llm_tax_advice(
                    total_income, taxable_income, using_itemized
                )
                recommendations.append({
                    "category": "personalized",
                    "priority": "low",
                    "description": "AI-generated tax strategy",
                    "action": llm_recommendation,
                    "potential_savings": 0,
                })
            except Exception as e:
                self.logger.warning(f"LLM tax advice generation failed: {e}")

        return recommendations

    async def _get_llm_tax_advice(
        self, total_income: float, taxable_income: float, using_itemized: bool
    ) -> str:
        """Generate personalized tax advice using LLM"""
        prompt = f"""
You are a certified tax advisor providing tax planning advice.

Client Situation:
- Total Income: ${total_income:,.2f}
- Taxable Income: ${taxable_income:,.2f}
- Deduction Method: {"Itemized" if using_itemized else "Standard"}

Provide 2-3 specific, actionable tax planning strategies for this client.
Focus on legal, common strategies to reduce tax liability.
Keep advice brief and specific.
"""

        response = await self.vllm.chat(
            prompt=prompt,
            temperature=0.3,
            max_tokens=300,
        )
        return response

    # ========== Deduction Optimization ==========

    async def _optimize_deductions(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Identify deduction optimization opportunities.

        Expected payload:
        {
            "transactions": [...],  # From BudgetSpecialist
            "filing_status": "single",
            "has_mortgage": true,
            "has_children": false
        }
        """
        transactions = payload.get("transactions", [])
        filing_status = payload.get("filing_status", "single")
        has_mortgage = payload.get("has_mortgage", False)
        has_children = payload.get("has_children", False)

        # Categorize potentially deductible expenses
        deductible_categories = {
            "charitable": ["charity", "donation", "nonprofit"],
            "medical": ["doctor", "hospital", "pharmacy", "dental"],
            "state_taxes": ["dmv", "property_tax"],
            "business": ["office", "business", "professional"],
        }

        found_deductions = {category: 0 for category in deductible_categories}

        for tx in transactions:
            description = tx.get("description", "").lower()
            category = tx.get("category", "").lower()
            amount = abs(tx.get("amount", 0))

            for deduction_type, keywords in deductible_categories.items():
                if any(keyword in description or keyword in category for keyword in keywords):
                    found_deductions[deduction_type] += amount

        # Calculate potential itemized deduction
        itemized_total = sum(found_deductions.values())
        standard_deduction = self.STANDARD_DEDUCTIONS_2025.get(filing_status, 14600)

        should_itemize = itemized_total > standard_deduction
        gap = abs(itemized_total - standard_deduction)

        opportunities = []

        if not should_itemize and gap < 5000:
            opportunities.append({
                "type": "itemize_threshold",
                "description": f"You're ${gap:.2f} away from itemizing",
                "action": "Consider bunching deductible expenses",
                "potential_benefit": round(gap * 0.22, 2),
            })

        # Specific opportunities
        if found_deductions["charitable"] < 5000 and total_income > 50000:
            opportunities.append({
                "type": "charitable",
                "description": "Low charitable contributions detected",
                "action": "Consider donor-advised fund or qualified charitable distribution",
                "potential_benefit": round(5000 * 0.22, 2),
            })

        if has_mortgage and found_deductions.get("mortgage_interest", 0) == 0:
            opportunities.append({
                "type": "mortgage_interest",
                "description": "Mortgage interest not captured",
                "action": "Ensure Form 1098 is included in tax documents",
                "potential_benefit": 0,  # Unknown without data
            })

        return {
            "found_deductions": {k: round(v, 2) for k, v in found_deductions.items()},
            "itemized_total": round(itemized_total, 2),
            "standard_deduction": standard_deduction,
            "should_itemize": should_itemize,
            "gap_to_itemize": round(gap, 2),
            "opportunities": opportunities,
        }

    # ========== Tax Planning ==========

    async def _create_tax_plan(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create comprehensive tax planning strategy.

        Expected payload:
        {
            "current_tax_estimate": {...},  # From tax_estimation
            "income_growth_expected": 0.05,  # 5% growth
            "planning_years": 3
        }
        """
        current_estimate = payload.get("current_tax_estimate", {})
        growth_rate = payload.get("income_growth_expected", 0.03)
        years = payload.get("planning_years", 3)

        current_income = current_estimate.get("total_income", 0)
        current_tax = current_estimate.get("federal_tax_after_credits", 0)

        # Project future years
        projections = []
        for year in range(1, years + 1):
            projected_income = current_income * ((1 + growth_rate) ** year)
            projected_tax = projected_income * 0.22  # Simplified

            projections.append({
                "year": datetime.now().year + year,
                "projected_income": round(projected_income, 2),
                "projected_tax": round(projected_tax, 2),
                "effective_rate": 22.0,  # Simplified
            })

        strategies = [
            {
                "strategy": "Max out retirement accounts",
                "annual_impact": -5060,  # $23k * 0.22 marginal rate
                "description": "Contribute maximum to 401(k) and IRA",
            },
            {
                "strategy": "Use HSA if eligible",
                "annual_impact": -913,  # $4150 * 0.22
                "description": "Triple tax advantage for healthcare",
            },
            {
                "strategy": "Tax-loss harvesting",
                "annual_impact": -750,  # Estimated
                "description": "Offset gains with losses annually",
            },
        ]

        total_annual_savings = sum(s["annual_impact"] for s in strategies)

        return {
            "current_year": datetime.now().year,
            "projections": projections,
            "strategies": strategies,
            "total_annual_savings": round(abs(total_annual_savings), 2),
            "three_year_savings": round(abs(total_annual_savings * 3), 2),
        }

    # ========== Bracket Analysis ==========

    async def _analyze_brackets(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze tax bracket positioning.

        Expected payload:
        {
            "taxable_income": 85000,
            "filing_status": "single"
        }
        """
        taxable_income = payload.get("taxable_income", 0)
        filing_status = payload.get("filing_status", "single")

        brackets = self.FEDERAL_BRACKETS_2025.get(filing_status, self.FEDERAL_BRACKETS_2025["single"])

        # Find current bracket
        current_bracket_idx = 0
        for idx, (limit, rate) in enumerate(brackets):
            if taxable_income <= limit:
                current_bracket_idx = idx
                break

        current_rate = brackets[current_bracket_idx][1]
        current_limit = brackets[current_bracket_idx][0]

        # Distance to next bracket
        if current_bracket_idx < len(brackets) - 1:
            next_limit = brackets[current_bracket_idx + 1][0]
            distance_to_next = next_limit - taxable_income
            next_rate = brackets[current_bracket_idx + 1][1]
        else:
            distance_to_next = 0
            next_rate = current_rate

        return {
            "current_taxable_income": round(taxable_income, 2),
            "current_marginal_rate": round(current_rate * 100, 2),
            "current_bracket_limit": current_limit,
            "distance_to_next_bracket": round(distance_to_next, 2),
            "next_marginal_rate": round(next_rate * 100, 2),
            "all_brackets": [
                {"limit": limit, "rate": round(rate * 100, 2)}
                for limit, rate in brackets
            ],
        }

    # ========== Withholding Adjustment ==========

    async def _recommend_withholding(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Recommend W-4 withholding adjustments.

        Expected payload:
        {
            "estimated_annual_tax": 18500,
            "year_to_date_withholding": 12000,
            "pay_periods_remaining": 12,
            "biweekly_gross": 3250
        }
        """
        estimated_tax = payload.get("estimated_annual_tax", 0)
        ytd_withholding = payload.get("year_to_date_withholding", 0)
        periods_remaining = payload.get("pay_periods_remaining", 26)
        biweekly_gross = payload.get("biweekly_gross", 0)

        # Calculate adjustment needed
        total_needed = estimated_tax - ytd_withholding
        per_paycheck_needed = total_needed / periods_remaining if periods_remaining > 0 else 0

        # Current withholding rate
        current_rate = (
            (ytd_withholding / (biweekly_gross * (26 - periods_remaining))) * 100
            if biweekly_gross > 0 and periods_remaining < 26
            else 0
        )

        recommended_rate = (per_paycheck_needed / biweekly_gross) * 100 if biweekly_gross > 0 else 0

        status = "over_withheld" if total_needed < 0 else "under_withheld"

        return {
            "estimated_annual_tax": round(estimated_tax, 2),
            "ytd_withholding": round(ytd_withholding, 2),
            "additional_withholding_needed": round(total_needed, 2),
            "per_paycheck_adjustment": round(per_paycheck_needed, 2),
            "current_withholding_rate": round(current_rate, 2),
            "recommended_withholding_rate": round(recommended_rate, 2),
            "status": status,
            "action": (
                "Increase withholding to avoid underpayment penalty"
                if status == "under_withheld"
                else "Decrease withholding to increase take-home pay"
            ),
        }

    # ========== Estimated Taxes ==========

    async def _calculate_estimated_taxes(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate quarterly estimated tax payments.

        Expected payload:
        {
            "estimated_annual_tax": 24000,
            "withholding": 0,  # For self-employed
            "previous_year_tax": 22000
        }
        """
        estimated_tax = payload.get("estimated_annual_tax", 0)
        withholding = payload.get("withholding", 0)
        previous_year_tax = payload.get("previous_year_tax", 0)

        # Calculate required payment (lesser of 90% current or 100% prior)
        required_payment = min(estimated_tax * 0.9, previous_year_tax)

        # Subtract withholding
        estimated_payment_needed = max(0, required_payment - withholding)

        # Quarterly payments
        quarterly_payment = estimated_payment_needed / 4

        # Due dates (approximate)
        current_year = datetime.now().year
        due_dates = [
            f"{current_year}-04-15",
            f"{current_year}-06-15",
            f"{current_year}-09-15",
            f"{current_year + 1}-01-15",
        ]

        return {
            "estimated_annual_tax": round(estimated_tax, 2),
            "required_annual_payment": round(required_payment, 2),
            "withholding": round(withholding, 2),
            "estimated_payment_needed": round(estimated_payment_needed, 2),
            "quarterly_payment": round(quarterly_payment, 2),
            "due_dates": due_dates,
            "safe_harbor": "Paying 100% of prior year tax to avoid penalty",
        }

    # ========== MCP Integration ==========

    async def _fetch_tax_context_via_mcp(
        self, user_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Fetch tax-related data via MCP.

        Returns:
            Dict with paystubs, investment_portfolio, and tax_year
        """
        if not self.mcp:
            return {}

        try:
            self.logger.info(f"Fetching tax context via MCP for user {user_id}")

            # Extract parameters
            session_id = payload.get("session_id", f"session_{user_id[:8]}")
            tax_year = payload.get("tax_year", datetime.now().year)

            # Fetch from MCP
            from uuid import UUID
            mcp_context = await self.mcp.get_tax_context(
                user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
                session_id=session_id,
                tax_year=tax_year
            )

            # Transform MCP response to expected format
            return {
                "paystubs": mcp_context.get("paystubs", []),
                "investment_portfolio": mcp_context.get("investment_portfolio", {}),
                "tax_year": mcp_context.get("tax_year", tax_year),
            }

        except Exception as e:
            self.logger.warning(f"MCP fetch failed: {e}, using payload data")
            return {}
