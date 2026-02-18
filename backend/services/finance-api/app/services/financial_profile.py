"""
Financial Profile Service - Core Business Logic
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from app.models.financial_profile import (
    FinancialProfile, 
    FinancialGoal, 
    FinancialAccount,
    Transaction,
    Budget
)
from app.schemas.financial import (
    FinancialProfileCreate,
    FinancialProfileUpdate,
    FinancialHealthScore,
    CashFlowAnalysis
)

class FinancialProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_profile(self, profile_data: FinancialProfileCreate) -> FinancialProfile:
        """Create a new financial profile"""
        profile = FinancialProfile(**profile_data.model_dump())
        
        # Calculate initial metrics
        profile.net_worth = profile.total_assets - profile.total_debt
        profile.monthly_income = profile.annual_income / 12
        
        if profile.monthly_income > 0:
            profile.debt_to_income_ratio = (profile.total_debt / profile.annual_income) * 100
            profile.savings_rate = max(0, (profile.monthly_income - profile.monthly_expenses) / profile.monthly_income * 100)
        
        if profile.monthly_expenses > 0:
            profile.emergency_fund_months = profile.liquid_assets / profile.monthly_expenses
        
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile
    
    async def get_by_user_id(self, user_id: str) -> Optional[FinancialProfile]:
        """Get profile by user ID"""
        result = await self.db.execute(
            select(FinancialProfile)
            .where(FinancialProfile.user_id == user_id)
            .options(selectinload(FinancialProfile.goals))
            .options(selectinload(FinancialProfile.accounts))
        )
        return result.scalar_one_or_none()
    
    async def update_profile(
        self, 
        user_id: str, 
        profile_update: FinancialProfileUpdate
    ) -> Optional[FinancialProfile]:
        """Update financial profile"""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None
        
        update_data = profile_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        
        # Recalculate metrics
        await self.recalculate_metrics(user_id)
        
        await self.db.commit()
        await self.db.refresh(profile)
        return profile
    
    async def calculate_health_score(self, user_id: str) -> Optional[FinancialHealthScore]:
        """Calculate comprehensive financial health score"""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None
        
        components = {}
        strengths = []
        weaknesses = []
        recommendations = []
        
        # 1. Emergency Fund Score (20% weight)
        emergency_score = min(100, (profile.emergency_fund_months / 6) * 100)
        components['emergency_fund'] = int(emergency_score)
        
        if emergency_score >= 80:
            strengths.append("Strong emergency fund coverage")
        elif emergency_score < 50:
            weaknesses.append("Insufficient emergency fund")
            recommendations.append("Build emergency fund to cover 3-6 months of expenses")
        
        # 2. Debt-to-Income Score (20% weight)
        if profile.debt_to_income_ratio == 0:
            dti_score = 100
        elif profile.debt_to_income_ratio < 20:
            dti_score = 90
        elif profile.debt_to_income_ratio < 35:
            dti_score = 70
        elif profile.debt_to_income_ratio < 50:
            dti_score = 40
        else:
            dti_score = 20
        components['debt_management'] = dti_score
        
        if dti_score >= 70:
            strengths.append("Healthy debt-to-income ratio")
        else:
            weaknesses.append("High debt burden")
            recommendations.append("Focus on debt reduction to improve financial flexibility")
        
        # 3. Savings Rate Score (20% weight)
        if profile.savings_rate >= 20:
            savings_score = 100
        elif profile.savings_rate >= 15:
            savings_score = 85
        elif profile.savings_rate >= 10:
            savings_score = 70
        elif profile.savings_rate >= 5:
            savings_score = 50
        else:
            savings_score = max(0, profile.savings_rate * 10)
        components['savings_rate'] = int(savings_score)
        
        if savings_score >= 70:
            strengths.append("Excellent savings habits")
        else:
            weaknesses.append("Low savings rate")
            recommendations.append("Aim to save at least 15-20% of income")
        
        # 4. Net Worth Progress Score (20% weight)
        age_factor = max(1, (profile.net_worth / (profile.annual_income * 0.1 * 30)) * 100)  # Simplified age-based formula
        net_worth_score = min(100, age_factor)
        components['net_worth'] = int(net_worth_score)
        
        # 5. Credit Score Component (10% weight)
        if profile.credit_score:
            if profile.credit_score >= 750:
                credit_score = 100
            elif profile.credit_score >= 700:
                credit_score = 85
            elif profile.credit_score >= 650:
                credit_score = 70
            elif profile.credit_score >= 600:
                credit_score = 50
            else:
                credit_score = 30
            components['credit'] = credit_score
            
            if credit_score >= 85:
                strengths.append("Excellent credit score")
            elif credit_score < 70:
                weaknesses.append("Credit score needs improvement")
                recommendations.append("Work on improving credit score for better loan terms")
        else:
            components['credit'] = 50  # Default if not provided
        
        # 6. Investment Diversification (10% weight)
        if profile.invested_assets > 0:
            investment_ratio = profile.invested_assets / profile.total_assets
            if investment_ratio > 0.3:
                investment_score = min(100, investment_ratio * 150)
                strengths.append("Good investment allocation")
            else:
                investment_score = investment_ratio * 200
                recommendations.append("Consider increasing investment allocation for long-term growth")
        else:
            investment_score = 0
            weaknesses.append("No investment assets")
            recommendations.append("Start investing for long-term wealth building")
        components['investments'] = int(investment_score)
        
        # Calculate overall score (weighted average)
        weights = {
            'emergency_fund': 0.20,
            'debt_management': 0.20,
            'savings_rate': 0.20,
            'net_worth': 0.20,
            'credit': 0.10,
            'investments': 0.10
        }
        
        overall_score = sum(components[key] * weights[key] for key in components)
        
        # Peer comparison (simplified - would need demographic data)
        peer_comparison = {
            'average_score': 65,
            'percentile': min(95, max(5, overall_score - 35 + 50)),  # Rough percentile
            'demographic': 'Similar age and income bracket'
        }
        
        return FinancialHealthScore(
            overall_score=int(overall_score),
            components=components,
            strengths=strengths[:3],  # Top 3 strengths
            weaknesses=weaknesses[:3],  # Top 3 weaknesses
            recommendations=recommendations[:5],  # Top 5 recommendations
            peer_comparison=peer_comparison
        )
    
    async def analyze_cash_flow(
        self, 
        user_id: str, 
        period: str = "monthly"
    ) -> Optional[CashFlowAnalysis]:
        """Analyze cash flow for specified period"""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None
        
        # Determine period multiplier
        if period == "monthly":
            multiplier = 1
        elif period == "quarterly":
            multiplier = 3
        elif period == "annual":
            multiplier = 12
        else:
            multiplier = 1
        
        # Calculate income for period
        period_income = profile.monthly_income * multiplier
        
        # Calculate expenses for period
        period_expenses = profile.monthly_expenses * multiplier
        
        # Build expense breakdown
        expense_breakdown = {
            'housing': profile.housing_cost * multiplier,
            'food': profile.food_cost * multiplier,
            'transportation': profile.transportation_cost * multiplier,
            'insurance': profile.insurance_cost * multiplier,
            'utilities': profile.utilities_cost * multiplier,
            'entertainment': profile.entertainment_cost * multiplier,
            'other': max(0, period_expenses - sum([
                profile.housing_cost,
                profile.food_cost,
                profile.transportation_cost,
                profile.insurance_cost,
                profile.utilities_cost,
                profile.entertainment_cost
            ]) * multiplier)
        }
        
        # Calculate net cash flow
        net_cash_flow = period_income - period_expenses
        
        # Calculate savings rate for period
        savings_rate = 0 if period_income == 0 else (net_cash_flow / period_income * 100)
        
        return CashFlowAnalysis(
            period=period,
            income=period_income,
            expenses=period_expenses,
            net_cash_flow=net_cash_flow,
            savings_rate=savings_rate,
            expense_breakdown=expense_breakdown
        )
    
    async def recalculate_metrics(self, user_id: str) -> Optional[Dict[str, float]]:
        """Recalculate all financial metrics"""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None
        
        # Net worth
        profile.net_worth = profile.total_assets - profile.total_debt
        
        # Monthly income
        profile.monthly_income = profile.annual_income / 12
        
        # Debt-to-income ratio
        if profile.annual_income > 0:
            profile.debt_to_income_ratio = (profile.total_debt / profile.annual_income) * 100
        else:
            profile.debt_to_income_ratio = 0
        
        # Savings rate
        if profile.monthly_income > 0:
            monthly_savings = profile.monthly_income - profile.monthly_expenses
            profile.savings_rate = max(0, (monthly_savings / profile.monthly_income) * 100)
        else:
            profile.savings_rate = 0
        
        # Emergency fund months
        if profile.monthly_expenses > 0:
            profile.emergency_fund_months = profile.liquid_assets / profile.monthly_expenses
        else:
            profile.emergency_fund_months = 0
        
        profile.updated_at = datetime.utcnow()
        await self.db.commit()
        
        return {
            'net_worth': profile.net_worth,
            'debt_to_income_ratio': profile.debt_to_income_ratio,
            'savings_rate': profile.savings_rate,
            'emergency_fund_months': profile.emergency_fund_months
        }
    
    async def delete_profile(self, user_id: str) -> bool:
        """Delete profile and all related data"""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return False
        
        await self.db.delete(profile)
        await self.db.commit()
        return True