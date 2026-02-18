"""
Snapshot builder job - orchestrates the full pipeline.

Steps:
1. Fetch data from all collectors (FRED, Yahoo, ECB, AlphaVantage)
2. Normalize and compute features
3. Compute regime features
4. Validate snapshot
5. Store in GCS (and optionally Cloud SQL)
6. Update metrics
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.collectors.fred import FREDCollector
from app.collectors.yahoo import YahooCollector
from app.collectors.ecb import ECBCollector
from app.collectors.alphavantage import AlphaVantageCollector
from app.normalizers.features import FeatureComputer
from app.normalizers.regime_features import RegimeComputer
from app.normalizers.validators import SnapshotValidator
from app.storage.gcs_store import GCSStore
from app.core.config import settings
from app.core.logging import get_logger
from app.core.metrics import (
    snapshot_build_total,
    snapshot_build_duration,
    snapshot_staleness,
    set_confidence_gauge,
)
from app.domain.schema import (
    MarketSnapshot,
    Provenance,
    RegimeFeatures,
    ConfidenceLevel,
    DataSource,
    FieldConfidence,
)

logger = get_logger(__name__)


class SnapshotBuilder:
    """
    Orchestrates market snapshot creation.

    Deterministic: given same raw inputs, produces same output.
    """

    def __init__(self):
        self.fred = FREDCollector()
        self.yahoo = YahooCollector()
        self.ecb = ECBCollector() if settings.ENABLE_ECB_COLLECTOR else None
        self.alphavantage = (
            AlphaVantageCollector() if settings.ENABLE_ALPHAVANTAGE_COLLECTOR else None
        )

        self.feature_computer = FeatureComputer()
        self.regime_computer = RegimeComputer()
        self.validator = SnapshotValidator()
        self.storage = GCSStore()

    async def build_and_store_snapshot(self) -> tuple[Optional[MarketSnapshot], list[str]]:
        """
        Build a complete market snapshot and store it.

        Returns:
            (snapshot, list_of_errors)
        """
        build_start = datetime.now(timezone.utc)
        errors = []
        sources_used = []

        try:
            logger.info("snapshot_build_started")

            # Step 1: Fetch from all collectors
            logger.info("fetching_market_data")

            fred_data = await self.fred.fetch_all_series(lookback_days=365)
            if fred_data:
                sources_used.append(DataSource.FRED)

            yahoo_data = await self.yahoo.fetch_all_symbols(lookback_days=60)
            if yahoo_data:
                sources_used.append(DataSource.YAHOO)

            # ECB and AlphaVantage are optional stubs
            if self.ecb:
                ecb_data = await self.ecb.fetch_all_series()
                if ecb_data:
                    sources_used.append(DataSource.ECB)

            if self.alphavantage:
                av_data = await self.alphavantage.fetch_all_data()
                if av_data:
                    sources_used.append(DataSource.ALPHAVANTAGE)

            # Step 2: Compute normalized features
            logger.info("computing_features")

            # Volatilities
            equity_vol = self._compute_equity_vol(yahoo_data)
            bond_vol = self._compute_bond_vol(yahoo_data)
            crypto_vol = self._compute_crypto_vol(yahoo_data)
            fx_vol = FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FALLBACK,
                missing=True,
                warning="FX volatility not implemented",
            )

            # Rates
            rates_2y = self._compute_rate(fred_data, "rates_2y")
            rates_10y = self._compute_rate(fred_data, "rates_10y")
            yield_curve_slope = self.feature_computer.compute_yield_curve_slope(
                rates_10y, rates_2y
            )

            # Macro
            inflation_yoy = self._compute_inflation(fred_data)
            unemployment_rate = self._compute_unemployment(fred_data)

            # Credit spread proxy (stub for now)
            credit_spread_proxy = FieldConfidence(
                value=None,
                confidence=ConfidenceLevel.NONE,
                source=DataSource.FALLBACK,
                missing=True,
                warning="Credit spread proxy not implemented",
            )

            # Step 3: Compute regime features
            logger.info("computing_regime_features")

            equity_momentum = self._compute_equity_momentum(yahoo_data)
            vix_level = self._get_latest_vix(yahoo_data)

            risk_on_score = self.regime_computer.compute_risk_on_score(
                equity_momentum, vix_level, yield_curve_slope, credit_spread_proxy
            )

            volatility_regime = self.regime_computer.compute_volatility_regime(
                vix_level, equity_vol
            )

            vol_shock = self.regime_computer.compute_vol_shock(vix_level, None)

            regime_features = RegimeFeatures(
                risk_on_score=risk_on_score,
                recession_probability=FieldConfidence(
                    value=None,
                    confidence=ConfidenceLevel.NONE,
                    source=DataSource.FALLBACK,
                    missing=True,
                    warning="Recession probability not implemented",
                ),
                volatility_regime=volatility_regime,
                liquidity_score=FieldConfidence(
                    value=None,
                    confidence=ConfidenceLevel.NONE,
                    source=DataSource.FALLBACK,
                    missing=True,
                    warning="Liquidity score not implemented",
                ),
                equity_momentum_60d=equity_momentum,
                rates_trend=FieldConfidence(
                    value=0.0,
                    confidence=ConfidenceLevel.LOW,
                    source=DataSource.FALLBACK,
                    missing=False,
                    warning="Rates trend not implemented",
                ),
                vol_shock=vol_shock,
                credit_shock=FieldConfidence(
                    value=0.0,
                    confidence=ConfidenceLevel.NONE,
                    source=DataSource.FALLBACK,
                    missing=True,
                    warning="Credit shock not implemented",
                ),
            )

            # Step 4: Determine overall confidence
            overall_confidence = self._compute_overall_confidence([
                equity_vol,
                rates_2y,
                rates_10y,
                yield_curve_slope,
                inflation_yoy,
            ])

            # Step 5: Build snapshot
            snapshot_id = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

            snapshot = MarketSnapshot(
                snapshot_id=snapshot_id,
                as_of=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                version="1.0",
                equity_vol=equity_vol,
                bond_vol=bond_vol,
                crypto_vol=crypto_vol,
                fx_vol=fx_vol,
                rates_2y=rates_2y,
                rates_10y=rates_10y,
                yield_curve_slope=yield_curve_slope,
                inflation_yoy=inflation_yoy,
                unemployment_rate=unemployment_rate,
                credit_spread_proxy=credit_spread_proxy,
                regime_features=regime_features,
                overall_confidence=overall_confidence,
                warnings=errors,
            )

            # Step 6: Validate
            logger.info("validating_snapshot")
            is_valid, validation_errors = self.validator.validate(snapshot)

            if not is_valid:
                errors.extend(validation_errors)
                logger.error("snapshot_validation_failed", errors=validation_errors)
                snapshot_build_total.labels(status="validation_failed").inc()
                return None, errors

            # Step 7: Store
            logger.info("storing_snapshot")

            build_duration = (datetime.now(timezone.utc) - build_start).total_seconds()

            provenance = Provenance(
                snapshot_id=snapshot_id,
                sources_used=sources_used,
                fred_series_fetched=list(fred_data.keys()) if fred_data else [],
                yahoo_symbols_fetched=list(yahoo_data.keys()) if yahoo_data else [],
                fetch_timestamp=build_start,
                build_duration_seconds=build_duration,
                errors=errors,
            )

            await self.storage.store_snapshot(snapshot, provenance)

            # Step 8: Update metrics
            snapshot_build_total.labels(status="success").inc()
            snapshot_build_duration.observe(build_duration)
            snapshot_staleness.set(0)  # Fresh snapshot
            set_confidence_gauge(snapshot.overall_confidence.value)

            logger.info(
                "snapshot_build_complete",
                snapshot_id=snapshot_id,
                confidence=snapshot.overall_confidence.value,
                duration_seconds=build_duration,
            )

            return snapshot, errors

        except Exception as e:
            logger.error("snapshot_build_failed", error=str(e))
            snapshot_build_total.labels(status="error").inc()
            errors.append(f"Build error: {str(e)}")
            return None, errors

    def _compute_equity_vol(self, yahoo_data: dict) -> FieldConfidence:
        """Compute equity volatility from S&P 500"""
        if "equity" in yahoo_data:
            close_prices = yahoo_data["equity"]["Close"]
            return self.feature_computer.compute_volatility(
                close_prices, window=20, source=DataSource.YAHOO, asset_class="equity"
            )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.YAHOO,
            missing=True,
            warning="No equity data available",
        )

    def _compute_bond_vol(self, yahoo_data: dict) -> FieldConfidence:
        """Compute bond volatility from TLT"""
        if "bond_long" in yahoo_data:
            close_prices = yahoo_data["bond_long"]["Close"]
            return self.feature_computer.compute_volatility(
                close_prices, window=20, source=DataSource.YAHOO, asset_class="bond"
            )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.YAHOO,
            missing=True,
            warning="No bond data available",
        )

    def _compute_crypto_vol(self, yahoo_data: dict) -> FieldConfidence:
        """Compute crypto volatility from BTC"""
        if "btc" in yahoo_data:
            close_prices = yahoo_data["btc"]["Close"]
            return self.feature_computer.compute_volatility(
                close_prices, window=20, source=DataSource.YAHOO, asset_class="crypto"
            )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.YAHOO,
            missing=True,
            warning="No crypto data available",
        )

    def _compute_rate(self, fred_data: dict, rate_name: str) -> FieldConfidence:
        """Extract rate from FRED data"""
        if rate_name in fred_data:
            return self.feature_computer.compute_rate(
                fred_data[rate_name], source=DataSource.FRED
            )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.FRED,
            missing=True,
            warning=f"No {rate_name} data available",
        )

    def _compute_inflation(self, fred_data: dict) -> FieldConfidence:
        """Compute YoY inflation from CPI"""
        if "cpi" in fred_data:
            inflation = self.fred.compute_inflation_yoy(fred_data["cpi"])
            if inflation is not None:
                staleness = self.fred.get_staleness_seconds(fred_data["cpi"])
                confidence = self.feature_computer._staleness_to_confidence(staleness)
                return FieldConfidence(
                    value=inflation,
                    confidence=confidence,
                    source=DataSource.FRED,
                    staleness_seconds=staleness,
                    missing=False,
                )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.FRED,
            missing=True,
            warning="No CPI data available",
        )

    def _compute_unemployment(self, fred_data: dict) -> FieldConfidence:
        """Extract unemployment rate"""
        if "unemployment" in fred_data:
            unemp = self.fred.get_latest_value(fred_data["unemployment"])
            if unemp is not None:
                # Convert from percentage to decimal if needed
                if unemp > 1.0:
                    unemp = unemp / 100.0

                staleness = self.fred.get_staleness_seconds(fred_data["unemployment"])
                confidence = self.feature_computer._staleness_to_confidence(staleness)
                return FieldConfidence(
                    value=unemp,
                    confidence=confidence,
                    source=DataSource.FRED,
                    staleness_seconds=staleness,
                    missing=False,
                )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.FRED,
            missing=True,
            warning="No unemployment data available",
        )

    def _compute_equity_momentum(self, yahoo_data: dict) -> FieldConfidence:
        """Compute 60-day equity momentum"""
        if "equity" in yahoo_data:
            close_prices = yahoo_data["equity"]["Close"]
            return self.feature_computer.compute_momentum(
                close_prices, lookback_days=60, source=DataSource.YAHOO
            )
        return FieldConfidence(
            value=None,
            confidence=ConfidenceLevel.NONE,
            source=DataSource.YAHOO,
            missing=True,
            warning="No equity data for momentum",
        )

    def _get_latest_vix(self, yahoo_data: dict) -> Optional[float]:
        """Get latest VIX level"""
        if "vix" in yahoo_data:
            return self.yahoo.get_latest_value(yahoo_data["vix"], "Close")
        return None

    def _compute_overall_confidence(self, fields: list[FieldConfidence]) -> ConfidenceLevel:
        """Determine overall snapshot confidence from critical fields"""
        confidences = [f.confidence for f in fields if not f.missing]

        if not confidences:
            return ConfidenceLevel.NONE

        # Count confidence levels
        high_count = sum(1 for c in confidences if c == ConfidenceLevel.HIGH)
        medium_count = sum(1 for c in confidences if c == ConfidenceLevel.MEDIUM)

        total = len(confidences)

        if high_count >= total * 0.75:
            return ConfidenceLevel.HIGH
        elif (high_count + medium_count) >= total * 0.5:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW
