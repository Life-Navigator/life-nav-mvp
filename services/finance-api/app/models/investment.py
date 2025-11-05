"""
Investment Portfolio Models
"""

from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.core.database import Base

class AssetClass(str, enum.Enum):
    STOCKS = "stocks"
    BONDS = "bonds"
    REAL_ESTATE = "real_estate"
    COMMODITIES = "commodities"
    CASH = "cash"
    CRYPTO = "crypto"
    ALTERNATIVES = "alternatives"

class Portfolio(Base):
    __tablename__ = "portfolios"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("financial_profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(String(1000))
    portfolio_type = Column(String(50))  # retirement, taxable, education, etc.
    target_allocation = Column(JSON)  # {"stocks": 60, "bonds": 30, "cash": 10}
    risk_tolerance = Column(String(50))  # conservative, moderate, aggressive
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("FinancialProfile", back_populates="portfolios")
    investments = relationship("Investment", back_populates="portfolio", cascade="all, delete-orphan")
    
class Investment(Base):
    __tablename__ = "investments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(20))  # Stock ticker or identifier
    name = Column(String(200), nullable=False)
    asset_class = Column(SQLEnum(AssetClass), nullable=False)
    quantity = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    current_price = Column(Float)
    current_value = Column(Float)
    cost_basis = Column(Float)  # For tax calculations
    fees_paid = Column(Float, default=0)
    dividends_received = Column(Float, default=0)
    is_tax_advantaged = Column(Boolean, default=False)
    notes = Column(String(1000))
    last_updated = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="investments")
    
class AssetAllocation(Base):
    __tablename__ = "asset_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    asset_class = Column(SQLEnum(AssetClass), nullable=False)
    current_percentage = Column(Float)
    target_percentage = Column(Float)
    current_value = Column(Float)
    rebalance_needed = Column(Float)  # Amount to buy/sell
    last_rebalanced = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio")

class PerformanceHistory(Base):
    __tablename__ = "performance_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    date = Column(DateTime, nullable=False)
    total_value = Column(Float, nullable=False)
    daily_return = Column(Float)
    cumulative_return = Column(Float)
    benchmark_return = Column(Float)  # S&P 500 or other benchmark
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio")