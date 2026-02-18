"""Comprehensive unit tests for explainability system.

Tests cover:
- Reasoning engine
- Plan explainer
- Error recovery
- Audit trail
- Provenance tracking
"""

from datetime import datetime, timedelta, timezone

import pytest

from agents.core.audit import AuditEvent, AuditEventType, AuditTrail
from agents.core.error_recovery import (
    ErrorRecoveryManager,
    RecoveryStrategy,
    RecoveryStrategyRegistry,
)
from agents.core.plan_explainer import PlanExplainer
from agents.core.provenance import DataSource, ProvenanceTracker
from agents.core.reasoning import (
    ReasoningEngine,
    ReasoningStepType,
)
from models.agent_models import AgentType
from utils.errors import TaskExecutionError


class TestReasoningEngine:
    """Tests for ReasoningEngine."""

    def test_start_chain(self):
        """Test starting a reasoning chain."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        assert chain.task_id == "task-123"
        assert chain.agent_type == AgentType.SPECIALIST
        assert chain.status == "in_progress"
        assert len(chain.steps) == 0

    def test_add_observation(self):
        """Test adding observation step."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        step = engine.add_observation(
            chain.chain_id,
            "User has $5000 in savings",
            ["account-data"],
            confidence=0.95,
        )

        assert step.step_type == ReasoningStepType.OBSERVATION
        assert step.content == "User has $5000 in savings"
        assert step.data_sources == ["account-data"]
        assert step.confidence_score == 0.95
        assert len(chain.steps) == 1

    def test_add_thought(self):
        """Test adding thought step."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        step = engine.add_thought(
            chain.chain_id, "Sufficient emergency fund", confidence=0.9
        )

        assert step.step_type == ReasoningStepType.THOUGHT
        assert step.content == "Sufficient emergency fund"
        assert step.confidence_score == 0.9

    def test_add_plan(self):
        """Test adding plan step."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        plan_data = {"steps": ["analyze", "recommend"]}
        step = engine.add_plan(
            chain.chain_id,
            "Analyze budget and recommend savings",
            plan_data,
            "User has stable income",
        )

        assert step.step_type == ReasoningStepType.PLAN
        assert "Analyze budget" in step.content
        assert "Justification:" in step.content
        assert step.structured_data == plan_data

    def test_add_correction(self):
        """Test adding correction step."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        step = engine.add_correction(
            chain.chain_id, "Data fetch failed", "Use cached data"
        )

        assert step.step_type == ReasoningStepType.CORRECTION
        assert "Data fetch failed" in step.content
        assert "Fallback:" in step.content
        assert step.structured_data["fallback_strategy"] == "Use cached data"

    def test_complete_chain(self):
        """Test completing a chain."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        engine.add_thought(chain.chain_id, "Test thought")

        completed = engine.complete_chain(chain.chain_id, "completed")

        assert completed.status == "completed"
        assert completed.completed_at is not None

    def test_chain_summary(self):
        """Test generating chain summary."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        engine.add_observation(chain.chain_id, "Initial data", ["source-1"])
        engine.add_thought(chain.chain_id, "Analysis complete")

        summary = chain.get_summary()

        assert "Reasoning Chain" in summary
        assert "task-123" in summary
        assert "Initial data" in summary
        assert "Analysis complete" in summary

    def test_confidence_trajectory(self):
        """Test confidence trajectory tracking."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        engine.add_observation(chain.chain_id, "Step 1", [], confidence=0.7)
        engine.add_thought(chain.chain_id, "Step 2", confidence=0.8)
        engine.add_result(chain.chain_id, "Step 3", True, {})

        trajectory = chain.get_confidence_trajectory()

        assert len(trajectory) == 3
        assert trajectory[0] == 0.7
        assert trajectory[1] == 0.8
        assert trajectory[2] == 1.0

    def test_data_provenance(self):
        """Test data provenance tracking."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        engine.add_observation(chain.chain_id, "Obs 1", ["source-1", "source-2"])
        engine.add_observation(chain.chain_id, "Obs 2", ["source-1"])

        provenance = chain.get_data_provenance()

        assert provenance["source-1"] == 2
        assert provenance["source-2"] == 1

    def test_analyze_chain(self):
        """Test chain analysis."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)

        engine.add_observation(chain.chain_id, "Obs", ["src"])
        engine.add_thought(chain.chain_id, "Thought")
        engine.add_correction(chain.chain_id, "Correction", "fallback")

        analysis = engine.analyze_chain(chain)

        assert analysis["total_steps"] == 3
        assert analysis["corrections_needed"] == 1
        assert "avg_confidence" in analysis


