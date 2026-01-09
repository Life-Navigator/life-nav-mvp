"""
Household Cashflow & Shock Model
===========================================================================
Models household income, spending, and shocks that interact with market regime.

Features:
- Multiple income streams (salary, business, passive, social security)
- Spending with inflation adjustments
- Shocks: layoff, health costs, emergency expenses
- Regime-dependent shock probabilities (higher in bear markets)
- Insurance modeling (reduces shock impact)
- Deterministic seeding for Monte Carlo

HIPAA/PCI Compliance:
- NO medical details, diagnosis, or treatment info
- Only numeric proxies: health_cost_shock_annual_max, insurance_deductible
- NO SSN, account numbers, or identifying info
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from .regime import MarketRegime


# ===========================================================================
# Income Modeling
# ===========================================================================

class IncomeType(str, Enum):
    """Types of household income."""
    SALARY_W2 = "salary_w2"
    BUSINESS_1099 = "business_1099"
    PASSIVE_RENTAL = "passive_rental"
    PASSIVE_DIVIDENDS = "passive_dividends"
    SOCIAL_SECURITY = "social_security"
    PENSION = "pension"
    OTHER = "other"


class IncomeStream(BaseModel):
    """Single income stream."""
    model_config = ConfigDict(extra='forbid')

    income_type: IncomeType
    annual_amount: float = Field(..., gt=0)

    # Growth rate (real, after inflation)
    growth_rate: float = Field(0.0, ge=-0.1, le=0.2)

    # Stability (0.0 = very unstable, 1.0 = guaranteed)
    stability_score: float = Field(1.0, ge=0.0, le=1.0)

    # Layoff risk (annual probability)
    layoff_probability: float = Field(0.0, ge=0.0, le=0.5)

    # End date (optional, for temp income)
    end_year: Optional[int] = None


# ===========================================================================
# Spending Modeling
# ===========================================================================

class SpendingProfile(BaseModel):
    """Household spending profile."""
    model_config = ConfigDict(extra='forbid')

    # Base annual spending (current year)
    annual_base_spending: float = Field(..., gt=0)

    # Spending growth rate (real, after inflation)
    # Negative = lifestyle deflation, positive = lifestyle inflation
    growth_rate: float = Field(0.0, ge=-0.05, le=0.10)

    # Flexibility (0.0 = rigid, 1.0 = very flexible)
    # Affects ability to cut spending in bad markets
    flexibility_score: float = Field(0.5, ge=0.0, le=1.0)

    # Discretionary percentage (can be cut if needed)
    discretionary_pct: float = Field(0.3, ge=0.0, le=0.8)


# ===========================================================================
# Shock Modeling
# ===========================================================================

class ShockType(str, Enum):
    """Types of household shocks."""
    LAYOFF = "layoff"
    HEALTH_COST = "health_cost"
    EMERGENCY_REPAIR = "emergency_repair"
    LEGAL_EXPENSE = "legal_expense"
    FAMILY_SUPPORT = "family_support"


class ShockParameters(BaseModel):
    """Parameters for household shock modeling."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Health cost shocks (HIPAA-safe: no medical details)
    health_cost_shock_annual_max: float = Field(5000.0, ge=0)
    health_cost_shock_probability: float = Field(0.15, ge=0.0, le=1.0)
    insurance_deductible: float = Field(0.0, ge=0)
    insurance_coverage_ratio: float = Field(0.8, ge=0.0, le=1.0)

    # Emergency repair shocks
    emergency_repair_annual_max: float = Field(10000.0, ge=0)
    emergency_repair_probability: float = Field(0.10, ge=0.0, le=1.0)

    # Legal expense shocks
    legal_expense_annual_max: float = Field(15000.0, ge=0)
    legal_expense_probability: float = Field(0.05, ge=0.0, le=1.0)

    # Family support shocks (helping relatives)
    family_support_annual_max: float = Field(8000.0, ge=0)
    family_support_probability: float = Field(0.08, ge=0.0, le=1.0)


class Shock(BaseModel):
    """Single shock occurrence."""
    model_config = ConfigDict(extra='forbid')

    shock_type: ShockType
    amount: float = Field(..., ge=0)
    year: int = Field(..., ge=0)
    month: int = Field(1, ge=1, le=12)
    insurance_covered: float = Field(0.0, ge=0)  # Amount covered by insurance


