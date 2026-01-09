"""
Explainability Engine
===========================================================================
Provides explainability for risk outcomes through:
- Driver attribution (what factors impact success most)
- Risk decomposition (breakdown by source)
- Counterfactual analysis (what-if scenarios)
- Sensitivity analysis (parameter impact)

Features:
- Identifies top drivers of success/failure
- Quantifies impact of each driver
- Generates actionable insights
- Supports UI visualization
"""

import numpy as np
from typing import List, Dict, Optional, Tuple, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from copy import deepcopy

from .simulation import SimulationOutput, ScenarioResult, MonteCarloSimulator, SimulationInput, SimulationConfig
from .scoring import RiskScorecard, GoalRiskMetrics
from .goals import Goal


# ===========================================================================
# Driver Attribution
# ===========================================================================

class Driver(BaseModel):
    """Single risk driver."""
    model_config = ConfigDict(extra='forbid')

    name: str
    category: Literal["market", "household", "goal", "portfolio"]

    # Impact on success probability (-1.0 to +1.0)
    # Positive = increases success, negative = decreases success
    impact_on_success_pct: float = Field(..., ge=-1.0, le=1.0)

    # Confidence in this attribution (0.0 to 1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)

    # Human-readable explanation
    explanation: str

    # Quantitative details (optional)
    quantitative_impact: Optional[float] = None


class DriverAttribution(BaseModel):
    """Complete driver attribution."""
    model_config = ConfigDict(extra='forbid')

    # Top drivers (sorted by absolute impact)
    top_drivers: List[Driver] = Field(..., max_length=10)

    # Summary
    primary_driver: Driver
    primary_risk_source: Literal["market", "household", "goal", "portfolio"]

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Risk Decomposition
# ===========================================================================

class RiskComponent(BaseModel):
    """Single component of risk."""
    model_config = ConfigDict(extra='forbid')

    component: str
    contribution_pct: float = Field(..., ge=0.0, le=1.0)
    description: str


class RiskDecomposition(BaseModel):
    """Decomposition of risk by source."""
    model_config = ConfigDict(extra='forbid')

    # Risk breakdown
    market_risk_pct: float = Field(..., ge=0.0, le=1.0)
    household_risk_pct: float = Field(..., ge=0.0, le=1.0)
    goal_structure_risk_pct: float = Field(..., ge=0.0, le=1.0)

    # Detailed components
    components: List[RiskComponent]

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Counterfactual Analysis
# ===========================================================================

class Counterfactual(BaseModel):
    """Counterfactual scenario (what-if)."""
    model_config = ConfigDict(extra='forbid')

    scenario_name: str
    description: str

    # Change description
    parameter_changed: str
    original_value: str
    new_value: str

    # Impact
    success_probability_change_pct: float = Field(..., ge=-1.0, le=1.0)
    terminal_value_change_pct: float = Field(..., ge=-1.0, le=10.0)

    # New success probability
    counterfactual_success_probability: float = Field(..., ge=0.0, le=1.0)

    # Feasibility
    is_actionable: bool
    difficulty: Literal["easy", "moderate", "hard"]


class CounterfactualAnalysis(BaseModel):
    """Complete counterfactual analysis."""
    model_config = ConfigDict(extra='forbid')

    # Counterfactuals (sorted by impact)
    counterfactuals: List[Counterfactual] = Field(..., max_length=10)

    # Most impactful actionable change
    best_actionable_change: Optional[Counterfactual] = None

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Sensitivity Analysis
# ===========================================================================

class SensitivityResult(BaseModel):
    """Sensitivity analysis result for one parameter."""
    model_config = ConfigDict(extra='forbid')

    parameter: str
    baseline_value: float

    # Impact of ±10% change
    impact_positive_10pct: float  # Change in success probability
    impact_negative_10pct: float

    # Elasticity (% change in output / % change in input)
    elasticity: float

    # Sensitivity category
    sensitivity: Literal["low", "medium", "high"]


class SensitivityAnalysis(BaseModel):
    """Complete sensitivity analysis."""
    model_config = ConfigDict(extra='forbid')

    # Sensitivity results for key parameters
    results: List[SensitivityResult]

    # Most sensitive parameters
    most_sensitive_parameters: List[str] = Field(..., max_length=5)

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Explainer
# ===========================================================================

