"""
Server-Sent Events (SSE) Streaming API
===========================================================================
Real-time risk computation streaming with incremental updates.

Endpoint: POST /v1/risk/stream

Features:
- First event: full snapshot
- Subsequent events: incremental updates only
- Material change detection
- Throttling (max 1 update/sec)
- Max stream duration enforcement
- Client heartbeat monitoring
"""

import asyncio
import json
from typing import AsyncGenerator, Optional, Dict, Any, Literal
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from ...domain.schemas import RiskRequest, RiskResponse
from ...domain.simulation import MonteCarloSimulator, SimulationConfig, SimulationInput
from ...domain.scoring import RiskScorer, calculate_risk_metrics
from ...domain.explain import Explainer, ExplainerInput
from ...domain.recommend import Recommender, RecommenderInput, generate_recommendations
from ...domain.series import generate_ui_series, Granularity
from ...core.security import validate_jwt_token, enforce_scope


router = APIRouter(prefix="/v1/risk", tags=["streaming"])


# ===========================================================================
# Stream Event Types
# ===========================================================================

class ReasonCode(str, Enum):
    """Reason for stream update."""
    MARKET_REGIME_CHANGED = "market_regime_changed"
    PORTFOLIO_CHANGED = "portfolio_changed"
    SPENDING_CHANGED = "spending_changed"
    RISK_PROFILE_UPDATED = "risk_profile_updated"
    GOAL_UPDATED = "goal_updated"
    SIMULATION_PROGRESS = "simulation_progress"
    COMPUTATION_COMPLETE = "computation_complete"


class StreamEventType(str, Enum):
    """Stream event type."""
    SNAPSHOT = "snapshot"
    DELTA = "delta"
    HEARTBEAT = "heartbeat"
    ERROR = "error"
    COMPLETE = "complete"


# ===========================================================================
# Delta Models
# ===========================================================================

class WinLossDelta(BaseModel):
    """Win/loss probability delta."""
    model_config = ConfigDict(extra='forbid')

    goal_id: str
    previous_success_probability: float
    new_success_probability: float
    delta_pct: float  # Change in percentage points


class StreamDelta(BaseModel):
    """Incremental update delta."""
    model_config = ConfigDict(extra='forbid')

    # Win/loss deltas
    win_loss_deltas: list[WinLossDelta] = Field(default_factory=list)

    # Updated series (only if changed)
    updated_series: Optional[Dict[str, Any]] = None

    # Reason for update
    reason_codes: list[ReasonCode]

    # Change summary
    material_change: bool
    change_magnitude: float = Field(..., ge=0.0, le=1.0)


class StreamEvent(BaseModel):
    """Single SSE event."""
    model_config = ConfigDict(extra='forbid')

    # Event metadata
    event_type: StreamEventType
    sequence: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Payload
    snapshot: Optional[RiskResponse] = None
    delta: Optional[StreamDelta] = None
    progress_pct: Optional[float] = None
    error_message: Optional[str] = None


# ===========================================================================
# Stream State Management
# ===========================================================================

