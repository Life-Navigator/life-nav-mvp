"""
Market Regime Classification Module
===========================================================================
Classifies current market regime based on volatility, returns, correlations.

Features:
- Rule-based classification (no ML)
- Stability / hysteresis to prevent regime flickering
- Transition dampening (optional)
- Deterministic given same inputs

Regimes:
- BULL_LOW_VOL: Strong returns, low volatility
- BULL_HIGH_VOL: Strong returns, high volatility
- BEAR_LOW_VOL: Negative returns, low volatility
- BEAR_HIGH_VOL: Negative returns, high volatility (crisis)
- SIDEWAYS: Neutral returns, moderate volatility

Logic:
- Use trailing returns + realized volatility
- Apply hysteresis thresholds to prevent rapid switches
- Optional transition dampening (requires recent regime history)
"""

from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ===========================================================================
# Regime Enums
# ===========================================================================

class MarketRegime(str, Enum):
    """Market regime classification."""
    BULL_LOW_VOL = "bull_low_vol"
    BULL_HIGH_VOL = "bull_high_vol"
    BEAR_LOW_VOL = "bear_low_vol"
    BEAR_HIGH_VOL = "bear_high_vol"
    SIDEWAYS = "sideways"


# ===========================================================================
# Configuration
# ===========================================================================

class RegimeThresholds(BaseModel):
    """Thresholds for regime classification."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    # Return thresholds (annualized)
    bull_return_threshold: float = Field(0.10, ge=0.0)  # >10% = bull
    bear_return_threshold: float = Field(-0.05, le=0.0)  # <-5% = bear

    # Volatility thresholds (annualized)
    high_vol_threshold: float = Field(0.25, ge=0.0)  # >25% = high vol
    low_vol_threshold: float = Field(0.15, ge=0.0)  # <15% = low vol

    # Hysteresis bands (prevent flickering)
    # Once in a regime, need stronger signal to exit
    hysteresis_return_buffer: float = Field(0.03, ge=0.0)  # ±3% buffer
    hysteresis_vol_buffer: float = Field(0.05, ge=0.0)  # ±5% buffer


class RegimeConfig(BaseModel):
    """Configuration for regime classifier."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    thresholds: RegimeThresholds = Field(default_factory=RegimeThresholds)

    # Lookback period for returns/volatility (trading days)
    lookback_days: int = Field(60, ge=20, le=252)

    # Enable transition dampening (prevents rapid regime changes)
    enable_transition_dampening: bool = Field(True)

    # Minimum time in regime before allowing transition (days)
    min_regime_duration_days: int = Field(10, ge=1, le=60)


# ===========================================================================
# Regime Classification
# ===========================================================================

class RegimeInput(BaseModel):
    """Input for regime classification."""
    model_config = ConfigDict(extra='forbid')

    # Market data
    trailing_return_annualized: float = Field(..., ge=-1.0, le=5.0)
    realized_volatility_annualized: float = Field(..., ge=0.0, le=2.0)

    # Optional: Current regime for hysteresis
    current_regime: Optional[MarketRegime] = None

    # Optional: Regime history for transition dampening
    regime_history: List['RegimeHistoryEntry'] = Field(default_factory=list)

    # Optional: Additional market signals
    equity_bond_correlation: Optional[float] = Field(None, ge=-1.0, le=1.0)
    credit_spread: Optional[float] = Field(None, ge=0.0)


class RegimeHistoryEntry(BaseModel):
    """Historical regime entry for transition dampening."""
    model_config = ConfigDict(extra='forbid', frozen=True)

    regime: MarketRegime
    start_date: datetime
    end_date: Optional[datetime] = None


class RegimeOutput(BaseModel):
    """Output from regime classification."""
    model_config = ConfigDict(extra='forbid')

    regime: MarketRegime
    confidence: float = Field(..., ge=0.0, le=1.0)

    # Signal strengths
    return_signal: float = Field(..., ge=-1.0, le=1.0)  # -1 bear, +1 bull
    volatility_signal: float = Field(..., ge=0.0, le=1.0)  # 0 low, 1 high

    # Regime stability
    days_in_current_regime: int = Field(0, ge=0)
    transition_blocked: bool = False  # True if dampening prevented transition

    # Metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
