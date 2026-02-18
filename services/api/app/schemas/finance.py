"""
Finance schemas
"""

from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, UUID4
from app.schemas.base import BaseResponseSchema
from app.models.finance import AccountType, TransactionType, InvestmentType


# Financial Account Schemas
class FinancialAccountCreate(BaseModel):
    name: str
    account_type: AccountType
    institution_name: Optional[str] = None


class FinancialAccountUpdate(BaseModel):
    name: Optional[str] = None
    current_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None


class FinancialAccountResponse(BaseResponseSchema):
    name: str
    account_type: AccountType
    current_balance: Decimal
    institution_name: Optional[str]
    is_active: bool


# Transaction Schemas
class TransactionCreate(BaseModel):
    account_id: UUID4
    transaction_type: TransactionType
    amount: Decimal
    description: str
    transaction_date: date


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None


class TransactionResponse(BaseResponseSchema):
    account_id: UUID4
    transaction_type: TransactionType
    amount: Decimal
    description: str
    transaction_date: date
    category: Optional[str]


# Investment Schemas
class InvestmentCreate(BaseModel):
    account_id: UUID4
    name: str
    symbol: Optional[str] = None
    investment_type: InvestmentType
    quantity: Decimal


class InvestmentUpdate(BaseModel):
    quantity: Optional[Decimal] = None
    current_price: Optional[Decimal] = None


class InvestmentResponse(BaseResponseSchema):
    account_id: UUID4
    name: str
    symbol: Optional[str]
    investment_type: InvestmentType
    quantity: Decimal
    current_value: Optional[Decimal]
