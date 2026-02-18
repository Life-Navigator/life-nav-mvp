"""
Risk Scoring Module
===========================================================================
Calculates risk metrics from Monte Carlo simulation results.

Metrics:
- Win/loss probabilities (goal success)
- Value at Risk (VaR) - 5th percentile
- Conditional Value at Risk (CVaR) - expected loss in worst 5%
- Maximum drawdown
- Liquidity metrics
- Risk-adjusted returns (Sharpe, Sortino)

Features:
- Goal-specific and portfolio-level metrics
- Time-horizon aware
- Confidence intervals
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from .simulation import ScenarioResult, SimulationOutput
from .goals import Goal


# ===========================================================================
# Risk Metrics
# ===========================================================================

class GoalRiskMetrics(BaseModel):
    """Risk metrics for a single goal."""
    model_config = ConfigDict(extra='forbid')

    goal_id: str

    # Success probability
    success_probability: float = Field(..., ge=0.0, le=1.0)

    # Expected outcomes
    expected_funded_amount: float = Field(..., ge=0)
    expected_shortfall: float = Field(0.0, ge=0)
    expected_delay_months: int = Field(0, ge=0)

    # Distribution
    median_funded_amount: float = Field(..., ge=0)
    percentile_5_funded_amount: float = Field(..., ge=0)  # Worst case
    percentile_95_funded_amount: float = Field(..., ge=0)  # Best case

    # Confidence interval (95%)
    confidence_interval_95: Tuple[float, float]


class PortfolioRiskMetrics(BaseModel):
    """Portfolio-level risk metrics."""
    model_config = ConfigDict(extra='forbid')

    # Terminal value distribution
    mean_terminal_value: float
    median_terminal_value: float
    std_terminal_value: float

    # Value at Risk
    value_at_risk_5pct: float  # 5th percentile (worst 5% of outcomes)
    value_at_risk_10pct: float  # 10th percentile

    # Conditional VaR (expected shortfall)
    conditional_var_5pct: float  # Average of worst 5% of outcomes

    # Drawdown metrics
    max_drawdown_mean: float  # Average max drawdown across scenarios
    max_drawdown_worst_case: float  # Worst max drawdown observed

    # Risk-adjusted returns
    sharpe_ratio: Optional[float] = None  # (return - rf) / volatility
    sortino_ratio: Optional[float] = None  # (return - rf) / downside_vol

    # Liquidity metrics
    probability_portfolio_depletion: float = Field(..., ge=0.0, le=1.0)
    expected_years_to_depletion: Optional[float] = None


class RiskScorecard(BaseModel):
    """Complete risk scorecard."""
    model_config = ConfigDict(extra='forbid')

    # Overall
    overall_success_probability: float = Field(..., ge=0.0, le=1.0)
    overall_risk_score: float = Field(..., ge=0.0, le=1.0)  # 0 = low risk, 1 = high risk

    # Per-goal metrics
    goal_metrics: List[GoalRiskMetrics]

    # Portfolio metrics
    portfolio_metrics: PortfolioRiskMetrics

    # Metadata
    num_scenarios: int
    time_horizon_years: int
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Scorer
# ===========================================================================

class RiskScorer:
    """
    Calculates risk metrics from simulation results.
    """

    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate

    def score(
        self, simulation_output: SimulationOutput, goals: List[Goal]
    ) -> RiskScorecard:
        """
        Calculate complete risk scorecard from simulation results.

        Args:
            simulation_output: Monte Carlo simulation results
            goals: List of goals

        Returns:
            RiskScorecard with all metrics
        """
        scenarios = simulation_output.scenarios

        # Calculate per-goal metrics
        goal_metrics = self._calculate_goal_metrics(scenarios, goals)

        # Calculate portfolio metrics
        portfolio_metrics = self._calculate_portfolio_metrics(scenarios)

        # Overall success probability
        overall_success = simulation_output.overall_success_probability

        # Overall risk score (inverse of success probability, adjusted)
        # 0 = low risk (high success), 1 = high risk (low success)
        overall_risk_score = self._calculate_overall_risk_score(
            overall_success, portfolio_metrics
        )

        return RiskScorecard(
            overall_success_probability=overall_success,
            overall_risk_score=overall_risk_score,
            goal_metrics=goal_metrics,
            portfolio_metrics=portfolio_metrics,
            num_scenarios=simulation_output.num_scenarios,
            time_horizon_years=simulation_output.time_horizon_years,
        )

    def _calculate_goal_metrics(
        self, scenarios: List[ScenarioResult], goals: List[Goal]
    ) -> List[GoalRiskMetrics]:
        """Calculate metrics for each goal."""
        goal_metrics = []

        for goal in goals:
            # Collect funded amounts across scenarios
            funded_amounts = []

            for scenario in scenarios:
                # Find final allocation for this goal
                funded_amount = 0.0

                # Check if fully funded
                if goal.id in scenario.goals_fully_funded:
                    funded_amount = goal.target_value
                elif goal.id in scenario.goals_partially_funded:
                    # Sum allocations across time steps
                    for time_step in scenario.time_steps:
                        for allocation in time_step.goal_allocations:
                            if allocation.goal_id == goal.id:
                                funded_amount += allocation.allocated_amount

                funded_amounts.append(funded_amount)

            funded_amounts = np.array(funded_amounts)

            # Success probability
            success_prob = np.mean(funded_amounts >= goal.target_value)

            # Expected outcomes
            expected_funded = np.mean(funded_amounts)
            expected_shortfall = max(0, goal.target_value - expected_funded)

            # Distribution
            median_funded = np.median(funded_amounts)
            percentile_5 = np.percentile(funded_amounts, 5)
            percentile_95 = np.percentile(funded_amounts, 95)

            # Confidence interval
            confidence_interval = (
                np.percentile(funded_amounts, 2.5),
                np.percentile(funded_amounts, 97.5),
            )

            # Expected delay (simplified - assume linear)
            # TODO: Calculate actual delay from time series
            expected_delay = 0

            goal_metrics.append(
                GoalRiskMetrics(
                    goal_id=goal.id,
                    success_probability=success_prob,
                    expected_funded_amount=expected_funded,
                    expected_shortfall=expected_shortfall,
                    expected_delay_months=expected_delay,
                    median_funded_amount=median_funded,
                    percentile_5_funded_amount=percentile_5,
                    percentile_95_funded_amount=percentile_95,
                    confidence_interval_95=confidence_interval,
                )
            )

        return goal_metrics

    def _calculate_portfolio_metrics(
        self, scenarios: List[ScenarioResult]
    ) -> PortfolioRiskMetrics:
        """Calculate portfolio-level metrics."""
        terminal_values = np.array([s.terminal_portfolio_value for s in scenarios])

        # Basic statistics
        mean_terminal = np.mean(terminal_values)
        median_terminal = np.median(terminal_values)
        std_terminal = np.std(terminal_values)

        # VaR
        var_5pct = np.percentile(terminal_values, 5)
        var_10pct = np.percentile(terminal_values, 10)

        # CVaR (conditional VaR)
        # Average of worst 5% of outcomes
        worst_5pct_mask = terminal_values <= var_5pct
        if np.any(worst_5pct_mask):
            cvar_5pct = np.mean(terminal_values[worst_5pct_mask])
        else:
            cvar_5pct = var_5pct

        # Drawdown metrics
        max_drawdowns = []
        for scenario in scenarios:
            max_dd = self._calculate_max_drawdown(scenario)
            max_drawdowns.append(max_dd)

        max_drawdown_mean = np.mean(max_drawdowns)
        max_drawdown_worst = np.max(max_drawdowns)

        # Risk-adjusted returns
        # Annualized return
        time_horizon = len(scenarios[0].time_steps) / 12  # Assuming monthly steps
        if time_horizon > 0:
            annualized_returns = (terminal_values ** (1 / time_horizon)) - 1
            mean_return = np.mean(annualized_returns)
            vol_return = np.std(annualized_returns)

            # Sharpe ratio
            sharpe = (mean_return - self.risk_free_rate) / vol_return if vol_return > 0 else None

            # Sortino ratio (downside deviation only)
            downside_returns = annualized_returns[annualized_returns < self.risk_free_rate]
            if len(downside_returns) > 0:
                downside_vol = np.std(downside_returns)
                sortino = (mean_return - self.risk_free_rate) / downside_vol if downside_vol > 0 else None
            else:
                sortino = None
        else:
            sharpe = None
            sortino = None

        # Liquidity metrics
        prob_depletion = np.mean(terminal_values <= 0)

        # Expected years to depletion (for depleted scenarios)
        years_to_depletion = []
        for scenario in scenarios:
            if scenario.terminal_portfolio_value <= 0:
                # Find when portfolio hit zero
                for i, step in enumerate(scenario.time_steps):
                    if step.portfolio_value_after_cashflow <= 0:
                        years_to_depletion.append(step.year + step.month / 12)
                        break

        expected_years_to_depletion = (
            np.mean(years_to_depletion) if years_to_depletion else None
        )

        return PortfolioRiskMetrics(
            mean_terminal_value=mean_terminal,
            median_terminal_value=median_terminal,
            std_terminal_value=std_terminal,
            value_at_risk_5pct=var_5pct,
            value_at_risk_10pct=var_10pct,
            conditional_var_5pct=cvar_5pct,
            max_drawdown_mean=max_drawdown_mean,
            max_drawdown_worst_case=max_drawdown_worst,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            probability_portfolio_depletion=prob_depletion,
            expected_years_to_depletion=expected_years_to_depletion,
        )

    def _calculate_max_drawdown(self, scenario: ScenarioResult) -> float:
        """
        Calculate maximum drawdown for a scenario.

        Drawdown = (peak - trough) / peak
        """
        portfolio_values = [
            step.portfolio_value_after_cashflow for step in scenario.time_steps
        ]

        if not portfolio_values:
            return 0.0

        max_dd = 0.0
        peak = portfolio_values[0]

        for value in portfolio_values:
            if value > peak:
                peak = value

            if peak > 0:
                drawdown = (peak - value) / peak
                max_dd = max(max_dd, drawdown)

        return max_dd

    def _calculate_overall_risk_score(
        self, overall_success: float, portfolio_metrics: PortfolioRiskMetrics
    ) -> float:
        """
        Calculate overall risk score.

        Combines success probability, VaR, drawdown, etc.
        Returns 0-1 where 0 = low risk, 1 = high risk.
        """
        # Base score from inverse of success probability
        base_score = 1 - overall_success

        # Adjust for portfolio depletion risk
        depletion_penalty = portfolio_metrics.probability_portfolio_depletion * 0.3

        # Adjust for drawdown risk
        drawdown_penalty = min(portfolio_metrics.max_drawdown_mean, 1.0) * 0.2

        # Combined score
        risk_score = base_score + depletion_penalty + drawdown_penalty

        # Clamp to [0, 1]
        return min(1.0, max(0.0, risk_score))


# ===========================================================================
# Helper Functions
# ===========================================================================

def calculate_risk_metrics(
    simulation_output: SimulationOutput, goals: List[Goal], risk_free_rate: float = 0.02
) -> RiskScorecard:
    """
    Convenience function for calculating risk metrics.

    Args:
        simulation_output: Monte Carlo simulation results
        goals: List of goals
        risk_free_rate: Risk-free rate for Sharpe/Sortino (annualized)

    Returns:
        RiskScorecard with all metrics

    Example:
        >>> simulation_output = run_monte_carlo(...)
        >>> goals = [Goal(...)]
        >>> scorecard = calculate_risk_metrics(simulation_output, goals)
        >>> scorecard.overall_success_probability
        0.73  # 73% chance of success
        >>> scorecard.portfolio_metrics.value_at_risk_5pct
        523456.78  # 5th percentile terminal value
    """
    scorer = RiskScorer(risk_free_rate=risk_free_rate)
    return scorer.score(simulation_output, goals)


def calculate_var_cvar(
    values: List[float], percentile: float = 5
) -> Tuple[float, float]:
    """
    Calculate VaR and CVaR for a distribution.

    Args:
        values: Distribution of values
        percentile: Percentile for VaR (default 5)

    Returns:
        Tuple of (VaR, CVaR)

    Example:
        >>> terminal_values = [100000, 150000, 200000, ..., 500000]
        >>> var, cvar = calculate_var_cvar(terminal_values, percentile=5)
        >>> var
        125000  # 5th percentile
        >>> cvar
        110000  # Average of worst 5%
    """
    values_array = np.array(values)

    # VaR
    var = np.percentile(values_array, percentile)

    # CVaR (conditional VaR)
    worst_cases = values_array[values_array <= var]
    if len(worst_cases) > 0:
        cvar = np.mean(worst_cases)
    else:
        cvar = var

    return var, cvar


def calculate_sharpe_ratio(
    returns: List[float], risk_free_rate: float = 0.02
) -> float:
    """
    Calculate Sharpe ratio.

    Sharpe = (mean_return - risk_free_rate) / std_return

    Args:
        returns: Annualized returns
        risk_free_rate: Risk-free rate (annualized)

    Returns:
        Sharpe ratio

    Example:
        >>> returns = [0.05, 0.08, 0.12, -0.02, 0.15]
        >>> sharpe = calculate_sharpe_ratio(returns, risk_free_rate=0.02)
        >>> sharpe
        0.86
    """
    returns_array = np.array(returns)
    mean_return = np.mean(returns_array)
    std_return = np.std(returns_array)

    if std_return == 0:
        return 0.0

    return (mean_return - risk_free_rate) / std_return


def calculate_sortino_ratio(
    returns: List[float], risk_free_rate: float = 0.02
) -> float:
    """
    Calculate Sortino ratio.

    Sortino = (mean_return - risk_free_rate) / downside_deviation

    Only considers downside volatility (returns below risk-free rate).

    Args:
        returns: Annualized returns
        risk_free_rate: Risk-free rate (annualized)

    Returns:
        Sortino ratio

    Example:
        >>> returns = [0.05, 0.08, 0.12, -0.02, 0.15]
        >>> sortino = calculate_sortino_ratio(returns, risk_free_rate=0.02)
        >>> sortino
        1.23
    """
    returns_array = np.array(returns)
    mean_return = np.mean(returns_array)

    # Downside deviation (only negative excess returns)
    downside_returns = returns_array[returns_array < risk_free_rate]

    if len(downside_returns) == 0:
        return float('inf')  # No downside risk

    downside_deviation = np.std(downside_returns)

    if downside_deviation == 0:
        return 0.0

    return (mean_return - risk_free_rate) / downside_deviation


def calculate_max_drawdown(portfolio_values: List[float]) -> float:
    """
    Calculate maximum drawdown from a time series of portfolio values.

    Drawdown = (peak - trough) / peak

    Args:
        portfolio_values: Time series of portfolio values

    Returns:
        Maximum drawdown (0.0 to 1.0)

    Example:
        >>> values = [100000, 120000, 110000, 90000, 105000, 115000]
        >>> max_dd = calculate_max_drawdown(values)
        >>> max_dd
        0.25  # 25% drawdown from peak of 120000 to trough of 90000
    """
    if not portfolio_values:
        return 0.0

    values_array = np.array(portfolio_values)
    max_dd = 0.0
    peak = values_array[0]

    for value in values_array:
        if value > peak:
            peak = value

        if peak > 0:
            drawdown = (peak - value) / peak
            max_dd = max(max_dd, drawdown)

    return max_dd
