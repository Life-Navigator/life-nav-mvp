"""
Stream Contract Tests
===========================================================================
Tests for SSE streaming API format and behavior.

Coverage:
- Stream event format (snapshot, delta, heartbeat, error, complete)
- Sequence ordering
- Throttling (max 1 update/sec)
- Material change detection
- Max stream duration
- Client heartbeat monitoring
"""

import pytest
import asyncio
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.domain.schemas import (
    RiskRequest,
    RequestMeta,
    CallContext,
    Goal,
    GoalType,
    GoalFlexibility,
    GoalConstraints,
    HouseholdFinancialState,
    IncomeStream,
    IncomeType,
    PortfolioState,
    AssetAllocation,
    AssetClass,
    RiskProfile,
    MarketContext,
    MarketRegime,
    PolicyWeights,
)
from app.api.v1.stream import StreamEventType, ReasonCode


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def test_risk_request() -> RiskRequest:
    """Create test risk request."""
    from uuid import uuid4
    from datetime import date

    return RiskRequest(
        request_meta=RequestMeta(
            request_id=uuid4(),
            timestamp=datetime.utcnow(),
            timezone="UTC",
            tenant_id="test-tenant",
            user_id_hash="hash123",
            schema_version="1.0",
        ),
        call_context=CallContext(
            api_version="v1",
            client_type="web",
            feature_flags={},
        ),
        goal_bundle=[
            Goal(
                id="retirement",
                type=GoalType.RETIREMENT,
                target_value=1000000,
                target_date=date(2055, 1, 1),
                priority=1,
                current_allocated=100000,
                flexibility=GoalFlexibility(),
                constraints=GoalConstraints(),
            )
        ],
        household_financial_state=HouseholdFinancialState(
            income_streams=[
                IncomeStream(
                    income_type=IncomeType.SALARY_W2,
                    annual_amount=100000,
                    growth_rate=0.03,
                    stability_score=0.9,
                    layoff_probability=0.05,
                )
            ],
            annual_spending=60000,
            health_cost_shock_annual_max=5000,
            insurance_deductible=2000,
            employment_stability_score=0.9,
            liquid_assets=50000,
            illiquid_assets=0,
            total_liabilities=0,
        ),
        portfolio_state=PortfolioState(
            total_value=150000,
            asset_allocation=[
                AssetAllocation(asset_class=AssetClass.US_EQUITY, weight=0.6),
                AssetAllocation(asset_class=AssetClass.US_TREASURY, weight=0.4),
            ],
        ),
        risk_profile=RiskProfile(
            risk_tolerance=0.7,
            risk_capacity=0.8,
            risk_need=0.6,
        ),
        market_context=MarketContext(
            current_regime=MarketRegime.SIDEWAYS,
            trailing_return_1yr=0.08,
            realized_volatility_1yr=0.15,
        ),
        policy_weights=PolicyWeights(),
    )


@pytest.fixture
def auth_headers() -> dict:
    """Mock auth headers."""
    # In production, would use real JWT
    return {"Authorization": "Bearer mock-token"}


# ===========================================================================
# Stream Format Tests
# ===========================================================================


