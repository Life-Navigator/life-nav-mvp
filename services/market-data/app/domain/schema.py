"""
Market Data Domain Schema

Defines the normalized MarketSnapshot format used by risk-engine.
All external vendor data is normalized into this single schema.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict


class DataSource(str, Enum):
    """Supported data sources"""

    FRED = "fred"
    YAHOO = "yahoo"
    ECB = "ecb"
    ALPHAVANTAGE = "alphavantage"
    FALLBACK = "fallback"


class ConfidenceLevel(str, Enum):
    """Confidence levels for data quality"""

    HIGH = "high"  # Fresh data, all sources available
    MEDIUM = "medium"  # Some staleness or missing non-critical fields
    LOW = "low"  # Significant staleness or fallback values
    NONE = "none"  # No data available, using defaults


class FieldConfidence(BaseModel):
    """Confidence metadata for a single field"""

    model_config = ConfigDict(frozen=True, extra="forbid")

    value: Optional[float] = None
    confidence: ConfidenceLevel = ConfidenceLevel.NONE
    source: DataSource = DataSource.FALLBACK
    staleness_seconds: int = 0
    missing: bool = False
    warning: Optional[str] = None


class RegimeFeatures(BaseModel):
    """Derived regime classification features"""

    model_config = ConfigDict(frozen=True, extra="forbid")

    # Market regime indicators (0-1 scores)
    risk_on_score: FieldConfidence
    recession_probability: FieldConfidence
    volatility_regime: FieldConfidence  # 0=low, 1=high
    liquidity_score: FieldConfidence

    # Momentum and trend
    equity_momentum_60d: FieldConfidence  # Annualized return
    rates_trend: FieldConfidence  # Rising=1, falling=-1, neutral=0

    # Shock indicators
    vol_shock: FieldConfidence  # VIX spike indicator
    credit_shock: FieldConfidence  # Credit spread widening


class MarketSnapshot(BaseModel):
    """
    Normalized market data snapshot.

    This is the ONLY format consumed by risk-engine.
    All vendor-specific data is normalized into this schema.

    NO PHI, NO PCI, NO user data.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    # Metadata
    snapshot_id: str = Field(..., description="Unique snapshot ID (UUID or ISO timestamp)")
    as_of: datetime = Field(..., description="Snapshot timestamp (UTC)")
    created_at: datetime = Field(..., description="When this snapshot was created (UTC)")
    version: str = Field(default="1.0", description="Schema version")

    # Volatility metrics (annualized, 0-1 scale)
    equity_vol: FieldConfidence = Field(..., description="Equity volatility (20d rolling)")
    bond_vol: FieldConfidence = Field(..., description="Bond volatility (20d rolling)")
    crypto_vol: FieldConfidence = Field(..., description="Crypto volatility (20d rolling)")
    fx_vol: FieldConfidence = Field(..., description="FX volatility (optional)")

    # Interest rates (decimal, e.g., 0.045 = 4.5%)
    rates_2y: FieldConfidence = Field(..., description="2-year Treasury yield")
    rates_10y: FieldConfidence = Field(..., description="10-year Treasury yield")
    yield_curve_slope: FieldConfidence = Field(..., description="10y - 2y spread (bps)")

    # Macro indicators
    inflation_yoy: FieldConfidence = Field(..., description="CPI YoY % change")
    unemployment_rate: FieldConfidence = Field(..., description="Unemployment rate (%)")

    # Credit and risk spreads
    credit_spread_proxy: FieldConfidence = Field(
        ..., description="Credit spread proxy (bps or null)"
    )

    # Regime features (derived)
    regime_features: RegimeFeatures

    # Overall snapshot quality
    overall_confidence: ConfidenceLevel = Field(..., description="Overall snapshot confidence")
    warnings: list[str] = Field(default_factory=list, description="Data quality warnings")

    @field_validator("as_of", "created_at")
    @classmethod
    def validate_timestamps(cls, v: datetime) -> datetime:
        """Ensure timestamps are timezone-aware UTC"""
        if v.tzinfo is None:
            raise ValueError("Timestamp must be timezone-aware UTC")
        return v

    @field_validator("snapshot_id")
    @classmethod
    def validate_snapshot_id(cls, v: str) -> str:
        """Validate snapshot ID format"""
        if not v or len(v) < 10:
            raise ValueError("snapshot_id must be non-empty and >= 10 chars")
        return v


class Provenance(BaseModel):
    """
    Minimal provenance tracking.

    We do NOT store raw vendor payloads long-term (licensing/compliance).
    We only track what sources were used and basic metadata.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    snapshot_id: str
    sources_used: list[DataSource]
    fred_series_fetched: list[str] = Field(default_factory=list)
    yahoo_symbols_fetched: list[str] = Field(default_factory=list)
    fetch_timestamp: datetime
    build_duration_seconds: float
    errors: list[str] = Field(default_factory=list)


class SnapshotResponse(BaseModel):
    """API response wrapper for snapshot queries"""

    model_config = ConfigDict(frozen=True, extra="forbid")

    snapshot: MarketSnapshot
    provenance: Provenance
    staleness_seconds: int
    warnings: list[str] = Field(default_factory=list)


class SnapshotRangeResponse(BaseModel):
    """API response for range queries"""

    model_config = ConfigDict(frozen=True, extra="forbid")

    snapshots: list[MarketSnapshot]
    count: int
    start_date: datetime
    end_date: datetime
