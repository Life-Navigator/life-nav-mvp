"""
Transaction Service Layer
Business logic for transaction management and analysis
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
import statistics

from app.models.financial_profile import Transaction, FinancialProfile, FinancialAccount
from app.schemas.transaction import SpendingTrend, TransactionStats

class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_spending_trends(
        self,
        profile_id: str,
        periods: int = 3,
        period_type: str = "month"
    ) -> List[SpendingTrend]:
        """Analyze spending trends by category over time periods"""
        trends = []
        
        # Calculate period boundaries
        now = datetime.utcnow().date()
        if period_type == "month":
            current_start = date(now.year, now.month, 1)
            if now.month == 1:
                previous_start = date(now.year - 1, 12, 1)
            else:
                previous_start = date(now.year, now.month - 1, 1)
        elif period_type == "quarter":
            quarter = (now.month - 1) // 3
            current_start = date(now.year, quarter * 3 + 1, 1)
            if quarter == 0:
                previous_start = date(now.year - 1, 10, 1)
            else:
                previous_start = date(now.year, (quarter - 1) * 3 + 1, 1)
        elif period_type == "year":
            current_start = date(now.year, 1, 1)
            previous_start = date(now.year - 1, 1, 1)
        else:
            # Default to last 30 days
            current_start = now - timedelta(days=30)
            previous_start = now - timedelta(days=60)
        
        # Get current period transactions
        current_result = await self.db.execute(
            select(
                Transaction.category,
                func.sum(Transaction.amount).label("total")
            ).where(
                and_(
                    Transaction.profile_id == profile_id,
                    Transaction.transaction_date >= current_start,
                    Transaction.transaction_type == "debit"
                )
            ).group_by(Transaction.category)
        )
        current_spending = {row.category: float(row.total) for row in current_result}
        
        # Get previous period transactions
        previous_result = await self.db.execute(
            select(
                Transaction.category,
                func.sum(Transaction.amount).label("total")
            ).where(
                and_(
                    Transaction.profile_id == profile_id,
                    Transaction.transaction_date >= previous_start,
                    Transaction.transaction_date < current_start,
                    Transaction.transaction_type == "debit"
                )
            ).group_by(Transaction.category)
        )
        previous_spending = {row.category: float(row.total) for row in previous_result}
        
        # Calculate trends
        all_categories = set(current_spending.keys()) | set(previous_spending.keys())
        
        for category in all_categories:
            current = current_spending.get(category, 0)
            previous = previous_spending.get(category, 0)
            change = current - previous
            
            if previous > 0:
                change_pct = (change / previous) * 100
            else:
                change_pct = 100 if current > 0 else 0
            
            trends.append(SpendingTrend(
                period=f"{period_type}ly",
                category=category or "Uncategorized",
                current_amount=Decimal(str(current)),
                previous_amount=Decimal(str(previous)),
                change_amount=Decimal(str(change)),
                change_percentage=round(change_pct, 2),
                is_increasing=change > 0
            ))
        
        # Sort by absolute change amount
        trends.sort(key=lambda x: abs(x.change_amount), reverse=True)
        
        return trends
    
    async def get_transaction_statistics(
        self,
        profile_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> TransactionStats:
        """Get comprehensive transaction statistics"""
        
        # Build base query
        query = select(Transaction).where(Transaction.profile_id == profile_id)
        
        if start_date:
            query = query.where(Transaction.transaction_date >= start_date)
        if end_date:
            query = query.where(Transaction.transaction_date <= end_date)
        
        result = await self.db.execute(query)
        transactions = result.scalars().all()
        
        if not transactions:
            return TransactionStats(
                total_transactions=0,
                total_income=Decimal("0"),
                total_expenses=Decimal("0"),
                net_cashflow=Decimal("0"),
                average_transaction=Decimal("0")
            )
        
        # Calculate statistics
        total_income = sum(t.amount for t in transactions if t.transaction_type == "credit")
        total_expenses = sum(t.amount for t in transactions if t.transaction_type == "debit")
        
        # Find largest transactions
        expenses = [t for t in transactions if t.transaction_type == "debit"]
        incomes = [t for t in transactions if t.transaction_type == "credit"]
        
        largest_expense = max(expenses, key=lambda x: x.amount) if expenses else None
        largest_income = max(incomes, key=lambda x: x.amount) if incomes else None
        
        # Find most frequent merchant
        merchant_counts = {}
        for t in transactions:
            if t.merchant_name:
                merchant_counts[t.merchant_name] = merchant_counts.get(t.merchant_name, 0) + 1
        
        most_frequent_merchant = max(merchant_counts, key=merchant_counts.get) if merchant_counts else None
        
        # Find most expensive category
        category_totals = {}
        for t in expenses:
            if t.category:
                category_totals[t.category] = category_totals.get(t.category, 0) + t.amount
        
        most_expensive_category = max(category_totals, key=category_totals.get) if category_totals else None
        
        return TransactionStats(
            total_transactions=len(transactions),
            total_income=total_income,
            total_expenses=total_expenses,
            net_cashflow=total_income - total_expenses,
            average_transaction=sum(t.amount for t in transactions) / len(transactions),
            largest_expense=largest_expense,
            largest_income=largest_income,
            most_frequent_merchant=most_frequent_merchant,
            most_expensive_category=most_expensive_category
        )
    
    async def predict_future_spending(
        self,
        profile_id: str,
        months_ahead: int = 3
    ) -> Dict[str, Any]:
        """Predict future spending based on historical patterns"""
        
        # Get last 6 months of transactions
        cutoff = datetime.utcnow().date() - timedelta(days=180)
        
        result = await self.db.execute(
            select(
                func.date_trunc('month', Transaction.transaction_date).label('month'),
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).where(
                and_(
                    Transaction.profile_id == profile_id,
                    Transaction.transaction_date >= cutoff,
                    Transaction.transaction_type == "debit"
                )
            ).group_by('month', Transaction.category)
        )
        
        monthly_data = result.all()
        
        # Organize by category
        category_history = {}
        for row in monthly_data:
            cat = row.category or "Uncategorized"
            if cat not in category_history:
                category_history[cat] = []
            category_history[cat].append(float(row.total))
        
        # Calculate predictions
        predictions = {}
        for category, amounts in category_history.items():
            if len(amounts) >= 3:
                # Simple moving average
                avg = statistics.mean(amounts)
                std = statistics.stdev(amounts) if len(amounts) > 1 else 0
                
                predictions[category] = {
                    "predicted_monthly": round(avg, 2),
                    "confidence_range": {
                        "low": round(max(0, avg - std), 2),
                        "high": round(avg + std, 2)
                    },
                    "trend": "stable" if std < avg * 0.1 else "variable"
                }
        
        # Calculate total predictions
        total_predicted = sum(p["predicted_monthly"] for p in predictions.values())
        
        return {
            "predictions_by_category": predictions,
            "total_predicted_monthly": round(total_predicted, 2),
            "projected_spending": {
                f"{i+1}_month": round(total_predicted * (i+1), 2)
                for i in range(months_ahead)
            }
        }
    
    async def detect_anomalies(
        self,
        profile_id: str,
        sensitivity: float = 2.0
    ) -> List[Dict[str, Any]]:
        """Detect unusual transactions based on historical patterns"""
        
        # Get last 3 months of transactions
        cutoff = datetime.utcnow().date() - timedelta(days=90)
        
        result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.profile_id == profile_id,
                    Transaction.transaction_date >= cutoff
                )
            ).order_by(Transaction.transaction_date.desc())
        )
        
        transactions = result.scalars().all()
        
        if len(transactions) < 10:
            return []
        
        # Group by category for analysis
        category_amounts = {}
        for t in transactions:
            cat = t.category or "Uncategorized"
            if cat not in category_amounts:
                category_amounts[cat] = []
            category_amounts[cat].append(float(t.amount))
        
        anomalies = []
        
        for t in transactions[:20]:  # Check recent transactions
            cat = t.category or "Uncategorized"
            amounts = category_amounts[cat]
            
            if len(amounts) >= 5:
                # Calculate statistics excluding current transaction
                other_amounts = [a for a in amounts if a != float(t.amount)]
                if other_amounts:
                    avg = statistics.mean(other_amounts)
                    std = statistics.stdev(other_amounts) if len(other_amounts) > 1 else 0
                    
                    # Detect if transaction is unusual
                    if std > 0:
                        z_score = abs((float(t.amount) - avg) / std)
                        if z_score > sensitivity:
                            anomalies.append({
                                "transaction_id": t.id,
                                "date": t.transaction_date.isoformat(),
                                "description": t.description,
                                "amount": float(t.amount),
                                "category": cat,
                                "typical_amount": round(avg, 2),
                                "deviation": round(z_score, 2),
                                "severity": "high" if z_score > 3 else "medium"
                            })
        
        return anomalies
    
    async def calculate_burn_rate(
        self,
        profile_id: str
    ) -> Dict[str, Any]:
        """Calculate monthly burn rate and runway"""
        
        # Get last 3 months of data
        cutoff = datetime.utcnow().date() - timedelta(days=90)
        
        # Get monthly income and expenses
        result = await self.db.execute(
            select(
                func.date_trunc('month', Transaction.transaction_date).label('month'),
                Transaction.transaction_type,
                func.sum(Transaction.amount).label('total')
            ).where(
                and_(
                    Transaction.profile_id == profile_id,
                    Transaction.transaction_date >= cutoff
                )
            ).group_by('month', Transaction.transaction_type)
        )
        
        monthly_data = result.all()
        
        # Calculate averages
        monthly_income = []
        monthly_expenses = []
        
        months = {}
        for row in monthly_data:
            month_key = row.month.strftime('%Y-%m')
            if month_key not in months:
                months[month_key] = {"income": 0, "expenses": 0}
            
            if row.transaction_type == "credit":
                months[month_key]["income"] = float(row.total)
            else:
                months[month_key]["expenses"] = float(row.total)
        
        for month_data in months.values():
            monthly_income.append(month_data["income"])
            monthly_expenses.append(month_data["expenses"])
        
        if not monthly_expenses:
            return {
                "monthly_burn_rate": 0,
                "monthly_income": 0,
                "net_burn": 0,
                "months_of_runway": "N/A"
            }
        
        avg_income = statistics.mean(monthly_income) if monthly_income else 0
        avg_expenses = statistics.mean(monthly_expenses)
        net_burn = avg_expenses - avg_income
        
        # Get current balance (would need account balances)
        account_result = await self.db.execute(
            select(func.sum(FinancialAccount.current_balance)).where(
                and_(
                    FinancialAccount.profile_id == profile_id,
                    FinancialAccount.account_type.in_(["checking", "savings"])
                )
            )
        )
        current_balance = account_result.scalar() or 0
        
        if net_burn > 0 and current_balance > 0:
            runway_months = current_balance / net_burn
        else:
            runway_months = "Infinite" if net_burn <= 0 else 0
        
        return {
            "monthly_burn_rate": round(avg_expenses, 2),
            "monthly_income": round(avg_income, 2),
            "net_burn": round(net_burn, 2),
            "current_balance": float(current_balance),
            "months_of_runway": round(runway_months, 1) if isinstance(runway_months, (int, float)) else runway_months,
            "projection": {
                "3_months": round(current_balance - (net_burn * 3), 2) if net_burn > 0 else current_balance,
                "6_months": round(current_balance - (net_burn * 6), 2) if net_burn > 0 else current_balance,
                "12_months": round(current_balance - (net_burn * 12), 2) if net_burn > 0 else current_balance
            }
        }