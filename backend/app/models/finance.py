"""
Finance domain models.
Handles financial accounts, transactions, and budgets.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import ARRAY, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import BaseTenantModel


class AccountType(str, PyEnum):
    """Financial account type enumeration."""

    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"
    RETIREMENT = "retirement"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    STUDENT_LOAN = "student_loan"
    CRYPTO = "crypto"
    OTHER = "other"


class AccountStatus(str, PyEnum):
    """Financial account status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    CLOSED = "closed"


class TransactionType(str, PyEnum):
    """Transaction type enumeration."""

    DEBIT = "debit"
    CREDIT = "credit"
    TRANSFER = "transfer"


class BudgetPeriod(str, PyEnum):
    """Budget period enumeration."""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class BudgetStatus(str, PyEnum):
    """Budget status enumeration."""

    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class FinancialAccount(BaseTenantModel, Base):
    """
    Financial account model.
    Represents bank accounts, credit cards, investments, loans, etc.
    """

    __tablename__ = "financial_accounts"

    # Account details
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(String(255))
    account_number_last4: Mapped[str | None] = mapped_column(String(4))
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Balances
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    available_balance: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    minimum_payment: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))

    # Integration
    plaid_item_id: Mapped[str | None] = mapped_column(String(255), index=True)
    plaid_account_id: Mapped[str | None] = mapped_column(String(255), index=True)
    last_synced_at: Mapped[datetime | None] = mapped_column()
    sync_error: Mapped[str | None] = mapped_column(Text)

    # Status
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus),
        default=AccountStatus.ACTIVE,
        nullable=False,
    )
    is_manual: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))


class Transaction(BaseTenantModel, Base):
    """
    Transaction model.
    Represents individual financial transactions.
    """

    __tablename__ = "transactions"

    # Account relationship
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("financial_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Transaction details
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    post_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    subcategory: Mapped[str | None] = mapped_column(String(100))

    # Classification
    transaction_type: Mapped[TransactionType | None] = mapped_column(Enum(TransactionType))
    is_recurring: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_pending: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Integration
    plaid_transaction_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    external_id: Mapped[str | None] = mapped_column(String(255))

    # Location
    location: Mapped[dict | None] = mapped_column(JSONB)

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    notes: Mapped[str | None] = mapped_column(Text)


class Budget(BaseTenantModel, Base):
    """
    Budget model.
    Represents spending budgets by category and period.
    """

    __tablename__ = "budgets"

    # Budget details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    period: Mapped[BudgetPeriod] = mapped_column(Enum(BudgetPeriod), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Time range
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)

    # Alerts
    alert_threshold: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=Decimal("0.80"), nullable=False
    )
    alert_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Status
    status: Mapped[BudgetStatus] = mapped_column(
        Enum(BudgetStatus),
        default=BudgetStatus.ACTIVE,
        nullable=False,
    )

    # Metadata
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text)