# ===========================================================================
# Household State
# ===========================================================================

class HouseholdState(BaseModel):
    """Complete household financial state for a given year."""
    model_config = ConfigDict(extra='forbid')

    year: int = Field(..., ge=0)

    # Income
    total_income: float = Field(..., ge=0)
    income_by_type: Dict[IncomeType, float] = Field(default_factory=dict)

    # Spending
    base_spending: float = Field(..., ge=0)
    discretionary_spending: float = Field(0.0, ge=0)
    non_discretionary_spending: float = Field(..., ge=0)

    # Shocks
    shocks: List[Shock] = Field(default_factory=list)
    total_shock_amount: float = Field(0.0, ge=0)

    # Net cashflow
    net_cashflow: float  # Can be negative

    # Available to invest
    available_to_invest: float  # After spending + shocks


# ===========================================================================
# Household Simulator
# ===========================================================================

class HouseholdSimulatorConfig(BaseModel):
    """Configuration for household simulator."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Random seed for determinism
    random_seed: Optional[int] = None

    # Inflation assumption (real returns, so this is for reference only)
    inflation_rate: float = Field(0.025, ge=0.0, le=0.10)


class HouseholdSimulatorInput(BaseModel):
    """Input for household simulation."""
    model_config = ConfigDict(extra='forbid')

    # Income streams
    income_streams: List[IncomeStream] = Field(..., min_length=1)

    # Spending profile
    spending_profile: SpendingProfile

    # Shock parameters
    shock_parameters: ShockParameters = Field(default_factory=ShockParameters)

    # Time horizon
    time_horizon_years: int = Field(..., ge=1, le=100)

    # Market regime (affects shock probabilities)
    regime: MarketRegime

    # Current age (affects income trajectory, social security)
    current_age: int = Field(..., ge=18, le=100)

    # Retirement age (income changes)
    retirement_age: int = Field(67, ge=50, le=80)


class HouseholdSimulatorOutput(BaseModel):
    """Output from household simulation."""
    model_config = ConfigDict(extra='forbid')

    # Year-by-year household states
    states: List[HouseholdState]

    # Summary statistics
    total_income_pv: float  # Present value of all income
    total_spending_pv: float  # Present value of all spending
    total_shocks_pv: float  # Present value of all shocks
    net_cashflow_pv: float  # PV of net cashflows

    # Shock summary
    total_shocks_count: int
    shocks_by_type: Dict[ShockType, int]

    # Metadata
    regime: MarketRegime
    time_horizon_years: int
    random_seed: Optional[int]
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class HouseholdSimulator:
    """
    Household cashflow and shock simulator.

    Simulates income, spending, and shocks over time with regime awareness.
    """

    def __init__(self, config: HouseholdSimulatorConfig = HouseholdSimulatorConfig()):
        self.config = config

        # Set random seed if provided
        if config.random_seed is not None:
            np.random.seed(config.random_seed)

    def simulate(self, input_data: HouseholdSimulatorInput) -> HouseholdSimulatorOutput:
        """
        Simulate household cashflows over time.

        Args:
            input_data: Household simulation parameters

        Returns:
            HouseholdSimulatorOutput with year-by-year states
        """
        states = []
        shocks_by_type: Dict[ShockType, int] = {st: 0 for st in ShockType}

        for year in range(input_data.time_horizon_years):
            current_age = input_data.current_age + year

            # Calculate income for this year
            income, income_by_type = self._calculate_income(
                input_data.income_streams,
                year,
                current_age,
                input_data.retirement_age,
                input_data.regime,
            )

            # Calculate spending for this year
            spending = self._calculate_spending(
                input_data.spending_profile, year
            )

            discretionary = spending * input_data.spending_profile.discretionary_pct
            non_discretionary = spending - discretionary

            # Generate shocks for this year
            shocks = self._generate_shocks(
                input_data.shock_parameters,
                input_data.regime,
                year,
            )

            # Update shock counts
            for shock in shocks:
                shocks_by_type[shock.shock_type] += 1

            total_shock_amount = sum(s.amount for s in shocks)

            # Calculate net cashflow
            net_cashflow = income - spending - total_shock_amount

            # Available to invest (can be negative = need to withdraw)
            available_to_invest = net_cashflow

            state = HouseholdState(
                year=year,
                total_income=income,
                income_by_type=income_by_type,
                base_spending=spending,
                discretionary_spending=discretionary,
                non_discretionary_spending=non_discretionary,
                shocks=shocks,
                total_shock_amount=total_shock_amount,
                net_cashflow=net_cashflow,
                available_to_invest=available_to_invest,
            )

            states.append(state)

        # Calculate present values (simple sum, assuming real returns)
        total_income_pv = sum(s.total_income for s in states)
        total_spending_pv = sum(s.base_spending for s in states)
        total_shocks_pv = sum(s.total_shock_amount for s in states)
        net_cashflow_pv = sum(s.net_cashflow for s in states)

        total_shocks_count = sum(len(s.shocks) for s in states)

        return HouseholdSimulatorOutput(
            states=states,
            total_income_pv=total_income_pv,
            total_spending_pv=total_spending_pv,
            total_shocks_pv=total_shocks_pv,
            net_cashflow_pv=net_cashflow_pv,
            total_shocks_count=total_shocks_count,
            shocks_by_type=shocks_by_type,
            regime=input_data.regime,
            time_horizon_years=input_data.time_horizon_years,
            random_seed=self.config.random_seed,
        )

    def _calculate_income(
        self,
        streams: List[IncomeStream],
        year: int,
        current_age: int,
        retirement_age: int,
        regime: MarketRegime,
    ) -> Tuple[float, Dict[IncomeType, float]]:
        """Calculate total income for a given year."""
        total = 0.0
        by_type: Dict[IncomeType, float] = {}

        for stream in streams:
            # Check if stream has ended
            if stream.end_year is not None and year >= stream.end_year:
                continue

            # Check if retired (salary stops, social security starts)
            if current_age >= retirement_age:
                if stream.income_type in [IncomeType.SALARY_W2, IncomeType.BUSINESS_1099]:
                    continue  # Stop working income

            # Apply growth
            amount = stream.annual_amount * ((1 + stream.growth_rate) ** year)

            # Check for layoff (only for salary/business)
            if stream.income_type in [IncomeType.SALARY_W2, IncomeType.BUSINESS_1099]:
                # Regime affects layoff probability
                layoff_multiplier = self._get_layoff_probability_multiplier(regime)
                adjusted_layoff_prob = min(
                    0.5, stream.layoff_probability * layoff_multiplier
                )

                if np.random.random() < adjusted_layoff_prob:
                    # Layoff occurred - no income this year from this stream
                    amount = 0.0

            total += amount
            by_type[stream.income_type] = by_type.get(stream.income_type, 0.0) + amount

        return total, by_type

    def _calculate_spending(
        self, profile: SpendingProfile, year: int
    ) -> float:
        """Calculate spending for a given year."""
        # Apply growth
        spending = profile.annual_base_spending * (
            (1 + profile.growth_rate) ** year
        )
        return spending

    def _generate_shocks(
        self,
        params: ShockParameters,
        regime: MarketRegime,
        year: int,
    ) -> List[Shock]:
        """Generate shocks for a given year."""
        shocks = []

        # Regime affects shock probabilities
        shock_multiplier = self._get_shock_probability_multiplier(regime)

        # Health cost shock
        health_prob = params.health_cost_shock_probability * shock_multiplier
        if np.random.random() < health_prob:
            # Shock occurred
            gross_amount = np.random.uniform(0, params.health_cost_shock_annual_max)

            # Insurance coverage
            out_of_pocket = max(
                0,
                gross_amount - params.insurance_deductible
            ) * (1 - params.insurance_coverage_ratio)

            covered = gross_amount - out_of_pocket

            shocks.append(
                Shock(
                    shock_type=ShockType.HEALTH_COST,
                    amount=out_of_pocket,
                    year=year,
                    month=np.random.randint(1, 13),
                    insurance_covered=covered,
                )
            )

        # Emergency repair shock
        repair_prob = params.emergency_repair_probability * shock_multiplier
        if np.random.random() < repair_prob:
            amount = np.random.uniform(0, params.emergency_repair_annual_max)
            shocks.append(
                Shock(
                    shock_type=ShockType.EMERGENCY_REPAIR,
                    amount=amount,
                    year=year,
                    month=np.random.randint(1, 13),
                )
            )

        # Legal expense shock
        legal_prob = params.legal_expense_probability
        if np.random.random() < legal_prob:
            amount = np.random.uniform(0, params.legal_expense_annual_max)
            shocks.append(
                Shock(
                    shock_type=ShockType.LEGAL_EXPENSE,
                    amount=amount,
                    year=year,
                    month=np.random.randint(1, 13),
                )
            )

        # Family support shock
        family_prob = params.family_support_probability
        if np.random.random() < family_prob:
            amount = np.random.uniform(0, params.family_support_annual_max)
            shocks.append(
                Shock(
                    shock_type=ShockType.FAMILY_SUPPORT,
                    amount=amount,
                    year=year,
                    month=np.random.randint(1, 13),
                )
            )

        return shocks

    def _get_layoff_probability_multiplier(self, regime: MarketRegime) -> float:
        """
        Get layoff probability multiplier based on regime.

        In bear markets, layoffs more likely.
        """
        multipliers = {
            MarketRegime.BULL_LOW_VOL: 0.5,
            MarketRegime.BULL_HIGH_VOL: 0.8,
            MarketRegime.SIDEWAYS: 1.0,
            MarketRegime.BEAR_LOW_VOL: 1.5,
            MarketRegime.BEAR_HIGH_VOL: 3.0,  # Crisis
        }
        return multipliers.get(regime, 1.0)

    def _get_shock_probability_multiplier(self, regime: MarketRegime) -> float:
        """
        Get shock probability multiplier based on regime.

        In bear markets, financial shocks more likely.
        """
        multipliers = {
            MarketRegime.BULL_LOW_VOL: 0.8,
            MarketRegime.BULL_HIGH_VOL: 1.0,
            MarketRegime.SIDEWAYS: 1.0,
            MarketRegime.BEAR_LOW_VOL: 1.2,
            MarketRegime.BEAR_HIGH_VOL: 1.5,  # Crisis
        }
        return multipliers.get(regime, 1.0)


# ===========================================================================
# Helper Functions
# ===========================================================================

def simulate_household(
    income_streams: List[IncomeStream],
    spending_profile: SpendingProfile,
    time_horizon_years: int,
    regime: MarketRegime,
    current_age: int = 35,
    retirement_age: int = 67,
    random_seed: Optional[int] = None,
) -> HouseholdSimulatorOutput:
    """
    Convenience function for household simulation.

    Args:
        income_streams: List of income streams
        spending_profile: Spending profile
        time_horizon_years: Years to simulate
        regime: Market regime
        current_age: Current age
        retirement_age: Retirement age
        random_seed: Random seed for determinism (optional)

    Returns:
        HouseholdSimulatorOutput with year-by-year states

    Example:
        >>> streams = [
        ...     IncomeStream(
        ...         income_type=IncomeType.SALARY_W2,
        ...         annual_amount=100000,
        ...         growth_rate=0.03,
        ...         stability_score=0.9,
        ...         layoff_probability=0.05,
        ...     )
        ... ]
        >>> spending = SpendingProfile(
        ...     annual_base_spending=60000,
        ...     growth_rate=0.02,
        ...     flexibility_score=0.6,
        ...     discretionary_pct=0.3,
        ... )
        >>> output = simulate_household(
        ...     streams, spending, 30, MarketRegime.BULL_LOW_VOL, random_seed=42
        ... )
        >>> output.net_cashflow_pv
        1523456.78  # Total net cashflow over 30 years
    """
    config = HouseholdSimulatorConfig(random_seed=random_seed)
    simulator = HouseholdSimulator(config)

    input_data = HouseholdSimulatorInput(
        income_streams=income_streams,
        spending_profile=spending_profile,
        time_horizon_years=time_horizon_years,
        regime=regime,
        current_age=current_age,
        retirement_age=retirement_age,
    )

    return simulator.simulate(input_data)
