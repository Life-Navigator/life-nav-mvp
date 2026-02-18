"""
Regime feature computation.

Derives higher-level market regime indicators from normalized features.
Used by risk-engine for regime classification.
"""

from typing import Optional

import numpy as np

from app.core.logging import get_logger
from app.domain.schema import FieldConfidence, ConfidenceLevel, DataSource

logger = get_logger(__name__)


class RegimeComputer:
    """
    Compute derived regime classification features.

    Risk-on score combines multiple indicators:
    - Equity momentum (positive = risk-on)
    - VIX level (low = risk-on)
    - Yield curve slope (positive = growth expectations)
    - Credit spread proxy (low = risk-on)
    """

    # Thresholds for regime classification
    VIX_LOW_THRESHOLD = 15.0  # Below = low vol regime
    VIX_HIGH_THRESHOLD = 25.0  # Above = high vol regime
    VIX_SPIKE_THRESHOLD = 1.5  # 50% increase = vol shock

    YIELD_CURVE_INVERSION_THRESHOLD = -10.0  # bps

    def compute_risk_on_score(
        self,
        equity_momentum: FieldConfidence,
        vix_level: Optional[float],
        yield_curve_slope: FieldConfidence,
        credit_spread: FieldConfidence,
    ) -> FieldConfidence:
        """
        Compute risk-on score (0-1 scale).

        Combines:
        - Equity momentum: positive momentum increases risk-on
        - VIX: low VIX increases risk-on
        - Yield curve: positive slope increases risk-on
        - Credit spreads: low spreads increase risk-on

        Returns:
            FieldConfidence with risk_on_score (0=risk-off, 1=risk-on)
        """
        components = []
        confidences = []

        try:
            # Component 1: Equity momentum (normalized to 0-1)
            if not equity_momentum.missing and equity_momentum.value is not None:
                # Map momentum to 0-1 (assume -50% to +50% range)
                momentum_norm = np.clip((equity_momentum.value + 0.5) / 1.0, 0, 1)
                components.append(momentum_norm * 0.35)  # 35% weight
                confidences.append(equity_momentum.confidence)

            # Component 2: VIX (inverted: low VIX = risk-on)
            if vix_level is not None:
                vix_norm = np.clip((40.0 - vix_level) / 30.0, 0, 1)  # Invert and normalize
                components.append(vix_norm * 0.30)  # 30% weight
                confidences.append(ConfidenceLevel.HIGH)  # Assume fresh VIX data

            # Component 3: Yield curve slope (positive = risk-on)
            if not yield_curve_slope.missing and yield_curve_slope.value is not None:
                # Map slope from -100 to +300 bps to 0-1
                slope_norm = np.clip((yield_curve_slope.value + 100) / 400, 0, 1)
                components.append(slope_norm * 0.20)  # 20% weight
                confidences.append(yield_curve_slope.confidence)

            # Component 4: Credit spreads (low = risk-on)
            if not credit_spread.missing and credit_spread.value is not None:
                # Map spreads from 0-500 bps to 0-1 (inverted)
                spread_norm = np.clip((500 - credit_spread.value) / 500, 0, 1)
                components.append(spread_norm * 0.15)  # 15% weight
                confidences.append(credit_spread.confidence)

            if not components:
                return FieldConfidence(
                    value=None,
                    confidence=ConfidenceLevel.NONE,
                    source=DataSource.FALLBACK,
                    missing=True,
                    warning="No components available for risk-on score",
                )

            # Combine components
            risk_on_score = sum(components)

            # Use worst confidence among components
            overall_confidence = min(
                confidences, key=lambda c: self._confidence_rank(c)
            ) if confidences else ConfidenceLevel.LOW

            return FieldConfidence(
                value=risk_on_score,
                confidence=overall_confidence,
                source=DataSource.YAHOO,  # Primary source
                missing=False,
            )

        except Exception as e:
            logger.error("risk_on_score_error", error=str(e))
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FALLBACK,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def compute_volatility_regime(
        self,
        vix_level: Optional[float],
        equity_vol: FieldConfidence,
    ) -> FieldConfidence:
        """
        Classify volatility regime (0=low, 0.5=medium, 1=high).

        Args:
            vix_level: Current VIX level
            equity_vol: Realized equity volatility

        Returns:
            FieldConfidence with regime score
        """
        try:
            if vix_level is None and equity_vol.missing:
                return FieldConfidence(
                    value=None,
                    confidence=ConfidenceLevel.NONE,
                    source=DataSource.FALLBACK,
                    missing=True,
                    warning="No volatility data available",
                )

            # Prefer VIX as it's forward-looking
            if vix_level is not None:
                if vix_level < self.VIX_LOW_THRESHOLD:
                    regime = 0.0  # Low vol
                elif vix_level > self.VIX_HIGH_THRESHOLD:
                    regime = 1.0  # High vol
                else:
                    regime = 0.5  # Medium vol

                return FieldConfidence(
                    value=regime,
                    confidence=ConfidenceLevel.HIGH,
                    source=DataSource.YAHOO,
                    missing=False,
                )

            # Fallback to realized vol
            if not equity_vol.missing and equity_vol.value is not None:
                if equity_vol.value < 0.15:  # 15% annualized
                    regime = 0.0
                elif equity_vol.value > 0.25:  # 25% annualized
                    regime = 1.0
                else:
                    regime = 0.5

                return FieldConfidence(
                    value=regime,
                    confidence=equity_vol.confidence,
                    source=DataSource.YAHOO,
                    missing=False,
                )

            return FieldConfidence(
                value=0.5,  # Neutral default
                confidence=ConfidenceLevel.LOW,
                source=DataSource.FALLBACK,
                missing=False,
                warning="Using default medium volatility regime",
            )

        except Exception as e:
            logger.error("volatility_regime_error", error=str(e))
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FALLBACK,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def compute_vol_shock(
        self,
        vix_current: Optional[float],
        vix_series: Optional[list[float]],
    ) -> FieldConfidence:
        """
        Detect VIX spike (volatility shock indicator).

        Returns:
            FieldConfidence with shock indicator (0=no shock, 1=spike detected)
        """
        try:
            if vix_current is None or vix_series is None or len(vix_series) < 5:
                return FieldConfidence(
                    value=0.0,
                    confidence=ConfidenceLevel.LOW,
                    source=DataSource.FALLBACK,
                    missing=False,
                    warning="Insufficient VIX history for shock detection",
                )

            # Compare current VIX to recent average
            recent_avg = np.mean(vix_series[-5:])

            if vix_current > recent_avg * self.VIX_SPIKE_THRESHOLD:
                shock = 1.0
            else:
                shock = 0.0

            return FieldConfidence(
                value=shock,
                confidence=ConfidenceLevel.HIGH,
                source=DataSource.YAHOO,
                missing=False,
            )

        except Exception as e:
            logger.error("vol_shock_error", error=str(e))
            return FieldConfidence(
                value=0.0,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FALLBACK,
                missing=False,
                warning=f"Computation error: {str(e)}",
            )

    def _confidence_rank(self, conf: ConfidenceLevel) -> int:
        """Convert confidence to numeric rank"""
        ranking = {
            ConfidenceLevel.NONE: 0,
            ConfidenceLevel.LOW: 1,
            ConfidenceLevel.MEDIUM: 2,
            ConfidenceLevel.HIGH: 3,
        }
        return ranking.get(conf, 0)