class ExplainerConfig(BaseModel):
    """Configuration for explainer."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Number of counterfactuals to generate
    num_counterfactuals: int = Field(5, ge=1, le=20)

    # Run full sensitivity analysis (slower)
    run_sensitivity_analysis: bool = False


class ExplainerInput(BaseModel):
    """Input for explainability analysis."""
    model_config = ConfigDict(extra='forbid')

    # Original simulation results
    simulation_output: SimulationOutput
    risk_scorecard: RiskScorecard

    # Original inputs (for counterfactuals)
    simulation_input: SimulationInput

    # Goals
    goals: List[Goal]


class ExplainerOutput(BaseModel):
    """Output from explainability analysis."""
    model_config = ConfigDict(extra='forbid')

    # Driver attribution
    driver_attribution: DriverAttribution

    # Risk decomposition
    risk_decomposition: RiskDecomposition

    # Counterfactual analysis
    counterfactual_analysis: CounterfactualAnalysis

    # Sensitivity analysis (optional)
    sensitivity_analysis: Optional[SensitivityAnalysis] = None

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class Explainer:
    """
    Explainability engine for risk outcomes.

    Analyzes simulation results to identify drivers, decompose risk,
    and generate counterfactual scenarios.
    """

    def __init__(self, config: ExplainerConfig = ExplainerConfig()):
        self.config = config

    def explain(self, input_data: ExplainerInput) -> ExplainerOutput:
        """
        Generate explainability analysis.

        Args:
            input_data: Simulation results and inputs

        Returns:
            ExplainerOutput with drivers, decomposition, counterfactuals
        """
        # Driver attribution
        driver_attribution = self._attribute_drivers(
            input_data.simulation_output,
            input_data.risk_scorecard,
            input_data.goals,
        )

        # Risk decomposition
        risk_decomposition = self._decompose_risk(
            input_data.simulation_output, input_data.risk_scorecard
        )

        # Counterfactual analysis
        counterfactual_analysis = self._analyze_counterfactuals(
            input_data.simulation_input,
            input_data.simulation_output,
            input_data.goals,
        )

        # Sensitivity analysis (optional)
        sensitivity_analysis = None
        if self.config.run_sensitivity_analysis:
            sensitivity_analysis = self._sensitivity_analysis(
                input_data.simulation_input, input_data.goals
            )

        return ExplainerOutput(
            driver_attribution=driver_attribution,
            risk_decomposition=risk_decomposition,
            counterfactual_analysis=counterfactual_analysis,
            sensitivity_analysis=sensitivity_analysis,
        )

    def _attribute_drivers(
        self,
        simulation_output: SimulationOutput,
        risk_scorecard: RiskScorecard,
        goals: List[Goal],
    ) -> DriverAttribution:
        """
        Attribute success/failure to key drivers.

        Uses heuristics and variance decomposition.
        """
        drivers = []

        # Market regime driver
        # Analyze regime distribution across scenarios
        market_impact = self._calculate_market_impact(simulation_output)
        if abs(market_impact) > 0.05:
            drivers.append(
                Driver(
                    name="Market Volatility",
                    category="market",
                    impact_on_success_pct=market_impact,
                    confidence=0.8,
                    explanation=f"Market volatility {'increases' if market_impact < 0 else 'decreases'} risk by {abs(market_impact)*100:.1f}%",
                    quantitative_impact=market_impact,
                )
            )

        # Household cashflow driver
        household_impact = self._calculate_household_impact(simulation_output)
        if abs(household_impact) > 0.05:
            drivers.append(
                Driver(
                    name="Household Cashflow",
                    category="household",
                    impact_on_success_pct=household_impact,
                    confidence=0.85,
                    explanation=f"{'Insufficient' if household_impact < 0 else 'Strong'} household savings reduce success probability by {abs(household_impact)*100:.1f}%",
                    quantitative_impact=household_impact,
                )
            )

        # Portfolio allocation driver
        portfolio_impact = self._calculate_portfolio_impact(simulation_output)
        if abs(portfolio_impact) > 0.05:
            drivers.append(
                Driver(
                    name="Portfolio Allocation",
                    category="portfolio",
                    impact_on_success_pct=portfolio_impact,
                    confidence=0.75,
                    explanation=f"Portfolio allocation {'sub-optimal' if portfolio_impact < 0 else 'appropriate'} for risk level",
                    quantitative_impact=portfolio_impact,
                )
            )

        # Goal structure driver
        goal_impact = self._calculate_goal_structure_impact(goals, risk_scorecard)
        if abs(goal_impact) > 0.05:
            drivers.append(
                Driver(
                    name="Goal Feasibility",
                    category="goal",
                    impact_on_success_pct=goal_impact,
                    confidence=0.9,
                    explanation=f"Goals are {'overly ambitious' if goal_impact < 0 else 'achievable'} given current trajectory",
                    quantitative_impact=goal_impact,
                )
            )

        # Sort by absolute impact
        drivers.sort(key=lambda d: abs(d.impact_on_success_pct), reverse=True)

        # Identify primary driver
        primary_driver = drivers[0] if drivers else Driver(
            name="Unknown",
            category="market",
            impact_on_success_pct=0.0,
            confidence=0.0,
            explanation="Insufficient data to determine primary driver",
        )

        # Primary risk source
        primary_risk_source = primary_driver.category

        return DriverAttribution(
            top_drivers=drivers[:10],
            primary_driver=primary_driver,
            primary_risk_source=primary_risk_source,
        )

    def _decompose_risk(
        self, simulation_output: SimulationOutput, risk_scorecard: RiskScorecard
    ) -> RiskDecomposition:
        """
        Decompose risk by source.

        Uses variance decomposition across scenarios.
        """
        # Simplified decomposition based on heuristics
        # In reality, would use variance decomposition or Sobol indices

        # Market risk: variation in returns
        market_risk_pct = 0.4  # Placeholder

        # Household risk: variation in cashflows/shocks
        household_risk_pct = 0.3  # Placeholder

        # Goal structure risk: feasibility of goals
        goal_structure_risk_pct = 0.3  # Placeholder

        # Normalize
        total = market_risk_pct + household_risk_pct + goal_structure_risk_pct
        market_risk_pct /= total
        household_risk_pct /= total
        goal_structure_risk_pct /= total

        components = [
            RiskComponent(
                component="Market Volatility",
                contribution_pct=market_risk_pct * 0.7,
                description="Risk from market return variability",
            ),
            RiskComponent(
                component="Sequence of Returns",
                contribution_pct=market_risk_pct * 0.3,
                description="Risk from timing of market returns",
            ),
            RiskComponent(
                component="Income Variability",
                contribution_pct=household_risk_pct * 0.5,
                description="Risk from layoffs or income changes",
            ),
            RiskComponent(
                component="Unexpected Expenses",
                contribution_pct=household_risk_pct * 0.5,
                description="Risk from health costs and emergencies",
            ),
            RiskComponent(
                component="Goal Timing",
                contribution_pct=goal_structure_risk_pct,
                description="Risk from goals being too soon or too large",
            ),
        ]

        return RiskDecomposition(
            market_risk_pct=market_risk_pct,
            household_risk_pct=household_risk_pct,
            goal_structure_risk_pct=goal_structure_risk_pct,
            components=components,
        )

    def _analyze_counterfactuals(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
    ) -> CounterfactualAnalysis:
        """
        Generate counterfactual scenarios.

        What-if analysis: "What if I saved 10% more?"
        """
        counterfactuals = []
        baseline_success = baseline_output.overall_success_probability

        # Counterfactual 1: Increase savings rate by 10%
        cf1 = self._counterfactual_increase_savings(
            simulation_input, baseline_output, goals, 0.10
        )
        if cf1:
            counterfactuals.append(cf1)

        # Counterfactual 2: Delay goal by 2 years
        cf2 = self._counterfactual_delay_goal(
            simulation_input, baseline_output, goals, 2
        )
        if cf2:
            counterfactuals.append(cf2)

        # Counterfactual 3: Reduce goal target by 20%
        cf3 = self._counterfactual_reduce_goal(
            simulation_input, baseline_output, goals, 0.20
        )
        if cf3:
            counterfactuals.append(cf3)

        # Counterfactual 4: Increase equity allocation
        cf4 = self._counterfactual_increase_equity(
            simulation_input, baseline_output, goals, 0.10
        )
        if cf4:
            counterfactuals.append(cf4)

        # Counterfactual 5: Reduce spending by 10%
        cf5 = self._counterfactual_reduce_spending(
            simulation_input, baseline_output, goals, 0.10
        )
        if cf5:
            counterfactuals.append(cf5)

        # Sort by impact
        counterfactuals.sort(
            key=lambda c: abs(c.success_probability_change_pct), reverse=True
        )

        # Find best actionable change
        actionable = [c for c in counterfactuals if c.is_actionable]
        best_actionable = actionable[0] if actionable else None

        return CounterfactualAnalysis(
            counterfactuals=counterfactuals[:self.config.num_counterfactuals],
            best_actionable_change=best_actionable,
        )

    # ===========================================================================
    # Helper Methods
    # ===========================================================================

    def _calculate_market_impact(self, simulation_output: SimulationOutput) -> float:
        """Estimate market impact on success."""
        # Simplified: use variance in terminal values
        std_terminal = simulation_output.std_terminal_value
        mean_terminal = simulation_output.mean_terminal_value

        if mean_terminal == 0:
            return 0.0

        # Coefficient of variation
        cv = std_terminal / mean_terminal

        # High CV = high market impact (negative)
        impact = -min(0.3, cv * 0.5)
        return impact

    def _calculate_household_impact(self, simulation_output: SimulationOutput) -> float:
        """Estimate household cashflow impact on success."""
        # Simplified: analyze scenarios with shocks
        scenarios = simulation_output.scenarios

        avg_shocks = np.mean([s.total_shocks for s in scenarios])
        avg_contributions = np.mean([s.total_contributions for s in scenarios])

        if avg_contributions == 0:
            return -0.3  # No contributions = bad

        # Shock ratio
        shock_ratio = avg_shocks / avg_contributions

        # High shocks = negative impact
        impact = -min(0.3, shock_ratio * 0.2)
        return impact

    def _calculate_portfolio_impact(self, simulation_output: SimulationOutput) -> float:
        """Estimate portfolio allocation impact."""
        # Simplified placeholder
        return 0.0

    def _calculate_goal_structure_impact(
        self, goals: List[Goal], scorecard: RiskScorecard
    ) -> float:
        """Estimate goal feasibility impact."""
        # Average goal success probability
        avg_goal_success = np.mean(
            [gm.success_probability for gm in scorecard.goal_metrics]
        )

        # Low success = goals too ambitious (negative impact)
        impact = (avg_goal_success - 0.7) * 0.5
        return impact

    def _counterfactual_increase_savings(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
        increase_pct: float,
    ) -> Optional[Counterfactual]:
        """Counterfactual: Increase savings rate."""
        # Simplified: estimate impact without re-running simulation
        baseline_success = baseline_output.overall_success_probability

        # Rough estimate: 10% more savings -> 5% higher success probability
        estimated_impact = increase_pct * 0.5
        new_success = min(1.0, baseline_success + estimated_impact)

        return Counterfactual(
            scenario_name="Increase Savings Rate",
            description=f"Save {increase_pct*100:.0f}% more per year",
            parameter_changed="annual_savings",
            original_value="Current",
            new_value=f"+{increase_pct*100:.0f}%",
            success_probability_change_pct=estimated_impact,
            terminal_value_change_pct=increase_pct * 1.5,
            counterfactual_success_probability=new_success,
            is_actionable=True,
            difficulty="moderate",
        )

    def _counterfactual_delay_goal(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
        delay_years: int,
    ) -> Optional[Counterfactual]:
        """Counterfactual: Delay goal by X years."""
        baseline_success = baseline_output.overall_success_probability

        # Estimate: 2 years delay -> 10% higher success
        estimated_impact = delay_years * 0.05
        new_success = min(1.0, baseline_success + estimated_impact)

        return Counterfactual(
            scenario_name="Delay Goal",
            description=f"Delay goal target date by {delay_years} years",
            parameter_changed="target_date",
            original_value="Current",
            new_value=f"+{delay_years} years",
            success_probability_change_pct=estimated_impact,
            terminal_value_change_pct=0.0,
            counterfactual_success_probability=new_success,
            is_actionable=True,
            difficulty="easy",
        )

    def _counterfactual_reduce_goal(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
        reduction_pct: float,
    ) -> Optional[Counterfactual]:
        """Counterfactual: Reduce goal target."""
        baseline_success = baseline_output.overall_success_probability

        # Estimate: 20% reduction -> 15% higher success
        estimated_impact = reduction_pct * 0.75
        new_success = min(1.0, baseline_success + estimated_impact)

        return Counterfactual(
            scenario_name="Reduce Goal Target",
            description=f"Reduce goal amount by {reduction_pct*100:.0f}%",
            parameter_changed="target_value",
            original_value="Current",
            new_value=f"-{reduction_pct*100:.0f}%",
            success_probability_change_pct=estimated_impact,
            terminal_value_change_pct=0.0,
            counterfactual_success_probability=new_success,
            is_actionable=True,
            difficulty="moderate",
        )

    def _counterfactual_increase_equity(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
        increase_pct: float,
    ) -> Optional[Counterfactual]:
        """Counterfactual: Increase equity allocation."""
        baseline_success = baseline_output.overall_success_probability

        # Estimate: 10% more equity -> mixed impact (higher returns, higher risk)
        estimated_impact = increase_pct * 0.2
        new_success = baseline_success + estimated_impact

        return Counterfactual(
            scenario_name="Increase Equity Allocation",
            description=f"Increase stock allocation by {increase_pct*100:.0f}%",
            parameter_changed="equity_allocation",
            original_value="Current",
            new_value=f"+{increase_pct*100:.0f}%",
            success_probability_change_pct=estimated_impact,
            terminal_value_change_pct=increase_pct * 2.0,
            counterfactual_success_probability=new_success,
            is_actionable=True,
            difficulty="easy",
        )

    def _counterfactual_reduce_spending(
        self,
        simulation_input: SimulationInput,
        baseline_output: SimulationOutput,
        goals: List[Goal],
        reduction_pct: float,
    ) -> Optional[Counterfactual]:
        """Counterfactual: Reduce spending."""
        baseline_success = baseline_output.overall_success_probability

        # Estimate: 10% less spending -> 8% higher success
        estimated_impact = reduction_pct * 0.8
        new_success = min(1.0, baseline_success + estimated_impact)

        return Counterfactual(
            scenario_name="Reduce Spending",
            description=f"Cut annual spending by {reduction_pct*100:.0f}%",
            parameter_changed="annual_spending",
            original_value="Current",
            new_value=f"-{reduction_pct*100:.0f}%",
            success_probability_change_pct=estimated_impact,
            terminal_value_change_pct=reduction_pct * 1.5,
            counterfactual_success_probability=new_success,
            is_actionable=True,
            difficulty="hard",
        )

    def _sensitivity_analysis(
        self, simulation_input: SimulationInput, goals: List[Goal]
    ) -> SensitivityAnalysis:
        """
        Run sensitivity analysis.

        Measure impact of ±10% changes in key parameters.
        """
        # Placeholder - full implementation would re-run simulations
        results = []

        # Example: Savings rate sensitivity
        results.append(
            SensitivityResult(
                parameter="savings_rate",
                baseline_value=0.15,
                impact_positive_10pct=0.05,
                impact_negative_10pct=-0.05,
                elasticity=0.5,
                sensitivity="high",
            )
        )

        most_sensitive = ["savings_rate", "market_return", "goal_target"]

        return SensitivityAnalysis(
            results=results, most_sensitive_parameters=most_sensitive
        )


# ===========================================================================
# Helper Functions
# ===========================================================================

def explain_risk_outcome(
    simulation_output: SimulationOutput,
    risk_scorecard: RiskScorecard,
    simulation_input: SimulationInput,
    goals: List[Goal],
) -> ExplainerOutput:
    """
    Convenience function for explainability analysis.

    Args:
        simulation_output: Simulation results
        risk_scorecard: Risk metrics
        simulation_input: Original simulation inputs
        goals: Goals

    Returns:
        ExplainerOutput with drivers, decomposition, counterfactuals

    Example:
        >>> output = run_monte_carlo(...)
        >>> scorecard = calculate_risk_metrics(...)
        >>> explanation = explain_risk_outcome(output, scorecard, input_data, goals)
        >>> explanation.driver_attribution.primary_driver.name
        "Household Cashflow"
    """
    explainer = Explainer()

    input_data = ExplainerInput(
        simulation_output=simulation_output,
        risk_scorecard=risk_scorecard,
        simulation_input=simulation_input,
        goals=goals,
    )

    return explainer.explain(input_data)
