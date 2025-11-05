"""
Transaction Management API Endpoints
CRUD operations and categorization for financial transactions
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update, delete
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.financial_profile import Transaction, FinancialProfile, FinancialAccount
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionFilter,
    CategorySummary,
    TransactionBulkUpdate
)
from app.services.transaction_service import TransactionService

router = APIRouter()

@router.post("/", response_model=TransactionResponse)
async def create_transaction(
    transaction: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new transaction"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found"
        )
    
    # Verify account ownership if account_id provided
    if transaction.account_id:
        account_result = await db.execute(
            select(FinancialAccount).where(
                and_(
                    FinancialAccount.id == transaction.account_id,
                    FinancialAccount.profile_id == profile.id
                )
            )
        )
        if not account_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found"
            )
    
    # Create transaction
    db_transaction = Transaction(
        profile_id=profile.id,
        **transaction.model_dump()
    )
    
    db.add(db_transaction)
    await db.commit()
    await db.refresh(db_transaction)
    
    return db_transaction

@router.get("/", response_model=List[TransactionResponse])
async def get_transactions(
    account_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("transaction_date", regex="^(transaction_date|amount|category)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get transactions with filtering and pagination"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return []
    
    # Build query
    query = select(Transaction).where(Transaction.profile_id == profile.id)
    
    # Apply filters
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if category:
        query = query.where(Transaction.category == category)
    if transaction_type:
        query = query.where(Transaction.transaction_type == transaction_type)
    if start_date:
        query = query.where(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.where(Transaction.transaction_date <= end_date)
    if min_amount is not None:
        query = query.where(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.where(Transaction.amount <= max_amount)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Transaction.description.ilike(search_term),
                Transaction.merchant_name.ilike(search_term),
                Transaction.notes.ilike(search_term)
            )
        )
    
    # Apply sorting
    if sort_by == "transaction_date":
        order_col = Transaction.transaction_date
    elif sort_by == "amount":
        order_col = Transaction.amount
    else:
        order_col = Transaction.category
    
    if sort_order == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())
    
    # Apply pagination
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    return transactions

@router.get("/summary/by-category")
async def get_category_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    account_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get spending summary by category"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"categories": [], "total_income": 0, "total_expenses": 0}
    
    # Build base query
    base_query = select(
        Transaction.category,
        Transaction.transaction_type,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).where(Transaction.profile_id == profile.id)
    
    # Apply filters
    if account_id:
        base_query = base_query.where(Transaction.account_id == account_id)
    if start_date:
        base_query = base_query.where(Transaction.transaction_date >= start_date)
    if end_date:
        base_query = base_query.where(Transaction.transaction_date <= end_date)
    
    # Group by category and type
    base_query = base_query.group_by(Transaction.category, Transaction.transaction_type)
    
    result = await db.execute(base_query)
    category_data = result.all()
    
    # Process results
    categories = {}
    total_income = 0
    total_expenses = 0
    
    for row in category_data:
        category = row.category or "Uncategorized"
        if category not in categories:
            categories[category] = {
                "category": category,
                "income": 0,
                "expenses": 0,
                "net": 0,
                "transaction_count": 0
            }
        
        amount = float(row.total)
        count = row.count
        
        if row.transaction_type == "credit":
            categories[category]["income"] += amount
            total_income += amount
        else:
            categories[category]["expenses"] += amount
            total_expenses += amount
        
        categories[category]["transaction_count"] += count
    
    # Calculate net for each category
    for cat in categories.values():
        cat["net"] = cat["income"] - cat["expenses"]
    
    return {
        "categories": list(categories.values()),
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_cashflow": total_income - total_expenses,
        "period": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }

@router.get("/summary/monthly")
async def get_monthly_summary(
    months: int = Query(12, ge=1, le=24),
    account_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly transaction summary"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"months": []}
    
    # Calculate date range
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=months * 30)
    
    # Query with month grouping
    query = select(
        func.date_trunc('month', Transaction.transaction_date).label('month'),
        Transaction.transaction_type,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).where(
        and_(
            Transaction.profile_id == profile.id,
            Transaction.transaction_date >= start_date
        )
    )
    
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    
    query = query.group_by('month', Transaction.transaction_type)
    query = query.order_by('month')
    
    result = await db.execute(query)
    monthly_data = result.all()
    
    # Process into monthly summaries
    months_dict = {}
    for row in monthly_data:
        month_key = row.month.strftime('%Y-%m')
        if month_key not in months_dict:
            months_dict[month_key] = {
                "month": month_key,
                "income": 0,
                "expenses": 0,
                "net": 0,
                "transaction_count": 0
            }
        
        amount = float(row.total)
        if row.transaction_type == "credit":
            months_dict[month_key]["income"] += amount
        else:
            months_dict[month_key]["expenses"] += amount
        
        months_dict[month_key]["transaction_count"] += row.count
    
    # Calculate net and convert to list
    monthly_summaries = []
    for month_data in months_dict.values():
        month_data["net"] = month_data["income"] - month_data["expenses"]
        monthly_summaries.append(month_data)
    
    return {
        "months": monthly_summaries,
        "total_months": len(monthly_summaries)
    }

@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific transaction"""
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
    
    # Get transaction
    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.id == transaction_id,
                Transaction.profile_id == profile.id
            )
        )
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    return transaction

