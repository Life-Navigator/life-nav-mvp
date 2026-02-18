"""
Multi-Asset Return Model
===========================================================================
Generates regime-adjusted returns for multiple asset classes.

Asset Classes:
- Equities (domestic, international, emerging markets)
- Bonds (government, corporate, high-yield)
- Cash / Money Market
- Commodities (gold, oil, broad)
- Crypto (BTC, ETH)
- FX (major pairs)

Features:
- Regime-aware expected returns and volatilities
- Correlation matrix with regime adjustments
- Correlation shocks in crisis regimes
- Deterministic seeding for Monte Carlo
- Support for custom asset mixes

Returns distribution:
- Log-normal distribution per asset
- Correlated via Cholesky decomposition
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from .regime import MarketRegime, get_regime_expected_return_multiplier, get_regime_volatility_multiplier, get_regime_correlation_adjustment


# ===========================================================================
# Asset Class Definitions
# ===========================================================================

class AssetClass(str, Enum):
    """Supported asset classes."""
    # Equities
    US_EQUITY = "us_equity"
    INTL_EQUITY = "intl_equity"
    EM_EQUITY = "em_equity"

    # Fixed Income
    US_TREASURY = "us_treasury"
    CORPORATE_BONDS = "corporate_bonds"
    HIGH_YIELD = "high_yield"

    # Alternatives
    CASH = "cash"
    COMMODITIES = "commodities"
    GOLD = "gold"
    CRYPTO = "crypto"

    # FX (if applicable)
    FX_MAJOR = "fx_major"


# ===========================================================================
# Baseline Assumptions
# ===========================================================================

class AssetAssumptions(BaseModel):
    """Baseline return/volatility assumptions for one asset class."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    asset_class: AssetClass
    baseline_expected_return: float = Field(..., ge=-0.5, le=1.0)  # Annualized
    baseline_volatility: float = Field(..., ge=0.0, le=2.0)  # Annualized
    expense_ratio: float = Field(0.0, ge=0.0, le=0.05)  # Annual fee


# Default assumptions (2026-Q1)
DEFAULT_ASSET_ASSUMPTIONS = {
    AssetClass.US_EQUITY: AssetAssumptions(
        asset_class=AssetClass.US_EQUITY,
        baseline_expected_return=0.08,
        baseline_volatility=0.18,
        expense_ratio=0.003,
    ),
    AssetClass.INTL_EQUITY: AssetAssumptions(
        asset_class=AssetClass.INTL_EQUITY,
        baseline_expected_return=0.075,
        baseline_volatility=0.20,
        expense_ratio=0.005,
    ),
    AssetClass.EM_EQUITY: AssetAssumptions(
        asset_class=AssetClass.EM_EQUITY,
        baseline_expected_return=0.09,
        baseline_volatility=0.28,
        expense_ratio=0.008,
    ),
    AssetClass.US_TREASURY: AssetAssumptions(
        asset_class=AssetClass.US_TREASURY,
        baseline_expected_return=0.035,
        baseline_volatility=0.06,
        expense_ratio=0.001,
    ),
    AssetClass.CORPORATE_BONDS: AssetAssumptions(
        asset_class=AssetClass.CORPORATE_BONDS,
        baseline_expected_return=0.045,
        baseline_volatility=0.08,
        expense_ratio=0.002,
    ),
    AssetClass.HIGH_YIELD: AssetAssumptions(
        asset_class=AssetClass.HIGH_YIELD,
        baseline_expected_return=0.06,
        baseline_volatility=0.12,
        expense_ratio=0.004,
    ),
    AssetClass.CASH: AssetAssumptions(
        asset_class=AssetClass.CASH,
        baseline_expected_return=0.02,
        baseline_volatility=0.001,
        expense_ratio=0.0,
    ),
    AssetClass.COMMODITIES: AssetAssumptions(
        asset_class=AssetClass.COMMODITIES,
        baseline_expected_return=0.05,
        baseline_volatility=0.22,
        expense_ratio=0.005,
    ),
    AssetClass.GOLD: AssetAssumptions(
        asset_class=AssetClass.GOLD,
        baseline_expected_return=0.04,
        baseline_volatility=0.16,
        expense_ratio=0.004,
    ),
    AssetClass.CRYPTO: AssetAssumptions(
        asset_class=AssetClass.CRYPTO,
        baseline_expected_return=0.15,  # High expected return
        baseline_volatility=0.80,  # Very high volatility
        expense_ratio=0.01,
    ),
    AssetClass.FX_MAJOR: AssetAssumptions(
        asset_class=AssetClass.FX_MAJOR,
        baseline_expected_return=0.0,  # Zero expected return (hedging)
        baseline_volatility=0.10,
        expense_ratio=0.002,
    ),
}