# Classifier
# ===========================================================================

class RegimeClassifier:
    """
    Market regime classifier with hysteresis and transition dampening.

    Thread-safe, stateless (regime history passed as input).
    """

    def __init__(self, config: RegimeConfig = RegimeConfig()):
        self.config = config
        self.thresholds = config.thresholds

    def classify(self, input_data: RegimeInput) -> RegimeOutput:
        """
        Classify market regime based on returns and volatility.

        Args:
            input_data: Market data and optional regime history

        Returns:
            RegimeOutput with classification and metadata
        """
        ret = input_data.trailing_return_annualized
        vol = input_data.realized_volatility_annualized
        current = input_data.current_regime

        # Calculate raw signals
        return_signal = self._calculate_return_signal(ret)
        volatility_signal = self._calculate_volatility_signal(vol)

        # Classify regime without hysteresis
        raw_regime = self._classify_raw(return_signal, volatility_signal)

        # Apply hysteresis if current regime exists
        if current is not None:
            regime = self._apply_hysteresis(
                raw_regime, current, ret, vol
            )
        else:
            regime = raw_regime

        # Calculate days in current regime
        days_in_regime = self._calculate_days_in_regime(
            input_data.regime_history, regime
        )

        # Check transition dampening
        transition_blocked = False
        if (
            self.config.enable_transition_dampening
            and current is not None
            and regime != current
            and days_in_regime < self.config.min_regime_duration_days
        ):
            # Block transition - stay in current regime
            regime = current
            transition_blocked = True

        # Calculate confidence
        confidence = self._calculate_confidence(
            return_signal, volatility_signal, transition_blocked
        )

        return RegimeOutput(
            regime=regime,
            confidence=confidence,
            return_signal=return_signal,
            volatility_signal=volatility_signal,
            days_in_current_regime=days_in_regime,
            transition_blocked=transition_blocked,
        )

    def _calculate_return_signal(self, annualized_return: float) -> float:
        """
        Convert return to signal: -1 (bear) to +1 (bull).

        Maps:
        - return < bear_threshold → -1
        - return > bull_threshold → +1
        - in between → linear interpolation
        """
        bear = self.thresholds.bear_return_threshold
        bull = self.thresholds.bull_return_threshold

        if annualized_return <= bear:
            return -1.0
        elif annualized_return >= bull:
            return 1.0
        else:
            # Linear interpolation
            range_width = bull - bear
            signal = (annualized_return - bear) / range_width
            return signal * 2 - 1  # Map [0, 1] to [-1, 1]

    def _calculate_volatility_signal(self, annualized_vol: float) -> float:
        """
        Convert volatility to signal: 0 (low) to 1 (high).

        Maps:
        - vol < low_vol_threshold → 0
        - vol > high_vol_threshold → 1
        - in between → linear interpolation
        """
        low = self.thresholds.low_vol_threshold
        high = self.thresholds.high_vol_threshold

        if annualized_vol <= low:
            return 0.0
        elif annualized_vol >= high:
            return 1.0
        else:
            # Linear interpolation
            range_width = high - low
            return (annualized_vol - low) / range_width

    def _classify_raw(
        self, return_signal: float, volatility_signal: float
    ) -> MarketRegime:
        """
        Classify regime based on signals (no hysteresis).

        Logic:
        - return_signal > 0.5 → BULL
        - return_signal < -0.5 → BEAR
        - else → SIDEWAYS

        - volatility_signal > 0.6 → HIGH_VOL
        - volatility_signal < 0.4 → LOW_VOL
        """
        # Determine direction
        if return_signal > 0.5:
            direction = "BULL"
        elif return_signal < -0.5:
            direction = "BEAR"
        else:
            direction = "SIDEWAYS"

        # Determine volatility regime
        if volatility_signal > 0.6:
            vol_regime = "HIGH_VOL"
        elif volatility_signal < 0.4:
            vol_regime = "LOW_VOL"
        else:
            vol_regime = "MID_VOL"

        # Combine
        if direction == "SIDEWAYS":
            return MarketRegime.SIDEWAYS
        elif direction == "BULL":
            if vol_regime == "LOW_VOL":
                return MarketRegime.BULL_LOW_VOL
            else:  # HIGH_VOL or MID_VOL
                return MarketRegime.BULL_HIGH_VOL
        else:  # BEAR
            if vol_regime == "LOW_VOL":
                return MarketRegime.BEAR_LOW_VOL
            else:  # HIGH_VOL or MID_VOL (crisis)
                return MarketRegime.BEAR_HIGH_VOL

    def _apply_hysteresis(
        self,
        raw_regime: MarketRegime,
        current_regime: MarketRegime,
        ret: float,
        vol: float,
    ) -> MarketRegime:
        """
        Apply hysteresis to prevent regime flickering.

        Once in a regime, require stronger signal to transition out.
        Adjust thresholds by hysteresis buffers.
        """
        if raw_regime == current_regime:
            return current_regime

        # Check if transition is justified with hysteresis
        # Require stronger signal to exit current regime

        # For return-based transitions
        ret_buffer = self.thresholds.hysteresis_return_buffer
        vol_buffer = self.thresholds.hysteresis_vol_buffer

        # If currently in BULL, need return to drop below (bear_threshold - buffer)
        if "BULL" in current_regime.value:
            if ret > self.thresholds.bear_return_threshold + ret_buffer:
                # Not bearish enough to exit bull
                # Check if only volatility changed
                if "LOW_VOL" in current_regime.value and vol > self.thresholds.high_vol_threshold:
                    return MarketRegime.BULL_HIGH_VOL
                elif "HIGH_VOL" in current_regime.value and vol < self.thresholds.low_vol_threshold:
                    return MarketRegime.BULL_LOW_VOL
                return current_regime

        # If currently in BEAR, need return to rise above (bull_threshold + buffer)
        if "BEAR" in current_regime.value:
            if ret < self.thresholds.bull_return_threshold - ret_buffer:
                # Not bullish enough to exit bear
                # Check if only volatility changed
                if "LOW_VOL" in current_regime.value and vol > self.thresholds.high_vol_threshold:
                    return MarketRegime.BEAR_HIGH_VOL
                elif "HIGH_VOL" in current_regime.value and vol < self.thresholds.low_vol_threshold:
                    return MarketRegime.BEAR_LOW_VOL
                return current_regime

        # If currently SIDEWAYS, need stronger signal to exit
        if current_regime == MarketRegime.SIDEWAYS:
            if abs(ret) < self.thresholds.bull_return_threshold - ret_buffer:
                return current_regime

        # Transition justified
        return raw_regime

    def _calculate_days_in_regime(
        self, history: List[RegimeHistoryEntry], current_regime: MarketRegime
    ) -> int:
        """Calculate days in current regime from history."""
        if not history:
            return 0

        # Find most recent regime
        latest = history[-1]

        if latest.regime != current_regime:
            return 0

        if latest.end_date is None:
            # Still in this regime
            days = (datetime.utcnow() - latest.start_date).days
            return max(0, days)

        return 0

    def _calculate_confidence(
        self,
        return_signal: float,
        volatility_signal: float,
        transition_blocked: bool,
    ) -> float:
        """
        Calculate confidence in regime classification.

        Higher confidence when:
        - Signals are strong (far from thresholds)
        - Not near regime boundaries
        - Transition not blocked
        """
        # Base confidence from signal strengths
        # Closer to extremes (-1/1 for returns, 0/1 for vol) = higher confidence
        return_confidence = abs(return_signal)  # 0 to 1
        vol_confidence = min(volatility_signal, 1 - volatility_signal) * 2  # 0 to 1

        base_confidence = (return_confidence + vol_confidence) / 2

        # Reduce confidence if transition was blocked
        if transition_blocked:
            base_confidence *= 0.7

        return min(1.0, max(0.0, base_confidence))


