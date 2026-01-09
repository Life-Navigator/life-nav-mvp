"""
AlphaVantage collector - STUB IMPLEMENTATION.

Placeholder for future AlphaVantage API integration.
Not required for launch; provides interface only.

AlphaVantage provides free tier with rate limits:
- 5 requests/minute
- 500 requests/day

Requires API key: https://www.alphavantage.co/support/#api-key
"""

from typing import Optional

import pandas as pd

from app.core.logging import get_logger

logger = get_logger(__name__)


class AlphaVantageCollector:
    """
    Stub collector for AlphaVantage data.

    Future implementation could fetch:
    - Intraday market data
    - Forex rates
    - Digital currency data
    - Economic indicators

    API docs: https://www.alphavantage.co/documentation/
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        logger.info("alphavantage_collector_initialized", status="stub", has_key=bool(api_key))

    async def fetch_intraday(self, symbol: str) -> Optional[pd.DataFrame]:
        """
        Fetch intraday data (stub).

        Returns:
            None (not implemented)
        """
        logger.warning("alphavantage_fetch_not_implemented", method="fetch_intraday")
        return None

    async def fetch_forex(self, from_currency: str, to_currency: str) -> Optional[pd.Series]:
        """
        Fetch FX rates (stub).

        Returns:
            None (not implemented)
        """
        logger.warning("alphavantage_fetch_not_implemented", method="fetch_forex")
        return None

    async def fetch_all_data(self) -> dict[str, pd.DataFrame]:
        """
        Fetch all AlphaVantage data (stub).

        Returns:
            Empty dict (not implemented)
        """
        logger.info("alphavantage_fetch_skipped", reason="stub_implementation")
        return {}
