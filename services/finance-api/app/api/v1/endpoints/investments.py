"""
Investment Management API Endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.investment_service import InvestmentService
from app.schemas.financial import (
    InvestmentAnalysis,
    PortfolioAllocation,
    InvestmentRecommendation
)

router = APIRouter()

@router.get("/analysis", response_model=InvestmentAnalysis)
async def get_investment_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive investment analysis"""
    service = InvestmentService(db)
    analysis = await service.analyze_investments(current_user["id"])
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No investment data found"
        )
    
    return analysis

@router.get("/portfolio/allocation", response_model=List[PortfolioAllocation])
async def get_portfolio_allocation(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current portfolio allocation vs target"""
    service = InvestmentService(db)
    allocation = await service.get_portfolio_allocation(current_user["id"])
    
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio data not found"
        )
    
    return allocation

@router.post("/portfolio/rebalance")
async def rebalance_portfolio(
    dry_run: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Calculate portfolio rebalancing recommendations"""
    service = InvestmentService(db)
    rebalance_plan = await service.calculate_rebalancing(
        current_user["id"],
        dry_run=dry_run
    )
    
    if not rebalance_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to calculate rebalancing"
        )
    
    return rebalance_plan

@router.get("/recommendations", response_model=List[InvestmentRecommendation])
async def get_investment_recommendations(
    risk_level: str = None,
    investment_amount: float = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get personalized investment recommendations"""
    service = InvestmentService(db)
    recommendations = await service.get_recommendations(
        current_user["id"],
        risk_level=risk_level,
        amount=investment_amount
    )
    
    return recommendations

@router.post("/simulate/returns")
async def simulate_investment_returns(
    initial_investment: float,
    monthly_contribution: float,
    years: int,
    expected_return: float = 0.07,
    variance: float = 0.15,
    num_simulations: int = 1000,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Run Monte Carlo simulation for investment returns"""
    service = InvestmentService(db)
    simulation = await service.monte_carlo_simulation(
        initial_investment=initial_investment,
        monthly_contribution=monthly_contribution,
        years=years,
        expected_return=expected_return,
        variance=variance,
        num_simulations=num_simulations
    )
    
    return simulation

@router.get("/market/analysis")
async def get_market_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current market analysis and trends"""
    service = InvestmentService(db)
    analysis = await service.get_market_analysis()
    
    return analysis

@router.post("/watchlist/add")
async def add_to_watchlist(
    ticker: str,
    notes: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add a stock/ETF to investment watchlist"""
    service = InvestmentService(db)
    result = await service.add_to_watchlist(
        current_user["id"],
        ticker=ticker,
        notes=notes
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to add to watchlist"
        )
    
    return {"message": f"{ticker} added to watchlist", "data": result}

@router.get("/tax/optimization")
async def get_tax_optimization_strategies(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get tax optimization strategies for investments"""
    service = InvestmentService(db)
    strategies = await service.get_tax_optimization_strategies(current_user["id"])
    
    if not strategies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to generate tax strategies"
        )
    
    return strategies

@router.get("/risk/assessment")
async def assess_portfolio_risk(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Assess current portfolio risk metrics"""
    service = InvestmentService(db)
    risk_metrics = await service.assess_portfolio_risk(current_user["id"])
    
    if not risk_metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to assess portfolio risk"
        )
    
    return risk_metrics