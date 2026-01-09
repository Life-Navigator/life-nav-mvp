"""
Canonical Risk Engine Request/Response Schemas
===========================================================================
HIPAA/PCI-safe: Only derived numeric features, no PHI/PCI.
Multi-goal aware, household-context aware, market-regime aware.
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from uuid import UUID


# ===========================================================================
# Enums
# ===========================================================================

class GoalType(str, Enum):
    """Goal categories."""
    RETIREMENT = "retirement"
    HOME_PURCHASE = "home_purchase"
    EDUCATION = "education"
    DEBT_PAYOFF = "debt_payoff"
    EMERGENCY_FUND = "emergency_fund"
    TRAVEL = "travel"
    BUSINESS = "business"
    GENERAL_SAVINGS = "general_savings"


class IncomeType(str, Enum):
    """Income stream types."""
    SALARY = "salary"
    BONUS = "bonus"
    INVESTMENT = "investment"
    RENTAL = "rental"
    PENSION = "pension"
    SOCIAL_SECURITY = "social_security"
    ANNUITY = "annuity"
    SIDE_INCOME = "side_income"


class AssetClass(str, Enum):
    """Asset classes for portfolio exposures."""
    US_EQUITY = "us_equity"
    INTL_EQUITY = "intl_equity"
    US_BOND = "us_bond"
    INTL_BOND = "intl_bond"
    CASH = "cash"
    COMMODITIES = "commodities"
    CRYPTO = "crypto"
    REAL_ESTATE = "real_estate"
    ALTERNATIVE = "alternative"


class MarketRegime(str, Enum):
    """Market regime classifications."""
    BULL_LOW_VOL = "bull_low_vol"
    BULL_HIGH_VOL = "bull_high_vol"
    BEAR_LOW_VOL = "bear_low_vol"
    BEAR_HIGH_VOL = "bear_high_vol"
    SIDEWAYS = "sideways"
    CRISIS = "crisis"


class WaterfallPolicy(str, Enum):
    """Goal waterfall policy for resource allocation."""
    STRICT_PRIORITY = "strict_priority"  # Highest priority fully funded first
    PROPORTIONAL = "proportional"  # Split by weights
    MIN_FLOOR_THEN_PRIORITY = "min_floor_then_priority"  # Min for all, then priority


class ComputeMode(str, Enum):
    """Computation mode for speed/accuracy tradeoff."""
    FAST = "fast"  # 1k sims, 5s cache
    BALANCED = "balanced"  # 5k sims, 30s cache
    FULL = "full"  # 25k sims, 300s cache
    DETERMINISTIC = "deterministic"  # Seeded for testing


class Surface(str, Enum):
    """UI surface requesting computation."""
    WEB_DASHBOARD = "web_dashboard"
    WEB_GOAL_DETAIL = "web_goal_detail"
    WEB_PORTFOLIO = "web_portfolio"
    MOBILE_OVERVIEW = "mobile_overview"
    MOBILE_GOAL = "mobile_goal"
    BATCH_REPORT = "batch_report"


# ===========================================================================
# Request Components
# ===========================================================================

class RequestMeta(BaseModel):
    """Request metadata for tracing and caching."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    request_id: UUID = Field(..., description="Unique request ID")
    timestamp: datetime = Field(..., description="Request timestamp (UTC)")
    timezone: str = Field("UTC", description="User timezone (IANA)")
    tenant_id: str = Field(..., description="Tenant identifier")
    user_id_hash: str = Field(..., description="SHA256 hash of user ID")
    schema_version: str = Field("1.0", description="Schema version")


class CallContext(BaseModel):
    """Context about where/why this risk calc is happening."""
    model_config = ConfigDict(extra='forbid')

    surface: Surface = Field(..., description="UI surface")
    goal_id: Optional[str] = Field(None, description="Specific goal if detail view")
    scenario_id: Optional[str] = Field(None, description="What-if scenario ID")


