"""
FRED (Federal Reserve Economic Data) collector.

Fetches macro indicators, rates, and yields from St. Louis Fed.

FREE API with optional key for higher rate limits:
- Without key: 10 requests/hour
- With key: Unlimited (register at https://fred.stlouisfed.org/docs/api/api_key.html)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
from fredapi import Fred

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class FREDCollector:
    """
    Collector for FRED economic data.

    Series fetched:
    - CPIAUCSL: Consumer Price Index (inflation)
    - FEDFUNDS: Federal Funds Rate
    - DGS2: 2-Year Treasury Constant Maturity Rate
    - DGS10: 10-Year Treasury Constant Maturity Rate
    - UNRATE: Unemployment Rate
    - USREC: Recession Indicator (optional)
    """

    # FRED series IDs
    SERIES = {
        "cpi": "CPIAUCSL",
        "fed_funds": "FEDFUNDS",
        "rates_2y": "DGS2",
        "rates_10y": "DGS10",
        "unemployment": "UNRATE",
        "recession": "USREC",  # Optional binary recession indicator
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize FRED collector.

        Args:
            api_key: FRED API key (optional, rate-limited without)
        """
        self.api_key = api_key or settings.FRED_API_KEY
        self.client: Optional[Fred] = None

        if self.api_key:
            try:
                self.client = Fred(api_key=self.api_key)
                logger.info("fred_client_initialized", has_key=True)
            except Exception as e:
                logger.warning("fred_client_init_failed", error=str(e))
                self.client = None
        else:
            logger.info("fred_client_initialized", has_key=False, note="Rate limited")

    async def fetch_series(
        self,
        series_id: str,
        lookback_days: int = 365,
    ) -> Optional[pd.Series]:
        """
        Fetch a FRED series.

        Args:
            series_id: FRED series ID (e.g., "CPIAUCSL")
            lookback_days: How many days of history to fetch

        Returns:
            Pandas Series with dates as index, or None if unavailable
        """
        if not self.client:
            logger.warning("fred_client_unavailable", series=series_id)
            return None

        try:
            start_date = datetime.now(tz=timezone.utc) - timedelta(days=lookback_days)

            logger.debug("fred_fetch_series", series=series_id, start_date=start_date.date())

            # Note: fredapi is synchronous, but we're in async context
            # In production, consider using httpx directly for true async
            data = self.client.get_series(series_id, observation_start=start_date)

            if data is None or len(data) == 0:
                logger.warning("fred_series_empty", series=series_id)
                return None

            logger.info("fred_series_fetched", series=series_id, count=len(data))
            return data

        except Exception as e:
            logger.error("fred_fetch_error", series=series_id, error=str(e))
            return None

    async def fetch_all_series(self, lookback_days: int = 365) -> dict[str, pd.Series]:
        """
        Fetch all configured FRED series.

        Returns:
            Dict mapping series name -> pandas Series
        """
        results = {}

        for name, series_id in self.SERIES.items():
            data = await self.fetch_series(series_id, lookback_days)
            if data is not None:
                results[name] = data

        logger.info("fred_fetch_complete", series_count=len(results))
        return results

    def compute_inflation_yoy(self, cpi_series: pd.Series) -> Optional[float]:
        """
        Compute year-over-year inflation from CPI series.

        Returns:
            YoY inflation as decimal (e.g., 0.035 = 3.5%), or None if insufficient data
        """
        if cpi_series is None or len(cpi_series) < 252:  # Need ~1 year of data
            return None

        try:
            latest = cpi_series.iloc[-1]
            year_ago = cpi_series.iloc[-252]  # Approx 252 trading days

            inflation_yoy = (latest - year_ago) / year_ago

            logger.debug("inflation_computed", yoy=inflation_yoy)
            return float(inflation_yoy)

        except Exception as e:
            logger.error("inflation_compute_error", error=str(e))
            return None

    def get_latest_value(self, series: pd.Series) -> Optional[float]:
        """
        Get most recent value from a time series.

        Returns:
            Latest value, or None if series is empty
        """
        if series is None or len(series) == 0:
            return None

        try:
            return float(series.iloc[-1])
        except Exception:
            return None

    def get_staleness_seconds(self, series: pd.Series) -> int:
        """
        Calculate how stale the data is.

        Returns:
            Seconds since last observation
        """
        if series is None or len(series) == 0:
            return 999999  # Very stale

        try:
            last_date = series.index[-1]
            if not hasattr(last_date, 'tzinfo') or last_date.tzinfo is None:
                # Assume UTC if no timezone
                last_date = last_date.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            delta = now - last_date
            return int(delta.total_seconds())

        except Exception:
            return 999999
