"""
Time Series Generation for UI
===========================================================================
Generates UI-ready time series data from simulation results.

Features:
- Portfolio value over time (with confidence bands)
- Goal progress over time
- Cashflow projections
- Risk metrics evolution
- Percentile bands (5th, 25th, 50th, 75th, 95th)
- Formatted for charts (Recharts, Chart.js, etc.)

Output Format:
- JSON-serializable
- Monthly or annual granularity
- Multiple series per chart
- Includes metadata for rendering
"""

import numpy as np
from typing import List, Dict, Optional, Tuple, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from enum import Enum

from .simulation import SimulationOutput, ScenarioResult
from .goals import Goal


# ===========================================================================
# Series Types
# ===========================================================================

class SeriesType(str, Enum):
    """Type of time series."""
    PORTFOLIO_VALUE = "portfolio_value"
    GOAL_PROGRESS = "goal_progress"
    CASHFLOW = "cashflow"
    INCOME = "income"
    SPENDING = "spending"
    CONTRIBUTIONS = "contributions"
    WITHDRAWALS = "withdrawals"


class Granularity(str, Enum):
    """Time series granularity."""
    MONTHLY = "monthly"
    ANNUAL = "annual"


# ===========================================================================
# Data Points
# ===========================================================================

class TimeSeriesPoint(BaseModel):
    """Single point in time series."""
    model_config = ConfigDict(extra='forbid')

    # Time (Unix timestamp for easy charting)
    timestamp: int  # Seconds since epoch
    year: int
    month: Optional[int] = None  # For monthly granularity

    # Value
    value: float

    # Metadata (optional)
    label: Optional[str] = None


class PercentileBand(BaseModel):
    """Percentile band for confidence visualization."""
    model_config = ConfigDict(extra='forbid')

    timestamp: int
    year: int
    month: Optional[int] = None

    # Percentile values
    p5: float  # 5th percentile
    p25: float  # 25th percentile
    p50: float  # Median
    p75: float  # 75th percentile
    p95: float  # 95th percentile


class TimeSeries(BaseModel):
    """Complete time series."""
    model_config = ConfigDict(extra='forbid')

    # Metadata
    series_type: SeriesType
    name: str
    granularity: Granularity
    unit: str  # e.g., "$", "%", "count"

    # Data points
    data: List[TimeSeriesPoint]

    # Percentile bands (optional, for uncertainty visualization)
    percentile_bands: Optional[List[PercentileBand]] = None

    # Chart rendering hints
    chart_type: Literal["line", "area", "bar"] = "line"
    color: Optional[str] = None  # Hex color


# ===========================================================================
# Series Payload (for API response)
# ===========================================================================

class SeriesPayload(BaseModel):
    """Complete series payload for UI."""
    model_config = ConfigDict(extra='forbid')

    # Portfolio value series (with percentiles)
    portfolio_value_series: TimeSeries

    # Per-goal progress series
    goal_progress_series: List[TimeSeries] = Field(default_factory=list)

    # Cashflow series
    cashflow_series: Optional[TimeSeries] = None
    income_series: Optional[TimeSeries] = None
    spending_series: Optional[TimeSeries] = None

    # Contributions/withdrawals
    contributions_series: Optional[TimeSeries] = None
    withdrawals_series: Optional[TimeSeries] = None

    # Metadata
    start_date: date
    end_date: date
    num_data_points: int
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Series Generator
# ===========================================================================

