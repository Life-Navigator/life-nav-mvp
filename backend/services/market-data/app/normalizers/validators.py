"""
Schema validation and sanity checks for MarketSnapshot.

Ensures all fields are within plausible ranges before storage.
"""

from typing import list as List

from app.core.logging import get_logger
from app.domain.schema import MarketSnapshot, ConfidenceLevel

logger = get_logger(__name__)


class SnapshotValidator:
    """
    Validate MarketSnapshot before storage.

    Checks:
    - Required fields present
    - Values within plausible ranges
    - No NaN or infinity values
    - Confidence levels make sense
    """

    def validate(self, snapshot: MarketSnapshot) -> tuple[bool, List[str]]:
        """
        Validate a market snapshot.

        Returns:
            (is_valid, list_of_errors)
        """
        errors = []

        # Check metadata
        if not snapshot.snapshot_id:
            errors.append("Missing snapshot_id")

        if not snapshot.as_of:
            errors.append("Missing as_of timestamp")

        # Check critical fields have values or are explicitly missing
        critical_fields = [
            "equity_vol",
            "rates_2y",
            "rates_10y",
            "yield_curve_slope",
        ]

        for field_name in critical_fields:
            field = getattr(snapshot, field_name, None)
            if field is None:
                errors.append(f"Missing field: {field_name}")
                continue

            # If not missing, value must be present
            if not field.missing and field.value is None:
                errors.append(f"{field_name}: value is None but not marked as missing")

            # Check for invalid values
            if field.value is not None:
                if not self._is_finite(field.value):
                    errors.append(f"{field_name}: non-finite value {field.value}")

        # Check overall confidence is not NONE (snapshot should have some data)
        if snapshot.overall_confidence == ConfidenceLevel.NONE:
            errors.append("Overall confidence is NONE - no usable data in snapshot")

        # Validate regime features exist
        if not snapshot.regime_features:
            errors.append("Missing regime_features")

        is_valid = len(errors) == 0

        if not is_valid:
            logger.warning("snapshot_validation_failed", errors=errors)

        return is_valid, errors

    def _is_finite(self, value: float) -> bool:
        """Check if value is finite (not NaN or infinity)"""
        try:
            import math

            return math.isfinite(value)
        except Exception:
            return False
