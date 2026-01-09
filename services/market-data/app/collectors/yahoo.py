"""
Yahoo Finance collector.

Fetches market proxies using yfinance (free, no API key required).

Data includes:
- Equity indices (S&P 500)
- Volatility indices (VIX)
- Bond ETFs (TLT, SHY)
- Commodities (GLD, DBC)
- Crypto (BTC-USD, ETH-USD)

Compliance note: Only stores derived metrics (volatility, returns), NOT raw price series.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
import yfinance as yf

from app.core.logging import get_logger

logger = get_logger(__name__)


class YahooCollector:
    """
    Collector for Yahoo Finance market data.

    Symbols fetched:
    - ^GSPC: S&P 500 (equity proxy)
    - ^VIX: CBOE Volatility Index
    - TLT: iShares 20+ Year Treasury Bond ETF (long duration)
    - SHY: iShares 1-3 Year Treasury Bond ETF (short duration)
    - GLD: SPDR Gold Shares (commodity proxy)
    - DBC: Invesco DB Commodity Index (broad commodities - optional)
    - BTC-USD: Bitcoin
    - ETH-USD: Ethereum
    """

    SYMBOLS = {
        "equity": "^GSPC",
        "vix": "^VIX",
        "bond_long": "TLT",
        "bond_short": "SHY",
        "gold": "GLD",
        "commodities": "DBC",
        "btc": "BTC-USD",
        "eth": "ETH-USD",
    }

    async def fetch_symbol(
        self,
        symbol: str,
        lookback_days: int = 60,
    ) -> Optional[pd.DataFrame]:
        """
        Fetch OHLCV data for a symbol.

        Args:
            symbol: Yahoo Finance symbol
            lookback_days: Historical window

        Returns:
            DataFrame with columns: Open, High, Low, Close, Volume
            Or None if fetch failed
        """
        try:
            end_date = datetime.now(tz=timezone.utc)
            start_date = end_date - timedelta(days=lookback_days)

            logger.debug("yahoo_fetch_symbol", symbol=symbol, start=start_date.date())

            # yfinance is synchronous
            ticker = yf.Ticker(symbol)
            data = ticker.history(start=start_date, end=end_date)

            if data is None or len(data) == 0:
                logger.warning("yahoo_symbol_empty", symbol=symbol)
                return None

            logger.info("yahoo_symbol_fetched", symbol=symbol, count=len(data))
            return data

        except Exception as e:
            logger.error("yahoo_fetch_error", symbol=symbol, error=str(e))
            return None

    async def fetch_all_symbols(self, lookback_days: int = 60) -> dict[str, pd.DataFrame]:
        """
        Fetch all configured symbols.

        Returns:
            Dict mapping symbol name -> DataFrame
        """
        results = {}

        for name, symbol in self.SYMBOLS.items():
            data = await self.fetch_symbol(symbol, lookback_days)
            if data is not None and len(data) > 0:
                results[name] = data

        logger.info("yahoo_fetch_complete", symbols_count=len(results))
        return results

    def compute_rolling_volatility(
        self,
        price_series: pd.Series,
        window: int = 20,
        annualization_factor: int = 252,
    ) -> Optional[float]:
        """
        Compute annualized rolling volatility.

        Args:
            price_series: Close prices
            window: Rolling window in days
            annualization_factor: Typically 252 for daily data

        Returns:
            Annualized volatility (e.g., 0.15 = 15%), or None if insufficient data
        """
        if price_series is None or len(price_series) < window + 1:
            return None

        try:
            # Compute log returns
            returns = (price_series / price_series.shift(1)).apply(lambda x: pd.np.log(x))

            # Rolling standard deviation
            vol = returns.rolling(window=window).std().iloc[-1]

            # Annualize
            annualized_vol = vol * (annualization_factor ** 0.5)

            logger.debug("volatility_computed", vol=annualized_vol, window=window)
            return float(annualized_vol)

        except Exception as e:
            logger.error("volatility_compute_error", error=str(e))
            return None

    def compute_return(
        self,
        price_series: pd.Series,
        lookback_days: int = 60,
    ) -> Optional[float]:
        """
        Compute cumulative return over lookback period.

        Args:
            price_series: Close prices
            lookback_days: Period for return calculation

        Returns:
            Cumulative return (e.g., 0.10 = 10%), or None if insufficient data
        """
        if price_series is None or len(price_series) < lookback_days:
            return None

        try:
            start_price = price_series.iloc[-lookback_days]
            end_price = price_series.iloc[-1]

            cum_return = (end_price - start_price) / start_price

            logger.debug("return_computed", return_pct=cum_return, days=lookback_days)
            return float(cum_return)

        except Exception as e:
            logger.error("return_compute_error", error=str(e))
            return None

    def get_latest_value(self, df: pd.DataFrame, column: str = "Close") -> Optional[float]:
        """Get most recent value from DataFrame"""
        if df is None or len(df) == 0 or column not in df.columns:
            return None

        try:
            return float(df[column].iloc[-1])
        except Exception:
            return None

    def get_staleness_seconds(self, df: pd.DataFrame) -> int:
        """Calculate data staleness"""
        if df is None or len(df) == 0:
            return 999999

        try:
            last_date = df.index[-1]
            if not hasattr(last_date, 'tzinfo') or last_date.tzinfo is None:
                last_date = last_date.tz_localize(timezone.utc)
            elif last_date.tzinfo != timezone.utc:
                last_date = last_date.tz_convert(timezone.utc)

            now = datetime.now(timezone.utc)
            delta = now - last_date
            return int(delta.total_seconds())

        except Exception:
            return 999999