class GoalFlexibility(BaseModel):
    """How flexible is this goal?"""
    model_config = ConfigDict(extra='forbid')

    can_delay_months: int = Field(0, ge=0, le=120, description="Max delay months")
    can_reduce_target_pct: float = Field(
        0.0,
        ge=0.0,
        le=0.5,
        description="Max reduction (0.2 = can accept 80% of target)"
    )


class GoalConstraints(BaseModel):
    """Goal-specific constraints."""
    model_config = ConfigDict(extra='forbid')

    min_cash_buffer: float = Field(0.0, ge=0, description="Min cash reserve ($)")
    max_drawdown_allowed: float = Field(
        0.25,
        ge=0.0,
        le=1.0,
        description="Max allowed drawdown (0.25 = -25%)"
    )


class Goal(BaseModel):
    """A financial goal competing for resources."""
    model_config = ConfigDict(extra='forbid')

    id: str = Field(..., description="Goal identifier")
    type: GoalType = Field(..., description="Goal type")
    target_value: float = Field(..., gt=0, description="Target amount ($)")
    target_date: date = Field(..., description="Target date")
    priority: int = Field(..., ge=1, le=10, description="Priority (1=highest)")
    flexibility: GoalFlexibility = Field(default_factory=GoalFlexibility)
    constraints: GoalConstraints = Field(default_factory=GoalConstraints)
    current_allocated: float = Field(0.0, ge=0, description="Currently allocated ($)")


class IncomeStream(BaseModel):
    """A stream of income."""
    model_config = ConfigDict(extra='forbid')

    type: IncomeType
    annual_amount: float = Field(..., gt=0, description="Annual amount ($)")
    growth_rate: float = Field(0.0, ge=-0.1, le=0.2, description="Annual growth")
    volatility: float = Field(0.0, ge=0, le=0.5, description="Income volatility")
    start_year: int = Field(0, description="Years from now to start")
    end_year: Optional[int] = Field(None, description="Years from now to end")


class HouseholdFinancialState(BaseModel):
    """Household financial state (PHI/PCI-free)."""
    model_config = ConfigDict(extra='forbid')

    income_streams: List[IncomeStream] = Field(..., min_length=1)
    annual_spending: float = Field(..., gt=0, description="Annual spending ($)")
    spending_volatility: float = Field(0.05, ge=0, le=0.3)

    # Numeric shocks only - NO medical details
    health_cost_shock_annual_max: float = Field(
        5000.0,
        ge=0,
        description="Max annual health cost shock ($)"
    )
    insurance_deductible: float = Field(0.0, ge=0, description="Insurance deductible ($)")

    # Travel budget (numeric only)
    annual_travel_budget: float = Field(0.0, ge=0, description="Annual travel budget ($)")

    # Assets/liabilities (aggregate)
    liquid_assets: float = Field(..., ge=0, description="Liquid assets ($)")
    illiquid_assets: float = Field(0.0, ge=0, description="Illiquid assets ($)")
    total_liabilities: float = Field(0.0, ge=0, description="Total liabilities ($)")

    # Employment stability (numeric proxy)
    employment_stability_score: float = Field(
        0.8,
        ge=0.0,
        le=1.0,
        description="0=unstable, 1=very stable"
    )


class PortfolioExposure(BaseModel):
    """Portfolio allocation by asset class."""
    model_config = ConfigDict(extra='forbid')

    asset_class: AssetClass
    allocation_pct: float = Field(..., ge=0.0, le=1.0)
    current_value: float = Field(..., ge=0)


class ContributionSchedule(BaseModel):
    """Contribution schedule."""
    model_config = ConfigDict(extra='forbid')

    annual_amount: float = Field(..., ge=0, description="Annual contribution ($)")
    growth_rate: float = Field(0.0, ge=-0.1, le=0.2, description="Contribution growth")