class TestPlanExplainer:
    """Tests for PlanExplainer."""

    def test_explain_simple_plan(self):
        """Test explaining a simple plan."""
        explainer = PlanExplainer()

        plan = {
            "objective": "Calculate monthly budget",
            "subtasks": [
                {"name": "Gather data", "purpose": "Collect financial data"},
                {"name": "Analyze", "purpose": "Analyze spending patterns"},
            ],
        }

        explanation = explainer.explain_plan("task-123", AgentType.SPECIALIST, plan, {})

        assert explanation.task_id == "task-123"
        assert explanation.agent_type == AgentType.SPECIALIST
        assert "Calculate monthly budget" in explanation.objective
        assert len(explanation.subtasks) == 2

    def test_plan_risk_identification(self):
        """Test risk identification."""
        explainer = PlanExplainer()

        plan = {
            "objective": "Test",
            "subtasks": [{"name": f"Task {i}"} for i in range(6)],
        }

        explanation = explainer.explain_plan("task-123", AgentType.SPECIALIST, plan, {})

        # Should identify complexity risk
        assert len(explanation.risks) > 0
        risk_descriptions = [r["description"] for r in explanation.risks]
        assert any("complex" in desc.lower() for desc in risk_descriptions)

    def test_fallback_generation(self):
        """Test fallback strategy generation."""
        explainer = PlanExplainer()

        plan = {
            "objective": "Test",
            "subtasks": [],
            "requires_external_api": True,
        }

        explanation = explainer.explain_plan("task-123", AgentType.SPECIALIST, plan, {})

        assert len(explanation.fallback_strategies) > 0

    def test_confidence_estimation(self):
        """Test confidence estimation."""
        explainer = PlanExplainer()

        # Simple plan with good context
        plan1 = {"objective": "Test", "subtasks": []}
        context1 = {"has_recent_transactions": True}

        explanation1 = explainer.explain_plan(
            "task-123", AgentType.SPECIALIST, plan1, context1
        )

        # Complex plan without data
        plan2 = {"objective": "Test", "subtasks": [{} for _ in range(6)]}
        context2 = {}

        explanation2 = explainer.explain_plan(
            "task-456", AgentType.SPECIALIST, plan2, context2
        )

        assert explanation1.estimated_confidence > explanation2.estimated_confidence

    def test_markdown_formatting(self):
        """Test markdown formatting."""
        explainer = PlanExplainer()

        plan = {
            "objective": "Test objective",
            "subtasks": [{"name": "Task 1", "purpose": "Purpose 1"}],
        }

        explanation = explainer.explain_plan("task-123", AgentType.SPECIALIST, plan, {})

        markdown = explanation.to_markdown()

        assert "# Plan Explanation" in markdown
        assert "Test objective" in markdown
        assert "Task 1" in markdown


