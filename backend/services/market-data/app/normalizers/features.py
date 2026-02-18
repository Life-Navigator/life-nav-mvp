"""
Feature computation and normalization.

Transforms raw collector outputs into normalized MarketSnapshot fields.
All computations are deterministic and reproducible.
"""

from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

from app.core.logging import get_logger
from app.domain.schema import (
    FieldConfidence,
    ConfidenceLevel,
    DataSource,
)

logger = get_logger(__name__)


class FeatureComputer:
    """
    Compute normalized features from raw market data.

    All methods return FieldConfidence objects with:
    - value: computed metric
    - confidence: data quality assessment
    - source: origin of data
    - staleness_seconds: age of underlying data
    - warnings: any issues encountered
    """

    # Sanity check ranges (reject obviously bad data)
    VALID_RANGES = {
        "equity_vol": (0.0, 2.0),  # 0-200% annualized
        "bond_vol": (0.0, 0.5),  # 0-50% annualized
        "crypto_vol": (0.0, 5.0),  # 0-500% annualized
        "rates": (0.0, 0.25),  # 0-25%
        "inflation": (-0.05, 0.20),  # -5% to 20%
        "unemployment": (0.0, 0.30),  # 0-30%
        "vix": (0.0, 100.0),  # 0-100
    }

    # Staleness thresholds
    STALE_THRESHOLD_DAYS = 7
    VERY_STALE_THRESHOLD_DAYS = 30

    def compute_volatility(
        self,
        price_series: Optional[pd.Series],
        window: int = 20,
        source: DataSource = DataSource.YAHOO,
        asset_class: str = "equity",
    ) -> FieldConfidence:
        """
        Compute annualized volatility from price series.

        Args:
            price_series: Daily close prices
            window: Rolling window (days)
            source: Data source
            asset_class: "equity", "bond", or "crypto" (for range validation)

        Returns:
            FieldConfidence with volatility value
        """
        if price_series is None or len(price_series) < window + 1:
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning="Insufficient data for volatility calculation",
            )

        try:
            # Log returns
            returns = np.log(price_series / price_series.shift(1))

            # Rolling std dev
            vol_daily = returns.rolling(window=window).std().iloc[-1]

            # Annualize (sqrt(252) for daily data)
            vol_annualized = float(vol_daily * np.sqrt(252))

            # Validate range
            range_key = f"{asset_class}_vol"
            if range_key in self.VALID_RANGES:
                min_val, max_val = self.VALID_RANGES[range_key]
                if not (min_val <= vol_annualized <= max_val):
                    logger.warning(
                        "volatility_out_of_range",
                        asset_class=asset_class,
                        value=vol_annualized,
                        range=(min_val, max_val),
                    )
                    return FieldConfidence(
                        value=None,
                        confidence=ConfidenceLevel.NONE,
                        source=source,
                        missing=True,
                        warning=f"Volatility {vol_annualized:.2f} outside valid range",
                    )

            # Compute staleness
            staleness = self._compute_staleness(price_series)
            confidence = self._staleness_to_confidence(staleness)

            return FieldConfidence(
                value=vol_annualized,
                confidence=confidence,
                source=source,
                staleness_seconds=staleness,
                missing=False,
            )

        except Exception as e:
            logger.error("volatility_compute_error", error=str(e), asset_class=asset_class)
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def compute_rate(
        self,
        rate_series: Optional[pd.Series],
        source: DataSource = DataSource.FRED,
    ) -> FieldConfidence:
        """
        Extract latest rate value (already in decimal form from FRED).

        Args:
            rate_series: Time series of rates
            source: Data source

        Returns:
            FieldConfidence with rate value
        """
        if rate_series is None or len(rate_series) == 0:
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning="No rate data available",
            )

        try:
            # FRED rates are already in decimal (e.g., 4.5% = 0.045)
            # But sometimes they're in percentage form (4.5), convert if needed
            latest_rate = float(rate_series.iloc[-1])

            # If value > 1, assume it's percentage form, convert to decimal
            if latest_rate > 1.0:
                latest_rate = latest_rate / 100.0

            # Validate range
            min_val, max_val = self.VALID_RANGES["rates"]
            if not (min_val <= latest_rate <= max_val):
                logger.warning("rate_out_of_range", value=latest_rate)
                return FieldConfidence(
                    value=None,
                    confidence=ConfidenceLevel.NONE,
                    source=source,
                    missing=True,
                    warning=f"Rate {latest_rate:.4f} outside valid range",
                )

            staleness = self._compute_staleness(rate_series)
            confidence = self._staleness_to_confidence(staleness)

            return FieldConfidence(
                value=latest_rate,
                confidence=confidence,
                source=source,
                staleness_seconds=staleness,
                missing=False,
            )

        except Exception as e:
            logger.error("rate_compute_error", error=str(e))
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def compute_yield_curve_slope(
        self,
        rates_10y: FieldConfidence,
        rates_2y: FieldConfidence,
    ) -> FieldConfidence:
        """
        Compute yield curve slope (10y - 2y) in basis points.

        Args:
            rates_10y: 10-year rate
            rates_2y: 2-year rate

        Returns:
            FieldConfidence with slope in basis points
        """
        if rates_10y.missing or rates_2y.missing:
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FRED,
                missing=True,
                warning="Missing rate data for yield curve",
            )

        try:
            slope_decimal = rates_10y.value - rates_2y.value
            slope_bps = slope_decimal * 10000  # Convert to basis points

            # Use worse confidence of the two inputs
            confidence = (
                rates_10y.confidence
                if self._confidence_rank(rates_10y.confidence)
                < self._confidence_rank(rates_2y.confidence)
                else rates_2y.confidence
            )

            staleness = max(rates_10y.staleness_seconds, rates_2y.staleness_seconds)

            return FieldConfidence(
                value=slope_bps,
                confidence=confidence,
                source=DataSource.FRED,
                staleness_seconds=staleness,
                missing=False,
            )

        except Exception as e:
            logger.error("yield_curve_slope_error", error=str(e))
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FRED,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def compute_momentum(
        self,
        price_series: Optional[pd.Series],
        lookback_days: int = 60,
        source: DataSource = DataSource.YAHOO,
    ) -> FieldConfidence:
        """
        Compute annualized momentum (cumulative return).

        Args:
            price_series: Daily close prices
            lookback_days: Period for return calculation

        Returns:
            FieldConfidence with annualized return
        """
        if price_series is None or len(price_series) < lookback_days:
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning="Insufficient data for momentum calculation",
            )

        try:
            start_price = float(price_series.iloc[-lookback_days])
            end_price = float(price_series.iloc[-1])

            cum_return = (end_price - start_price) / start_price

            # Annualize
            annualized_return = cum_return * (252 / lookback_days)

            staleness = self._compute_staleness(price_series)
            confidence = self._staleness_to_confidence(staleness)

            return FieldConfidence(
                value=annualized_return,
                confidence=confidence,
                source=source,
                staleness_seconds=staleness,
                missing=False,
            )

        except Exception as e:
            logger.error("momentum_compute_error", error=str(e))
            return FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=source,
                missing=True,
                warning=f"Computation error: {str(e)}",
            )

    def _compute_staleness(self, series: pd.Series) -> int:
        """Compute staleness in seconds"""
        try:
            last_date = series.index[-1]
            if not hasattr(last_date, 'tzinfo') or last_date.tzinfo is None:
                last_date = last_date.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            delta = now - last_date
            return int(delta.total_seconds())

        except Exception:
            return 999999

    def _staleness_to_confidence(self, staleness_seconds: int) -> ConfidenceLevel:
        """Map staleness to confidence level"""
        days = staleness_seconds / 86400

        if days <= self.STALE_THRESHOLD_DAYS:
            return ConfidenceLevel.HIGH
        elif days <= self.VERY_STALE_THRESHOLD_DAYS:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW

    def _confidence_rank(self, conf: ConfidenceLevel) -> int:
        """Convert confidence to numeric rank for comparison"""
        ranking = {
            ConfidenceLevel.NONE: 0,
            ConfidenceLevel.LOW: 1,
            ConfidenceLevel.MEDIUM: 2,
            ConfidenceLevel.HIGH: 3,
        }
        return ranking.get(conf, 0)
