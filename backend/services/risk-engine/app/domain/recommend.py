"""
Recommendation Engine
===========================================================================
Generates actionable recommendations to improve goal success probability.

Features:
- Small set of high-impact actions
- Expected improvement quantification
- Tradeoff analysis
- Difficulty assessment
- Prioritization

Recommendation Categories:
- save_more: Increase contribution rate
- reduce_goal: Lower target amount
- delay_goal: Push back timeline
- reduce_risk: Lower portfolio risk
- increase_risk: Take more risk for higher returns
- reduce_spending: Cut expenses
- increase_income: Boost earnings
"""

import numpy as np
from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from .explain import ExplainerOutput, Counterfactual
from .scoring import RiskScorecard
from .simulation import SimulationOutput, SimulationInput
from .goals import Goal


# ===========================================================================
# Recommendation Types
# ===========================================================================

class RecommendationCategory(str, Enum):
    """Recommendation category."""
    SAVE_MORE = "save_more"
    REDUCE_GOAL = "reduce_goal"
    DELAY_GOAL = "delay_goal"
    REDUCE_RISK = "reduce_risk"
    INCREASE_RISK = "increase_risk"
    REDUCE_SPENDING = "reduce_spending"
    INCREASE_INCOME = "increase_income"
    DIVERSIFY = "diversify"
    BUILD_EMERGENCY_FUND = "build_emergency_fund"


from enum import Enum


class Recommendation(BaseModel):
    """Single actionable recommendation."""
    model_config = ConfigDict(extra='forbid')

    # Basic info
    action: str  # Short description (e.g., "Save $200 more per month")
    category: RecommendationCategory

    # Impact
    expected_improvement_pct: float = Field(..., ge=-0.5, le=1.0)  # Impact on success probability
    expected_terminal_value_increase: float = Field(0.0, ge=0)

    # Tradeoff
    tradeoff: str  # What you give up (e.g., "Reduced lifestyle flexibility")

    # Feasibility
    difficulty: Literal["easy", "moderate", "hard"]
    confidence: float = Field(..., ge=0.0, le=1.0)

    # Priority
    priority: int = Field(..., ge=1, le=10)  # 1 = highest

    # Details
    rationale: str
    implementation_steps: List[str] = Field(default_factory=list)


class RecommendationSet(BaseModel):
    """Complete set of recommendations."""
    model_config = ConfigDict(extra='forbid')

    # Recommendations (sorted by priority)
    recommendations: List[Recommendation] = Field(..., max_length=10)

    # Top recommendation
    top_recommendation: Recommendation

    # Quick wins (easy + high impact)
    quick_wins: List[Recommendation] = Field(default_factory=list)

    # Long-term improvements
    long_term_improvements: List[Recommendation] = Field(default_factory=list)

    # Metadata
    baseline_success_probability: float = Field(..., ge=0.0, le=1.0)
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Recommender
# ===========================================================================

