"""
Goal Planning Service
Financial goal management and tracking
"""

from typing import List, Optional, Dict
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
import numpy as np

from app.models.financial_profile import FinancialProfile, FinancialGoal
from app.schemas.financial import (
    FinancialGoalCreate,
    FinancialGoalUpdate,
    RetirementProjection
)
from app.services.retirement_calculator import RetirementCalculator, RetirementInputs

class GoalPlanningService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.retirement_calc = RetirementCalculator()
    
    async def create_goal(
        self, 
        user_id: str, 
        goal_data: FinancialGoalCreate
    ) -> Optional[FinancialGoal]:
        """Create a new financial goal"""
        # Get user's financial profile
        result = await self.db.execute(
            select(FinancialProfile).where(FinancialProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            return None
        
        # Create goal
        goal = FinancialGoal(
            profile_id=profile.id,
            **goal_data.model_dump()
        )
        
        # Calculate required return rate
        months_to_goal = (goal.target_date - datetime.utcnow()).days / 30
        if months_to_goal > 0 and goal.target_amount > goal.current_amount:
            # Simple calculation - could be enhanced
            total_contributions = goal.monthly_contribution * months_to_goal
            gap = goal.target_amount - goal.current_amount - total_contributions
            
            if gap > 0 and total_contributions > 0:
                goal.required_return_rate = (gap / total_contributions) / (months_to_goal / 12)
            else:
                goal.required_return_rate = 0
        
        # Calculate initial progress
        goal.progress_percentage = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
        
        self.db.add(goal)
        await self.db.commit()
        await self.db.refresh(goal)
        
        return goal
    
    async def get_user_goals(self, user_id: str) -> List[FinancialGoal]:
        """Get all goals for a user"""
        result = await self.db.execute(
            select(FinancialGoal)
            .join(FinancialProfile)
            .where(FinancialProfile.user_id == user_id)
            .order_by(FinancialGoal.priority.desc(), FinancialGoal.target_date)
        )
        return result.scalars().all()
    
    async def get_goal(self, goal_id: str, user_id: str) -> Optional[FinancialGoal]:
        """Get a specific goal"""
        result = await self.db.execute(
            select(FinancialGoal)
            .join(FinancialProfile)
            .where(
                and_(
                    FinancialGoal.id == goal_id,
                    FinancialProfile.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def update_goal(
        self, 
        goal_id: str, 
        user_id: str, 
        goal_update: FinancialGoalUpdate
    ) -> Optional[FinancialGoal]:
        """Update a financial goal"""
        goal = await self.get_goal(goal_id, user_id)
        if not goal:
            return None
        
        update_data = goal_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(goal, field, value)
        
        # Recalculate progress
        goal.progress_percentage = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
        
        # Recalculate required return if dates or amounts changed
        if 'target_date' in update_data or 'target_amount' in update_data:
            months_to_goal = (goal.target_date - datetime.utcnow()).days / 30
            if months_to_goal > 0 and goal.target_amount > goal.current_amount:
                total_contributions = goal.monthly_contribution * months_to_goal
                gap = goal.target_amount - goal.current_amount - total_contributions
                
                if gap > 0 and total_contributions > 0:
                    goal.required_return_rate = (gap / total_contributions) / (months_to_goal / 12)
                else:
                    goal.required_return_rate = 0
        
        goal.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(goal)
        
        return goal
    
    async def delete_goal(self, goal_id: str, user_id: str) -> bool:
        """Delete a financial goal"""
        goal = await self.get_goal(goal_id, user_id)
        if not goal:
            return False
        
        await self.db.delete(goal)
        await self.db.commit()
        return True
    
    async def simulate_goal(
        self,
        goal_id: str,
        user_id: str,
        monthly_contribution: float,
        expected_return: float
    ) -> Optional[Dict]:
        """Simulate goal achievement with different parameters"""
        goal = await self.get_goal(goal_id, user_id)
        if not goal:
            return None
        
        months_to_goal = max(1, (goal.target_date - datetime.utcnow()).days / 30)
        years_to_goal = months_to_goal / 12
        
        # Calculate future value with compound interest
        monthly_return = expected_return / 12
        
        # FV of current amount
        fv_current = goal.current_amount * ((1 + expected_return) ** years_to_goal)
        
        # FV of monthly contributions (annuity)
        if monthly_return > 0:
            fv_contributions = monthly_contribution * (
                ((1 + monthly_return) ** months_to_goal - 1) / monthly_return
            )
        else:
            fv_contributions = monthly_contribution * months_to_goal
        
        total_future_value = fv_current + fv_contributions
        
        # Calculate probability of success (simplified)
        # Using normal distribution with volatility
        volatility = 0.15  # 15% annual volatility
        expected_value = total_future_value
        std_dev = total_future_value * volatility * np.sqrt(years_to_goal)
        
        from scipy import stats
        probability = stats.norm.cdf(goal.target_amount, expected_value, std_dev)
        probability = (1 - probability) * 100  # Convert to success probability
        
        # Calculate time to reach goal
        if total_future_value >= goal.target_amount:
            # Goal achieved
            months_needed = months_to_goal
            status = "on_track"
        else:
            # Need more time
            gap = goal.target_amount - total_future_value
            additional_months = gap / monthly_contribution if monthly_contribution > 0 else float('inf')
            months_needed = months_to_goal + additional_months
            status = "behind"
        
        return {
            "goal_id": goal_id,
            "goal_name": goal.name,
            "target_amount": goal.target_amount,
            "current_amount": goal.current_amount,
            "simulation_parameters": {
                "monthly_contribution": monthly_contribution,
                "expected_return": f"{expected_return:.1%}",
                "years_to_goal": round(years_to_goal, 1)
            },
            "projected_value": round(total_future_value, 2),
            "surplus_or_shortfall": round(total_future_value - goal.target_amount, 2),
            "probability_of_success": round(probability, 1),
            "months_to_reach_goal": round(months_needed, 0),
            "status": status,
            "recommendations": self._generate_goal_recommendations(
                goal, total_future_value, monthly_contribution
            )
        }
    
    async def calculate_retirement_projection(
        self,
        user_id: str,
        retirement_age: int,
        expected_return: float,
        inflation_rate: float
    ) -> Optional[RetirementProjection]:
        """Calculate retirement projection"""
        # Get user's profile
        result = await self.db.execute(
            select(FinancialProfile)
            .where(FinancialProfile.user_id == user_id)
            .options(selectinload(FinancialProfile.goals))
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            return None
        
        # Get retirement goals
        retirement_goals = [g for g in profile.goals if g.category == "retirement"]
        
        # Calculate current age (simplified - would need birthdate)
        current_age = 35  # Default, should come from user profile
        
        # Sum up retirement savings
        current_retirement_savings = sum(g.current_amount for g in retirement_goals)
        monthly_retirement_contribution = sum(g.monthly_contribution for g in retirement_goals)
        
        # Add employer match (simplified)
        employer_match = min(profile.annual_income * 0.03 / 12, monthly_retirement_contribution * 0.5)
        
        # Create retirement inputs
        inputs = RetirementInputs(
            current_age=current_age,
            retirement_age=retirement_age,
            current_savings=current_retirement_savings + profile.retirement_accounts,
            monthly_contribution=monthly_retirement_contribution,
            employer_match_percent=0.5 if employer_match > 0 else 0,
            employer_match_limit=profile.annual_income * 0.03,
            current_income=profile.annual_income,
            expected_return_rate=expected_return,
            inflation_rate=inflation_rate,
            social_security_benefit=min(3000, profile.annual_income * 0.015),  # Rough estimate
        )
        
        # Calculate projection
        projection_data = self.retirement_calc.calculate_retirement_projection(inputs)
        
        # Convert to response schema
        return RetirementProjection(
            current_age=current_age,
            retirement_age=retirement_age,
            current_savings=inputs.current_savings,
            monthly_contribution=monthly_retirement_contribution,
            expected_return_rate=expected_return,
            projected_value=projection_data.get("projected_savings_at_retirement", 0),
            retirement_income_monthly=projection_data.get("monthly_retirement_income", 0),
            success_probability=projection_data.get("success_probability", 0),
            gap_analysis=projection_data.get("gap_or_surplus"),
            recommendations=projection_data.get("recommendations", [])
        )
    
    async def optimize_goal_allocation(self, user_id: str) -> Optional[Dict]:
        """Optimize allocation across multiple goals"""
        goals = await self.get_user_goals(user_id)
        
        if not goals:
            return None
        
        # Get user's profile for available resources
        result = await self.db.execute(
            select(FinancialProfile).where(FinancialProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            return None
        
        # Calculate available monthly savings
        available_monthly = profile.monthly_income - profile.monthly_expenses
        
        # Priority weights
        priority_weights = {
            "critical": 4,
            "high": 3,
            "medium": 2,
            "low": 1
        }
        
        # Calculate optimal allocation
        total_weight = sum(priority_weights.get(g.priority, 2) for g in goals)
        
        allocations = []
        for goal in goals:
            weight = priority_weights.get(goal.priority, 2)
            allocation = (weight / total_weight) * available_monthly
            
            allocations.append({
                "goal_id": goal.id,
                "goal_name": goal.name,
                "priority": goal.priority,
                "current_contribution": goal.monthly_contribution,
                "recommended_contribution": round(allocation, 2),
                "change": round(allocation - goal.monthly_contribution, 2)
            })
        
        return {
            "available_monthly_savings": available_monthly,
            "current_total_contributions": sum(g.monthly_contribution for g in goals),
            "allocations": allocations,
            "optimization_summary": {
                "total_goals": len(goals),
                "critical_goals": len([g for g in goals if g.priority == "critical"]),
                "fully_funded_goals": len([g for g in goals if g.progress_percentage >= 100]),
                "at_risk_goals": len([g for g in goals if g.progress_percentage < 25])
            }
        }
    
    async def get_ai_recommendations(self, user_id: str) -> Optional[List[str]]:
        """Get AI-powered goal recommendations"""
        goals = await self.get_user_goals(user_id)
        
        if not goals:
            return ["Start by setting your first financial goal - consider an emergency fund"]
        
        recommendations = []
        
        # Check for emergency fund
        has_emergency = any(g.category == "emergency" for g in goals)
        if not has_emergency:
            recommendations.append("🚨 Priority: Establish an emergency fund with 3-6 months of expenses")
        
        # Check for retirement savings
        has_retirement = any(g.category == "retirement" for g in goals)
        if not has_retirement:
            recommendations.append("🏖️ Start retirement savings now - time is your biggest asset")
        
        # Check goal diversity
        categories = set(g.category for g in goals)
        if len(categories) < 3:
            recommendations.append("📊 Diversify your goals across different life areas")
        
        # Check for unrealistic goals
        for goal in goals:
            months_to_goal = max(1, (goal.target_date - datetime.utcnow()).days / 30)
            required_monthly = (goal.target_amount - goal.current_amount) / months_to_goal
            
            if required_monthly > goal.monthly_contribution * 3:
                recommendations.append(
                    f"⚠️ '{goal.name}' may need timeline adjustment or increased contributions"
                )
        
        # Add positive reinforcement
        if len([g for g in goals if g.progress_percentage > 50]) > 0:
            recommendations.append("🌟 Great progress on your goals! Stay consistent")
        
        return recommendations[:5]
    
    def _generate_goal_recommendations(
        self,
        goal: FinancialGoal,
        projected_value: float,
        monthly_contribution: float
    ) -> List[str]:
        """Generate recommendations for a specific goal"""
        recommendations = []
        
        if projected_value < goal.target_amount:
            shortfall = goal.target_amount - projected_value
            recommendations.append(f"Increase monthly contribution by ${shortfall/12:.0f} to reach goal")
            recommendations.append("Consider extending the timeline by 6-12 months")
            recommendations.append("Look for ways to reduce expenses and redirect to this goal")
        else:
            surplus = projected_value - goal.target_amount
            recommendations.append(f"On track with ${surplus:.0f} projected surplus!")
            recommendations.append("Consider increasing target or redirecting funds to other goals")
        
        if goal.priority != "critical" and goal.progress_percentage < 25:
            recommendations.append("Consider increasing priority to ensure funding")
        
        return recommendations[:3]