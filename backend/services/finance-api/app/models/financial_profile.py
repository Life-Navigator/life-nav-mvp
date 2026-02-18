"""
Financial Profile Models
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class FinancialProfile(Base):
    __tablename__ = "financial_profiles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, unique=True, nullable=False, index=True)
    
    # Income
    annual_income = Column(Float, default=0)
    monthly_income = Column(Float, default=0)
    income_sources = Column(JSON, default=list)  # [{source, amount, frequency}]
    
    # Assets
    total_assets = Column(Float, default=0)
    liquid_assets = Column(Float, default=0)
    invested_assets = Column(Float, default=0)
    real_estate_value = Column(Float, default=0)
    retirement_accounts = Column(Float, default=0)
    
    # Liabilities
    total_debt = Column(Float, default=0)
    mortgage_balance = Column(Float, default=0)
    student_loans = Column(Float, default=0)
    credit_card_debt = Column(Float, default=0)
    other_debt = Column(Float, default=0)
    
    # Monthly Expenses
    monthly_expenses = Column(Float, default=0)
    housing_cost = Column(Float, default=0)
    food_cost = Column(Float, default=0)
    transportation_cost = Column(Float, default=0)
    insurance_cost = Column(Float, default=0)
    utilities_cost = Column(Float, default=0)
    entertainment_cost = Column(Float, default=0)
    
    # Financial Health Metrics
    net_worth = Column(Float, default=0)
    debt_to_income_ratio = Column(Float, default=0)
    savings_rate = Column(Float, default=0)
    emergency_fund_months = Column(Float, default=0)
    credit_score = Column(Integer, nullable=True)
    
    # Investment Profile
    risk_tolerance = Column(String, default="moderate")  # conservative, moderate, aggressive
    investment_experience = Column(String, default="beginner")  # beginner, intermediate, advanced
    investment_goals = Column(JSON, default=list)
    investment_watchlist = Column(JSON, default=list)  # List of symbols to watch
    time_horizon_years = Column(Integer, default=10)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    goals = relationship("FinancialGoal", back_populates="profile", cascade="all, delete-orphan")
    accounts = relationship("FinancialAccount", back_populates="profile", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="profile", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="profile", cascade="all, delete-orphan")
    portfolios = relationship("Portfolio", back_populates="profile", cascade="all, delete-orphan")


class FinancialGoal(Base):
    __tablename__ = "financial_goals"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("financial_profiles.id"))
    
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # retirement, education, home, investment, emergency
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0)
    target_date = Column(DateTime(timezone=True))
    priority = Column(String, default="medium")  # low, medium, high, critical
    
    # Planning
    monthly_contribution = Column(Float, default=0)
    required_return_rate = Column(Float, nullable=True)
    probability_of_success = Column(Float, nullable=True)
    
    # Status
    status = Column(String, default="active")  # active, paused, completed, cancelled
    progress_percentage = Column(Float, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    profile = relationship("FinancialProfile", back_populates="goals")


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("financial_profiles.id"))
    
    account_name = Column(String, nullable=False)
    account_type = Column(String, nullable=False)  # checking, savings, investment, retirement, credit
    institution = Column(String, nullable=True)
    account_number_masked = Column(String, nullable=True)
    
    current_balance = Column(Float, default=0)
    available_balance = Column(Float, nullable=True)
    credit_limit = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True)
    
    # External Integration
    plaid_account_id = Column(String, nullable=True, unique=True)
    plaid_item_id = Column(String, nullable=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)
    sync_enabled = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    profile = relationship("FinancialProfile", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("financial_profiles.id"))
    account_id = Column(String, ForeignKey("financial_accounts.id"))
    
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=True)
    subcategory = Column(String, nullable=True)
    
    transaction_type = Column(String, nullable=False)  # debit, credit
    payment_method = Column(String, nullable=True)  # cash, card, transfer, check
    
    # External Integration
    plaid_transaction_id = Column(String, nullable=True, unique=True)
    merchant_name = Column(String, nullable=True)
    pending = Column(Boolean, default=False)
    
    # Categorization
    is_recurring = Column(Boolean, default=False)
    is_essential = Column(Boolean, default=True)
    is_tax_deductible = Column(Boolean, default=False)
    tags = Column(JSON, default=list)
    notes = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    profile = relationship("FinancialProfile", back_populates="transactions")
    account = relationship("FinancialAccount", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("financial_profiles.id"))
    
    name = Column(String, nullable=False)
    period = Column(String, nullable=False)  # monthly, quarterly, annual
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    
    # Budget Categories
    categories = Column(JSON, nullable=False)  # {category: {planned, actual, remaining}}
    total_planned = Column(Float, nullable=False)
    total_actual = Column(Float, default=0)
    total_remaining = Column(Float, nullable=False)
    
    # Alerts
    alert_threshold = Column(Float, default=0.8)  # Alert when 80% spent
    alerts_enabled = Column(Boolean, default=True)
    
    status = Column(String, default="active")  # active, completed, exceeded
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    profile = relationship("FinancialProfile", back_populates="budgets")