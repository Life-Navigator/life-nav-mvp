"""
Investment Service Layer
Portfolio management, analysis, and optimization
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.investment import Portfolio, Investment, AssetAllocation, AssetClass
from app.models.financial_profile import FinancialProfile
from app.schemas.investment import (
    PortfolioPerformance,
    AssetAllocationItem,
    RebalanceRecommendation,
    MonteCarloResult,
    RiskMetrics
)
from app.services.market_data import MarketDataService

class InvestmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.market_service = MarketDataService()
    
    async def calculate_portfolio_performance(
        self,
        portfolio_id: str,
        period: str = "1Y"
    ) -> PortfolioPerformance:
        """Calculate comprehensive portfolio performance metrics"""
        
        # Get portfolio and investments
        result = await self.db.execute(
            select(Portfolio).where(Portfolio.id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        
        if not portfolio:
            return None
        
        # Get all investments
        result = await self.db.execute(
            select(Investment).where(Investment.portfolio_id == portfolio_id)
        )
        investments = result.scalars().all()
        
        # Calculate totals
        total_value = sum(inv.current_value or (inv.quantity * inv.purchase_price) for inv in investments)
        total_cost_basis = sum(inv.quantity * inv.purchase_price + inv.fees_paid for inv in investments)
        total_return = total_value - total_cost_basis
        total_return_pct = (total_return / total_cost_basis * 100) if total_cost_basis > 0 else 0
        
        # Calculate period returns (simplified - would need historical data for accuracy)
        period_returns = {
            "1D": 0.5,  # Placeholder
            "1W": 1.2,
            "1M": 3.5,
            "3M": 8.2,
            "6M": 12.5,
            "YTD": 15.3,
            "1Y": 18.7,
            "3Y": 45.2,
            "5Y": 78.5
        }
        
        # Calculate risk metrics
        returns_data = self._generate_sample_returns(total_return_pct)
        sharpe_ratio = self._calculate_sharpe_ratio(returns_data)
        std_dev = np.std(returns_data)
        max_drawdown = self._calculate_max_drawdown(returns_data)
        
        return PortfolioPerformance(
            portfolio_id=str(portfolio_id),
            portfolio_name=portfolio.name,
            total_value=total_value,
            total_cost_basis=total_cost_basis,
            total_return=total_return,
            total_return_percentage=total_return_pct,
            yearly_return=period_returns.get(period, 0),
            ytd_return=period_returns.get("YTD", 0),
            sharpe_ratio=sharpe_ratio,
            standard_deviation=std_dev,
            max_drawdown=max_drawdown
        )
    
    async def get_asset_allocation(self, portfolio_id: str) -> Dict[str, Any]:
        """Get current asset allocation breakdown"""
        
        # Get all investments
        result = await self.db.execute(
            select(Investment).where(Investment.portfolio_id == portfolio_id)
        )
        investments = result.scalars().all()
        
        if not investments:
            return {"allocation": [], "total_value": 0}
        
        # Calculate allocation by asset class
        allocation = {}
        total_value = 0
        
        for inv in investments:
            value = inv.current_value or (inv.quantity * inv.purchase_price)
            total_value += value
            
            if inv.asset_class not in allocation:
                allocation[inv.asset_class] = 0
            allocation[inv.asset_class] += value
        
        # Convert to percentage
        allocation_items = []
        for asset_class, value in allocation.items():
            percentage = (value / total_value * 100) if total_value > 0 else 0
            allocation_items.append(AssetAllocationItem(
                asset_class=asset_class.value if hasattr(asset_class, 'value') else str(asset_class),
                current_value=value,
                current_percentage=round(percentage, 2)
            ))
        
        # Sort by percentage
        allocation_items.sort(key=lambda x: x.current_percentage, reverse=True)
        
        return {
            "allocation": allocation_items,
            "total_value": total_value,
            "asset_count": len(investments)
        }
    
    async def calculate_rebalance_recommendations(
        self,
        portfolio_id: str,
        target_allocation: Dict[str, float]
    ) -> RebalanceRecommendation:
        """Calculate portfolio rebalancing recommendations"""
        
        # Get current allocation
        current_alloc_data = await self.get_asset_allocation(portfolio_id)
        current_allocation = current_alloc_data["allocation"]
        total_value = current_alloc_data["total_value"]
        
        # Get portfolio info
        result = await self.db.execute(
            select(Portfolio).where(Portfolio.id == portfolio_id)
        )
        portfolio = result.scalar_one_or_none()
        
        # Build target allocation items
        target_items = []
        recommendations = []
        total_trades = 0
        estimated_cost = 0
        
        for asset_class, target_pct in target_allocation.items():
            target_value = total_value * (target_pct / 100)
            
            # Find current allocation for this asset class
            current_item = next(
                (item for item in current_allocation if item.asset_class == asset_class),
                None
            )
            
            current_value = current_item.current_value if current_item else 0
            current_pct = current_item.current_percentage if current_item else 0
            
            difference = target_pct - current_pct
            rebalance_amount = target_value - current_value
            
            target_items.append(AssetAllocationItem(
                asset_class=asset_class,
                current_value=target_value,
                current_percentage=target_pct,
                target_percentage=target_pct,
                difference=difference,
                rebalance_amount=rebalance_amount
            ))
            
            # Generate recommendations
            if abs(rebalance_amount) > 100:  # Threshold for action
                action = "Buy" if rebalance_amount > 0 else "Sell"
                recommendations.append({
                    "action": action,
                    "asset_class": asset_class,
                    "amount": abs(rebalance_amount),
                    "current_percentage": current_pct,
                    "target_percentage": target_pct,
                    "reason": f"{action} ${abs(rebalance_amount):.2f} to reach target allocation"
                })
                total_trades += 1
                estimated_cost += abs(rebalance_amount) * 0.001  # Assume 0.1% trading cost
        
        # Determine rebalance urgency
        max_deviation = max(abs(item.difference) for item in target_items if item.difference)
        if max_deviation > 10:
            urgency = "high"
        elif max_deviation > 5:
            urgency = "medium"
        else:
            urgency = "low"
        
        return RebalanceRecommendation(
            portfolio_id=str(portfolio_id),
            portfolio_name=portfolio.name if portfolio else "Portfolio",
            current_allocation=current_allocation,
            target_allocation=target_items,
            recommendations=recommendations,
            total_trades_needed=total_trades,
            estimated_cost=estimated_cost,
            rebalance_urgency=urgency
        )
    
    async def monte_carlo_simulation(
        self,
        initial_investment: float,
        monthly_contribution: float,
        years: int,
        expected_return: float = 0.07,
        variance: float = 0.15,
        num_simulations: int = 1000
    ) -> MonteCarloResult:
        """Run Monte Carlo simulation for investment returns"""
        
        months = years * 12
        monthly_return = expected_return / 12
        monthly_variance = variance / np.sqrt(12)
        
        # Run simulations
        final_values = []
        
        for _ in range(num_simulations):
            value = initial_investment
            for month in range(months):
                # Add monthly contribution
                value += monthly_contribution
                # Apply random return
                month_return = np.random.normal(monthly_return, monthly_variance)
                value *= (1 + month_return)
            final_values.append(value)
        
        # Calculate percentiles
        percentiles = np.percentile(final_values, [10, 25, 50, 75, 90])
        
        # Calculate probability of success (beating inflation + target)
        target_value = initial_investment * (1.03 ** years)  # 3% inflation
        probability_success = sum(1 for v in final_values if v > target_value) / num_simulations
        
        return MonteCarloResult(
            simulation_count=num_simulations,
            time_horizon_years=years,
            initial_investment=initial_investment,
            monthly_contribution=monthly_contribution,
            expected_return=expected_return,
            volatility=variance,
            percentile_10=percentiles[0],
            percentile_25=percentiles[1],
            percentile_50=percentiles[2],
            percentile_75=percentiles[3],
            percentile_90=percentiles[4],
            probability_of_success=probability_success,
            worst_case=min(final_values),
            best_case=max(final_values),
            expected_value=np.mean(final_values)
        )
    
    async def calculate_risk_return_metrics(self, portfolio_id: str) -> Dict[str, Any]:
        """Calculate risk-return metrics for portfolio"""
        
        performance = await self.calculate_portfolio_performance(portfolio_id)
        
        if not performance:
            return {}
        
        # Generate sample returns for calculations
        returns = self._generate_sample_returns(performance.total_return_percentage)
        
        # Calculate metrics
        risk_free_rate = 0.04  # 4% risk-free rate
        excess_returns = returns - risk_free_rate/252  # Daily excess returns
        
        sharpe = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)
        sortino = np.mean(excess_returns) / np.std(excess_returns[excess_returns < 0]) * np.sqrt(252)
        
        # Value at Risk (95% confidence)
        var_95 = np.percentile(returns, 5)
        cvar = np.mean(returns[returns <= var_95])
        
        return {
            "expected_return": float(np.mean(returns) * 252),
            "volatility": float(np.std(returns) * np.sqrt(252)),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "value_at_risk_95": float(var_95),
            "conditional_value_at_risk": float(cvar),
            "beta": 1.0,  # Would need market data
            "alpha": 0.02  # Would need regression analysis
        }
    
    async def calculate_efficient_frontier(self, profile_id: str) -> List[Dict[str, float]]:
        """Calculate efficient frontier points for portfolios"""
        
        # Simplified efficient frontier calculation
        # In production, would use actual portfolio data and optimization
        
        frontier_points = []
        risk_levels = np.linspace(0.05, 0.30, 20)
        
        for risk in risk_levels:
            # Simplified: assume linear relationship between risk and return
            expected_return = 0.04 + (risk * 0.3)  # Risk premium
            
            frontier_points.append({
                "risk": float(risk),
                "return": float(expected_return),
                "sharpe_ratio": float((expected_return - 0.04) / risk)
            })
        
        return frontier_points
    
    async def calculate_correlations(self, portfolio_id: str) -> Dict[str, Any]:
        """Calculate correlation matrix between holdings"""
        
        # Get investments
        result = await self.db.execute(
            select(Investment).where(
                and_(
                    Investment.portfolio_id == portfolio_id,
                    Investment.symbol.isnot(None)
                )
            )
        )
        investments = result.scalars().all()
        
        if len(investments) < 2:
            return {"message": "Need at least 2 holdings with symbols for correlation analysis"}
        
        # In production, would fetch historical price data and calculate actual correlations
        # For now, return sample correlation matrix
        symbols = [inv.symbol for inv in investments[:5]]  # Limit to 5 for display
        
        # Generate sample correlation matrix
        n = len(symbols)
        corr_matrix = np.random.randn(n, n)
        corr_matrix = (corr_matrix + corr_matrix.T) / 2  # Make symmetric
        np.fill_diagonal(corr_matrix, 1)  # Diagonal = 1
        
        # Convert to valid correlation matrix
        eigenvalues, eigenvectors = np.linalg.eig(corr_matrix)
        eigenvalues = np.maximum(eigenvalues, 0.01)  # Ensure positive definite
        corr_matrix = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T
        
        # Normalize to [-1, 1]
        d = np.diag(1 / np.sqrt(np.diag(corr_matrix)))
        corr_matrix = d @ corr_matrix @ d
        
        return {
            "symbols": symbols,
            "correlation_matrix": corr_matrix.tolist(),
            "highly_correlated_pairs": self._find_high_correlations(symbols, corr_matrix),
            "diversification_score": self._calculate_diversification_score(corr_matrix)
        }
    
    def _generate_sample_returns(self, annual_return: float, days: int = 252) -> np.ndarray:
        """Generate sample daily returns for calculations"""
        daily_return = annual_return / 100 / 252
        daily_vol = 0.02  # 2% daily volatility
        returns = np.random.normal(daily_return, daily_vol, days)
        return returns
    
    def _calculate_sharpe_ratio(self, returns: np.ndarray, risk_free_rate: float = 0.04) -> float:
        """Calculate Sharpe ratio"""
        excess_returns = returns - risk_free_rate/252
        if np.std(excess_returns) == 0:
            return 0
        return np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)
    
    def _calculate_max_drawdown(self, returns: np.ndarray) -> float:
        """Calculate maximum drawdown"""
        cumulative = (1 + returns).cumprod()
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - running_max) / running_max
        return float(np.min(drawdown))
    
    def _find_high_correlations(self, symbols: List[str], corr_matrix: np.ndarray, threshold: float = 0.7) -> List[Dict]:
        """Find highly correlated pairs"""
        high_corr = []
        n = len(symbols)
        
        for i in range(n):
            for j in range(i+1, n):
                corr = corr_matrix[i, j]
                if abs(corr) > threshold:
                    high_corr.append({
                        "pair": f"{symbols[i]}-{symbols[j]}",
                        "correlation": float(corr),
                        "strength": "High" if abs(corr) > 0.8 else "Moderate"
                    })
        
        return high_corr
    
    def _calculate_diversification_score(self, corr_matrix: np.ndarray) -> float:
        """Calculate portfolio diversification score (0-100)"""
        # Lower average correlation = better diversification
        n = corr_matrix.shape[0]
        if n <= 1:
            return 0
        
        # Get upper triangle (excluding diagonal)
        upper_triangle = np.triu(corr_matrix, k=1)
        avg_correlation = np.sum(np.abs(upper_triangle)) / (n * (n-1) / 2)
        
        # Convert to score (lower correlation = higher score)
        score = (1 - avg_correlation) * 100
        return float(max(0, min(100, score)))