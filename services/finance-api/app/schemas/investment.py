"""
Investment Schemas for API validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

class AssetClassEnum(str, Enum):
    STOCKS = "stocks"
    BONDS = "bonds"
    REAL_ESTATE = "real_estate"
    COMMODITIES = "commodities"
    CASH = "cash"
    CRYPTO = "crypto"
    ALTERNATIVES = "alternatives"

class RiskTolerance(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE_CONSERVATIVE = "moderate_conservative"
    MODERATE = "moderate"
    MODERATE_AGGRESSIVE = "moderate_aggressive"
    AGGRESSIVE = "aggressive"

class PortfolioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    portfolio_type: Optional[str] = Field(None, max_length=50)
    target_allocation: Optional[Dict[str, float]] = None
    risk_tolerance: Optional[RiskTolerance] = None
    is_active: bool = True

class PortfolioCreate(PortfolioBase):
    """Schema for creating a portfolio"""
    pass

class PortfolioUpdate(BaseModel):
    """Schema for updating a portfolio"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    portfolio_type: Optional[str] = Field(None, max_length=50)
    target_allocation: Optional[Dict[str, float]] = None
    risk_tolerance: Optional[RiskTolerance] = None
    is_active: Optional[bool] = None

class PortfolioResponse(PortfolioBase):
    """Schema for portfolio response"""
    id: str
    profile_id: str
    created_at: datetime
    updated_at: datetime
    total_value: Optional[float] = None
    total_cost_basis: Optional[float] = None
    total_return: Optional[float] = None
    total_return_percentage: Optional[float] = None
    investments: Optional[List["InvestmentResponse"]] = []
    
    class Config:
        from_attributes = True

class InvestmentBase(BaseModel):
    symbol: Optional[str] = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    asset_class: AssetClassEnum
    quantity: float = Field(..., gt=0)
    purchase_price: float = Field(..., gt=0)
    purchase_date: date
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    cost_basis: Optional[float] = None
    fees_paid: float = Field(default=0, ge=0)
    dividends_received: float = Field(default=0, ge=0)
    is_tax_advantaged: bool = False
    notes: Optional[str] = Field(None, max_length=1000)

class InvestmentCreate(InvestmentBase):
    """Schema for creating an investment"""
    pass

class InvestmentUpdate(BaseModel):
    """Schema for updating an investment"""
    symbol: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    asset_class: Optional[AssetClassEnum] = None
    quantity: Optional[float] = Field(None, gt=0)
    purchase_price: Optional[float] = Field(None, gt=0)
    purchase_date: Optional[date] = None
    current_price: Optional[float] = None
    fees_paid: Optional[float] = Field(None, ge=0)
    dividends_received: Optional[float] = Field(None, ge=0)
    is_tax_advantaged: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)

class InvestmentResponse(InvestmentBase):
    """Schema for investment response"""
    id: str
    portfolio_id: str
    gain_loss: Optional[float] = None
    gain_loss_percentage: Optional[float] = None
    last_updated: datetime
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AssetAllocationItem(BaseModel):
    """Schema for asset allocation item"""
    asset_class: str
    current_value: float
    current_percentage: float
    target_percentage: Optional[float] = None
    difference: Optional[float] = None
    rebalance_amount: Optional[float] = None

class PortfolioPerformance(BaseModel):
    """Schema for portfolio performance metrics"""
    portfolio_id: str
    portfolio_name: str
    total_value: float
    total_cost_basis: float
    total_return: float
    total_return_percentage: float
    daily_return: Optional[float] = None
    weekly_return: Optional[float] = None
    monthly_return: Optional[float] = None
    yearly_return: Optional[float] = None
    ytd_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    beta: Optional[float] = None
    alpha: Optional[float] = None
    standard_deviation: Optional[float] = None
    max_drawdown: Optional[float] = None

class RebalanceRecommendation(BaseModel):
    """Schema for rebalancing recommendations"""
    portfolio_id: str
    portfolio_name: str
    current_allocation: List[AssetAllocationItem]
    target_allocation: List[AssetAllocationItem]
    recommendations: List[Dict[str, Any]]
    total_trades_needed: int
    estimated_cost: float
    rebalance_urgency: str  # low, medium, high

class InvestmentAnalysis(BaseModel):
    """Schema for investment analysis"""
    total_portfolio_value: float
    total_invested: float
    total_return: float
    total_return_percentage: float
    best_performer: Optional[Dict[str, Any]] = None
    worst_performer: Optional[Dict[str, Any]] = None
    asset_allocation: List[AssetAllocationItem]
    sector_allocation: Optional[List[Dict[str, Any]]] = None
    geographic_allocation: Optional[List[Dict[str, Any]]] = None
    risk_metrics: Optional[Dict[str, Any]] = None

class InvestmentRecommendation(BaseModel):
    """Schema for investment recommendations"""
    symbol: str
    name: str
    asset_class: str
    recommendation_type: str  # buy, sell, hold
    reason: str
    confidence_score: float
    target_allocation: Optional[float] = None
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    risk_level: str

class MonteCarloResult(BaseModel):
    """Schema for Monte Carlo simulation results"""
    simulation_count: int
    time_horizon_years: int
    initial_investment: float
    monthly_contribution: float
    expected_return: float
    volatility: float
    percentile_10: float
    percentile_25: float
    percentile_50: float
    percentile_75: float
    percentile_90: float
    probability_of_success: float
    worst_case: float
    best_case: float
    expected_value: float

class MarketAnalysis(BaseModel):
    """Schema for market analysis"""
    market_sentiment: str  # bullish, bearish, neutral
    vix_level: float
    sp500_pe_ratio: float
    bond_yields: Dict[str, float]
    sector_performance: List[Dict[str, Any]]
    economic_indicators: Dict[str, Any]
    recommendations: List[str]

class TaxOptimizationStrategy(BaseModel):
    """Schema for tax optimization strategies"""
    strategy_name: str
    description: str
    potential_tax_savings: float
    implementation_steps: List[str]
    risk_level: str
    time_horizon: str

class RiskMetrics(BaseModel):
    """Schema for portfolio risk metrics"""
    portfolio_beta: float
    portfolio_alpha: float
    sharpe_ratio: float
    sortino_ratio: float
    standard_deviation: float
    value_at_risk_95: float
    conditional_value_at_risk: float
    max_drawdown: float
    correlation_to_market: float
    risk_adjusted_return: float