"""
Financial Profile API Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.financial_profile import FinancialProfileService
from app.schemas.financial import (
    FinancialProfileCreate,
    FinancialProfileUpdate,
    FinancialProfileResponse,
    FinancialHealthScore,
    CashFlowAnalysis
)

router = APIRouter()

@router.post("/", response_model=FinancialProfileResponse)
async def create_profile(
    profile_data: FinancialProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new financial profile for the user"""
    service = FinancialProfileService(db)
    
    # Check if profile already exists
    existing = await service.get_by_user_id(profile_data.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Financial profile already exists for this user"
        )
    
    profile = await service.create_profile(profile_data)
    return profile

@router.get("/me", response_model=FinancialProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current user's financial profile"""
    service = FinancialProfileService(db)
    profile = await service.get_by_user_id(current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found"
        )
    
    return profile

@router.put("/me", response_model=FinancialProfileResponse)
async def update_my_profile(
    profile_update: FinancialProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update current user's financial profile"""
    service = FinancialProfileService(db)
    profile = await service.update_profile(current_user["id"], profile_update)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found"
        )
    
    return profile

@router.get("/me/health-score", response_model=FinancialHealthScore)
async def get_health_score(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Calculate and return financial health score"""
    service = FinancialProfileService(db)
    score = await service.calculate_health_score(current_user["id"])
    
    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to calculate health score. Profile may not exist."
        )
    
    return score

@router.get("/me/cash-flow", response_model=CashFlowAnalysis)
async def get_cash_flow_analysis(
    period: str = "monthly",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get cash flow analysis for specified period"""
    service = FinancialProfileService(db)
    analysis = await service.analyze_cash_flow(current_user["id"], period)
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to analyze cash flow. Profile may not exist."
        )
    
    return analysis

@router.post("/me/calculate-metrics")
async def calculate_financial_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Recalculate all financial metrics for the profile"""
    service = FinancialProfileService(db)
    metrics = await service.recalculate_metrics(current_user["id"])
    
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to calculate metrics. Profile may not exist."
        )
    
    return {
        "message": "Financial metrics recalculated successfully",
        "metrics": metrics
    }

@router.delete("/me")
async def delete_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete current user's financial profile and all related data"""
    service = FinancialProfileService(db)
    success = await service.delete_profile(current_user["id"])
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found"
        )
    
    return {"message": "Financial profile deleted successfully"}