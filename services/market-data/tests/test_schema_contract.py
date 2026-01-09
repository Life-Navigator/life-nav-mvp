"""
Contract tests for MarketSnapshot schema.

Ensures schema stability and validates that all required fields exist.
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.domain.schema import (
    MarketSnapshot,
    FieldConfidence,
    ConfidenceLevel,
    DataSource,
    RegimeFeatures,
)


def test_market_snapshot_requires_all_fields():
    """MarketSnapshot must have all required fields"""

    with pytest.raises(ValidationError):
        MarketSnapshot()  # Missing all fields


def test_market_snapshot_forbids_extra_fields():
    """MarketSnapshot must reject unknown fields (no typos allowed)"""

    snapshot_dict = _create_valid_snapshot_dict()
    snapshot_dict["unknown_field"] = "bad"

    with pytest.raises(ValidationError, match="extra"):
        MarketSnapshot(**snapshot_dict)


def test_field_confidence_structure():
    """FieldConfidence must have correct structure"""

    field = FieldConfidence(
        value=0.15,
        confidence=ConfidenceLevel.HIGH,
        source=DataSource.YAHOO,
        staleness_seconds=3600,
        missing=False,
    )

    assert field.value == 0.15
    assert field.confidence == ConfidenceLevel.HIGH
    assert field.source == DataSource.YAHOO
    assert field.staleness_seconds == 3600
    assert field.missing is False


def test_snapshot_id_validation():
    """snapshot_id must be non-empty and >= 10 chars"""

    snapshot_dict = _create_valid_snapshot_dict()

    # Too short
    snapshot_dict["snapshot_id"] = "short"
    with pytest.raises(ValidationError, match="snapshot_id"):
        MarketSnapshot(**snapshot_dict)

    # Empty
    snapshot_dict["snapshot_id"] = ""
    with pytest.raises(ValidationError):
        MarketSnapshot(**snapshot_dict)


def test_timestamps_must_be_timezone_aware():
    """as_of and created_at must have timezone info"""

    snapshot_dict = _create_valid_snapshot_dict()

    # Naive datetime (no timezone)
    snapshot_dict["as_of"] = datetime(2024, 1, 1, 12, 0, 0)

    with pytest.raises(ValidationError, match="timezone-aware"):
        MarketSnapshot(**snapshot_dict)


def test_valid_snapshot_serialization():
    """Valid snapshot should serialize to JSON"""

    snapshot = _create_valid_snapshot()

    json_str = snapshot.model_dump_json()
    assert len(json_str) > 100

    # Should be deserializable
    snapshot_dict = snapshot.model_dump()
    recreated = MarketSnapshot(**snapshot_dict)

    assert recreated.snapshot_id == snapshot.snapshot_id


def test_regime_features_required():
    """MarketSnapshot must include regime_features"""

    snapshot_dict = _create_valid_snapshot_dict()
    del snapshot_dict["regime_features"]

    with pytest.raises(ValidationError, match="regime_features"):
        MarketSnapshot(**snapshot_dict)


def _create_valid_snapshot_dict() -> dict:
    """Helper to create a valid snapshot dict"""

    now = datetime.now(timezone.utc)

    return {
        "snapshot_id": "20240101_120000_abc123",
        "as_of": now,
        "created_at": now,
        "version": "1.0",
        "equity_vol": {
            "value": 0.15,
            "confidence": "high",
            "source": "yahoo",
            "staleness_seconds": 0,
            "missing": False,
        },
        "bond_vol": {
            "value": 0.06,
            "confidence": "high",
            "source": "yahoo",
            "staleness_seconds": 0,
            "missing": False,
        },
        "crypto_vol": {
            "value": 0.80,
            "confidence": "medium",
            "source": "yahoo",
            "staleness_seconds": 3600,
            "missing": False,
        },
        "fx_vol": {
            "value": None,
            "confidence": "none",
            "source": "fallback",
            "staleness_seconds": 0,
            "missing": True,
        },
        "rates_2y": {
            "value": 0.04,
            "confidence": "high",
            "source": "fred",
            "staleness_seconds": 0,
            "missing": False,
        },
        "rates_10y": {
            "value": 0.045,
            "confidence": "high",
            "source": "fred",
            "staleness_seconds": 0,
            "missing": False,
        },
        "yield_curve_slope": {
            "value": 50.0,
            "confidence": "high",
            "source": "fred",
            "staleness_seconds": 0,
            "missing": False,
        },
        "inflation_yoy": {
            "value": 0.03,
            "confidence": "high",
            "source": "fred",
            "staleness_seconds": 0,
            "missing": False,
        },
        "unemployment_rate": {
            "value": 0.04,
            "confidence": "high",
            "source": "fred",
            "staleness_seconds": 0,
            "missing": False,
        },
        "credit_spread_proxy": {
            "value": None,
            "confidence": "none",
            "source": "fallback",
            "staleness_seconds": 0,
            "missing": True,
        },
        "regime_features": {
            "risk_on_score": {
                "value": 0.7,
                "confidence": "high",
                "source": "yahoo",
                "staleness_seconds": 0,
                "missing": False,
            },
            "recession_probability": {
                "value": None,
                "confidence": "none",
                "source": "fallback",
                "staleness_seconds": 0,
                "missing": True,
            },
            "volatility_regime": {
                "value": 0.0,
                "confidence": "high",
                "source": "yahoo",
                "staleness_seconds": 0,
                "missing": False,
            },
            "liquidity_score": {
                "value": None,
                "confidence": "none",
                "source": "fallback",
                "staleness_seconds": 0,
                "missing": True,
            },
            "equity_momentum_60d": {
                "value": 0.12,
                "confidence": "high",
                "source": "yahoo",
                "staleness_seconds": 0,
                "missing": False,
            },
            "rates_trend": {
                "value": 0.0,
                "confidence": "low",
                "source": "fallback",
                "staleness_seconds": 0,
                "missing": False,
            },
            "vol_shock": {
                "value": 0.0,
                "confidence": "high",
                "source": "yahoo",
                "staleness_seconds": 0,
                "missing": False,
            },
            "credit_shock": {
                "value": 0.0,
                "confidence": "none",
                "source": "fallback",
                "staleness_seconds": 0,
                "missing": True,
            },
        },
        "overall_confidence": "high",
        "warnings": [],
    }


def _create_valid_snapshot() -> MarketSnapshot:
    """Helper to create a valid snapshot object"""
    return MarketSnapshot(**_create_valid_snapshot_dict())