class WithdrawalPolicy(BaseModel):
    """Withdrawal policy."""
    model_config = ConfigDict(extra='forbid')

    annual_amount: float = Field(0.0, ge=0, description="Annual withdrawal ($)")
    inflation_adjust: bool = Field(True, description="Adjust for inflation")


class PortfolioConstraints(BaseModel):
    """Portfolio constraints."""
    model_config = ConfigDict(extra='forbid')

    min_cash_pct: float = Field(0.05, ge=0.0, le=0.5)
    max_equity_pct: float = Field(1.0, ge=0.0, le=1.0)
    max_single_asset_pct: float = Field(0.5, ge=0.0, le=1.0)
    rebalance_threshold: float = Field(0.05, ge=0.0, le=0.3)


class PortfolioState(BaseModel):
    """Portfolio state."""
    model_config = ConfigDict(extra='forbid')

    exposures: List[PortfolioExposure] = Field(..., min_length=1)
    total_value: float = Field(..., gt=0)
    contribution_schedule: ContributionSchedule
    withdrawal_policy: WithdrawalPolicy = Field(default_factory=WithdrawalPolicy)
    constraints: PortfolioConstraints = Field(default_factory=PortfolioConstraints)

    @field_validator('exposures')
    @classmethod
    def validate_allocation_sum(cls, exposures):
        total = sum(e.allocation_pct for e in exposures)
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Allocation must sum to 1.0, got {total}")
        return exposures


class RiskVector(BaseModel):
    """A single risk assessment dimension."""
    model_config = ConfigDict(extra='forbid')

    dimension: str = Field(..., description="Risk dimension")
    value: float = Field(..., ge=0.0, le=1.0, description="0=low, 1=high")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence in value")


class RiskProfile(BaseModel):
    """Multi-dimensional risk profile."""
    model_config = ConfigDict(extra='forbid')

    # Classic dimensions
    risk_tolerance: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Psychological willingness (0=conservative, 1=aggressive)"
    )
    risk_capacity: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Financial ability to take risk (0=low, 1=high)"
    )
    risk_need: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Risk required to meet goals (0=low, 1=high)"
    )

    # Optional detailed vector
    risk_vector: List[RiskVector] = Field(default_factory=list)


class RegimeInput(BaseModel):
    """Inputs for regime classification."""
    model_config = ConfigDict(extra='forbid')

    # Market indicators (numeric only)
    equity_return_trailing_12m: float = Field(..., description="12-month equity return")
    volatility_percentile: float = Field(..., ge=0.0, le=1.0)
    credit_spread_bps: float = Field(..., ge=0)
    yield_curve_slope_bps: float = Field(...)
    momentum_signal: float = Field(..., ge=-1.0, le=1.0)


class MarketContext(BaseModel):
    """Market context for regime-aware modeling."""
    model_config = ConfigDict(extra='forbid')

    regime_inputs: RegimeInput
    asof_timestamp: datetime = Field(..., description="Data as-of time")
    stability_hint: float = Field(
        0.5,
        ge=0.0,
        le=1.0,
        description="0=transitional, 1=stable"
    )


class GoalWeight(BaseModel):
    """Weight for a specific goal."""
    model_config = ConfigDict(extra='forbid')

    goal_id: str
    weight: float = Field(..., ge=0.0, le=1.0)


class PenaltyWeights(BaseModel):
    """Penalty weights for optimization."""
    model_config = ConfigDict(extra='forbid')

    delay_penalty: float = Field(1.0, ge=0.0, description="Penalty per month delayed")
    shortfall_penalty: float = Field(10.0, ge=0.0, description="Penalty per $ short")
    volatility_penalty: float = Field(0.1, ge=0.0, description="Volatility penalty")


class PolicyWeights(BaseModel):
    """Policy weights for goal allocation."""
    model_config = ConfigDict(extra='forbid')

    goal_weights: List[GoalWeight] = Field(..., min_length=1)
    penalty_weights: PenaltyWeights = Field(default_factory=PenaltyWeights)
    waterfall_policy: WaterfallPolicy = Field(
        WaterfallPolicy.MIN_FLOOR_THEN_PRIORITY,
        description="How to allocate resources"
    )