class RecommenderConfig(BaseModel):
    """Configuration for recommender."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Max number of recommendations
    max_recommendations: int = Field(10, ge=1, le=20)

    # Only include recommendations above this threshold
    min_improvement_threshold: float = Field(0.02, ge=0.0, le=1.0)  # 2%


class RecommenderInput(BaseModel):
    """Input for recommendation generation."""
    model_config = ConfigDict(extra='forbid')

    # Analysis results
    simulation_output: SimulationOutput
    risk_scorecard: RiskScorecard
    explainer_output: ExplainerOutput

    # Original inputs
    simulation_input: SimulationInput
    goals: List[Goal]


class Recommender:
    """
    Recommendation engine.

    Generates actionable recommendations based on explainability analysis.
    """

    def __init__(self, config: RecommenderConfig = RecommenderConfig()):
        self.config = config

    def recommend(self, input_data: RecommenderInput) -> RecommendationSet:
        """
        Generate recommendations.

        Args:
            input_data: Analysis results and inputs

        Returns:
            RecommendationSet with prioritized recommendations
        """
        baseline_success = input_data.simulation_output.overall_success_probability

        recommendations = []

        # Generate recommendations from counterfactuals
        for counterfactual in input_data.explainer_output.counterfactual_analysis.counterfactuals:
            if not counterfactual.is_actionable:
                continue

            rec = self._counterfactual_to_recommendation(counterfactual)
            if rec and rec.expected_improvement_pct >= self.config.min_improvement_threshold:
                recommendations.append(rec)

        # Generate recommendations from drivers
        for driver in input_data.explainer_output.driver_attribution.top_drivers[:3]:
            rec = self._driver_to_recommendation(driver, input_data)
            if rec and rec.expected_improvement_pct >= self.config.min_improvement_threshold:
                recommendations.append(rec)

        # Add specific recommendations based on risk decomposition
        decomp = input_data.explainer_output.risk_decomposition

        # If household risk is high, recommend emergency fund
        if decomp.household_risk_pct > 0.4:
            rec = self._recommend_emergency_fund(input_data)
            if rec:
                recommendations.append(rec)

        # If market risk is high, recommend diversification
        if decomp.market_risk_pct > 0.5:
            rec = self._recommend_diversification(input_data)
            if rec:
                recommendations.append(rec)

        # Deduplicate and prioritize
        recommendations = self._deduplicate_recommendations(recommendations)
        recommendations = self._prioritize_recommendations(recommendations, baseline_success)

        # Limit to max
        recommendations = recommendations[:self.config.max_recommendations]

        # Identify quick wins (easy + high impact)
        quick_wins = [
            r for r in recommendations
            if r.difficulty == "easy" and r.expected_improvement_pct >= 0.05
        ]

        # Identify long-term improvements (hard but very high impact)
        long_term = [
            r for r in recommendations
            if r.difficulty == "hard" and r.expected_improvement_pct >= 0.10
        ]

        # Top recommendation
        top_rec = recommendations[0] if recommendations else None

        return RecommendationSet(
            recommendations=recommendations,
            top_recommendation=top_rec,
            quick_wins=quick_wins[:3],
            long_term_improvements=long_term[:3],
            baseline_success_probability=baseline_success,
        )

    def _counterfactual_to_recommendation(
        self, counterfactual: Counterfactual
    ) -> Optional[Recommendation]:
        """Convert counterfactual to recommendation."""
        # Map counterfactual scenario to recommendation category
        category_map = {
            "Increase Savings Rate": RecommendationCategory.SAVE_MORE,
            "Delay Goal": RecommendationCategory.DELAY_GOAL,
            "Reduce Goal Target": RecommendationCategory.REDUCE_GOAL,
            "Increase Equity Allocation": RecommendationCategory.INCREASE_RISK,
            "Reduce Spending": RecommendationCategory.REDUCE_SPENDING,
        }

        category = category_map.get(
            counterfactual.scenario_name, RecommendationCategory.SAVE_MORE
        )

        # Implementation steps
        steps = self._generate_implementation_steps(counterfactual)

        return Recommendation(
            action=counterfactual.description,
            category=category,
            expected_improvement_pct=counterfactual.success_probability_change_pct,
            expected_terminal_value_increase=0.0,  # TODO: calculate from counterfactual
            tradeoff=self._generate_tradeoff(category),
            difficulty=counterfactual.difficulty,
            confidence=0.75,
            priority=1,  # Will be updated in prioritization
            rationale=f"Analysis shows this change could improve success probability by {counterfactual.success_probability_change_pct*100:.1f}%",
            implementation_steps=steps,
        )

    def _driver_to_recommendation(
        self, driver, input_data: RecommenderInput
    ) -> Optional[Recommendation]:
        """Generate recommendation from driver."""
        # Map driver category to recommendation
        if driver.category == "household" and driver.impact_on_success_pct < -0.1:
            # Household cashflow is negative driver
            return Recommendation(
                action="Increase monthly savings by $500",
                category=RecommendationCategory.SAVE_MORE,
                expected_improvement_pct=abs(driver.impact_on_success_pct) * 0.5,
                expected_terminal_value_increase=0.0,
                tradeoff="Reduced discretionary spending",
                difficulty="moderate",
                confidence=0.8,
                priority=1,
                rationale=driver.explanation,
                implementation_steps=[
                    "Review current budget",
                    "Identify $500 in discretionary spending to cut",
                    "Set up automatic transfer to savings",
                    "Monitor progress monthly",
                ],
            )

        elif driver.category == "goal" and driver.impact_on_success_pct < -0.15:
            # Goals too ambitious
            return Recommendation(
                action="Consider adjusting goal timeline or target",
                category=RecommendationCategory.DELAY_GOAL,
                expected_improvement_pct=abs(driver.impact_on_success_pct) * 0.6,
                expected_terminal_value_increase=0.0,
                tradeoff="Delayed gratification",
                difficulty="easy",
                confidence=0.85,
                priority=1,
                rationale=driver.explanation,
                implementation_steps=[
                    "Review goal priorities",
                    "Identify which goal has most flexibility",
                    "Adjust target date by 1-2 years",
                    "Recalculate required savings",
                ],
            )

        elif driver.category == "market" and driver.impact_on_success_pct < -0.1:
            # Market risk too high
            return Recommendation(
                action="Reduce portfolio risk by shifting to bonds",
                category=RecommendationCategory.REDUCE_RISK,
                expected_improvement_pct=abs(driver.impact_on_success_pct) * 0.4,
                expected_terminal_value_increase=-10000,  # Lower returns
                tradeoff="Lower expected returns",
                difficulty="easy",
                confidence=0.7,
                priority=2,
                rationale=driver.explanation,
                implementation_steps=[
                    "Review current asset allocation",
                    "Shift 10-15% from stocks to bonds",
                    "Rebalance portfolio",
                    "Review quarterly",
                ],
            )

        return None

    def _recommend_emergency_fund(
        self, input_data: RecommenderInput
    ) -> Optional[Recommendation]:
        """Recommend building emergency fund."""
        return Recommendation(
            action="Build 6-month emergency fund",
            category=RecommendationCategory.BUILD_EMERGENCY_FUND,
            expected_improvement_pct=0.08,
            expected_terminal_value_increase=0.0,
            tradeoff="Slower goal progress in short term",
            difficulty="moderate",
            confidence=0.9,
            priority=1,
            rationale="High household risk suggests need for emergency reserves to avoid portfolio withdrawals during shocks",
            implementation_steps=[
                "Calculate 6 months of essential expenses",
                "Open high-yield savings account",
                "Redirect savings to emergency fund until target reached",
                "Then resume goal contributions",
            ],
        )

    def _recommend_diversification(
        self, input_data: RecommenderInput
    ) -> Optional[Recommendation]:
        """Recommend portfolio diversification."""
        return Recommendation(
            action="Diversify portfolio across more asset classes",
            category=RecommendationCategory.DIVERSIFY,
            expected_improvement_pct=0.06,
            expected_terminal_value_increase=0.0,
            tradeoff="Slightly more complex portfolio",
            difficulty="easy",
            confidence=0.75,
            priority=3,
            rationale="High market risk concentration suggests need for better diversification",
            implementation_steps=[
                "Review current holdings",
                "Add international stocks (10-15%)",
                "Add small allocation to commodities or gold (5%)",
                "Rebalance quarterly",
            ],
        )

    def _deduplicate_recommendations(
        self, recommendations: List[Recommendation]
    ) -> List[Recommendation]:
        """Remove duplicate recommendations."""
        # Simple deduplication by category
        seen_categories = set()
        deduplicated = []

        for rec in recommendations:
            if rec.category not in seen_categories:
                deduplicated.append(rec)
                seen_categories.add(rec.category)

        return deduplicated

    def _prioritize_recommendations(
        self, recommendations: List[Recommendation], baseline_success: float
    ) -> List[Recommendation]:
        """
        Prioritize recommendations.

        Scoring = improvement * confidence / difficulty_factor
        """
        difficulty_factors = {"easy": 1.0, "moderate": 1.5, "hard": 2.5}

        for rec in recommendations:
            difficulty_factor = difficulty_factors.get(rec.difficulty, 1.5)
            score = (rec.expected_improvement_pct * rec.confidence) / difficulty_factor

            # Assign priority based on score
            # Higher score = lower priority number (1 = best)
            rec.priority = max(1, min(10, int(11 - score * 20)))

        # Sort by priority
        recommendations.sort(key=lambda r: (r.priority, -r.expected_improvement_pct))

        return recommendations

    def _generate_implementation_steps(
        self, counterfactual: Counterfactual
    ) -> List[str]:
        """Generate implementation steps for counterfactual."""
        steps_map = {
            "Increase Savings Rate": [
                "Review current monthly budget",
                "Identify areas to reduce spending",
                "Set up automatic transfers to savings",
                "Track progress monthly",
            ],
            "Delay Goal": [
                "Review goal timeline",
                "Communicate new timeline to stakeholders",
                "Adjust savings plan accordingly",
            ],
            "Reduce Goal Target": [
                "Reassess goal requirements",
                "Identify acceptable reduced target",
                "Update financial plan",
            ],
            "Increase Equity Allocation": [
                "Review current asset allocation",
                "Adjust target allocation",
                "Rebalance portfolio gradually",
                "Monitor volatility",
            ],
            "Reduce Spending": [
                "Audit monthly expenses",
                "Identify discretionary cuts",
                "Implement spending plan",
                "Review quarterly",
            ],
        }

        return steps_map.get(counterfactual.scenario_name, [])

    def _generate_tradeoff(self, category: RecommendationCategory) -> str:
        """Generate tradeoff description for category."""
        tradeoffs = {
            RecommendationCategory.SAVE_MORE: "Reduced current lifestyle spending",
            RecommendationCategory.REDUCE_GOAL: "Lower target achievement",
            RecommendationCategory.DELAY_GOAL: "Delayed gratification",
            RecommendationCategory.REDUCE_RISK: "Lower expected returns",
            RecommendationCategory.INCREASE_RISK: "Higher portfolio volatility",
            RecommendationCategory.REDUCE_SPENDING: "Lifestyle adjustments",
            RecommendationCategory.INCREASE_INCOME: "More time/effort required",
            RecommendationCategory.DIVERSIFY: "More portfolio complexity",
            RecommendationCategory.BUILD_EMERGENCY_FUND: "Slower goal progress initially",
        }

        return tradeoffs.get(category, "May require adjustments")


# ===========================================================================
# Helper Functions
# ===========================================================================

def generate_recommendations(
    simulation_output: SimulationOutput,
    risk_scorecard: RiskScorecard,
    explainer_output: ExplainerOutput,
    simulation_input: SimulationInput,
    goals: List[Goal],
    max_recommendations: int = 10,
) -> RecommendationSet:
    """
    Convenience function for generating recommendations.

    Args:
        simulation_output: Simulation results
        risk_scorecard: Risk metrics
        explainer_output: Explainability analysis
        simulation_input: Original inputs
        goals: Goals
        max_recommendations: Maximum recommendations to return

    Returns:
        RecommendationSet with prioritized recommendations

    Example:
        >>> output = run_monte_carlo(...)
        >>> scorecard = calculate_risk_metrics(...)
        >>> explanation = explain_risk_outcome(...)
        >>> recs = generate_recommendations(output, scorecard, explanation, input_data, goals)
        >>> recs.top_recommendation.action
        "Save $200 more per month"
        >>> recs.top_recommendation.expected_improvement_pct
        0.12  # 12% improvement
    """
    config = RecommenderConfig(max_recommendations=max_recommendations)
    recommender = Recommender(config)

    input_data = RecommenderInput(
        simulation_output=simulation_output,
        risk_scorecard=risk_scorecard,
        explainer_output=explainer_output,
        simulation_input=simulation_input,
        goals=goals,
    )

    return recommender.recommend(input_data)