# ===========================================================================
# Correlation Matrix
# ===========================================================================

class CorrelationMatrix:
    """
    Baseline correlation matrix for asset classes.

    Adjusted for market regime (crisis → higher correlations).
    """

    # Baseline correlations (normal market conditions)
    # Order: US_EQUITY, INTL_EQUITY, EM_EQUITY, US_TREASURY, CORPORATE_BONDS,
    #        HIGH_YIELD, CASH, COMMODITIES, GOLD, CRYPTO, FX_MAJOR
    BASELINE = np.array([
        # US_EQ  INTL   EM     TREAS  CORP   HY     CASH   COMM   GOLD   CRYP   FX
        [1.00,   0.85,  0.75,  -0.20, 0.40,  0.60,  0.05,  0.30,  0.10,  0.30,  0.15],  # US_EQUITY
        [0.85,   1.00,  0.80,  -0.15, 0.35,  0.55,  0.05,  0.35,  0.15,  0.25,  0.20],  # INTL_EQUITY
        [0.75,   0.80,  1.00,  -0.10, 0.30,  0.50,  0.05,  0.40,  0.20,  0.35,  0.25],  # EM_EQUITY
        [-0.20, -0.15, -0.10,  1.00,  0.50,  0.10,  0.30,  -0.10, 0.20,  -0.15, 0.05],  # US_TREASURY
        [0.40,   0.35,  0.30,  0.50,  1.00,  0.70,  0.10,  0.20,  0.15,  0.10,  0.10],  # CORPORATE_BONDS
        [0.60,   0.55,  0.50,  0.10,  0.70,  1.00,  0.05,  0.25,  0.10,  0.20,  0.15],  # HIGH_YIELD
        [0.05,   0.05,  0.05,  0.30,  0.10,  0.05,  1.00,  0.00,  0.05,  0.00,  0.00],  # CASH
        [0.30,   0.35,  0.40,  -0.10, 0.20,  0.25,  0.00,  1.00,  0.40,  0.20,  0.15],  # COMMODITIES
        [0.10,   0.15,  0.20,  0.20,  0.15,  0.10,  0.05,  0.40,  1.00,  0.15,  0.10],  # GOLD
        [0.30,   0.25,  0.35,  -0.15, 0.10,  0.20,  0.00,  0.20,  0.15,  1.00,  0.10],  # CRYPTO
        [0.15,   0.20,  0.25,  0.05,  0.10,  0.15,  0.00,  0.15,  0.10,  0.10,  1.00],  # FX_MAJOR
    ])

    ASSET_ORDER = [
        AssetClass.US_EQUITY,
        AssetClass.INTL_EQUITY,
        AssetClass.EM_EQUITY,
        AssetClass.US_TREASURY,
        AssetClass.CORPORATE_BONDS,
        AssetClass.HIGH_YIELD,
        AssetClass.CASH,
        AssetClass.COMMODITIES,
        AssetClass.GOLD,
        AssetClass.CRYPTO,
        AssetClass.FX_MAJOR,
    ]

    @classmethod
    def get_correlation_matrix(
        cls, regime: MarketRegime, asset_classes: Optional[List[AssetClass]] = None
    ) -> np.ndarray:
        """
        Get correlation matrix adjusted for market regime.

        Args:
            regime: Current market regime
            asset_classes: Subset of assets to include (optional)

        Returns:
            Correlation matrix (NxN numpy array)
        """
        # Start with baseline
        corr = cls.BASELINE.copy()

        # Apply regime adjustment
        adjustment = get_regime_correlation_adjustment(regime)

        if adjustment != 0.0:
            # Adjust off-diagonal elements
            # In crisis, correlations move toward 1.0
            # In calm markets, correlations move toward baseline
            for i in range(corr.shape[0]):
                for j in range(corr.shape[1]):
                    if i != j:
                        corr[i, j] += adjustment
                        # Clamp to [-1, 1]
                        corr[i, j] = np.clip(corr[i, j], -1.0, 1.0)

        # Ensure symmetry
        corr = (corr + corr.T) / 2
        np.fill_diagonal(corr, 1.0)

        # Subset if requested
        if asset_classes is not None:
            indices = [cls.ASSET_ORDER.index(ac) for ac in asset_classes]
            corr = corr[np.ix_(indices, indices)]

        return corr