class CalcParams(BaseModel):
    """Calculation parameters."""
    model_config = ConfigDict(extra='forbid')

    mode: ComputeMode = Field(ComputeMode.BALANCED)
    simulation_runs: Optional[int] = Field(
        None,
        ge=100,
        le=100000,
        description="Override simulation count"
    )
    horizon_steps: int = Field(120, ge=12, le=600, description="Monthly steps")
    tail_confidence: float = Field(0.95, ge=0.8, le=0.99)
    seed: Optional[int] = Field(None, description="Seed for deterministic mode")


# ===========================================================================
# Main Request Schema
# ===========================================================================

class RiskRequest(BaseModel):
    """
    Canonical risk engine request.

    Supports:
    - Goal probability
    - Portfolio risk
    - Household risk
    - Multi-goal coupling
    """
    model_config = ConfigDict(extra='forbid')

    request_meta: RequestMeta
    call_context: CallContext
    goal_bundle: List[Goal] = Field(..., min_length=1, max_length=20)
    household_financial_state: HouseholdFinancialState
    portfolio_state: PortfolioState
    risk_profile: RiskProfile
    market_context: MarketContext
    policy_weights: PolicyWeights
    calc_params: CalcParams = Field(default_factory=CalcParams)


# ===========================================================================
# Response Components
# ===========================================================================

class ResponseMeta(BaseModel):
    """Response metadata."""
    model_config = ConfigDict(extra='forbid')

    computed_at: datetime
    cache_key: str = Field(..., description="Cache key used")
    cache_hit: bool = Field(False, description="Was this cached?")
    model_version: str = Field("1.0.0", description="Risk model version")
    assumptions_version: str = Field("2026-Q1", description="Assumptions version")
    compute_time_ms: float = Field(..., ge=0)


class ProbabilityDistribution(BaseModel):
    """Probability distribution."""
    model_config = ConfigDict(extra='forbid')

    p10: float = Field(..., ge=0.0, le=1.0, description="10th percentile")
    p25: float = Field(..., ge=0.0, le=1.0)
    p50: float = Field(..., ge=0.0, le=1.0, description="Median")
    p75: float = Field(..., ge=0.0, le=1.0)
    p90: float = Field(..., ge=0.0, le=1.0, description="90th percentile")
    mean: float = Field(..., ge=0.0, le=1.0)
    std: float = Field(..., ge=0.0)


class OverallRisk(BaseModel):
    """Overall risk assessment."""
    model_config = ConfigDict(extra='forbid')

    win_probability: float = Field(..., ge=0.0, le=1.0, description="P(all goals met)")
    loss_probability: float = Field(..., ge=0.0, le=1.0)
    partial_success_probability: float = Field(..., ge=0.0, le=1.0)
    distribution: ProbabilityDistribution
    confidence_interval_95: tuple[float, float] = Field(...)


class GoalResult(BaseModel):
    """Result for a single goal."""
    model_config = ConfigDict(extra='forbid')

    goal_id: str
    success_probability: float = Field(..., ge=0.0, le=1.0)
    expected_shortfall: float = Field(..., ge=0.0, description="Expected $ shortfall")
    expected_delay_months: int = Field(..., ge=0, description="Expected delay")
    value_at_risk_5pct: float = Field(..., description="5th percentile value")
    conditional_value_at_risk: float = Field(..., description="CVaR")

    # Sensitivity
    primary_driver: str = Field(..., description="Main driver of success/failure")
    driver_impact_pct: float = Field(..., ge=0.0, le=1.0)


class TimeSeriesPoint(BaseModel):
    """Single point in time series."""
    model_config = ConfigDict(extra='forbid')

    t: int = Field(..., ge=0, description="Time step (months)")
    date: date = Field(..., description="Calendar date")

    # Portfolio metrics
    portfolio_p10: float
    portfolio_p50: float
    portfolio_p90: float

    # Goal metrics (if specific goal)
    goal_progress_p50: Optional[float] = None


