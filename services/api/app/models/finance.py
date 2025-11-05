"""
Finance models
"""
from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Date, Numeric, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class AccountType(str, enum.Enum):
    """Financial account types"""
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"
    RETIREMENT = "retirement"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    OTHER = "other"


class TransactionType(str, enum.Enum):
    """Transaction types"""
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    INVESTMENT = "investment"
    PAYMENT = "payment"


class InvestmentType(str, enum.Enum):
    """Investment types"""
    STOCK = "stock"
    BOND = "bond"
    MUTUAL_FUND = "mutual_fund"
    ETF = "etf"
    CRYPTO = "crypto"
    REAL_ESTATE = "real_estate"
    OTHER = "other"


class FinancialAccount(Base):
    """Financial account model"""

    __tablename__ = "financial_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Account Info
    name = Column(String(255), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    account_number_last4 = Column(String(4))

    # Institution
    institution_name = Column(String(255))
    institution_id = Column(String(100))  # Plaid institution ID

    # Balances
    current_balance = Column(Numeric(15, 2), default=0)
    available_balance = Column(Numeric(15, 2))
    credit_limit = Column(Numeric(15, 2))

    # Currency
    currency = Column(String(3), default="USD")

    # Integration
    plaid_account_id = Column(String(255))
    plaid_access_token = Column(String(255))
    is_connected = Column(Boolean, default=False)
    last_sync_at = Column(DateTime)

    # Status
    is_active = Column(Boolean, default=True)
    is_closed = Column(Boolean, default=False)

    # Metadata
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="account", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<FinancialAccount {self.name}>"


class Transaction(Base):
    """Transaction model"""

    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("financial_accounts.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Transaction Info
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="USD")

    # Details
    description = Column(String(500))
    merchant_name = Column(String(255))
    category = Column(String(100))
    subcategory = Column(String(100))

    # Date
    transaction_date = Column(Date, nullable=False, index=True)
    posted_date = Column(Date)

    # Status
    is_pending = Column(Boolean, default=False)
    is_recurring = Column(Boolean, default=False)

    # Integration
    plaid_transaction_id = Column(String(255), unique=True)

    # Location
    location = Column(JSONB)

    # Metadata
    tags = Column(JSONB)
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("FinancialAccount", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction {self.description} ${self.amount}>"


class Investment(Base):
    """Investment holding model"""

    __tablename__ = "investments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("financial_accounts.id"), nullable=False, index=True)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Investment Info
    name = Column(String(255), nullable=False)
    symbol = Column(String(20))
    investment_type = Column(Enum(InvestmentType), nullable=False)

    # Holdings
    quantity = Column(Numeric(18, 8))
    cost_basis = Column(Numeric(15, 2))
    current_price = Column(Numeric(15, 2))
    current_value = Column(Numeric(15, 2))

    # Performance
    unrealized_gain_loss = Column(Numeric(15, 2))
    unrealized_gain_loss_pct = Column(Numeric(10, 4))

    # Currency
    currency = Column(String(3), default="USD")

    # Acquisition
    acquisition_date = Column(Date)

    # Integration
    security_id = Column(String(255))  # Plaid security ID
    cusip = Column(String(9))
    isin = Column(String(12))

    # Metadata
    extra_data = Column("metadata", JSONB)  # Column name "metadata" but attribute name "extra_data"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_price_update = Column(DateTime)

    # Relationships
    account = relationship("FinancialAccount", back_populates="investments")

    def __repr__(self):
        return f"<Investment {self.name} ({self.symbol})>"
