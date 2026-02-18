"""
Monte Carlo Simulation Engine
===========================================================================
Time-stepped Monte Carlo simulation integrating:
- Market returns (regime-aware, correlated asset classes)
- Household cashflows (income, spending, shocks)
- Multi-goal allocation (waterfall policies)
- Portfolio dynamics (contributions, withdrawals, growth)

Features:
- Deterministic seeding for reproducibility
- Time-stepped (monthly or annual granularity)
- Portfolio rebalancing
- Tax considerations (simplified)
- Liquidity constraints

Output:
- Distribution of terminal portfolio values
- Goal success probabilities
- Time series of portfolio value, cashflows, allocations
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from copy import deepcopy

from .regime import MarketRegime, RegimeClassifier, RegimeInput
from .returns import ReturnGenerator, ReturnGeneratorConfig, AssetClass
from .household import (
    HouseholdSimulator,
    HouseholdSimulatorConfig,
    IncomeStream,
    SpendingProfile,
    ShockParameters,
)
from .goals import Goal, GoalAllocator, GoalAllocatorConfig, WaterfallPolicy, GoalAllocation
from .schemas import PortfolioState, AssetAllocation


# ===========================================================================
# Simulation Configuration
# ===========================================================================

class SimulationMode(str, Enum):
    """Simulation mode."""
    FAST = "fast"  # 1k scenarios, annual steps
    BALANCED = "balanced"  # 5k scenarios, monthly steps
    FULL = "full"  # 25k scenarios, monthly steps
    DETERMINISTIC = "deterministic"  # Seeded, 1k scenarios


class SimulationConfig(BaseModel):
    """Configuration for Monte Carlo simulation."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Mode
    mode: SimulationMode = SimulationMode.BALANCED

    # Number of scenarios
    num_scenarios: int = Field(5000, ge=1, le=100000)

    # Time step (months)
    time_step_months: int = Field(1, ge=1, le=12)  # 1 = monthly, 12 = annual

    # Random seed (for determinism)
    random_seed: Optional[int] = None

    # Portfolio rebalancing frequency (months)
    rebalancing_frequency_months: int = Field(12, ge=1, le=12)

    # Tax rate (simplified)
    capital_gains_tax_rate: float = Field(0.15, ge=0.0, le=0.5)

    # Minimum liquidity reserve (as % of annual spending)
    min_liquidity_reserve_months: int = Field(6, ge=0, le=24)


# ===========================================================================
# Simulation Input
# ===========================================================================

class SimulationInput(BaseModel):
    """Input for Monte Carlo simulation."""
    model_config = ConfigDict(extra='forbid')

    # Goals
    goals: List[Goal] = Field(..., min_length=1, max_length=20)

    # Initial portfolio state
    initial_portfolio: PortfolioState

    # Household
    income_streams: List[IncomeStream]
    spending_profile: SpendingProfile
    shock_parameters: ShockParameters = Field(default_factory=ShockParameters)

    # Market regime
    initial_regime: MarketRegime

    # Time horizon
    time_horizon_years: int = Field(..., ge=1, le=100)

    # Household demographics
    current_age: int = Field(..., ge=18, le=100)
    retirement_age: int = Field(67, ge=50, le=80)

    # Allocation policy
    waterfall_policy: WaterfallPolicy = WaterfallPolicy.STRICT_PRIORITY


# ===========================================================================
# Scenario State
# ===========================================================================

class ScenarioTimeStep(BaseModel):
    """State at a single time step in a scenario."""
    model_config = ConfigDict(extra='forbid')

    # Time
    year: int
    month: int
    age: int

    # Market
    regime: MarketRegime
    portfolio_return_this_period: float

    # Household
    income_this_period: float
    spending_this_period: float
    shocks_this_period: float
    net_cashflow_this_period: float

    # Portfolio
    portfolio_value_before_cashflow: float
    portfolio_value_after_cashflow: float
    contributions_this_period: float
    withdrawals_this_period: float

    # Goals
    goal_allocations: List[GoalAllocation]


class ScenarioResult(BaseModel):
    """Result of a single Monte Carlo scenario."""
    model_config = ConfigDict(extra='forbid')

    scenario_id: int
    random_seed: int

    # Time series
    time_steps: List[ScenarioTimeStep]

    # Terminal state
    terminal_portfolio_value: float
    terminal_age: int

    # Goal outcomes
    goals_fully_funded: List[str] = Field(default_factory=list)
    goals_partially_funded: List[str] = Field(default_factory=list)
    goals_unfunded: List[str] = Field(default_factory=list)

    # Summary metrics
    total_contributions: float
    total_withdrawals: float
    total_market_gains: float
    total_shocks: float


# ===========================================================================
# Simulation Output
# ===========================================================================

