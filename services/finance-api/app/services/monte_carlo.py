"""
Monte Carlo Simulation Engine
For investment projections and risk analysis
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import scipy.stats as stats
from datetime import datetime, timedelta

@dataclass
class SimulationParameters:
    initial_investment: float
    monthly_contribution: float
    years: int
    expected_return: float  # Annual expected return
    volatility: float  # Annual volatility (standard deviation)
    inflation_rate: float = 0.03
    rebalance_frequency: str = "quarterly"  # monthly, quarterly, annual
    tax_rate: float = 0  # Capital gains tax rate
    expense_ratio: float = 0.001  # Fund expense ratio

@dataclass
class PortfolioAllocation:
    stocks: float  # Percentage in stocks (0-1)
    bonds: float  # Percentage in bonds (0-1)
    real_estate: float = 0  # Percentage in REITs
    commodities: float = 0  # Percentage in commodities
    cash: float = 0  # Percentage in cash
    
    def __post_init__(self):
        total = self.stocks + self.bonds + self.real_estate + self.commodities + self.cash
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Portfolio allocation must sum to 100% (got {total*100:.1f}%)")

class MonteCarloEngine:
    
    # Historical asset class parameters (annual)
    ASSET_PARAMETERS = {
        'stocks': {'return': 0.10, 'volatility': 0.18, 'correlation': 1.0},
        'bonds': {'return': 0.05, 'volatility': 0.05, 'correlation': -0.1},
        'real_estate': {'return': 0.08, 'volatility': 0.15, 'correlation': 0.6},
        'commodities': {'return': 0.06, 'volatility': 0.20, 'correlation': 0.3},
        'cash': {'return': 0.02, 'volatility': 0.01, 'correlation': 0.0}
    }
    
    def run_simulation(
        self,
        params: SimulationParameters,
        num_simulations: int = 10000,
        portfolio: Optional[PortfolioAllocation] = None
    ) -> Dict:
        """
        Run Monte Carlo simulation for investment returns
        """
        if portfolio is None:
            # Default 60/40 portfolio
            portfolio = PortfolioAllocation(stocks=0.6, bonds=0.4)
        
        # Calculate portfolio parameters
        portfolio_return, portfolio_volatility = self._calculate_portfolio_parameters(portfolio)
        
        # Adjust parameters if custom values provided
        if params.expected_return:
            portfolio_return = params.expected_return
        if params.volatility:
            portfolio_volatility = params.volatility
        
        # Run simulations
        final_values = []
        yearly_values = []
        
        for _ in range(num_simulations):
            path = self._simulate_single_path(
                params.initial_investment,
                params.monthly_contribution,
                params.years,
                portfolio_return,
                portfolio_volatility,
                params.inflation_rate,
                params.expense_ratio
            )
            final_values.append(path[-1])
            yearly_values.append(path)
        
        # Calculate statistics
        final_values = np.array(final_values)
        percentiles = np.percentile(final_values, [10, 25, 50, 75, 90, 95])
        
        # Calculate probability of reaching various targets
        total_contributions = params.initial_investment + (params.monthly_contribution * 12 * params.years)
        prob_double = np.mean(final_values >= total_contributions * 2) * 100
        prob_triple = np.mean(final_values >= total_contributions * 3) * 100
        prob_loss = np.mean(final_values < total_contributions) * 100
        
        # Calculate value at risk (VaR) and conditional value at risk (CVaR)
        var_95 = np.percentile(final_values, 5)
        cvar_95 = np.mean(final_values[final_values <= var_95])
        
        # Best and worst case scenarios
        best_case_idx = np.argmax(final_values)
        worst_case_idx = np.argmin(final_values)
        
        return {
            "summary": {
                "initial_investment": params.initial_investment,
                "total_contributions": total_contributions,
                "years": params.years,
                "expected_return": f"{portfolio_return:.1%}",
                "volatility": f"{portfolio_volatility:.1%}",
                "simulations_run": num_simulations
            },
            "final_values": {
                "mean": float(np.mean(final_values)),
                "median": float(percentiles[2]),
                "std_dev": float(np.std(final_values)),
                "min": float(np.min(final_values)),
                "max": float(np.max(final_values))
            },
            "percentiles": {
                "p10": float(percentiles[0]),
                "p25": float(percentiles[1]),
                "p50": float(percentiles[2]),
                "p75": float(percentiles[3]),
                "p90": float(percentiles[4]),
                "p95": float(percentiles[5])
            },
            "probabilities": {
                "double_money": prob_double,
                "triple_money": prob_triple,
                "loss": prob_loss,
                "beat_inflation": np.mean(final_values > total_contributions * (1 + params.inflation_rate) ** params.years) * 100
            },
            "risk_metrics": {
                "value_at_risk_95": var_95,
                "conditional_var_95": cvar_95,
                "sharpe_ratio": (portfolio_return - 0.02) / portfolio_volatility,  # Risk-free rate ~2%
                "max_drawdown": self._calculate_max_drawdown(yearly_values)
            },
            "scenarios": {
                "best_case": {
                    "value": float(final_values[best_case_idx]),
                    "annual_return": ((final_values[best_case_idx] / total_contributions) ** (1/params.years) - 1) * 100,
                    "path": [float(v) for v in yearly_values[best_case_idx]]
                },
                "worst_case": {
                    "value": float(final_values[worst_case_idx]),
                    "annual_return": ((final_values[worst_case_idx] / total_contributions) ** (1/params.years) - 1) * 100,
                    "path": [float(v) for v in yearly_values[worst_case_idx]]
                },
                "median_case": {
                    "value": float(percentiles[2]),
                    "annual_return": ((percentiles[2] / total_contributions) ** (1/params.years) - 1) * 100
                }
            },
            "confidence_intervals": {
                "ci_80": [float(percentiles[0]), float(percentiles[4])],
                "ci_90": [float(np.percentile(final_values, 5)), float(percentiles[5])],
                "ci_95": [float(np.percentile(final_values, 2.5)), float(np.percentile(final_values, 97.5))]
            }
        }
    
    def _simulate_single_path(
        self,
        initial: float,
        monthly_contribution: float,
        years: int,
        annual_return: float,
        annual_volatility: float,
        inflation_rate: float,
        expense_ratio: float
    ) -> List[float]:
        """
        Simulate a single investment path using geometric Brownian motion
        """
        months = years * 12
        monthly_return = annual_return / 12
        monthly_volatility = annual_volatility / np.sqrt(12)
        monthly_expense = expense_ratio / 12
        
        balance = initial
        path = [balance]
        
        for month in range(months):
            # Generate random return using log-normal distribution
            random_return = np.random.normal(
                monthly_return - monthly_expense,
                monthly_volatility
            )
            
            # Apply return
            balance = balance * (1 + random_return)
            
            # Add contribution (adjusted for inflation)
            inflation_adjusted_contribution = monthly_contribution * ((1 + inflation_rate / 12) ** month)
            balance += inflation_adjusted_contribution
            
            # Record yearly values
            if (month + 1) % 12 == 0:
                path.append(balance)
        
        return path
    
    def _calculate_portfolio_parameters(
        self,
        portfolio: PortfolioAllocation
    ) -> Tuple[float, float]:
        """
        Calculate expected return and volatility for a portfolio
        """
        # Build weight vector
        weights = np.array([
            portfolio.stocks,
            portfolio.bonds,
            portfolio.real_estate,
            portfolio.commodities,
            portfolio.cash
        ])
        
        # Build return vector
        returns = np.array([
            self.ASSET_PARAMETERS['stocks']['return'],
            self.ASSET_PARAMETERS['bonds']['return'],
            self.ASSET_PARAMETERS['real_estate']['return'],
            self.ASSET_PARAMETERS['commodities']['return'],
            self.ASSET_PARAMETERS['cash']['return']
        ])
        
        # Build covariance matrix (simplified - using correlations)
        volatilities = np.array([
            self.ASSET_PARAMETERS['stocks']['volatility'],
            self.ASSET_PARAMETERS['bonds']['volatility'],
            self.ASSET_PARAMETERS['real_estate']['volatility'],
            self.ASSET_PARAMETERS['commodities']['volatility'],
            self.ASSET_PARAMETERS['cash']['volatility']
        ])
        
        # Simple correlation matrix (stocks vs others)
        corr_matrix = np.array([
            [1.0, -0.1, 0.6, 0.3, 0.0],  # Stocks
            [-0.1, 1.0, 0.2, 0.1, 0.1],   # Bonds
            [0.6, 0.2, 1.0, 0.4, 0.0],    # Real Estate
            [0.3, 0.1, 0.4, 1.0, 0.0],    # Commodities
            [0.0, 0.1, 0.0, 0.0, 1.0]     # Cash
        ])
        
        # Convert correlation to covariance
        cov_matrix = np.outer(volatilities, volatilities) * corr_matrix
        
        # Calculate portfolio return (weighted average)
        portfolio_return = np.dot(weights, returns)
        
        # Calculate portfolio volatility (considering correlations)
        portfolio_variance = np.dot(weights, np.dot(cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)
        
        return portfolio_return, portfolio_volatility
    
    def _calculate_max_drawdown(self, paths: List[List[float]]) -> float:
        """
        Calculate maximum drawdown across all simulation paths
        """
        max_drawdowns = []
        
        for path in paths:
            peak = path[0]
            max_dd = 0
            
            for value in path:
                if value > peak:
                    peak = value
                drawdown = (peak - value) / peak
                max_dd = max(max_dd, drawdown)
            
            max_drawdowns.append(max_dd)
        
        return float(np.mean(max_drawdowns)) * 100
    
    def optimize_portfolio(
        self,
        params: SimulationParameters,
        target_return: float,
        risk_tolerance: str = "moderate"
    ) -> Dict:
        """
        Optimize portfolio allocation based on risk tolerance and target return
        """
        # Define risk tolerance profiles
        risk_profiles = {
            "conservative": PortfolioAllocation(stocks=0.3, bonds=0.6, cash=0.1),
            "moderate": PortfolioAllocation(stocks=0.6, bonds=0.35, real_estate=0.05),
            "aggressive": PortfolioAllocation(stocks=0.8, bonds=0.15, real_estate=0.05),
            "very_aggressive": PortfolioAllocation(stocks=0.9, bonds=0.05, commodities=0.05)
        }
        
        portfolio = risk_profiles.get(risk_tolerance, risk_profiles["moderate"])
        
        # Run simulation with optimized portfolio
        results = self.run_simulation(params, num_simulations=5000, portfolio=portfolio)
        
        # Calculate probability of reaching target
        total_contributions = params.initial_investment + (params.monthly_contribution * 12 * params.years)
        target_value = total_contributions * (1 + target_return) ** params.years
        
        # Simulate to find optimal contribution
        if results["final_values"]["median"] < target_value:
            required_monthly = self._find_required_contribution(
                params,
                target_value,
                portfolio
            )
        else:
            required_monthly = params.monthly_contribution
        
        return {
            "recommended_portfolio": {
                "stocks": portfolio.stocks * 100,
                "bonds": portfolio.bonds * 100,
                "real_estate": portfolio.real_estate * 100,
                "commodities": portfolio.commodities * 100,
                "cash": portfolio.cash * 100
            },
            "expected_outcome": results["final_values"],
            "probability_of_target": results["probabilities"],
            "required_monthly_contribution": required_monthly,
            "risk_metrics": results["risk_metrics"]
        }
    
    def _find_required_contribution(
        self,
        params: SimulationParameters,
        target_value: float,
        portfolio: PortfolioAllocation,
        tolerance: float = 100
    ) -> float:
        """
        Binary search to find required monthly contribution
        """
        low = 0
        high = target_value / (params.years * 12)
        
        while high - low > tolerance:
            mid = (low + high) / 2
            test_params = SimulationParameters(
                initial_investment=params.initial_investment,
                monthly_contribution=mid,
                years=params.years,
                expected_return=params.expected_return,
                volatility=params.volatility
            )
            
            results = self.run_simulation(test_params, num_simulations=1000, portfolio=portfolio)
            
            if results["final_values"]["median"] < target_value:
                low = mid
            else:
                high = mid
        
        return (low + high) / 2