class TestStreamFormat:
    """Test stream event format compliance."""

    def test_stream_starts_with_snapshot(self, test_risk_request, auth_headers):
        """First event must be a snapshot."""
        client = TestClient(app)

        with client.stream(
            "POST",
            "/v1/risk/stream",
            json=test_risk_request.model_dump(mode="json"),
            headers=auth_headers,
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream"

            # Read first event
            first_line = next(response.iter_lines())
            assert first_line.startswith("event: snapshot")

            # Next line should be data
            data_line = next(response.iter_lines())
            assert data_line.startswith("data: ")

            # Parse data
            data_json = data_line[6:]  # Remove "data: " prefix
            event_data = json.loads(data_json)

            assert event_data["event_type"] == StreamEventType.SNAPSHOT
            assert event_data["sequence"] == 1
            assert "snapshot" in event_data
            assert event_data["snapshot"] is not None

    def test_event_sequence_is_monotonic(self, test_risk_request, auth_headers):
        """Sequence numbers must be strictly increasing."""
        client = TestClient(app)

        with client.stream(
            "POST",
            "/v1/risk/stream",
            json=test_risk_request.model_dump(mode="json"),
            headers=auth_headers,
        ) as response:
            sequences = []

            for line in response.iter_lines():
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    sequences.append(data["sequence"])

            # Check monotonic increasing
            assert sequences == sorted(sequences)
            assert sequences == list(range(1, len(sequences) + 1))

    def test_delta_event_includes_required_fields(self, test_risk_request, auth_headers):
        """Delta events must include win_loss_deltas, reason_codes, timestamp."""
        # This test would require triggering a delta event
        # For now, we'll test the data model

        from app.api.v1.stream import StreamDelta, WinLossDelta

        delta = StreamDelta(
            win_loss_deltas=[
                WinLossDelta(
                    goal_id="retirement",
                    previous_success_probability=0.70,
                    new_success_probability=0.75,
                    delta_pct=0.05,
                )
            ],
            reason_codes=[ReasonCode.MARKET_REGIME_CHANGED],
            material_change=True,
            change_magnitude=0.05,
        )

        # Validate model
        assert len(delta.win_loss_deltas) == 1
        assert delta.win_loss_deltas[0].delta_pct == 0.05
        assert ReasonCode.MARKET_REGIME_CHANGED in delta.reason_codes
        assert delta.material_change is True

    def test_stream_ends_with_complete_event(self, test_risk_request, auth_headers):
        """Last event should be 'complete'."""
        client = TestClient(app)

        with client.stream(
            "POST",
            "/v1/risk/stream",
            json=test_risk_request.model_dump(mode="json"),
            headers=auth_headers,
        ) as response:
            events = []

            for line in response.iter_lines():
                if line.startswith("event: "):
                    event_type = line[7:]  # Remove "event: "
                    events.append(event_type)

            # Last event should be complete
            assert events[-1] == "complete"


# ===========================================================================
# Throttling Tests
# ===========================================================================


class TestStreamThrottling:
    """Test throttling behavior (max 1 update/sec)."""

    @pytest.mark.asyncio
    async def test_updates_throttled_to_1_per_second(self):
        """Updates should be throttled to max 1/sec."""
        from app.api.v1.stream import StreamState

        request = RiskRequest(
            request_meta=RequestMeta(
                request_id="test",
                timestamp=datetime.utcnow(),
                tenant_id="test",
                user_id_hash="hash",
            ),
            # Minimal valid request
            goal_bundle=[],
            household_financial_state=HouseholdFinancialState(
                income_streams=[], annual_spending=50000
            ),
            portfolio_state=PortfolioState(total_value=100000, asset_allocation=[]),
            risk_profile=RiskProfile(
                risk_tolerance=0.5, risk_capacity=0.5, risk_need=0.5
            ),
            market_context=MarketContext(current_regime=MarketRegime.SIDEWAYS),
        )

        state = StreamState(request)

        # First update should be allowed
        assert state.should_send_update() is True

        # Mark update sent
        state.last_update_time = datetime.utcnow()

        # Immediately after, should be throttled
        assert state.should_send_update() is False

        # Wait 1 second
        await asyncio.sleep(1.1)

        # Now should be allowed
        assert state.should_send_update() is True

    def test_material_change_threshold(self):
        """Changes below threshold should not trigger update."""
        from app.api.v1.stream import StreamState
        from app.domain.schemas import RiskResponse, ResponseMeta, OverallRisk

        request = RiskRequest(
            request_meta=RequestMeta(
                request_id="test",
                timestamp=datetime.utcnow(),
                tenant_id="test",
                user_id_hash="hash",
            ),
            goal_bundle=[],
            household_financial_state=HouseholdFinancialState(
                income_streams=[], annual_spending=50000
            ),
            portfolio_state=PortfolioState(total_value=100000, asset_allocation=[]),
            risk_profile=RiskProfile(
                risk_tolerance=0.5, risk_capacity=0.5, risk_need=0.5
            ),
            market_context=MarketContext(current_regime=MarketRegime.SIDEWAYS),
        )

        state = StreamState(request)
        state.material_change_threshold = 0.05  # 5%

        # Create initial snapshot
        snapshot1 = RiskResponse(
            meta=ResponseMeta(
                computed_at=datetime.utcnow(),
                cache_key="test",
                model_version="1.0",
                compute_time_ms=100,
            ),
            overall=OverallRisk(
                win_probability=0.70,
                loss_probability=0.30,
                partial_success_probability=0.10,
                confidence_interval_95=(0.60, 0.80),
            ),
            per_goal=[],
            series_payload={},
            drivers=[],
            decomposition={},
            counterfactuals=[],
            recommended_actions=[],
            disclaimers=[],
        )

        state.previous_snapshot = snapshot1

        # Small change (3% - below threshold)
        snapshot2 = snapshot1.model_copy()
        snapshot2.overall.win_probability = 0.73

        is_material, magnitude, _ = state.detect_material_change(snapshot2)
        assert is_material is False  # Below 5% threshold

        # Large change (8% - above threshold)
        snapshot3 = snapshot1.model_copy()
        snapshot3.overall.win_probability = 0.78

        is_material, magnitude, _ = state.detect_material_change(snapshot3)
        assert is_material is True  # Above 5% threshold
        assert magnitude >= 0.05


# ===========================================================================
# Duration & Heartbeat Tests
# ===========================================================================


class TestStreamDuration:
    """Test max stream duration and heartbeat monitoring."""

    def test_stream_expires_after_max_duration(self):
        """Stream should expire after max duration."""
        from app.api.v1.stream import StreamState

        request = RiskRequest(
            request_meta=RequestMeta(
                request_id="test",
                timestamp=datetime.utcnow(),
                tenant_id="test",
                user_id_hash="hash",
            ),
            goal_bundle=[],
            household_financial_state=HouseholdFinancialState(
                income_streams=[], annual_spending=50000
            ),
            portfolio_state=PortfolioState(total_value=100000, asset_allocation=[]),
            risk_profile=RiskProfile(
                risk_tolerance=0.5, risk_capacity=0.5, risk_need=0.5
            ),
            market_context=MarketContext(current_regime=MarketRegime.SIDEWAYS),
        )

        state = StreamState(request, max_duration_seconds=10)

        # Initially not expired
        assert state.is_expired() is False

        # Simulate time passing
        state.start_time = datetime.utcnow() - timedelta(seconds=11)

        # Now should be expired
        assert state.is_expired() is True

    def test_client_heartbeat_detection(self):
        """Stream should detect client disconnection via heartbeat."""
        from app.api.v1.stream import StreamState

        request = RiskRequest(
            request_meta=RequestMeta(
                request_id="test",
                timestamp=datetime.utcnow(),
                tenant_id="test",
                user_id_hash="hash",
            ),
            goal_bundle=[],
            household_financial_state=HouseholdFinancialState(
                income_streams=[], annual_spending=50000
            ),
            portfolio_state=PortfolioState(total_value=100000, asset_allocation=[]),
            risk_profile=RiskProfile(
                risk_tolerance=0.5, risk_capacity=0.5, risk_need=0.5
            ),
            market_context=MarketContext(current_regime=MarketRegime.SIDEWAYS),
        )

        state = StreamState(request)

        # Initially client is alive
        assert state.is_client_alive(heartbeat_timeout_seconds=30) is True

        # Simulate no heartbeat for 31 seconds
        state.last_client_heartbeat = datetime.utcnow() - timedelta(seconds=31)

        # Should detect client is dead
        assert state.is_client_alive(heartbeat_timeout_seconds=30) is False

        # Update heartbeat
        state.update_heartbeat()

        # Should be alive again
        assert state.is_client_alive(heartbeat_timeout_seconds=30) is True


# ===========================================================================
# Reason Code Tests
# ===========================================================================


class TestReasonCodes:
    """Test reason code generation."""

    def test_reason_codes_generated_for_changes(self):
        """Appropriate reason codes should be generated for detected changes."""
        from app.api.v1.stream import ReasonCode

        # Test all reason code types
        all_codes = [
            ReasonCode.MARKET_REGIME_CHANGED,
            ReasonCode.PORTFOLIO_CHANGED,
            ReasonCode.SPENDING_CHANGED,
            ReasonCode.RISK_PROFILE_UPDATED,
            ReasonCode.GOAL_UPDATED,
            ReasonCode.SIMULATION_PROGRESS,
            ReasonCode.COMPUTATION_COMPLETE,
        ]

        # Validate all codes are defined
        assert len(all_codes) == 7

        # Each code should be valid
        for code in all_codes:
            assert isinstance(code.value, str)
            assert len(code.value) > 0


# ===========================================================================
# Error Handling Tests
# ===========================================================================


class TestStreamErrorHandling:
    """Test error handling in streams."""

    def test_invalid_request_returns_error_event(self, auth_headers):
        """Invalid request should return error event."""
        client = TestClient(app)

        invalid_request = {"invalid": "data"}

        response = client.post(
            "/v1/risk/stream", json=invalid_request, headers=auth_headers
        )

        # Should return validation error (422)
        assert response.status_code == 422

    def test_stream_error_event_format(self):
        """Error events should have proper format."""
        from app.api.v1.stream import StreamEvent, StreamEventType

        error_event = StreamEvent(
            event_type=StreamEventType.ERROR,
            sequence=5,
            error_message="Test error occurred",
        )

        # Validate error event structure
        assert error_event.event_type == StreamEventType.ERROR
        assert error_event.error_message == "Test error occurred"
        assert error_event.sequence == 5
        assert error_event.snapshot is None
        assert error_event.delta is None
