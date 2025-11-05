"""
Financial Goals API Endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.goal_planning import GoalPlanningService
from app.schemas.financial import (
    FinancialGoalCreate,
    FinancialGoalUpdate,
    FinancialGoalResponse,
    RetirementProjection
)

router = APIRouter()

@router.post("/", response_model=FinancialGoalResponse)
async def create_goal(
    goal_data: FinancialGoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new financial goal"""
    service = GoalPlanningService(db)
    goal = await service.create_goal(current_user["id"], goal_data)
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create goal. Profile may not exist."
        )
    
    return goal

@router.get("/", response_model=List[FinancialGoalResponse])
async def get_my_goals(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all financial goals for current user"""
    service = GoalPlanningService(db)
    goals = await service.get_user_goals(current_user["id"])
    return goals

@router.get("/{goal_id}", response_model=FinancialGoalResponse)
async def get_goal(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get a specific financial goal"""
    service = GoalPlanningService(db)
    goal = await service.get_goal(goal_id, current_user["id"])
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    return goal

@router.put("/{goal_id}", response_model=FinancialGoalResponse)
async def update_goal(
    goal_id: str,
    goal_update: FinancialGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update a financial goal"""
    service = GoalPlanningService(db)
    goal = await service.update_goal(goal_id, current_user["id"], goal_update)
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    return goal

@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a financial goal"""
    service = GoalPlanningService(db)
    success = await service.delete_goal(goal_id, current_user["id"])
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    return {"message": "Goal deleted successfully"}

@router.post("/{goal_id}/simulate")
async def simulate_goal_achievement(
    goal_id: str,
    monthly_contribution: float,
    expected_return: float = 0.07,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Simulate goal achievement with different parameters"""
    service = GoalPlanningService(db)
    simulation = await service.simulate_goal(
        goal_id, 
        current_user["id"],
        monthly_contribution,
        expected_return
    )
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    return simulation

@router.get("/retirement/projection", response_model=RetirementProjection)
async def get_retirement_projection(
    retirement_age: int = 65,
    expected_return: float = 0.07,
    inflation_rate: float = 0.03,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get retirement projection based on current profile and goals"""
    service = GoalPlanningService(db)
    projection = await service.calculate_retirement_projection(
        current_user["id"],
        retirement_age,
        expected_return,
        inflation_rate
    )
    
    if not projection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to calculate projection. Profile may not exist."
        )
    
    return projection

@router.post("/optimize")
async def optimize_goals(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Optimize goal allocation based on priority and available resources"""
    service = GoalPlanningService(db)
    optimization = await service.optimize_goal_allocation(current_user["id"])
    
    if not optimization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to optimize goals. Profile may not exist."
        )
    
    return optimization

@router.get("/recommendations/ai")
async def get_ai_goal_recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get AI-powered goal recommendations based on profile"""
    service = GoalPlanningService(db)
    recommendations = await service.get_ai_recommendations(current_user["id"])
    
    if not recommendations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to generate recommendations. Profile may not exist."
        )
    
    return recommendations