# ===========================================================================
# Return Generation
# ===========================================================================

class ReturnGeneratorConfig(BaseModel):
    """Configuration for return generator."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Asset assumptions (can override defaults)
    asset_assumptions: Dict[AssetClass, AssetAssumptions] = Field(
        default_factory=lambda: DEFAULT_ASSET_ASSUMPTIONS.copy()
    )

    # Random seed for determinism (optional)
    random_seed: Optional[int] = None

    # Use log-normal distribution (vs normal)
    use_lognormal: bool = True


class ReturnGeneratorInput(BaseModel):
    """Input for return generation."""
    model_config = ConfigDict(extra='forbid')

    # Market regime
    regime: MarketRegime

    # Asset allocation (weights must sum to 1.0)
    asset_allocation: Dict[AssetClass, float] = Field(...)

    # Time horizon (years)
    time_horizon_years: float = Field(..., gt=0, le=100)

    # Number of time steps (for path generation)
    num_steps: int = Field(12, ge=1, le=1200)  # Default: monthly for 1 year

    # Number of scenarios (Monte Carlo paths)
    num_scenarios: int = Field(1000, ge=1, le=100000)


class ReturnScenario(BaseModel):
    """Single scenario of asset returns."""
    model_config = ConfigDict(extra='forbid')

    scenario_id: int
    # Returns for each asset over time (num_steps x num_assets)
    asset_returns: Dict[AssetClass, List[float]]
    # Portfolio return over time (num_steps)
    portfolio_returns: List[float]
    # Terminal portfolio value (starting from 1.0)
    terminal_value: float


class ReturnGeneratorOutput(BaseModel):
    """Output from return generator."""
    model_config = ConfigDict(extra='forbid')

    # All scenarios
    scenarios: List[ReturnScenario]

    # Summary statistics
    mean_return_annualized: float
    volatility_annualized: float
    median_terminal_value: float
    percentile_5_terminal_value: float  # VaR
    percentile_95_terminal_value: float

    # Metadata
    regime: MarketRegime
    num_scenarios: int
    time_horizon_years: float
    random_seed: Optional[int]
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Generator
# ===========================================================================

class ReturnGenerator:
    """
    Multi-asset return generator with regime adjustments.

    Generates correlated asset returns using:
    1. Regime-adjusted expected returns
    2. Regime-adjusted volatilities
    3. Regime-adjusted correlation matrix
    4. Cholesky decomposition for correlation
    5. Log-normal distribution (optional)
    """

    def __init__(self, config: ReturnGeneratorConfig = ReturnGeneratorConfig()):
        self.config = config
        self.assumptions = config.asset_assumptions

        # Set random seed if provided
        if config.random_seed is not None:
            np.random.seed(config.random_seed)

    def generate(self, input_data: ReturnGeneratorInput) -> ReturnGeneratorOutput:
        """
        Generate return scenarios for asset allocation.

        Args:
            input_data: Return generation parameters

        Returns:
            ReturnGeneratorOutput with scenarios and statistics
        """
        # Validate allocation
        self._validate_allocation(input_data.asset_allocation)

        # Get asset list
        asset_classes = list(input_data.asset_allocation.keys())

        # Get regime-adjusted parameters
        expected_returns = self._get_expected_returns(
            asset_classes, input_data.regime
        )
        volatilities = self._get_volatilities(asset_classes, input_data.regime)
        correlation_matrix = CorrelationMatrix.get_correlation_matrix(
            input_data.regime, asset_classes
        )

        # Generate scenarios
        scenarios = self._generate_scenarios(
            asset_classes,
            input_data.asset_allocation,
            expected_returns,
            volatilities,
            correlation_matrix,
            input_data.num_steps,
            input_data.num_scenarios,
            input_data.time_horizon_years,
        )

        # Calculate statistics
        terminal_values = [s.terminal_value for s in scenarios]
        portfolio_returns_annualized = [
            (s.terminal_value ** (1 / input_data.time_horizon_years) - 1)
            for s in scenarios
        ]

        mean_return = np.mean(portfolio_returns_annualized)
        volatility = np.std(portfolio_returns_annualized)
        median_terminal = np.median(terminal_values)
        percentile_5 = np.percentile(terminal_values, 5)
        percentile_95 = np.percentile(terminal_values, 95)

        return ReturnGeneratorOutput(
            scenarios=scenarios,
            mean_return_annualized=mean_return,
            volatility_annualized=volatility,
            median_terminal_value=median_terminal,
            percentile_5_terminal_value=percentile_5,
            percentile_95_terminal_value=percentile_95,
            regime=input_data.regime,
            num_scenarios=input_data.num_scenarios,
            time_horizon_years=input_data.time_horizon_years,
            random_seed=self.config.random_seed,
        )

    def _validate_allocation(self, allocation: Dict[AssetClass, float]):
        """Validate asset allocation sums to 1.0."""
        total = sum(allocation.values())
        if not (0.99 <= total <= 1.01):
            raise ValueError(
                f"Asset allocation must sum to 1.0, got {total:.4f}"
            )

    def _get_expected_returns(
        self, asset_classes: List[AssetClass], regime: MarketRegime
    ) -> np.ndarray:
        """Get regime-adjusted expected returns."""
        returns = []
        multiplier = get_regime_expected_return_multiplier(regime)

        for ac in asset_classes:
            assumptions = self.assumptions[ac]
            base_return = assumptions.baseline_expected_return
            expense = assumptions.expense_ratio
            # Apply regime multiplier and subtract expenses
            adjusted_return = (base_return * multiplier) - expense
            returns.append(adjusted_return)

        return np.array(returns)

    def _get_volatilities(
        self, asset_classes: List[AssetClass], regime: MarketRegime
    ) -> np.ndarray:
        """Get regime-adjusted volatilities."""
        vols = []
        multiplier = get_regime_volatility_multiplier(regime)

        for ac in asset_classes:
            assumptions = self.assumptions[ac]
            base_vol = assumptions.baseline_volatility
            adjusted_vol = base_vol * multiplier
            vols.append(adjusted_vol)

        return np.array(vols)

    def _generate_scenarios(
        self,
        asset_classes: List[AssetClass],
        allocation: Dict[AssetClass, float],
        expected_returns: np.ndarray,
        volatilities: np.ndarray,
        correlation_matrix: np.ndarray,
        num_steps: int,
        num_scenarios: int,
        time_horizon_years: float,
    ) -> List[ReturnScenario]:
        """Generate Monte Carlo scenarios."""
        dt = time_horizon_years / num_steps  # Time step in years
        num_assets = len(asset_classes)

        # Cholesky decomposition for correlation
        try:
            cholesky = np.linalg.cholesky(correlation_matrix)
        except np.linalg.LinAlgError:
            # Correlation matrix not positive definite - use nearest PD matrix
            cholesky = self._nearest_pd_cholesky(correlation_matrix)

        # Allocation weights
        weights = np.array([allocation[ac] for ac in asset_classes])

        scenarios = []

        for scenario_id in range(num_scenarios):
            # Generate uncorrelated random returns
            # Shape: (num_steps, num_assets)
            uncorrelated_returns = np.random.randn(num_steps, num_assets)

            # Apply correlation via Cholesky
            # correlated_returns[t, :] = uncorrelated_returns[t, :] @ cholesky.T
            correlated_returns = uncorrelated_returns @ cholesky.T

            # Convert to asset returns
            # r = mu*dt + sigma*sqrt(dt)*z
            asset_returns_dict = {}
            asset_paths = np.zeros((num_steps, num_assets))

            for i, ac in enumerate(asset_classes):
                mu = expected_returns[i]
                sigma = volatilities[i]

                # Periodic return
                returns = mu * dt + sigma * np.sqrt(dt) * correlated_returns[:, i]

                if self.config.use_lognormal:
                    # Adjust for log-normal drift
                    returns = (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * correlated_returns[:, i]

                asset_paths[:, i] = returns
                asset_returns_dict[ac] = returns.tolist()

            # Portfolio returns (weighted average)
            portfolio_returns = (asset_paths @ weights).tolist()

            # Terminal value (compound returns)
            if self.config.use_lognormal:
                terminal_value = np.exp(sum(portfolio_returns))
            else:
                terminal_value = np.prod([1 + r for r in portfolio_returns])

            scenarios.append(
                ReturnScenario(
                    scenario_id=scenario_id,
                    asset_returns=asset_returns_dict,
                    portfolio_returns=portfolio_returns,
                    terminal_value=terminal_value,
                )
            )

        return scenarios

    def _nearest_pd_cholesky(self, matrix: np.ndarray) -> np.ndarray:
        """
        Find nearest positive definite matrix and return Cholesky decomposition.

        Uses eigenvalue decomposition to force positive definiteness.
        """
        # Symmetrize
        symmetric = (matrix + matrix.T) / 2

        # Eigenvalue decomposition
        eigval, eigvec = np.linalg.eigh(symmetric)

        # Force positive eigenvalues
        eigval[eigval < 1e-8] = 1e-8

        # Reconstruct matrix
        pd_matrix = eigvec @ np.diag(eigval) @ eigvec.T

        # Cholesky decomposition
        return np.linalg.cholesky(pd_matrix)


# ===========================================================================
# Helper Functions
# ===========================================================================

def generate_returns(
    regime: MarketRegime,
    asset_allocation: Dict[AssetClass, float],
    time_horizon_years: float = 1.0,
    num_scenarios: int = 1000,
    random_seed: Optional[int] = None,
) -> ReturnGeneratorOutput:
    """
    Convenience function for return generation.

    Args:
        regime: Market regime
        asset_allocation: Asset allocation (must sum to 1.0)
        time_horizon_years: Time horizon in years
        num_scenarios: Number of Monte Carlo scenarios
        random_seed: Random seed for determinism (optional)

    Returns:
        ReturnGeneratorOutput with scenarios and statistics

    Example:
        >>> allocation = {
        ...     AssetClass.US_EQUITY: 0.6,
        ...     AssetClass.US_TREASURY: 0.4,
        ... }
        >>> output = generate_returns(
        ...     MarketRegime.BULL_LOW_VOL,
        ...     allocation,
        ...     time_horizon_years=10,
        ...     num_scenarios=5000,
        ...     random_seed=42
        ... )
        >>> output.mean_return_annualized
        0.0623  # ~6.2% annualized
    """
    config = ReturnGeneratorConfig(random_seed=random_seed)
    generator = ReturnGenerator(config)

    input_data = ReturnGeneratorInput(
        regime=regime,
        asset_allocation=asset_allocation,
        time_horizon_years=time_horizon_years,
        num_steps=int(time_horizon_years * 12),  # Monthly steps
        num_scenarios=num_scenarios,
    )

    return generator.generate(input_data)