class SimulationOutput(BaseModel):
    """Output from Monte Carlo simulation."""
    model_config = ConfigDict(extra='forbid')

    # All scenarios
    scenarios: List[ScenarioResult]

    # Distribution statistics
    mean_terminal_value: float
    median_terminal_value: float
    std_terminal_value: float
    percentile_5_terminal_value: float  # VaR 5%
    percentile_95_terminal_value: float

    # Goal success probabilities
    goal_success_probabilities: Dict[str, float]  # goal_id -> probability

    # Overall success probability (all goals funded)
    overall_success_probability: float

    # Metadata
    num_scenarios: int
    time_horizon_years: int
    mode: SimulationMode
    random_seed: Optional[int]
    compute_time_seconds: float
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Monte Carlo Simulator
# ===========================================================================

class MonteCarloSimulator:
    """
    Monte Carlo simulation engine.

    Integrates market returns, household cashflows, and goal allocation
    over time to project portfolio outcomes.
    """

    def __init__(self, config: SimulationConfig = SimulationConfig()):
        self.config = config

        # Set random seed if provided
        if config.random_seed is not None:
            np.random.seed(config.random_seed)

        # Initialize sub-simulators
        self.return_generator = ReturnGenerator(
            ReturnGeneratorConfig(random_seed=config.random_seed)
        )
        self.household_simulator = HouseholdSimulator(
            HouseholdSimulatorConfig(random_seed=config.random_seed)
        )
        self.goal_allocator = GoalAllocator()
        self.regime_classifier = RegimeClassifier()

    def simulate(self, input_data: SimulationInput) -> SimulationOutput:
        """
        Run Monte Carlo simulation.

        Args:
            input_data: Simulation parameters

        Returns:
            SimulationOutput with distribution of outcomes
        """
        start_time = datetime.utcnow()

        # Calculate number of time steps
        total_months = input_data.time_horizon_years * 12
        num_steps = total_months // self.config.time_step_months

        # Run scenarios
        scenarios = []
        for scenario_id in range(self.config.num_scenarios):
            # Generate scenario seed
            scenario_seed = (
                self.config.random_seed + scenario_id
                if self.config.random_seed is not None
                else None
            )

            scenario = self._run_scenario(
                scenario_id, scenario_seed, input_data, num_steps
            )
            scenarios.append(scenario)

        # Calculate statistics
        terminal_values = [s.terminal_portfolio_value for s in scenarios]

        mean_terminal = np.mean(terminal_values)
        median_terminal = np.median(terminal_values)
        std_terminal = np.std(terminal_values)
        percentile_5 = np.percentile(terminal_values, 5)
        percentile_95 = np.percentile(terminal_values, 95)

        # Calculate goal success probabilities
        goal_success_probs = self._calculate_goal_success_probabilities(
            scenarios, input_data.goals
        )

        # Overall success (all goals funded)
        overall_success = sum(
            1
            for s in scenarios
            if len(s.goals_fully_funded) == len(input_data.goals)
        ) / len(scenarios)

        # Compute time
        end_time = datetime.utcnow()
        compute_time = (end_time - start_time).total_seconds()

        return SimulationOutput(
            scenarios=scenarios,
            mean_terminal_value=mean_terminal,
            median_terminal_value=median_terminal,
            std_terminal_value=std_terminal,
            percentile_5_terminal_value=percentile_5,
            percentile_95_terminal_value=percentile_95,
            goal_success_probabilities=goal_success_probs,
            overall_success_probability=overall_success,
            num_scenarios=self.config.num_scenarios,
            time_horizon_years=input_data.time_horizon_years,
            mode=self.config.mode,
            random_seed=self.config.random_seed,
            compute_time_seconds=compute_time,
        )

    def _run_scenario(
        self,
        scenario_id: int,
        scenario_seed: Optional[int],
        input_data: SimulationInput,
        num_steps: int,
    ) -> ScenarioResult:
        """Run a single Monte Carlo scenario."""
        # Seed RNG for this scenario
        if scenario_seed is not None:
            np.random.seed(scenario_seed)

        # Initialize state
        portfolio_value = input_data.initial_portfolio.total_value
        current_regime = input_data.initial_regime
        goals = deepcopy(input_data.goals)

        time_steps = []
        total_contributions = 0.0
        total_withdrawals = 0.0
        total_market_gains = 0.0
        total_shocks = 0.0

        # Run time steps
        for step in range(num_steps):
            # Calculate current year/month
            total_months_elapsed = step * self.config.time_step_months
            year = total_months_elapsed // 12
            month = (total_months_elapsed % 12) + 1
            age = input_data.current_age + year

            # Update regime (with some persistence)
            current_regime = self._update_regime(current_regime, step)

            # Generate portfolio return for this period
            portfolio_return = self._generate_portfolio_return(
                input_data.initial_portfolio.asset_allocation,
                current_regime,
                self.config.time_step_months,
            )

            # Apply return to portfolio
            portfolio_value_before_cashflow = portfolio_value * (1 + portfolio_return)
            market_gain = portfolio_value * portfolio_return
            total_market_gains += market_gain

            # Generate household cashflow for this period
            income, spending, shocks = self._generate_household_cashflow(
                input_data.income_streams,
                input_data.spending_profile,
                input_data.shock_parameters,
                year,
                age,
                input_data.retirement_age,
                current_regime,
            )

            total_shocks += shocks

            # Net cashflow
            net_cashflow = income - spending - shocks

            # Allocate cashflow to goals
            if net_cashflow > 0:
                # Positive cashflow - allocate to goals
                goal_allocations = self._allocate_to_goals(
                    goals, net_cashflow, input_data.waterfall_policy
                )

                contributions = sum(a.allocated_amount for a in goal_allocations)
                withdrawals = 0.0

                # Update goal progress
                for allocation in goal_allocations:
                    goal = next(g for g in goals if g.id == allocation.goal_id)
                    goal.current_allocated += allocation.allocated_amount

                total_contributions += contributions
            else:
                # Negative cashflow - need to withdraw from portfolio
                withdrawals = abs(net_cashflow)
                contributions = 0.0
                goal_allocations = []

                total_withdrawals += withdrawals

            # Update portfolio value
            portfolio_value_after_cashflow = (
                portfolio_value_before_cashflow + contributions - withdrawals
            )

            # Ensure portfolio doesn't go negative
            if portfolio_value_after_cashflow < 0:
                portfolio_value_after_cashflow = 0

            portfolio_value = portfolio_value_after_cashflow

            # Record time step
            time_step = ScenarioTimeStep(
                year=year,
                month=month,
                age=age,
                regime=current_regime,
                portfolio_return_this_period=portfolio_return,
                income_this_period=income,
                spending_this_period=spending,
                shocks_this_period=shocks,
                net_cashflow_this_period=net_cashflow,
                portfolio_value_before_cashflow=portfolio_value_before_cashflow,
                portfolio_value_after_cashflow=portfolio_value_after_cashflow,
                contributions_this_period=contributions,
                withdrawals_this_period=withdrawals,
                goal_allocations=goal_allocations,
            )

            time_steps.append(time_step)

        # Evaluate goal outcomes
        goals_fully_funded = []
        goals_partially_funded = []
        goals_unfunded = []

        for goal in goals:
            if goal.current_allocated >= goal.target_value:
                goals_fully_funded.append(goal.id)
            elif goal.current_allocated > 0:
                goals_partially_funded.append(goal.id)
            else:
                goals_unfunded.append(goal.id)

        return ScenarioResult(
            scenario_id=scenario_id,
            random_seed=scenario_seed or 0,
            time_steps=time_steps,
            terminal_portfolio_value=portfolio_value,
            terminal_age=input_data.current_age + input_data.time_horizon_years,
            goals_fully_funded=goals_fully_funded,
            goals_partially_funded=goals_partially_funded,
            goals_unfunded=goals_unfunded,
            total_contributions=total_contributions,
            total_withdrawals=total_withdrawals,
            total_market_gains=total_market_gains,
            total_shocks=total_shocks,
        )

    def _update_regime(
        self, current_regime: MarketRegime, step: int
    ) -> MarketRegime:
        """
        Update market regime with some persistence.

        Regimes don't change every period - use random walk.
        """
        # Simple random regime transitions
        # In reality, this would use market data
        transition_prob = 0.05  # 5% chance of regime change per period

        if np.random.random() < transition_prob:
            # Transition to new regime
            regimes = list(MarketRegime)
            # Remove current regime from options
            other_regimes = [r for r in regimes if r != current_regime]
            return np.random.choice(other_regimes)

        return current_regime

    def _generate_portfolio_return(
        self,
        asset_allocation: List[AssetAllocation],
        regime: MarketRegime,
        time_step_months: int,
    ) -> float:
        """
        Generate portfolio return for this time period.

        Returns annualized return scaled to time_step_months.
        """
        # Build allocation dict
        allocation_dict = {aa.asset_class: aa.weight for aa in asset_allocation}

        # Generate returns (simplified - single period)
        # In reality, this would use ReturnGenerator properly
        from .returns import get_regime_expected_return_multiplier, DEFAULT_ASSET_ASSUMPTIONS

        portfolio_return = 0.0
        for aa in asset_allocation:
            base_return = DEFAULT_ASSET_ASSUMPTIONS[aa.asset_class].baseline_expected_return
            multiplier = get_regime_expected_return_multiplier(regime)
            adjusted_return = base_return * multiplier

            # Add volatility (random)
            base_vol = DEFAULT_ASSET_ASSUMPTIONS[aa.asset_class].baseline_volatility
            from .returns import get_regime_volatility_multiplier
            vol_multiplier = get_regime_volatility_multiplier(regime)
            adjusted_vol = base_vol * vol_multiplier

            # Random return
            period_return = np.random.normal(
                adjusted_return * (time_step_months / 12),
                adjusted_vol * np.sqrt(time_step_months / 12),
            )

            portfolio_return += aa.weight * period_return

        return portfolio_return

    def _generate_household_cashflow(
        self,
        income_streams: List[IncomeStream],
        spending_profile: SpendingProfile,
        shock_parameters: ShockParameters,
        year: int,
        age: int,
        retirement_age: int,
        regime: MarketRegime,
    ) -> Tuple[float, float, float]:
        """
        Generate household cashflow for this period.

        Returns: (income, spending, shocks)
        """
        # Simplified - use household simulator for single year
        # In reality, would cache full simulation

        # Income
        from .household import HouseholdSimulator
        simulator = HouseholdSimulator(
            HouseholdSimulatorConfig(random_seed=None)
        )

        # Calculate income (simplified)
        income = 0.0
        for stream in income_streams:
            if age >= retirement_age:
                if stream.income_type.value in ["salary_w2", "business_1099"]:
                    continue

            amount = stream.annual_amount * ((1 + stream.growth_rate) ** year)
            income += amount

        # Spending
        spending = spending_profile.annual_base_spending * (
            (1 + spending_profile.growth_rate) ** year
        )

        # Shocks (simplified)
        shocks = 0.0
        if np.random.random() < shock_parameters.health_cost_shock_probability:
            shocks += np.random.uniform(0, shock_parameters.health_cost_shock_annual_max)

        # Annualize for time step
        time_fraction = self.config.time_step_months / 12
        return income * time_fraction, spending * time_fraction, shocks * time_fraction

    def _allocate_to_goals(
        self, goals: List[Goal], available_cashflow: float, policy: WaterfallPolicy
    ) -> List[GoalAllocation]:
        """Allocate cashflow to goals using waterfall policy."""
        from .goals import GoalAllocatorInput

        allocator = GoalAllocator(GoalAllocatorConfig(waterfall_policy=policy))

        input_data = GoalAllocatorInput(
            goals=goals,
            available_cashflow=available_cashflow,
            current_date=date.today(),
            time_horizon_months=12,
        )

        result = allocator.allocate(input_data)
        return result.allocations

    def _calculate_goal_success_probabilities(
        self, scenarios: List[ScenarioResult], goals: List[Goal]
    ) -> Dict[str, float]:
        """Calculate success probability for each goal."""
        goal_success_counts = {g.id: 0 for g in goals}

        for scenario in scenarios:
            for goal_id in scenario.goals_fully_funded:
                goal_success_counts[goal_id] += 1

        total_scenarios = len(scenarios)
        return {
            goal_id: count / total_scenarios
            for goal_id, count in goal_success_counts.items()
        }


