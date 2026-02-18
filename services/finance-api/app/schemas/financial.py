"""
Pydantic schemas for Financial API
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class RiskTolerance(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"

class GoalCategory(str, Enum):
    RETIREMENT = "retirement"
    EDUCATION = "education"
    HOME = "home"
    INVESTMENT = "investment"
    EMERGENCY = "emergency"
    VACATION = "vacation"
    VEHICLE = "vehicle"
    OTHER = "other"

class AccountType(str, Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    RETIREMENT = "retirement"
    CREDIT = "credit"

class TransactionType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"

# Financial Profile Schemas
class FinancialProfileBase(BaseModel):
    annual_income: float = Field(ge=0)
    monthly_expenses: float = Field(ge=0)
    total_assets: float = Field(ge=0)
    total_debt: float = Field(ge=0)
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE
    investment_experience: str = "beginner"
    time_horizon_years: int = Field(ge=1, le=50)

class FinancialProfileCreate(FinancialProfileBase):
    user_id: str

class FinancialProfileUpdate(BaseModel):
    annual_income: Optional[float] = None
    monthly_expenses: Optional[float] = None
    total_assets: Optional[float] = None
    total_debt: Optional[float] = None
    risk_tolerance: Optional[RiskTolerance] = None
    investment_experience: Optional[str] = None
    time_horizon_years: Optional[int] = None
    credit_score: Optional[int] = None

class FinancialProfileResponse(FinancialProfileBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    net_worth: float
    debt_to_income_ratio: float
    savings_rate: float
    emergency_fund_months: float
    credit_score: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

# Financial Goal Schemas
class FinancialGoalBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: GoalCategory
    target_amount: float = Field(gt=0)
    target_date: datetime
    priority: str = Field(default="medium")
    monthly_contribution: float = Field(ge=0, default=0)

class FinancialGoalCreate(FinancialGoalBase):
    pass

class FinancialGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    target_date: Optional[datetime] = None
    priority: Optional[str] = None
    monthly_contribution: Optional[float] = None
    current_amount: Optional[float] = None

class FinancialGoalResponse(FinancialGoalBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    current_amount: float
    progress_percentage: float
    required_return_rate: Optional[float]
    probability_of_success: Optional[float]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

# Account Schemas
class AccountBase(BaseModel):
    account_name: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    institution: Optional[str] = None
    current_balance: float = 0
    interest_rate: Optional[float] = None

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    current_balance: Optional[float] = None
    interest_rate: Optional[float] = None

class AccountResponse(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    account_number_masked: Optional[str]
    available_balance: Optional[float]
    credit_limit: Optional[float]
    sync_enabled: bool
    last_sync: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

# Transaction Schemas
class TransactionBase(BaseModel):
    transaction_date: datetime
    amount: float
    description: str
    category: Optional[str] = None
    transaction_type: TransactionType

class TransactionCreate(TransactionBase):
    account_id: str

class TransactionResponse(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    account_id: str
    merchant_name: Optional[str]
    is_recurring: bool
    is_essential: bool
    tags: List[str]
    created_at: datetime

# Budget Schemas
class BudgetCategoryItem(BaseModel):
    planned: float
    actual: float = 0
    remaining: float

class BudgetBase(BaseModel):
    name: str
    period: str  # monthly, quarterly, annual
    start_date: datetime
    end_date: datetime
    categories: Dict[str, BudgetCategoryItem]
    alert_threshold: float = 0.8

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    categories: Optional[Dict[str, BudgetCategoryItem]] = None
    alert_threshold: Optional[float] = None

class BudgetResponse(BudgetBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    total_planned: float
    total_actual: float
    total_remaining: float
    status: str
    alerts_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime]

# Analytics Schemas
class CashFlowAnalysis(BaseModel):
    period: str
    income: float
    expenses: float
    net_cash_flow: float
    savings_rate: float
    expense_breakdown: Dict[str, float]

class InvestmentAnalysis(BaseModel):
    total_invested: float
    current_value: float
    total_return: float
    return_percentage: float
    annualized_return: float
    risk_score: float
    diversification_score: float
    recommendations: List[str]

class RetirementProjection(BaseModel):
    current_age: int
    retirement_age: int
    current_savings: float
    monthly_contribution: float
    expected_return_rate: float
    projected_value: float
    retirement_income_monthly: float
    success_probability: float
    gap_analysis: Optional[float]
    recommendations: List[str]

class DebtAnalysis(BaseModel):
    total_debt: float
    monthly_payment: float
    average_interest_rate: float
    debt_to_income_ratio: float
    payoff_timeline_months: int
    total_interest_paid: float
    optimization_strategies: List[Dict[str, Any]]

class FinancialHealthScore(BaseModel):
    overall_score: int  # 0-100
    components: Dict[str, int]
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]
    peer_comparison: Optional[Dict[str, Any]]

# Plaid Integration Schemas
class PlaidLinkToken(BaseModel):
    link_token: str
    expiration: datetime

class PlaidPublicTokenExchange(BaseModel):
    public_token: str

class PlaidAccountSync(BaseModel):
    account_id: str
    transactions_synced: int
    balance_updated: bool
    last_sync: datetime

# Investment Schemas
class PortfolioAllocation(BaseModel):
    asset_class: str
    current_percentage: float
    target_percentage: float
    difference: float
    rebalance_amount: float

class InvestmentRecommendation(BaseModel):
    ticker: str
    name: str
    recommendation: str  # buy, hold, sell
    confidence: float
    rationale: str
    target_price: Optional[float]
    risk_level: str