class SeriesPayload(BaseModel):
    """UI-ready time series."""
    model_config = ConfigDict(extra='forbid')

    series: List[TimeSeriesPoint] = Field(..., min_length=1)
    regime_transitions: List[int] = Field(
        default_factory=list,
        description="Time steps where regime likely changes"
    )


class Driver(BaseModel):
    """Driver of risk."""
    model_config = ConfigDict(extra='forbid')

    name: str
    category: Literal["market", "household", "goal", "portfolio"]
    impact_on_success_pct: float = Field(..., ge=-1.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)


class Decomposition(BaseModel):
    """Risk decomposition."""
    model_config = ConfigDict(extra='forbid')

    market_risk_pct: float = Field(..., ge=0.0, le=1.0)
    household_risk_pct: float = Field(..., ge=0.0, le=1.0)
    goal_conflict_pct: float = Field(..., ge=0.0, le=1.0)
    unexplained_pct: float = Field(..., ge=0.0, le=1.0)


class Counterfactual(BaseModel):
    """What-if counterfactual."""
    model_config = ConfigDict(extra='forbid')

    scenario: str = Field(..., description="What changed")
    delta_success_probability: float = Field(..., description="Change in P(success)")
    new_success_probability: float = Field(..., ge=0.0, le=1.0)


class RecommendedAction(BaseModel):
    """Recommended action."""
    model_config = ConfigDict(extra='forbid')

    action: str = Field(..., description="Action description")
    category: Literal["save_more", "reduce_goal", "delay_goal", "reduce_risk", "increase_risk"]
    expected_improvement_pct: float = Field(..., ge=0.0)
    tradeoff: str = Field(..., description="What you give up")
    confidence: float = Field(..., ge=0.0, le=1.0)


class Disclaimer(BaseModel):
    """Legal disclaimer."""
    model_config = ConfigDict(extra='forbid')

    text: str
    severity: Literal["info", "warning", "critical"] = "info"


# ===========================================================================
# Main Response Schema
# ===========================================================================

class RiskResponse(BaseModel):
    """
    Canonical risk engine response.

    Provides:
    - Overall and per-goal probabilities
    - UI-ready time series
    - Explainability (drivers, decomposition, counterfactuals)
    - Recommendations
    """
    model_config = ConfigDict(extra='forbid')

    meta: ResponseMeta
    overall: OverallRisk
    per_goal: List[GoalResult]
    series_payload: SeriesPayload
    drivers: List[Driver]
    decomposition: Decomposition
    counterfactuals: List[Counterfactual]
    recommended_actions: List[RecommendedAction]
    disclaimers: List[Disclaimer]


# ===========================================================================
# Stream Response (for SSE)
# ===========================================================================

class StreamChunk(BaseModel):
    """Chunk for streaming response."""
    model_config = ConfigDict(extra='forbid')

    chunk_type: Literal["progress", "result", "complete", "error"]
    progress_pct: Optional[float] = Field(None, ge=0.0, le=1.0)
    partial_result: Optional[RiskResponse] = None
    error: Optional[str] = None


# ===========================================================================
# Explain/Recommend Request Schemas
# ===========================================================================

class ExplainRequest(BaseModel):
    """Request for detailed explanation."""
    model_config = ConfigDict(extra='forbid')

    request_meta: RequestMeta
    goal_id: str
    base_request: RiskRequest
    explain_params: Dict[str, Any] = Field(default_factory=dict)


class RecommendRequest(BaseModel):
    """Request for recommendations."""
    model_config = ConfigDict(extra='forbid')

    request_meta: RequestMeta
    base_request: RiskRequest
    max_recommendations: int = Field(5, ge=1, le=10)
    categories: List[str] = Field(default_factory=list)