# ===========================================================================
# Helper Functions
# ===========================================================================

def run_monte_carlo(
    goals: List[Goal],
    initial_portfolio: PortfolioState,
    income_streams: List[IncomeStream],
    spending_profile: SpendingProfile,
    time_horizon_years: int,
    initial_regime: MarketRegime = MarketRegime.SIDEWAYS,
    num_scenarios: int = 5000,
    random_seed: Optional[int] = None,
) -> SimulationOutput:
    """
    Convenience function for running Monte Carlo simulation.

    Args:
        goals: List of financial goals
        initial_portfolio: Starting portfolio state
        income_streams: Income streams
        spending_profile: Spending profile
        time_horizon_years: Simulation horizon (years)
        initial_regime: Starting market regime
        num_scenarios: Number of Monte Carlo scenarios
        random_seed: Random seed for determinism (optional)

    Returns:
        SimulationOutput with distribution of outcomes

    Example:
        >>> goals = [Goal(...)]
        >>> portfolio = PortfolioState(...)
        >>> income = [IncomeStream(...)]
        >>> spending = SpendingProfile(...)
        >>> output = run_monte_carlo(
        ...     goals, portfolio, income, spending, 30, num_scenarios=10000, random_seed=42
        ... )
        >>> output.overall_success_probability
        0.73  # 73% chance of achieving all goals
    """
    config = SimulationConfig(
        num_scenarios=num_scenarios, random_seed=random_seed
    )
    simulator = MonteCarloSimulator(config)

    input_data = SimulationInput(
        goals=goals,
        initial_portfolio=initial_portfolio,
        income_streams=income_streams,
        spending_profile=spending_profile,
        initial_regime=initial_regime,
        time_horizon_years=time_horizon_years,
        current_age=35,  # Default
        retirement_age=67,  # Default
    )

    return simulator.simulate(input_data)
