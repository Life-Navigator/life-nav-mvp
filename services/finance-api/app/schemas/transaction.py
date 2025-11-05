"""
Transaction Schemas for API validation
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

class TransactionType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class TransactionCategory(str, Enum):
    FOOD_DINING = "Food & Dining"
    TRANSPORTATION = "Transportation"
    SHOPPING = "Shopping"
    ENTERTAINMENT = "Entertainment"
    UTILITIES = "Utilities"
    HEALTHCARE = "Healthcare"
    INSURANCE = "Insurance"
    HOUSING = "Housing"
    TRAVEL = "Travel"
    EDUCATION = "Education"
    FITNESS = "Fitness"
    PERSONAL_CARE = "Personal Care"
    SUBSCRIPTIONS = "Subscriptions"
    CHARITABLE = "Charitable"
    FINANCIAL = "Financial"
    INCOME = "Income"
    INVESTMENT = "Investment"
    OTHER = "Other"
    UNCATEGORIZED = "Uncategorized"

class TransactionBase(BaseModel):
    account_id: Optional[str] = None
    transaction_date: date
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    description: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = None
    transaction_type: TransactionType
    merchant_name: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = []
    is_recurring: bool = False
    is_tax_deductible: bool = False
    
    @field_validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return round(v, 2)

class TransactionCreate(TransactionBase):
    """Schema for creating a new transaction"""
    pass

class TransactionUpdate(BaseModel):
    """Schema for updating a transaction"""
    account_id: Optional[str] = None
    transaction_date: Optional[date] = None
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    category: Optional[str] = None
    transaction_type: Optional[TransactionType] = None
    merchant_name: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    tags: Optional[List[str]] = None
    is_recurring: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None

class TransactionResponse(TransactionBase):
    """Schema for transaction response"""
    id: str
    profile_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TransactionFilter(BaseModel):
    """Schema for filtering transactions"""
    account_id: Optional[str] = None
    category: Optional[str] = None
    transaction_type: Optional[TransactionType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    search: Optional[str] = None
    is_recurring: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    tags: Optional[List[str]] = None

class CategorySummary(BaseModel):
    """Schema for category spending summary"""
    category: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    transaction_count: int
    percentage_of_total: Optional[float] = None

class MonthlySummary(BaseModel):
    """Schema for monthly transaction summary"""
    month: str  # YYYY-MM format
    income: Decimal
    expenses: Decimal
    net: Decimal
    transaction_count: int
    savings_rate: Optional[float] = None

class TransactionBulkUpdate(BaseModel):
    """Schema for bulk updating transactions"""
    transaction_ids: List[str]
    updates: TransactionUpdate

class RecurringTransaction(BaseModel):
    """Schema for recurring transaction detection"""
    merchant: str
    amount: Decimal
    frequency: str  # Monthly, Weekly, etc.
    transaction_count: int
    last_date: date
    next_expected: date
    category: Optional[str] = None
    
class TransactionImportResult(BaseModel):
    """Schema for transaction import results"""
    total_found: int
    new_added: int
    duplicates_skipped: int
    errors: List[str] = []
    categories_found: List[str] = []

class SpendingTrend(BaseModel):
    """Schema for spending trend analysis"""
    period: str
    category: str
    current_amount: Decimal
    previous_amount: Decimal
    change_amount: Decimal
    change_percentage: float
    is_increasing: bool

class TransactionStats(BaseModel):
    """Schema for transaction statistics"""
    total_transactions: int
    total_income: Decimal
    total_expenses: Decimal
    net_cashflow: Decimal
    average_transaction: Decimal
    largest_expense: Optional[TransactionResponse] = None
    largest_income: Optional[TransactionResponse] = None
    most_frequent_merchant: Optional[str] = None
    most_expensive_category: Optional[str] = None