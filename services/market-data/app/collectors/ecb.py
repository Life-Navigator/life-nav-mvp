"""
ECB (European Central Bank) collector - STUB IMPLEMENTATION.

Placeholder for future ECB SDMX API integration.
Not required for launch; provides interface only.
"""

from typing import Optional

import pandas as pd

from app.core.logging import get_logger

logger = get_logger(__name__)


class ECBCollector:
    """
    Stub collector for ECB data.

    Future implementation could fetch:
    - EUR interest rates
    - ECB policy rate
    - EUR inflation (HICP)
    - EUR FX rates

    API: https://data.ecb.europa.eu/help/api/overview
    """

    def __init__(self):
        logger.info("ecb_collector_initialized", status="stub")

    async def fetch_euro_rates(self) -> Optional[pd.Series]:
        """
        Fetch EUR interest rates (stub).

        Returns:
            None (not implemented)
        """
        logger.warning("ecb_fetch_not_implemented", method="fetch_euro_rates")
        return None

    async def fetch_euro_inflation(self) -> Optional[pd.Series]:
        """
        Fetch EUR inflation (HICP) (stub).

        Returns:
            None (not implemented)
        """
        logger.warning("ecb_fetch_not_implemented", method="fetch_euro_inflation")
        return None

    async def fetch_all_series(self) -> dict[str, pd.Series]:
        """
        Fetch all ECB series (stub).

        Returns:
            Empty dict (not implemented)
        """
        logger.info("ecb_fetch_skipped", reason="stub_implementation")
        return {}
