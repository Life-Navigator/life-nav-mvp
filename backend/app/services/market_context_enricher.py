"""
Market Context Enrichment Service

Enriches RiskRequest with normalized market data from market-data service.
Maps MarketSnapshot fields to risk-engine's expected market_context format.
"""

from typing import Any, Dict, Optional

from app.core.service_clients.market_data_client import MarketDataClient
from app.core.logging import get_logger

logger = get_logger(__name__)


class MarketContextEnricher:
    """
    Enriches risk computation requests with market context.

    Responsibilities:
    - Fetch latest market snapshot
    - Map snapshot fields to risk-engine format
    - Provide fallback values if snapshot unavailable
    - Add confidence and staleness metadata
    """

    # Baseline fallback values (conservative estimates)
    FALLBACK_MARKET_CONTEXT = {
        "equity_vol_annual": 0.18,  # 18% (long-term avg)
        "bond_vol_annual": 0.06,  # 6%
        "rates_short_term": 0.04,  # 4%
        "rates_long_term": 0.045,  # 4.5%
        "inflation_yoy": 0.03,  # 3%
        "risk_on_score": 0.5,  # Neutral
        "volatility_regime": "medium",
    }

    def __init__(self):
        self.client = MarketDataClient()

    async def close(self) -> None:
        """Close market data client"""
        await self.client.close()

    async def enrich_risk_request(
        self,
        request_body: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Enrich a RiskRequest with market context.

        Steps:
        1. Fetch latest snapshot from market-data service
        2. Map snapshot to market_context fields
        3. Add snapshot metadata to request_meta
        4. If snapshot unavailable, use fallback values with low confidence

        Args:
            request_body: Original RiskRequest dict

        Returns:
            Enriched request with market_context populated
        """
        try:
            logger.debug("enriching_risk_request_with_market_context")

            # Fetch latest snapshot
            snapshot_response = await self.client.get_latest_snapshot()

            if snapshot_response is None:
                # Use fallback values
                logger.warning("market_snapshot_unavailable_using_fallback")
                return self._apply_fallback_context(request_body)

            # Extract snapshot
            snapshot = snapshot_response.get("snapshot", {})
            staleness_seconds = snapshot_response.get("staleness_seconds", 999999)

            # Map snapshot to market_context
            market_context = self._map_snapshot_to_context(snapshot)

            # Add market_context to request
            if "market_context" not in request_body:
                request_body["market_context"] = {}

            request_body["market_context"].update(market_context)

            # Add metadata
            if "request_meta" not in request_body:
                request_body["request_meta"] = {}

            request_body["request_meta"]["market_snapshot_id"] = snapshot.get("snapshot_id")
            request_body["request_meta"]["market_snapshot_confidence"] = snapshot.get(
                "overall_confidence"
            )
            request_body["request_meta"]["market_snapshot_staleness_seconds"] = staleness_seconds

            # Add warning if stale
            if staleness_seconds > 86400 * 2:  # 2 days
                logger.warning(
                    "market_snapshot_stale",
                    staleness_seconds=staleness_seconds,
                )
                request_body["request_meta"]["warnings"] = request_body["request_meta"].get(
                    "warnings", []
                ) + [f"Market snapshot is {staleness_seconds / 86400:.1f} days old"]

            logger.info(
                "risk_request_enriched",
                snapshot_id=snapshot.get("snapshot_id"),
                confidence=snapshot.get("overall_confidence"),
            )

            return request_body

        except Exception as e:
            logger.error("market_context_enrichment_failed", error=str(e))
            return self._apply_fallback_context(request_body)

    def _map_snapshot_to_context(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map MarketSnapshot fields to risk-engine market_context format.

        Snapshot structure (relevant fields):
        - equity_vol: {value, confidence, ...}
        - bond_vol: {value, confidence, ...}
        - rates_2y: {value, ...}
        - rates_10y: {value, ...}
        - inflation_yoy: {value, ...}
        - regime_features: {risk_on_score, volatility_regime, ...}

        Returns:
            market_context dict for risk-engine
        """
        context = {}

        # Volatilities
        equity_vol = snapshot.get("equity_vol", {})
        if not equity_vol.get("missing") and equity_vol.get("value") is not None:
            context["equity_vol_annual"] = equity_vol["value"]

        bond_vol = snapshot.get("bond_vol", {})
        if not bond_vol.get("missing") and bond_vol.get("value") is not None:
            context["bond_vol_annual"] = bond_vol["value"]

        # Rates
        rates_2y = snapshot.get("rates_2y", {})
        if not rates_2y.get("missing") and rates_2y.get("value") is not None:
            context["rates_short_term"] = rates_2y["value"]

        rates_10y = snapshot.get("rates_10y", {})
        if not rates_10y.get("missing") and rates_10y.get("value") is not None:
            context["rates_long_term"] = rates_10y["value"]

        # Inflation
        inflation = snapshot.get("inflation_yoy", {})
        if not inflation.get("missing") and inflation.get("value") is not None:
            context["inflation_yoy"] = inflation["value"]

        # Regime features
        regime = snapshot.get("regime_features", {})

        risk_on_score = regime.get("risk_on_score", {})
        if not risk_on_score.get("missing") and risk_on_score.get("value") is not None:
            context["risk_on_score"] = risk_on_score["value"]

        volatility_regime = regime.get("volatility_regime", {})
        if not volatility_regime.get("missing") and volatility_regime.get("value") is not None:
            regime_value = volatility_regime["value"]
            if regime_value == 0.0:
                context["volatility_regime"] = "low"
            elif regime_value == 0.5:
                context["volatility_regime"] = "medium"
            else:
                context["volatility_regime"] = "high"

        return context

    def _apply_fallback_context(self, request_body: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply fallback market context when snapshot unavailable.

        Adds fallback values and marks confidence as LOW.
        """
        if "market_context" not in request_body:
            request_body["market_context"] = {}

        request_body["market_context"].update(self.FALLBACK_MARKET_CONTEXT)

        if "request_meta" not in request_body:
            request_body["request_meta"] = {}

        request_body["request_meta"]["market_snapshot_id"] = "fallback"
        request_body["request_meta"]["market_snapshot_confidence"] = "low"
        request_body["request_meta"]["warnings"] = request_body["request_meta"].get("warnings", []) + [
            "Using fallback market context - snapshot unavailable"
        ]

        logger.warning("using_fallback_market_context")

        return request_body
