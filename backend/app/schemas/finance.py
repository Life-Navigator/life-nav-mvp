"""
Finance domain schemas.
Handles financial accounts, transactions, and budgets.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.finance import (
    AccountStatus,
    AccountType,
    BudgetPeriod,
    BudgetStatus,
    TransactionType,
)
from app.schemas.base import BaseSchema, IDTimestampSchema


# ============================================================================
# FinancialAccount Schemas
# ============================================================================


class FinancialAccountCreate(BaseSchema):
    """FinancialAccount creation schema."""

    account_name: str = Field(min_length=1, max_length=255)
    account_type: AccountType
    institution_name: str | None = Field(default=None, max_length=255)
    account_number_last4: str | None = Field(default=None, max_length=4)
    currency: str = Field(default="USD", max_length=3)
    current_balance: Decimal | None = None
    available_balance: Decimal | None = None
    credit_limit: Decimal | None = None
    interest_rate: Decimal | None = None
    minimum_payment: Decimal | None = None
    plaid_item_id: str | None = Field(default=None, max_length=255)
    plaid_account_id: str | None = Field(default=None, max_length=255)
    is_manual: bool = Field(default=False)
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None


class FinancialAccountUpdate(BaseSchema):
    """FinancialAccount update schema."""

    account_name: str | None = Field(default=None, max_length=255)
    account_type: AccountType | None = None
    institution_name: str | None = Field(default=None, max_length=255)
    account_number_last4: str | None = Field(default=None, max_length=4)
    currency: str | None = Field(default=None, max_length=3)
    current_balance: Decimal | None = None
    available_balance: Decimal | None = None
    credit_limit: Decimal | None = None
    interest_rate: Decimal | None = None
    minimum_payment: Decimal | None = None
    plaid_item_id: str | None = Field(default=None, max_length=255)
    plaid_account_id: str | None = Field(default=None, max_length=255)
    last_synced_at: datetime | None = None
    sync_error: str | None = None
    status: AccountStatus | None = None
    is_manual: bool | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None


class FinancialAccountResponse(IDTimestampSchema):
    """FinancialAccount response schema."""

    account_name: str
    account_type: AccountType
    institution_name: str | None
    account_number_last4: str | None
    currency: str
    current_balance: Decimal | None
    available_balance: Decimal | None
    credit_limit: Decimal | None
    interest_rate: Decimal | None
    minimum_payment: Decimal | None
    plaid_item_id: str | None
    plaid_account_id: str | None
    last_synced_at: datetime | None
    sync_error: str | None
    status: AccountStatus
    is_manual: bool
    metadata: dict[str, Any]
    tags: list[str] | None


# ============================================================================
# Transaction Schemas
# ============================================================================


class TransactionCreate(BaseSchema):
    """Transaction creation schema."""

    account_id: UUID
    transaction_date: date
    post_date: date | None = None
    amount: Decimal
    currency: str = Field(default="USD", max_length=3)
    description: str = Field(min_length=1)
    merchant_name: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    transaction_type: TransactionType | None = None
    is_recurring: bool = Field(default=False)
    is_pending: bool = Field(default=False)
    plaid_transaction_id: str | None = Field(default=None, max_length=255)
    external_id: str | None = Field(default=None, max_length=255)
    location: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class TransactionUpdate(BaseSchema):
    """Transaction update schema."""

    account_id: UUID | None = None
    transaction_date: date | None = None
    post_date: date | None = None
    amount: Decimal | None = None
    currency: str | None = Field(default=None, max_length=3)
    description: str | None = None
    merchant_name: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    transaction_type: TransactionType | None = None
    is_recurring: bool | None = None
    is_pending: bool | None = None
    plaid_transaction_id: str | None = Field(default=None, max_length=255)
    external_id: str | None = Field(default=None, max_length=255)
    location: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class TransactionResponse(IDTimestampSchema):
    """Transaction response schema."""

    account_id: UUID
    transaction_date: date
    post_date: date | None
    amount: Decimal
    currency: str
    description: str
    merchant_name: str | None
    category: str | None
    subcategory: str | None
    transaction_type: TransactionType | None
    is_recurring: bool
    is_pending: bool
    plaid_transaction_id: str | None
    external_id: str | None
    location: dict[str, Any] | None
    metadata: dict[str, Any]
    tags: list[str] | None
    notes: str | None


# ============================================================================
# Budget Schemas
# ============================================================================


class BudgetCreate(BaseSchema):
    """Budget creation schema."""

    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    period: BudgetPeriod
    currency: str = Field(default="USD", max_length=3)
    start_date: date
    end_date: date | None = None
    alert_threshold: Decimal = Field(default=Decimal("0.80"), ge=0, le=1)
    alert_enabled: bool = Field(default=True)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class BudgetUpdate(BaseSchema):
    """Budget update schema."""

    name: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)
    period: BudgetPeriod | None = None
    currency: str | None = Field(default=None, max_length=3)
    start_date: date | None = None
    end_date: date | None = None
    alert_threshold: Decimal | None = Field(default=None, ge=0, le=1)
    alert_enabled: bool | None = None
    status: BudgetStatus | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class BudgetResponse(IDTimestampSchema):
    """Budget response schema."""

    name: str
    category: str
    amount: Decimal
    period: BudgetPeriod
    currency: str
    start_date: date
    end_date: date | None
    alert_threshold: Decimal
    alert_enabled: bool
    status: BudgetStatus
    metadata: dict[str, Any]
    notes: str | None
