"""
Finance endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.finance import FinancialAccount, Transaction, Investment
from app.schemas.finance import *

router = APIRouter()

# Accounts
@router.get("/accounts", response_model=List[FinancialAccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List financial accounts"""
    result = await db.execute(
        select(FinancialAccount).where(FinancialAccount.user_id == current_user.id, FinancialAccount.is_active == True)
    )
    return result.scalars().all()


@router.post("/accounts", response_model=FinancialAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: FinancialAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create financial account"""
    account = FinancialAccount(**account_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


# Transactions
@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List transactions"""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create transaction"""
    transaction = Transaction(**tx_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


# Investments
@router.get("/investments", response_model=List[InvestmentResponse])
async def list_investments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List investments"""
    result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/investments", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_investment(
    inv_data: InvestmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create investment"""
    investment = Investment(**inv_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(investment)
    await db.commit()
    await db.refresh(investment)
    return investment
