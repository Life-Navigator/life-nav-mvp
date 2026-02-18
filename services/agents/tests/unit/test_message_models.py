"""Unit tests for message models and communication structures.

Tests cover:
- Message type enums
- Message headers and routing
- Request/response patterns
- Event notifications
- Task delegation messages
- Message envelope serialization
- TTL and expiration
- Message batching
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from models.message_models import (
    AckMessage,
    AgentMessage,
    CommandMessage,
    ErrorMessage,
    EventMessage,
    HeartbeatMessage,
    MessageBatch,
    MessageEnvelope,
    MessageHeader,
    MessagePriority,
    MessageStatus,
    MessageType,
    QueryRequestMessage,
    QueryResponseMessage,
    RoutingStrategy,
    StatusUpdateMessage,
    TaskRequestMessage,
    TaskResponseMessage,
)


class TestEnums:
    """Tests for enum definitions."""

    def test_message_type_values(self):
        """Test MessageType enum values."""
        assert MessageType.TASK_REQUEST == "task_request"
        assert MessageType.TASK_RESPONSE == "task_response"
        assert MessageType.QUERY_REQUEST == "query_request"
        assert MessageType.QUERY_RESPONSE == "query_response"
        assert MessageType.EVENT == "event"
        assert MessageType.COMMAND == "command"
        assert MessageType.STATUS_UPDATE == "status_update"
        assert MessageType.HEARTBEAT == "heartbeat"
        assert MessageType.ERROR == "error"
        assert MessageType.ACK == "ack"

    def test_message_priority_values(self):
        """Test MessagePriority enum values."""
        assert MessagePriority.LOW == "low"
        assert MessagePriority.NORMAL == "normal"
        assert MessagePriority.HIGH == "high"
        assert MessagePriority.CRITICAL == "critical"

    def test_routing_strategy_values(self):
        """Test RoutingStrategy enum values."""
        assert RoutingStrategy.DIRECT == "direct"
        assert RoutingStrategy.BROADCAST == "broadcast"
        assert RoutingStrategy.ROUND_ROBIN == "round_robin"
        assert RoutingStrategy.FANOUT == "fanout"

    def test_message_status_values(self):
        """Test MessageStatus enum values."""
        assert MessageStatus.PENDING == "pending"
        assert MessageStatus.DELIVERED == "delivered"
        assert MessageStatus.PROCESSING == "processing"
        assert MessageStatus.COMPLETED == "completed"
        assert MessageStatus.FAILED == "failed"
        assert MessageStatus.EXPIRED == "expired"


class TestMessageHeader:
    """Tests for MessageHeader model."""

    def test_default_header(self):
        """Test message header with defaults."""
        header = MessageHeader(
            message_type=MessageType.TASK_REQUEST, correlation_id="corr-123"
        )

        assert isinstance(header.message_id, UUID)
        assert header.message_type == MessageType.TASK_REQUEST
        assert header.priority == MessagePriority.NORMAL
        assert header.correlation_id == "corr-123"
        assert header.reply_to is None
        assert isinstance(header.timestamp, datetime)
        assert header.ttl_seconds == 300
        assert header.routing_strategy == RoutingStrategy.DIRECT
        assert header.metadata == {}

    def test_full_header(self):
        """Test message header with all fields."""
        now = datetime.now(timezone.utc)
        header = MessageHeader(
            message_type=MessageType.QUERY_REQUEST,
            priority=MessagePriority.HIGH,
            correlation_id="corr-456",
            reply_to="query.responses",
            timestamp=now,
            ttl_seconds=60,
            routing_strategy=RoutingStrategy.BROADCAST,
            metadata={"source": "test"},
        )

        assert header.message_type == MessageType.QUERY_REQUEST
        assert header.priority == MessagePriority.HIGH
        assert header.reply_to == "query.responses"
        assert header.timestamp == now
        assert header.ttl_seconds == 60
        assert header.routing_strategy == RoutingStrategy.BROADCAST
        assert header.metadata["source"] == "test"

    def test_ttl_bounds(self):
        """Test TTL seconds bounds."""
        # Valid
        MessageHeader(
            message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=1
        )
        MessageHeader(
            message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=86400
        )

        # Invalid
        with pytest.raises(ValidationError):
            MessageHeader(
                message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=0
            )

        with pytest.raises(ValidationError):
            MessageHeader(
                message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=86401
            )

    def test_is_expired_property(self):
        """Test is_expired property."""
        # Not expired
        header = MessageHeader(
            message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=300
        )
        assert not header.is_expired

        # Expired
        old_time = datetime.now(timezone.utc) - timedelta(seconds=400)
        header2 = MessageHeader(
            message_type=MessageType.EVENT,
            correlation_id="corr",
            ttl_seconds=300,
            timestamp=old_time,
        )
        assert header2.is_expired

        # No TTL (never expires)
        header3 = MessageHeader(
            message_type=MessageType.EVENT, correlation_id="corr", ttl_seconds=None
        )
        assert not header3.is_expired


class TestAgentMessage:
    """Tests for AgentMessage model."""

    def test_basic_agent_message(self):
        """Test basic agent message."""
        header = MessageHeader(
            message_type=MessageType.TASK_REQUEST, correlation_id="corr-123"
        )
        message = AgentMessage(
            header=header,
            sender_id="orchestrator-001",
            recipient_id="finance-manager-001",
            payload={"action": "analyze_budget"},
        )

        assert message.header == header
        assert message.sender_id == "orchestrator-001"
        assert message.recipient_id == "finance-manager-001"
        assert message.payload == {"action": "analyze_budget"}
        assert message.status == MessageStatus.PENDING
        assert message.error is None

    def test_broadcast_message(self):
        """Test broadcast message without recipient."""
        header = MessageHeader(
            message_type=MessageType.EVENT,
            correlation_id="corr-123",
            routing_strategy=RoutingStrategy.BROADCAST,
        )
        message = AgentMessage(
            header=header,
            sender_id="orchestrator-001",
            payload={"event": "system_started"},
        )

        assert message.recipient_id is None
        assert message.header.routing_strategy == RoutingStrategy.BROADCAST

    def test_failed_message(self):
        """Test failed message with error."""
        header = MessageHeader(
            message_type=MessageType.TASK_RESPONSE, correlation_id="corr-123"
        )
        message = AgentMessage(
            header=header,
            sender_id="agent-001",
            recipient_id="orchestrator-001",
            payload={},
            status=MessageStatus.FAILED,
            error="Task execution timeout",
        )

        assert message.status == MessageStatus.FAILED
        assert message.error == "Task execution timeout"


class TestTaskRequestMessage:
    """Tests for TaskRequestMessage model."""

    def test_default_task_request(self):
        """Test task request with defaults."""
        request = TaskRequestMessage(
            task_type="budget.analyze", payload={"account_id": "acc-123"}
        )

        assert isinstance(request.task_id, UUID)
        assert request.task_type == "budget.analyze"
        assert request.payload == {"account_id": "acc-123"}
        assert request.context == {}
        assert request.timeout_seconds == 300
        assert request.retry_attempts == 3
        assert request.callback_queue is None

    def test_full_task_request(self):
        """Test task request with all fields."""
        task_id = uuid4()
        request = TaskRequestMessage(
            task_id=task_id,
            task_type="investment.recommend",
            payload={"user_id": "user-123"},
            context={"previous_analysis": "data"},
            timeout_seconds=600,
            retry_attempts=5,
            callback_queue="tasks.callbacks",
        )

        assert request.task_id == task_id
        assert request.task_type == "investment.recommend"
        assert request.context["previous_analysis"] == "data"
        assert request.timeout_seconds == 600
        assert request.retry_attempts == 5
        assert request.callback_queue == "tasks.callbacks"


class TestTaskResponseMessage:
    """Tests for TaskResponseMessage model."""

    def test_successful_task_response(self):
        """Test successful task response."""
        task_id = uuid4()
        response = TaskResponseMessage(
            task_id=task_id,
            success=True,
            result={"available_funds": 5000},
            duration_ms=250.5,
        )

        assert response.task_id == task_id
        assert response.success is True
        assert response.result == {"available_funds": 5000}
        assert response.error is None
        assert response.duration_ms == 250.5

    def test_failed_task_response(self):
        """Test failed task response."""
        task_id = uuid4()
        response = TaskResponseMessage(
            task_id=task_id,
            success=False,
            error="Database connection timeout",
            duration_ms=5000.0,
        )

        assert response.task_id == task_id
        assert response.success is False
        assert response.result is None
        assert response.error == "Database connection timeout"
        assert response.duration_ms == 5000.0


class TestQueryRequestMessage:
    """Tests for QueryRequestMessage model."""

    def test_text_query_request(self):
        """Test query request with text query."""
        request = QueryRequestMessage(
            query_type="graphrag.cypher", query="MATCH (u:User) RETURN u"
        )

        assert isinstance(request.query_id, UUID)
        assert request.query_type == "graphrag.cypher"
        assert request.query == "MATCH (u:User) RETURN u"
        assert request.parameters == {}
        assert request.timeout_seconds == 30

    def test_structured_query_request(self):
        """Test query request with structured query."""
        query = {"operation": "find", "collection": "users", "filter": {"age": 25}}
        request = QueryRequestMessage(
            query_type="graphrag.structured",
            query=query,
            parameters={"limit": 10},
            timeout_seconds=60,
        )

        assert request.query == query
        assert request.parameters == {"limit": 10}
        assert request.timeout_seconds == 60


class TestQueryResponseMessage:
    """Tests for QueryResponseMessage model."""

    def test_successful_query_response_list(self):
        """Test successful query response with list."""
        query_id = uuid4()
        data = [{"id": 1, "name": "Test"}, {"id": 2, "name": "Test2"}]
        response = QueryResponseMessage(
            query_id=query_id, success=True, data=data, duration_ms=150.0
        )

        assert response.query_id == query_id
        assert response.success is True
        assert response.data == data
        assert response.error is None
        assert response.duration_ms == 150.0

    def test_successful_query_response_dict(self):
        """Test successful query response with dict."""
        query_id = uuid4()
        data = {"count": 42, "results": []}
        response = QueryResponseMessage(
            query_id=query_id, success=True, data=data, duration_ms=100.0
        )

        assert response.data == data

    def test_failed_query_response(self):
        """Test failed query response."""
        query_id = uuid4()
        response = QueryResponseMessage(
            query_id=query_id, success=False, error="Invalid query syntax"
        )

        assert response.success is False
        assert response.data is None
        assert response.error == "Invalid query syntax"


class TestEventMessage:
    """Tests for EventMessage model."""

    def test_basic_event(self):
        """Test basic event message."""
        event = EventMessage(
            event_type="agent.started", source="budget-specialist-001", data={}
        )

        assert isinstance(event.event_id, UUID)
        assert event.event_type == "agent.started"
        assert event.source == "budget-specialist-001"
        assert isinstance(event.timestamp, datetime)
        assert event.data == {}
        assert event.severity == "info"

    def test_critical_event(self):
        """Test critical event with severity."""
        data = {"error_code": "DB_CONNECTION_LOST", "attempts": 3}
        event = EventMessage(
            event_type="system.error",
            source="graphrag-client",
            data=data,
            severity="critical",
        )

        assert event.event_type == "system.error"
        assert event.data == data
        assert event.severity == "critical"


class TestCommandMessage:
    """Tests for CommandMessage model."""

    def test_basic_command(self):
        """Test basic command message."""
        command = CommandMessage(command="shutdown")

        assert isinstance(command.command_id, UUID)
        assert command.command == "shutdown"
        assert command.arguments == {}
        assert command.timeout_seconds == 60

    def test_command_with_arguments(self):
        """Test command with arguments."""
        args = {"graceful": True, "delay_seconds": 30}
        command = CommandMessage(
            command="shutdown", arguments=args, timeout_seconds=120
        )

        assert command.command == "shutdown"
        assert command.arguments == args
        assert command.timeout_seconds == 120


class TestStatusUpdateMessage:
    """Tests for StatusUpdateMessage model."""

    def test_basic_status_update(self):
        """Test basic status update."""
        status = StatusUpdateMessage(agent_id="budget-001", state="processing")

        assert status.agent_id == "budget-001"
        assert status.state == "processing"
        assert status.active_tasks == 0
        assert status.uptime_seconds == 0.0
        assert isinstance(status.timestamp, datetime)
        assert status.metadata == {}

    def test_full_status_update(self):
        """Test full status update with metadata."""
        metadata = {"cpu_usage": 45.2, "memory_mb": 512}
        status = StatusUpdateMessage(
            agent_id="budget-001",
            state="processing",
            active_tasks=3,
            uptime_seconds=3600.0,
            metadata=metadata,
        )

        assert status.active_tasks == 3
        assert status.uptime_seconds == 3600.0
        assert status.metadata == metadata


class TestHeartbeatMessage:
    """Tests for HeartbeatMessage model."""

    def test_basic_heartbeat(self):
        """Test basic heartbeat."""
        heartbeat = HeartbeatMessage(agent_id="budget-001")

        assert heartbeat.agent_id == "budget-001"
        assert isinstance(heartbeat.timestamp, datetime)
        assert heartbeat.sequence == 0
        assert heartbeat.metadata == {}

    def test_heartbeat_with_sequence(self):
        """Test heartbeat with sequence number."""
        heartbeat = HeartbeatMessage(agent_id="budget-001", sequence=42)

        assert heartbeat.sequence == 42


class TestErrorMessage:
    """Tests for ErrorMessage model."""

    def test_basic_error(self):
        """Test basic error message."""
        error = ErrorMessage(
            error_code="AGENT_004",
            error_message="Task execution failed",
            source="budget-specialist-001",
        )

        assert isinstance(error.error_id, UUID)
        assert error.error_code == "AGENT_004"
        assert error.error_message == "Task execution failed"
        assert error.source == "budget-specialist-001"
        assert isinstance(error.timestamp, datetime)
        assert error.context == {}
        assert error.stack_trace is None

    def test_error_with_stack_trace(self):
        """Test error with stack trace."""
        stack = "Traceback (most recent call last):\n  File test.py..."
        error = ErrorMessage(
            error_code="LLM_301",
            error_message="Connection timeout",
            source="vllm-client",
            context={"endpoint": "http://localhost:8000"},
            stack_trace=stack,
        )

        assert error.context["endpoint"] == "http://localhost:8000"
        assert error.stack_trace == stack


class TestAckMessage:
    """Tests for AckMessage model."""

    def test_basic_ack(self):
        """Test basic acknowledgment."""
        original_id = uuid4()
        ack = AckMessage(original_message_id=original_id)

        assert isinstance(ack.ack_id, UUID)
        assert ack.original_message_id == original_id
        assert isinstance(ack.timestamp, datetime)
        assert ack.status == "received"

    def test_processed_ack(self):
        """Test processed acknowledgment."""
        original_id = uuid4()
        ack = AckMessage(original_message_id=original_id, status="processed")

        assert ack.status == "processed"


class TestMessageEnvelope:
    """Tests for MessageEnvelope model."""

    def test_basic_envelope(self):
        """Test basic message envelope."""
        header = MessageHeader(
            message_type=MessageType.TASK_REQUEST, correlation_id="corr-123"
        )
        envelope = MessageEnvelope(
            header=header,
            sender_id="orchestrator-001",
            recipient_id="budget-001",
            message_type=MessageType.TASK_REQUEST,
            payload={"task": "analyze"},
        )

        assert envelope.header == header
        assert envelope.sender_id == "orchestrator-001"
        assert envelope.recipient_id == "budget-001"
        assert envelope.message_type == MessageType.TASK_REQUEST
        assert envelope.payload == {"task": "analyze"}

    def test_envelope_create_method(self):
        """Test MessageEnvelope.create() factory method."""
        envelope = MessageEnvelope.create(
            sender_id="orchestrator-001",
            message_type=MessageType.EVENT,
            payload={"event": "test"},
            recipient_id="budget-001",
            priority=MessagePriority.HIGH,
            correlation_id="corr-456",
            ttl_seconds=600,
        )

        assert envelope.sender_id == "orchestrator-001"
        assert envelope.recipient_id == "budget-001"
        assert envelope.message_type == MessageType.EVENT
        assert envelope.payload == {"event": "test"}
        assert envelope.header.priority == MessagePriority.HIGH
        assert envelope.header.correlation_id == "corr-456"
        assert envelope.header.ttl_seconds == 600

    def test_envelope_auto_correlation_id(self):
        """Test envelope with auto-generated correlation ID."""
        envelope = MessageEnvelope.create(
            sender_id="agent-001",
            message_type=MessageType.HEARTBEAT,
            payload={},
        )

        assert envelope.header.correlation_id is not None
        assert len(envelope.header.correlation_id) > 0


class TestMessageBatch:
    """Tests for MessageBatch model."""

    def test_empty_batch(self):
        """Test empty message batch."""
        batch = MessageBatch(messages=[])

        assert isinstance(batch.batch_id, UUID)
        assert batch.messages == []
        assert isinstance(batch.timestamp, datetime)
        assert batch.metadata == {}
        assert batch.size == 0

    def test_batch_with_messages(self):
        """Test batch with multiple messages."""
        envelope1 = MessageEnvelope.create(
            sender_id="agent-001", message_type=MessageType.EVENT, payload={}
        )
        envelope2 = MessageEnvelope.create(
            sender_id="agent-002", message_type=MessageType.HEARTBEAT, payload={}
        )
        envelope3 = MessageEnvelope.create(
            sender_id="agent-003", message_type=MessageType.STATUS_UPDATE, payload={}
        )

        batch = MessageBatch(messages=[envelope1, envelope2, envelope3])

        assert batch.size == 3
        assert len(batch.messages) == 3

    def test_batch_with_metadata(self):
        """Test batch with metadata."""
        envelope = MessageEnvelope.create(
            sender_id="agent-001", message_type=MessageType.EVENT, payload={}
        )
        metadata = {"source": "test", "batch_type": "heartbeats"}
        batch = MessageBatch(messages=[envelope], metadata=metadata)

        assert batch.metadata == metadata


class TestModelSerialization:
    """Tests for model serialization and deserialization."""

    def test_message_header_serialization(self):
        """Test MessageHeader JSON serialization."""
        header = MessageHeader(
            message_type=MessageType.TASK_REQUEST,
            priority=MessagePriority.HIGH,
            correlation_id="corr-123",
        )

        # Serialize
        header_dict = header.model_dump()
        assert header_dict["message_type"] == "task_request"
        assert header_dict["priority"] == "high"

        # Deserialize
        header2 = MessageHeader(**header_dict)
        assert header2.message_type == header.message_type
        assert header2.correlation_id == header.correlation_id

    def test_task_request_serialization(self):
        """Test TaskRequestMessage JSON serialization."""
        request = TaskRequestMessage(
            task_type="budget.analyze",
            payload={"account_id": "acc-123"},
            timeout_seconds=600,
        )

        # Serialize
        request_dict = request.model_dump()
        assert request_dict["task_type"] == "budget.analyze"
        assert request_dict["timeout_seconds"] == 600

        # Deserialize
        request2 = TaskRequestMessage(**request_dict)
        assert request2.task_type == request.task_type
        assert request2.timeout_seconds == request.timeout_seconds

    def test_message_envelope_serialization(self):
        """Test MessageEnvelope JSON serialization."""
        envelope = MessageEnvelope.create(
            sender_id="orchestrator-001",
            message_type=MessageType.COMMAND,
            payload={"command": "restart"},
            priority=MessagePriority.CRITICAL,
        )

        # Serialize
        envelope_dict = envelope.model_dump()
        assert envelope_dict["sender_id"] == "orchestrator-001"
        assert envelope_dict["message_type"] == "command"

        # Deserialize
        envelope2 = MessageEnvelope(**envelope_dict)
        assert envelope2.sender_id == envelope.sender_id
        assert envelope2.message_type == envelope.message_type
