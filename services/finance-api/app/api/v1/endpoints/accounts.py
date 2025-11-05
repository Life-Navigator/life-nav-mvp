"""
Financial Accounts API Endpoints
Account management and synchronization
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.financial_profile import FinancialAccount, FinancialProfile, Transaction
from app.schemas.financial import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter()

@router.post("/", response_model=AccountResponse)
async def create_account(
    account_data: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new financial account"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found. Please create a profile first."
        )
    
    # Check if account already exists
    existing = await db.execute(
        select(FinancialAccount).where(
            and_(
                FinancialAccount.profile_id == profile.id,
                FinancialAccount.account_name == account_data.account_name
            )
        )
    )
    
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account with this name already exists"
        )
    
    # Create account
    account = FinancialAccount(
        profile_id=profile.id,
        **account_data.model_dump()
    )
    
    db.add(account)
    await db.commit()
    await db.refresh(account)
    
    return account

@router.get("/", response_model=List[AccountResponse])
async def get_accounts(
    account_type: Optional[str] = Query(None, description="Filter by account type"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all accounts for the current user"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return []
    
    # Build query
    query = select(FinancialAccount).where(FinancialAccount.profile_id == profile.id)
    
    if account_type:
        query = query.where(FinancialAccount.account_type == account_type)
    
    result = await db.execute(query.order_by(FinancialAccount.account_name))
    accounts = result.scalars().all()
    
    return accounts

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific account"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Get account
    result = await db.execute(
        select(FinancialAccount).where(
            and_(
                FinancialAccount.id == account_id,
                FinancialAccount.profile_id == profile.id
            )
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return account

@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    account_update: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update an account"""
    # Get account (with ownership check)
    account = await get_account(account_id, db, current_user)
    
    # Update fields
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    
    account.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(account)
    
    return account

@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an account and all related transactions"""
    # Get account (with ownership check)
    account = await get_account(account_id, db, current_user)
    
    # Delete account (cascades to transactions)
    await db.delete(account)
    await db.commit()
    
    return {"message": "Account deleted successfully"}

@router.get("/{account_id}/transactions")
async def get_account_transactions(
    account_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get transactions for a specific account"""
    # Verify account ownership
    await get_account(account_id, db, current_user)
    
    # Get transactions
    result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .order_by(Transaction.transaction_date.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.account_id == account_id)
    )
    total_count = count_result.scalar()
    
    return {
        "transactions": transactions,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }

@router.post("/{account_id}/sync")
async def sync_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Trigger account synchronization (placeholder for Plaid integration)"""
    # Get account
    account = await get_account(account_id, db, current_user)
    
    # Update last sync time
    account.last_sync = datetime.utcnow()
    await db.commit()
    
    return {
        "message": "Account sync initiated",
        "account_id": account_id,
        "last_sync": account.last_sync,
        "note": "Manual sync - automatic sync will be available with bank integration"
    }

@router.get("/summary/balances")
async def get_account_summary(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get summary of all account balances"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {
            "total_assets": 0,
            "total_liabilities": 0,
            "net_worth": 0,
            "accounts_by_type": {}
        }
    
    # Get all accounts
    result = await db.execute(
        select(FinancialAccount).where(FinancialAccount.profile_id == profile.id)
    )
    accounts = result.scalars().all()
    
    # Calculate summary
    total_assets = 0
    total_liabilities = 0
    accounts_by_type = {}
    
    for account in accounts:
        if account.account_type in ['checking', 'savings', 'investment', 'retirement']:
            total_assets += account.current_balance
        elif account.account_type == 'credit':
            total_liabilities += account.current_balance
        
        if account.account_type not in accounts_by_type:
            accounts_by_type[account.account_type] = {
                "count": 0,
                "total_balance": 0
            }
        
        accounts_by_type[account.account_type]["count"] += 1
        accounts_by_type[account.account_type]["total_balance"] += account.current_balance
    
    return {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": total_assets - total_liabilities,
        "accounts_by_type": accounts_by_type,
        "total_accounts": len(accounts)
    }

# Import func for count
from sqlalchemy import func