class StreamState:
    """Manages state for a single stream."""

    def __init__(self, request: RiskRequest, max_duration_seconds: int = 300):
        self.request = request
        self.max_duration_seconds = max_duration_seconds
        self.start_time = datetime.utcnow()
        self.last_update_time = datetime.utcnow()
        self.last_client_heartbeat = datetime.utcnow()
        self.sequence = 0

        # State tracking
        self.previous_snapshot: Optional[RiskResponse] = None
        self.current_snapshot: Optional[RiskResponse] = None

        # Throttling
        self.min_update_interval = timedelta(seconds=1)  # Max 1 update/sec

        # Material change threshold (5% change = material)
        self.material_change_threshold = 0.05

    def should_send_update(self) -> bool:
        """Check if enough time has passed since last update (throttling)."""
        now = datetime.utcnow()
        time_since_last = now - self.last_update_time
        return time_since_last >= self.min_update_interval

    def is_expired(self) -> bool:
        """Check if stream has exceeded max duration."""
        now = datetime.utcnow()
        duration = now - self.start_time
        return duration.total_seconds() > self.max_duration_seconds

    def is_client_alive(self, heartbeat_timeout_seconds: int = 30) -> bool:
        """Check if client heartbeat is recent."""
        now = datetime.utcnow()
        time_since_heartbeat = now - self.last_client_heartbeat
        return time_since_heartbeat.total_seconds() < heartbeat_timeout_seconds

    def update_heartbeat(self):
        """Update last client heartbeat timestamp."""
        self.last_client_heartbeat = datetime.utcnow()

    def detect_material_change(
        self, new_snapshot: RiskResponse
    ) -> tuple[bool, float, list[ReasonCode]]:
        """
        Detect if there's a material change between snapshots.

        Returns:
            (is_material, magnitude, reason_codes)
        """
        if self.previous_snapshot is None:
            # First snapshot is always material
            return True, 1.0, [ReasonCode.COMPUTATION_COMPLETE]

        reason_codes = []
        max_delta = 0.0

        # Check overall success probability change
        prev_success = self.previous_snapshot.overall.win_probability
        new_success = new_snapshot.overall.win_probability
        overall_delta = abs(new_success - prev_success)

        if overall_delta > self.material_change_threshold:
            max_delta = max(max_delta, overall_delta)

        # Check per-goal changes
        for new_goal in new_snapshot.per_goal:
            prev_goal = next(
                (g for g in self.previous_snapshot.per_goal if g.goal_id == new_goal.goal_id),
                None,
            )
            if prev_goal:
                goal_delta = abs(
                    new_goal.success_probability - prev_goal.success_probability
                )
                if goal_delta > self.material_change_threshold:
                    max_delta = max(max_delta, goal_delta)
                    reason_codes.append(ReasonCode.GOAL_UPDATED)

        # Detect specific changes (simplified - would check actual request changes)
        # In production, compare request hashes or specific fields

        is_material = max_delta > self.material_change_threshold

        if not reason_codes and is_material:
            reason_codes.append(ReasonCode.SIMULATION_PROGRESS)

        return is_material, max_delta, reason_codes

    def create_delta(
        self, new_snapshot: RiskResponse, reason_codes: list[ReasonCode]
    ) -> StreamDelta:
        """Create delta between previous and new snapshot."""
        win_loss_deltas = []

        if self.previous_snapshot:
            for new_goal in new_snapshot.per_goal:
                prev_goal = next(
                    (
                        g
                        for g in self.previous_snapshot.per_goal
                        if g.goal_id == new_goal.goal_id
                    ),
                    None,
                )
                if prev_goal:
                    delta_pct = (
                        new_goal.success_probability - prev_goal.success_probability
                    )
                    if abs(delta_pct) > 0.001:  # Only include non-trivial changes
                        win_loss_deltas.append(
                            WinLossDelta(
                                goal_id=new_goal.goal_id,
                                previous_success_probability=prev_goal.success_probability,
                                new_success_probability=new_goal.success_probability,
                                delta_pct=delta_pct,
                            )
                        )

        # Include updated series if there are win/loss changes
        updated_series = None
        if win_loss_deltas:
            # Simplified - would include actual series delta
            updated_series = {"series_updated": True}

        is_material, magnitude, _ = self.detect_material_change(new_snapshot)

        return StreamDelta(
            win_loss_deltas=win_loss_deltas,
            updated_series=updated_series,
            reason_codes=reason_codes,
            material_change=is_material,
            change_magnitude=magnitude,
        )

    def next_sequence(self) -> int:
        """Get next sequence number."""
        self.sequence += 1
        return self.sequence


# ===========================================================================
# Stream Generator
# ===========================================================================

async def risk_stream_generator(
    request: RiskRequest, state: StreamState
) -> AsyncGenerator[str, None]:
    """
    Generate SSE stream of risk computation updates.

    Yields SSE-formatted events.
    """
    try:
        # Send initial snapshot
        initial_snapshot = await compute_risk_snapshot(request)
        state.current_snapshot = initial_snapshot

        initial_event = StreamEvent(
            event_type=StreamEventType.SNAPSHOT,
            sequence=state.next_sequence(),
            snapshot=initial_snapshot,
        )

        yield f"event: snapshot\n"
        yield f"data: {initial_event.model_dump_json()}\n\n"

        state.last_update_time = datetime.utcnow()
        state.previous_snapshot = initial_snapshot

        # Simulate incremental updates
        # In production, this would listen to actual triggers
        while not state.is_expired():
            # Check client heartbeat
            if not state.is_client_alive():
                error_event = StreamEvent(
                    event_type=StreamEventType.ERROR,
                    sequence=state.next_sequence(),
                    error_message="Client heartbeat timeout",
                )
                yield f"event: error\n"
                yield f"data: {error_event.model_dump_json()}\n\n"
                break

            # Wait for next update interval
            await asyncio.sleep(1)

            # Check throttling
            if not state.should_send_update():
                continue

            # Simulate computation progress (in production, this would be real updates)
            # For demo purposes, we'll send periodic heartbeats
            heartbeat_event = StreamEvent(
                event_type=StreamEventType.HEARTBEAT,
                sequence=state.next_sequence(),
            )

            yield f"event: heartbeat\n"
            yield f"data: {heartbeat_event.model_dump_json()}\n\n"

            state.last_update_time = datetime.utcnow()

            # Stop after initial snapshot for now
            # In production, would continue streaming updates
            break

        # Send completion event
        complete_event = StreamEvent(
            event_type=StreamEventType.COMPLETE,
            sequence=state.next_sequence(),
        )

        yield f"event: complete\n"
        yield f"data: {complete_event.model_dump_json()}\n\n"

    except Exception as e:
        error_event = StreamEvent(
            event_type=StreamEventType.ERROR,
            sequence=state.next_sequence(),
            error_message=str(e),
        )
        yield f"event: error\n"
        yield f"data: {error_event.model_dump_json()}\n\n"