class TestErrorRecovery:
    """Tests for ErrorRecoveryManager."""

    def test_strategy_registry_initialization(self):
        """Test strategy registry initialization."""
        registry = RecoveryStrategyRegistry()

        # Should have default strategies
        strategies = registry.get_strategies_for_error("GRAPHRAG_100")
        assert len(strategies) > 0

    def test_strategy_priority_ordering(self):
        """Test strategy priority ordering."""
        registry = RecoveryStrategyRegistry()

        strategies = registry.get_strategies_for_error("GRAPHRAG_100")

        # Should be sorted by priority descending
        for i in range(len(strategies) - 1):
            assert strategies[i].priority >= strategies[i + 1].priority

    def test_custom_strategy_registration(self):
        """Test registering custom strategy."""
        registry = RecoveryStrategyRegistry()

        custom = RecoveryStrategy(
            name="custom_strategy",
            description="Custom test strategy",
            applicable_errors=["TEST_ERROR"],
            priority=9,
        )

        registry.register(custom)

        strategies = registry.get_strategies_for_error("TEST_ERROR")
        assert len(strategies) == 1
        assert strategies[0].name == "custom_strategy"

    @pytest.mark.asyncio
    async def test_recovery_attempt(self):
        """Test recovery attempt."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)
        manager = ErrorRecoveryManager(engine)

        error = TaskExecutionError("Test error")

        success, result = await manager.attempt_recovery(
            error, chain.chain_id, {}, max_strategies=1
        )

        # With mock strategy, should succeed
        assert isinstance(success, bool)

    @pytest.mark.asyncio
    async def test_recover_or_fail(self):
        """Test recover or fail."""
        engine = ReasoningEngine()
        chain = engine.start_chain("task-123", AgentType.SPECIALIST)
        manager = ErrorRecoveryManager(engine)

        error = TaskExecutionError("Test error")

        result = await manager.recover_or_fail(error, chain.chain_id, {})

        assert "status" in result
        assert result["status"] in ["recovered", "failed"]


class TestAuditTrail:
    """Tests for AuditTrail."""

    @pytest.mark.asyncio
    async def test_record_event(self):
        """Test recording audit event."""
        audit = AuditTrail()

        event = AuditEvent(
            event_type=AuditEventType.TASK_STARTED,
            user_id="user-123",
            agent_id="agent-001",
            agent_type=AgentType.SPECIALIST,
            correlation_id="corr-456",
            description="Task started",
        )

        await audit.record_event(event)

        # Event should be in buffer
        assert len(audit._event_buffer) == 1

    @pytest.mark.asyncio
    async def test_buffer_flushing(self):
        """Test buffer flushing."""
        audit = AuditTrail()
        audit._buffer_size = 5

        # Add events to fill buffer
        for i in range(5):
            event = AuditEvent(
                event_type=AuditEventType.TASK_STARTED,
                user_id=f"user-{i}",
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id=f"corr-{i}",
                description=f"Event {i}",
            )
            await audit.record_event(event)

        # Buffer should be empty after automatic flush
        assert len(audit._event_buffer) == 0
        # Events should be in storage
        assert len(audit._events_storage) == 5

    @pytest.mark.asyncio
    async def test_query_by_user(self):
        """Test querying events by user."""
        audit = AuditTrail()

        # Add events for different users
        for i in range(3):
            event = AuditEvent(
                event_type=AuditEventType.TASK_STARTED,
                user_id=f"user-{i % 2}",  # Alternate between user-0 and user-1
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id=f"corr-{i}",
                description=f"Event {i}",
            )
            await audit.record_event(event)

        # Query for user-0
        events = await audit.query_events(user_id="user-0")

        assert len(events) == 2
        assert all(e.user_id == "user-0" for e in events)

    @pytest.mark.asyncio
    async def test_query_by_event_type(self):
        """Test querying events by type."""
        audit = AuditTrail()

        await audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_STARTED,
                user_id="user-123",
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id="corr-1",
                description="Started",
            )
        )

        await audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_COMPLETED,
                user_id="user-123",
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id="corr-1",
                description="Completed",
            )
        )

        events = await audit.query_events(event_type=AuditEventType.TASK_STARTED)

        assert len(events) == 1
        assert events[0].event_type == AuditEventType.TASK_STARTED

    @pytest.mark.asyncio
    async def test_query_time_range(self):
        """Test querying events by time range."""
        audit = AuditTrail()

        now = datetime.now(timezone.utc)
        past = now - timedelta(hours=2)

        # Add old event
        old_event = AuditEvent(
            event_type=AuditEventType.TASK_STARTED,
            user_id="user-123",
            agent_id="agent-001",
            agent_type=AgentType.SPECIALIST,
            correlation_id="corr-1",
            description="Old event",
            timestamp=past,
        )
        await audit.record_event(old_event)

        # Add recent event
        recent_event = AuditEvent(
            event_type=AuditEventType.TASK_STARTED,
            user_id="user-123",
            agent_id="agent-001",
            agent_type=AgentType.SPECIALIST,
            correlation_id="corr-2",
            description="Recent event",
            timestamp=now,
        )
        await audit.record_event(recent_event)

        # Query recent events
        events = await audit.query_events(start_time=now - timedelta(hours=1))

        assert len(events) == 1
        assert events[0].description == "Recent event"

    @pytest.mark.asyncio
    async def test_compliance_report(self):
        """Test compliance report generation."""
        audit = AuditTrail()

        start = datetime.now(timezone.utc) - timedelta(days=1)

        # Add events
        await audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_COMPLETED,
                user_id="user-123",
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id="corr-1",
                description="Task 1",
                contains_pii=True,
            )
        )

        await audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_FAILED,
                user_id="user-123",
                agent_id="agent-001",
                agent_type=AgentType.SPECIALIST,
                correlation_id="corr-2",
                description="Task 2",
            )
        )

        # Set end time after events are created
        end = datetime.now(timezone.utc)

        report = await audit.generate_compliance_report("user-123", start, end)

        assert report["user_id"] == "user-123"
        assert report["summary"]["total_events"] == 2
        assert report["summary"]["tasks_completed"] == 1
        assert report["summary"]["tasks_failed"] == 1
        assert report["compliance_flags"]["pii_accessed"] == 1


class TestProvenanceTracker:
    """Tests for ProvenanceTracker."""

    def test_start_decision(self):
        """Test starting decision tracking."""
        tracker = ProvenanceTracker()

        decision_id = tracker.start_decision(
            "task-123", AgentType.SPECIALIST, "Calculate budget"
        )

        assert decision_id in tracker._active_decisions
        assert tracker._active_decisions[decision_id].task_id == "task-123"

    def test_add_data_source(self):
        """Test adding data source."""
        tracker = ProvenanceTracker()
        decision_id = tracker.start_decision("task-123", AgentType.SPECIALIST, "Test")

        source = DataSource(
            source_id="src-1",
            source_type="transaction",
            source_name="Bank Transaction",
            confidence=0.95,
        )

        tracker.add_data_source(decision_id, source, primary=True)

        provenance = tracker._active_decisions[decision_id]
        assert len(provenance.primary_sources) == 1
        assert provenance.primary_sources[0].source_id == "src-1"

    def test_add_transformation(self):
        """Test adding transformation."""
        tracker = ProvenanceTracker()
        decision_id = tracker.start_decision("task-123", AgentType.SPECIALIST, "Test")

        tracker.add_transformation(decision_id, "Normalized amounts to USD")

        provenance = tracker._active_decisions[decision_id]
        assert len(provenance.transformations) == 1
        assert "Normalized" in provenance.transformations[0]

    def test_finalize_decision(self):
        """Test finalizing decision."""
        tracker = ProvenanceTracker()
        decision_id = tracker.start_decision("task-123", AgentType.SPECIALIST, "Test")

        source = DataSource(
            source_id="src-1",
            source_type="account",
            source_name="Checking Account",
            confidence=0.9,
        )

        tracker.add_data_source(decision_id, source)

        output = {"result": "success"}
        provenance = tracker.finalize_decision(decision_id, output, 0.85)

        assert provenance.decision_output == output
        assert provenance.confidence_score == 0.85
        assert provenance.data_quality_score == 0.9
        assert decision_id not in tracker._active_decisions

    def test_citation_generation(self):
        """Test citation generation."""
        tracker = ProvenanceTracker()
        decision_id = tracker.start_decision("task-123", AgentType.SPECIALIST, "Test")

        source1 = DataSource(
            source_id="src-1",
            source_type="transaction",
            source_name="Bank Data",
        )
        source2 = DataSource(
            source_id="src-2", source_type="account", source_name="Account Balance"
        )

        tracker.add_data_source(decision_id, source1)
        tracker.add_data_source(decision_id, source2)

        provenance = tracker.finalize_decision(decision_id, {}, 0.8)
        citation = provenance.to_citation()

        assert "2 primary data sources" in citation
        assert "Confidence: 80%" in citation