class SeriesGeneratorConfig(BaseModel):
    """Configuration for series generator."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Granularity
    granularity: Granularity = Granularity.ANNUAL

    # Include percentile bands
    include_percentile_bands: bool = True

    # Include optional series
    include_cashflow_series: bool = True
    include_goal_progress_series: bool = True


class SeriesGenerator:
    """
    Time series generator for UI visualization.

    Extracts and formats time series data from simulation results.
    """

    def __init__(self, config: SeriesGeneratorConfig = SeriesGeneratorConfig()):
        self.config = config

    def generate(
        self, simulation_output: SimulationOutput, goals: List[Goal], start_date: date
    ) -> SeriesPayload:
        """
        Generate time series payload from simulation results.

        Args:
            simulation_output: Simulation results
            goals: Goals
            start_date: Start date for time series

        Returns:
            SeriesPayload with all time series
        """
        scenarios = simulation_output.scenarios

        # Generate portfolio value series
        portfolio_series = self._generate_portfolio_value_series(
            scenarios, start_date
        )

        # Generate goal progress series
        goal_series = []
        if self.config.include_goal_progress_series:
            for goal in goals:
                series = self._generate_goal_progress_series(
                    scenarios, goal, start_date
                )
                goal_series.append(series)

        # Generate cashflow series
        cashflow_series = None
        income_series = None
        spending_series = None
        contributions_series = None
        withdrawals_series = None

        if self.config.include_cashflow_series:
            cashflow_series = self._generate_cashflow_series(scenarios, start_date)
            income_series = self._generate_income_series(scenarios, start_date)
            spending_series = self._generate_spending_series(scenarios, start_date)
            contributions_series = self._generate_contributions_series(scenarios, start_date)
            withdrawals_series = self._generate_withdrawals_series(scenarios, start_date)

        # Calculate end date
        time_horizon_years = simulation_output.time_horizon_years
        end_date = date(
            start_date.year + time_horizon_years, start_date.month, start_date.day
        )

        num_data_points = len(portfolio_series.data)

        return SeriesPayload(
            portfolio_value_series=portfolio_series,
            goal_progress_series=goal_series,
            cashflow_series=cashflow_series,
            income_series=income_series,
            spending_series=spending_series,
            contributions_series=contributions_series,
            withdrawals_series=withdrawals_series,
            start_date=start_date,
            end_date=end_date,
            num_data_points=num_data_points,
        )

    def _generate_portfolio_value_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate portfolio value time series with percentiles."""
        # Extract portfolio values across all scenarios
        # Assume all scenarios have same number of time steps
        num_steps = len(scenarios[0].time_steps)

        data_points = []
        percentile_bands = []

        for step_idx in range(num_steps):
            # Get portfolio values at this step across all scenarios
            values_at_step = [
                scenario.time_steps[step_idx].portfolio_value_after_cashflow
                for scenario in scenarios
            ]

            # Calculate percentiles
            p5 = np.percentile(values_at_step, 5)
            p25 = np.percentile(values_at_step, 25)
            p50 = np.percentile(values_at_step, 50)
            p75 = np.percentile(values_at_step, 75)
            p95 = np.percentile(values_at_step, 95)

            # Get time info
            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            # Calculate timestamp
            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            # Add median data point
            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=p50,
                    label=f"Year {year}" if month is None else f"{year}-{month:02d}",
                )
            )

            # Add percentile band
            if self.config.include_percentile_bands:
                percentile_bands.append(
                    PercentileBand(
                        timestamp=timestamp,
                        year=year,
                        month=month,
                        p5=p5,
                        p25=p25,
                        p50=p50,
                        p75=p75,
                        p95=p95,
                    )
                )

        return TimeSeries(
            series_type=SeriesType.PORTFOLIO_VALUE,
            name="Portfolio Value",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            percentile_bands=percentile_bands if self.config.include_percentile_bands else None,
            chart_type="area",
            color="#4f46e5",  # Indigo
        )

    def _generate_goal_progress_series(
        self, scenarios: List[ScenarioResult], goal: Goal, start_date: date
    ) -> TimeSeries:
        """Generate goal progress time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            # Get allocated amounts for this goal at this step across scenarios
            allocated_at_step = []

            for scenario in scenarios:
                # Sum allocations up to this step
                total_allocated = 0.0
                for s in range(step_idx + 1):
                    step = scenario.time_steps[s]
                    for allocation in step.goal_allocations:
                        if allocation.goal_id == goal.id:
                            total_allocated += allocation.allocated_amount

                allocated_at_step.append(total_allocated)

            # Calculate median allocation
            median_allocated = np.median(allocated_at_step)

            # Progress as percentage of goal
            progress_pct = (median_allocated / goal.target_value) * 100

            # Get time info
            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=progress_pct,
                    label=f"Year {year}" if month is None else f"{year}-{month:02d}",
                )
            )

        return TimeSeries(
            series_type=SeriesType.GOAL_PROGRESS,
            name=f"{goal.name or goal.type.value} Progress",
            granularity=self.config.granularity,
            unit="%",
            data=data_points,
            chart_type="line",
            color=self._get_goal_color(goal.type.value),
        )

    def _generate_cashflow_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate net cashflow time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            # Get net cashflow at this step across scenarios
            cashflows_at_step = [
                scenario.time_steps[step_idx].net_cashflow_this_period
                for scenario in scenarios
            ]

            median_cashflow = np.median(cashflows_at_step)

            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=median_cashflow,
                    label=f"Year {year}" if month is None else f"{year}-{month:02d}",
                )
            )

        return TimeSeries(
            series_type=SeriesType.CASHFLOW,
            name="Net Cashflow",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            chart_type="bar",
            color="#10b981",  # Green
        )

    def _generate_income_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate income time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            incomes_at_step = [
                scenario.time_steps[step_idx].income_this_period
                for scenario in scenarios
            ]

            median_income = np.median(incomes_at_step)

            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=median_income,
                )
            )

        return TimeSeries(
            series_type=SeriesType.INCOME,
            name="Income",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            chart_type="line",
            color="#3b82f6",  # Blue
        )

    def _generate_spending_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate spending time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            spending_at_step = [
                scenario.time_steps[step_idx].spending_this_period
                for scenario in scenarios
            ]

            median_spending = np.median(spending_at_step)

            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=median_spending,
                )
            )

        return TimeSeries(
            series_type=SeriesType.SPENDING,
            name="Spending",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            chart_type="line",
            color="#ef4444",  # Red
        )

    def _generate_contributions_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate contributions time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            contributions_at_step = [
                scenario.time_steps[step_idx].contributions_this_period
                for scenario in scenarios
            ]

            median_contributions = np.median(contributions_at_step)

            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=median_contributions,
                )
            )

        return TimeSeries(
            series_type=SeriesType.CONTRIBUTIONS,
            name="Contributions",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            chart_type="bar",
            color="#10b981",  # Green
        )

    def _generate_withdrawals_series(
        self, scenarios: List[ScenarioResult], start_date: date
    ) -> TimeSeries:
        """Generate withdrawals time series."""
        num_steps = len(scenarios[0].time_steps)

        data_points = []

        for step_idx in range(num_steps):
            withdrawals_at_step = [
                scenario.time_steps[step_idx].withdrawals_this_period
                for scenario in scenarios
            ]

            median_withdrawals = np.median(withdrawals_at_step)

            step = scenarios[0].time_steps[step_idx]
            year = step.year
            month = step.month if self.config.granularity == Granularity.MONTHLY else None

            step_date = date(start_date.year + year, month or 1, 1)
            timestamp = int(step_date.strftime("%s"))

            data_points.append(
                TimeSeriesPoint(
                    timestamp=timestamp,
                    year=year,
                    month=month,
                    value=median_withdrawals,
                )
            )

        return TimeSeries(
            series_type=SeriesType.WITHDRAWALS,
            name="Withdrawals",
            granularity=self.config.granularity,
            unit="$",
            data=data_points,
            chart_type="bar",
            color="#ef4444",  # Red
        )

    def _get_goal_color(self, goal_type: str) -> str:
        """Get color for goal type."""
        colors = {
            "retirement": "#8b5cf6",  # Purple
            "home_purchase": "#f59e0b",  # Amber
            "education": "#06b6d4",  # Cyan
            "emergency_fund": "#10b981",  # Green
            "vacation": "#ec4899",  # Pink
            "debt_payoff": "#ef4444",  # Red
            "major_purchase": "#f97316",  # Orange
            "business": "#6366f1",  # Indigo
        }
        return colors.get(goal_type, "#6b7280")  # Gray default


# ===========================================================================
# Helper Functions
# ===========================================================================

def generate_ui_series(
    simulation_output: SimulationOutput,
    goals: List[Goal],
    start_date: date = date.today(),
    granularity: Granularity = Granularity.ANNUAL,
) -> SeriesPayload:
    """
    Convenience function for generating UI time series.

    Args:
        simulation_output: Simulation results
        goals: Goals
        start_date: Start date for time series
        granularity: Time series granularity (monthly or annual)

    Returns:
        SeriesPayload with all time series

    Example:
        >>> output = run_monte_carlo(...)
        >>> goals = [Goal(...)]
        >>> series = generate_ui_series(output, goals, granularity=Granularity.ANNUAL)
        >>> series.portfolio_value_series.data[0].value
        100000  # Initial portfolio value
        >>> series.portfolio_value_series.percentile_bands[0].p5
        95000  # 5th percentile at t=0
    """
    config = SeriesGeneratorConfig(granularity=granularity)
    generator = SeriesGenerator(config)

    return generator.generate(simulation_output, goals, start_date)