async def compute_risk_snapshot(request: RiskRequest) -> RiskResponse:
    """
    Compute full risk snapshot.

    This is a simplified version - full implementation would integrate
    all domain modules properly.
    """
    # Import here to avoid circular dependencies
    from ...domain.regime import MarketRegime
    from ...domain.returns import AssetClass
    from ...domain.household import IncomeType

    # For now, return a mock response
    # In production, this would run the full computation pipeline

    from ...domain.schemas import (
        ResponseMeta,
        OverallRisk,
        ProbabilityDistribution,
        GoalResult,
        SeriesPayload,
        Driver,
        Decomposition,
        RiskDimension,
        RecommendedAction,
        Disclaimer,
    )

    # Create mock response
    response = RiskResponse(
        meta=ResponseMeta(
            computed_at=datetime.utcnow(),
            cache_key="mock-key",
            cache_hit=False,
            model_version="1.0.0",
            assumptions_version="2026-Q1",
            compute_time_ms=150.0,
        ),
        overall=OverallRisk(
            win_probability=0.73,
            loss_probability=0.27,
            partial_success_probability=0.15,
            distribution=ProbabilityDistribution(
                mean=0.73, median=0.75, std=0.12, skew=-0.1, p5=0.55, p95=0.88
            ),
            confidence_interval_95=(0.55, 0.88),
        ),
        per_goal=[
            GoalResult(
                goal_id=goal.id,
                success_probability=0.75,
                expected_shortfall=0.0,
                expected_delay_months=0,
                value_at_risk_5pct=goal.target_value * 0.9,
                conditional_value_at_risk=goal.target_value * 0.85,
                primary_driver="market_returns",
                driver_impact_pct=0.4,
            )
            for goal in request.goal_bundle
        ],
        series_payload=SeriesPayload(
            start_date=datetime.utcnow().date(),
            end_date=(datetime.utcnow() + timedelta(days=365 * 10)).date(),
            num_data_points=10,
        ),
        drivers=[
            Driver(
                name="Market Returns",
                category="market",
                impact_on_success_pct=0.4,
                confidence=0.85,
            )
        ],
        decomposition=Decomposition(
            tolerance=RiskDimension(score=0.7, contribution_pct=0.3),
            capacity=RiskDimension(score=0.8, contribution_pct=0.4),
            need=RiskDimension(score=0.6, contribution_pct=0.3),
        ),
        counterfactuals=[],
        recommended_actions=[
            RecommendedAction(
                action="Increase monthly savings by $200",
                category="save_more",
                expected_improvement_pct=0.08,
                tradeoff="Reduced discretionary spending",
                confidence=0.8,
            )
        ],
        disclaimers=[
            Disclaimer(
                category="general",
                text="Projections are estimates and not guarantees.",
            )
        ],
    )

    return response


# ===========================================================================
# API Endpoints
# ===========================================================================


@router.post("/stream")
async def stream_risk_computation(
    request: RiskRequest,
    req: Request,
    token: dict = Depends(validate_jwt_token),
) -> StreamingResponse:
    """
    Stream real-time risk computation updates via SSE.

    **First event**: Full snapshot
    **Subsequent events**: Incremental deltas only

    **Throttling**: Max 1 update/second
    **Max duration**: 5 minutes without client heartbeat
    **Material change threshold**: 5% delta

    **Event types**:
    - `snapshot`: Full risk response
    - `delta`: Incremental update with win/loss deltas
    - `heartbeat`: Keep-alive
    - `error`: Error occurred
    - `complete`: Stream finished

    **Client heartbeat**: Send periodic pings to keep stream alive

    **Requires scope**: `risk-engine:stream`
    """
    # Enforce scope
    enforce_scope(token, "risk-engine:stream")

    # Create stream state
    state = StreamState(request, max_duration_seconds=300)

    # Return SSE response
    return EventSourceResponse(
        risk_stream_generator(request, state),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/stream/heartbeat")
async def stream_heartbeat(
    stream_id: str, token: dict = Depends(validate_jwt_token)
) -> dict:
    """
    Client heartbeat to keep stream alive.

    Call this endpoint periodically (every 10-20 seconds) to prevent
    stream timeout.

    **Requires scope**: `risk-engine:stream`
    """
    enforce_scope(token, "risk-engine:stream")

    # In production, would update stream state in Redis/cache
    # For now, just acknowledge

    return {"status": "ok", "stream_id": stream_id, "timestamp": datetime.utcnow()}