@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    transaction_update: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a transaction"""
    # Get transaction (with ownership check)
    transaction = await get_transaction(transaction_id, db, current_user)
    
    # Update fields
    update_data = transaction_update.model_dump(exclude_unset=True)
    
    # If changing account, verify ownership
    if "account_id" in update_data and update_data["account_id"]:
        result = await db.execute(
            select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
        )
        profile = result.scalar_one_or_none()
        
        account_result = await db.execute(
            select(FinancialAccount).where(
                and_(
                    FinancialAccount.id == update_data["account_id"],
                    FinancialAccount.profile_id == profile.id
                )
            )
        )
        if not account_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found"
            )
    
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    transaction.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(transaction)
    
    return transaction

@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a transaction"""
    # Get transaction (with ownership check)
    transaction = await get_transaction(transaction_id, db, current_user)
    
    await db.delete(transaction)
    await db.commit()
    
    return {"message": "Transaction deleted successfully"}

@router.post("/bulk/update")
async def bulk_update_transactions(
    updates: TransactionBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk update multiple transactions"""
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
    
    # Verify all transactions belong to user
    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.id.in_(updates.transaction_ids),
                Transaction.profile_id == profile.id
            )
        )
    )
    transactions = result.scalars().all()
    
    if len(transactions) != len(updates.transaction_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Some transactions not found"
        )
    
    # Apply updates
    update_data = updates.updates.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.execute(
        update(Transaction)
        .where(Transaction.id.in_(updates.transaction_ids))
        .values(**update_data)
    )
    
    await db.commit()
    
    return {
        "message": f"Updated {len(updates.transaction_ids)} transactions",
        "updated_count": len(updates.transaction_ids)
    }

@router.post("/bulk/delete")
async def bulk_delete_transactions(
    transaction_ids: List[str],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk delete multiple transactions"""
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
    
    # Delete only transactions belonging to user
    result = await db.execute(
        delete(Transaction)
        .where(
            and_(
                Transaction.id.in_(transaction_ids),
                Transaction.profile_id == profile.id
            )
        )
        .returning(Transaction.id)
    )
    
    deleted_ids = [row[0] for row in result]
    await db.commit()
    
    return {
        "message": f"Deleted {len(deleted_ids)} transactions",
        "deleted_count": len(deleted_ids)
    }

@router.post("/categorize/auto")
async def auto_categorize_transactions(
    transaction_ids: Optional[List[str]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Auto-categorize transactions based on patterns"""
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
    
    # Get transactions to categorize
    query = select(Transaction).where(
        and_(
            Transaction.profile_id == profile.id,
            Transaction.category.is_(None)
        )
    )
    
    if transaction_ids:
        query = query.where(Transaction.id.in_(transaction_ids))
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    # Simple rule-based categorization
    categorization_rules = {
        "Food & Dining": ["restaurant", "cafe", "coffee", "pizza", "burger", "food", "grocery", "market"],
        "Transportation": ["uber", "lyft", "gas", "parking", "transit", "subway", "taxi"],
        "Shopping": ["amazon", "walmart", "target", "store", "shop"],
        "Entertainment": ["netflix", "spotify", "movie", "theater", "concert", "game"],
        "Utilities": ["electric", "water", "gas", "internet", "phone", "mobile"],
        "Healthcare": ["pharmacy", "doctor", "hospital", "medical", "dental", "health"],
        "Insurance": ["insurance", "geico", "progressive", "allstate"],
        "Housing": ["rent", "mortgage", "property", "maintenance"],
        "Travel": ["airline", "hotel", "airbnb", "booking"],
        "Education": ["university", "college", "school", "course", "tuition"],
        "Fitness": ["gym", "fitness", "yoga", "pilates"],
        "Personal Care": ["salon", "barber", "spa", "beauty"],
        "Subscriptions": ["subscription", "membership", "monthly", "annual"],
        "Charitable": ["donation", "charity", "nonprofit"],
        "Financial": ["bank fee", "atm", "interest", "transfer", "investment"]
    }
    
    categorized_count = 0
    for transaction in transactions:
        desc_lower = (transaction.description or "").lower()
        merchant_lower = (transaction.merchant_name or "").lower()
        combined_text = f"{desc_lower} {merchant_lower}"
        
        for category, keywords in categorization_rules.items():
            if any(keyword in combined_text for keyword in keywords):
                transaction.category = category
                categorized_count += 1
                break
    
    await db.commit()
    
    return {
        "message": f"Auto-categorized {categorized_count} transactions",
        "total_processed": len(transactions),
        "categorized": categorized_count,
        "uncategorized": len(transactions) - categorized_count
    }

@router.get("/recurring/detect")
async def detect_recurring_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Detect recurring transactions (subscriptions, bills, etc.)"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"recurring_transactions": []}
    
    # Get last 6 months of transactions
    cutoff_date = datetime.utcnow().date() - timedelta(days=180)
    
    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.profile_id == profile.id,
                Transaction.transaction_date >= cutoff_date
            )
        ).order_by(Transaction.merchant_name, Transaction.transaction_date)
    )
    transactions = result.scalars().all()
    
    # Group by merchant and amount
    merchant_groups = {}
    for trans in transactions:
        if not trans.merchant_name:
            continue
        
        key = (trans.merchant_name, round(trans.amount, 2))
        if key not in merchant_groups:
            merchant_groups[key] = []
        merchant_groups[key].append(trans)
    
    # Detect recurring patterns
    recurring = []
    for (merchant, amount), trans_list in merchant_groups.items():
        if len(trans_list) >= 2:
            # Calculate intervals between transactions
            dates = sorted([t.transaction_date for t in trans_list])
            intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
            
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                
                # Determine frequency
                if 25 <= avg_interval <= 35:
                    frequency = "Monthly"
                elif 12 <= avg_interval <= 16:
                    frequency = "Bi-weekly"
                elif 6 <= avg_interval <= 8:
                    frequency = "Weekly"
                elif 85 <= avg_interval <= 95:
                    frequency = "Quarterly"
                elif 355 <= avg_interval <= 375:
                    frequency = "Annual"
                else:
                    continue
                
                recurring.append({
                    "merchant": merchant,
                    "amount": amount,
                    "frequency": frequency,
                    "transaction_count": len(trans_list),
                    "last_date": max(dates).isoformat(),
                    "next_expected": (max(dates) + timedelta(days=int(avg_interval))).isoformat(),
                    "category": trans_list[0].category
                })
    
    return {
        "recurring_transactions": recurring,
        "total_detected": len(recurring)
    }

@router.get("/analytics/trends")
async def get_spending_trends(
    period_type: str = Query("month", regex="^(month|quarter|year)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get spending trends analysis"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"trends": []}
    
    service = TransactionService(db)
    trends = await service.get_spending_trends(profile.id, period_type=period_type)
    
    return {
        "trends": trends,
        "period": period_type
    }

@router.get("/analytics/statistics")
async def get_statistics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive transaction statistics"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"error": "Profile not found"}
    
    service = TransactionService(db)
    stats = await service.get_transaction_statistics(profile.id, start_date, end_date)
    
    return stats

@router.get("/analytics/predict")
async def predict_spending(
    months_ahead: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Predict future spending based on historical patterns"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"predictions_by_category": {}}
    
    service = TransactionService(db)
    predictions = await service.predict_future_spending(profile.id, months_ahead)
    
    return predictions

@router.get("/analytics/anomalies")
async def detect_anomalies(
    sensitivity: float = Query(2.0, ge=1.0, le=5.0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Detect unusual transactions"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"anomalies": []}
    
    service = TransactionService(db)
    anomalies = await service.detect_anomalies(profile.id, sensitivity)
    
    return {
        "anomalies": anomalies,
        "total_detected": len(anomalies),
        "sensitivity_level": sensitivity
    }

@router.get("/analytics/burn-rate")
async def calculate_burn_rate(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Calculate monthly burn rate and financial runway"""
    # Get user's profile
    result = await db.execute(
        select(FinancialProfile).where(FinancialProfile.user_id == current_user["id"])
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        return {"error": "Profile not found"}
    
    service = TransactionService(db)
    burn_rate = await service.calculate_burn_rate(profile.id)
    
    return burn_rate