# ===========================================================================
# Helper Functions
# ===========================================================================

def classify_regime(
    trailing_return: float,
    realized_volatility: float,
    current_regime: Optional[MarketRegime] = None,
    config: RegimeConfig = RegimeConfig(),
) -> RegimeOutput:
    """
    Convenience function for regime classification.

    Args:
        trailing_return: Annualized return (e.g., 0.10 = 10%)
        realized_volatility: Annualized volatility (e.g., 0.20 = 20%)
        current_regime: Current regime for hysteresis (optional)
        config: Configuration for classifier

    Returns:
        RegimeOutput with classification

    Example:
        >>> output = classify_regime(0.15, 0.12)
        >>> output.regime
        <MarketRegime.BULL_LOW_VOL: 'bull_low_vol'>
    """
    classifier = RegimeClassifier(config)
    input_data = RegimeInput(
        trailing_return_annualized=trailing_return,
        realized_volatility_annualized=realized_volatility,
        current_regime=current_regime,
    )
    return classifier.classify(input_data)


def get_regime_expected_return_multiplier(regime: MarketRegime) -> float:
    """
    Get expected return multiplier for regime.

    Used by returns.py to adjust baseline returns.

    Returns:
        Multiplier (1.0 = baseline)

    Example:
        >>> get_regime_expected_return_multiplier(MarketRegime.BULL_LOW_VOL)
        1.2  # 20% boost in bull market
    """
    multipliers = {
        MarketRegime.BULL_LOW_VOL: 1.2,
        MarketRegime.BULL_HIGH_VOL: 1.1,
        MarketRegime.SIDEWAYS: 1.0,
        MarketRegime.BEAR_LOW_VOL: 0.7,
        MarketRegime.BEAR_HIGH_VOL: 0.5,  # Crisis
    }
    return multipliers.get(regime, 1.0)


def get_regime_volatility_multiplier(regime: MarketRegime) -> float:
    """
    Get expected volatility multiplier for regime.

    Used by returns.py to adjust baseline volatility.

    Returns:
        Multiplier (1.0 = baseline)

    Example:
        >>> get_regime_volatility_multiplier(MarketRegime.BEAR_HIGH_VOL)
        2.0  # Double volatility in crisis
    """
    multipliers = {
        MarketRegime.BULL_LOW_VOL: 0.7,
        MarketRegime.BULL_HIGH_VOL: 1.3,
        MarketRegime.SIDEWAYS: 1.0,
        MarketRegime.BEAR_LOW_VOL: 1.2,
        MarketRegime.BEAR_HIGH_VOL: 2.0,  # Crisis
    }
    return multipliers.get(regime, 1.0)


def get_regime_correlation_adjustment(regime: MarketRegime) -> float:
    """
    Get correlation adjustment for regime.

    In crisis, correlations go to 1 (all assets fall together).
    In bull markets, correlations may be lower (diversification works).

    Returns:
        Adjustment to add to baseline correlation (-0.3 to +0.3)

    Example:
        >>> get_regime_correlation_adjustment(MarketRegime.BEAR_HIGH_VOL)
        0.3  # Increase correlations by 0.3 in crisis
    """
    adjustments = {
        MarketRegime.BULL_LOW_VOL: -0.1,  # Lower correlations
        MarketRegime.BULL_HIGH_VOL: 0.0,
        MarketRegime.SIDEWAYS: 0.0,
        MarketRegime.BEAR_LOW_VOL: 0.1,
        MarketRegime.BEAR_HIGH_VOL: 0.3,  # Crisis correlation
    }
    return adjustments.get(regime, 0.0)
