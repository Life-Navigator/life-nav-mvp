"""
Test suite for MessageBus functionality

Tests the MessageBus with mocked Redis and RabbitMQ connections.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from uuid import uuid4
from datetime import datetime, timezone

from messaging.message_bus import MessageBus, TransportType
from models.message_models import (
    MessageEnvelope,
    MessageType,
    MessagePriority,
    RoutingStrategy,
    MessageHeader
)


@pytest.fixture
async def mock_redis():
    """Mock Redis client"""
    redis_mock = AsyncMock()
    redis_mock.ping = AsyncMock(return_value=True)
    redis_mock.publish = AsyncMock(return_value=1)
    redis_mock.close = AsyncMock()

    # Mock pubsub
    pubsub_mock = AsyncMock()
    pubsub_mock.subscribe = AsyncMock()
    pubsub_mock.unsubscribe = AsyncMock()

    redis_mock.pubsub = Mock(return_value=pubsub_mock)

    return redis_mock


@pytest.fixture
async def mock_rabbitmq():
    """Mock RabbitMQ connection and channel"""
    # Mock connection
    conn_mock = AsyncMock()
    conn_mock.is_closed = False
    conn_mock.close = AsyncMock()

    # Mock channel
    channel_mock = AsyncMock()
    channel_mock.set_qos = AsyncMock()
    channel_mock.declare_exchange = AsyncMock()
    channel_mock.declare_queue = AsyncMock()
    channel_mock.close = AsyncMock()

    # Mock exchange
    exchange_mock = AsyncMock()
    exchange_mock.publish = AsyncMock()
    channel_mock.get_exchange = AsyncMock(return_value=exchange_mock)

    # Mock queue
    queue_mock = AsyncMock()
    queue_mock.bind = AsyncMock()
    queue_mock.consume = AsyncMock(return_value="consumer_tag")
    channel_mock.get_queue = AsyncMock(return_value=queue_mock)

    conn_mock.channel = AsyncMock(return_value=channel_mock)

    return conn_mock, channel_mock


@pytest.fixture
def sample_message():
    """Create a sample message envelope"""
    header = MessageHeader(
        message_type=MessageType.TASK_REQUEST,
        priority=MessagePriority.NORMAL,
        correlation_id=str(uuid4())
    )

    envelope = MessageEnvelope(
        header=header,
        sender_id="test-sender",
        recipient_id="test-recipient",
        message_type=MessageType.TASK_REQUEST,
        payload={"action": "test_action", "data": "test_data"}
    )

    return envelope


@pytest.mark.asyncio
async def test_message_bus_initialization():
    """Test MessageBus initialization"""
    bus = MessageBus(
        redis_url="redis://localhost:6379/0",
        rabbitmq_url="amqp://guest:guest@localhost:5672/",
        auto_reconnect=False
    )

    assert bus.redis_url == "redis://localhost:6379/0"
    assert bus.rabbitmq_url == "amqp://guest:guest@localhost:5672/"
    assert bus.auto_reconnect is False
    assert bus._redis is None
    assert bus._rabbitmq_conn is None


@pytest.mark.asyncio
async def test_message_bus_connect(mock_redis, mock_rabbitmq):
    """Test MessageBus connection to Redis and RabbitMQ"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()

            # Verify Redis connected
            assert bus._redis is not None
            assert bus._redis_healthy is True

            # Verify RabbitMQ connected
            assert bus._rabbitmq_conn is not None
            assert bus._rabbitmq_healthy is True

            # Cleanup
            await bus.disconnect()


@pytest.mark.asyncio
async def test_message_bus_disconnect(mock_redis, mock_rabbitmq):
    """Test MessageBus disconnection"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()
            await bus.disconnect()

            # Verify connections closed
            assert bus._redis is None
            assert bus._rabbitmq_conn is None
            assert bus._redis_healthy is False
            assert bus._rabbitmq_healthy is False


@pytest.mark.asyncio
async def test_transport_selection_auto(sample_message):
    """Test automatic transport selection"""
    bus = MessageBus(auto_reconnect=False)

    # Test event message -> should select Redis
    event_message = MessageEnvelope.create(
        sender_id="test-sender",
        message_type=MessageType.EVENT,
        payload={"event": "test_event"}
    )
    transport = bus._select_transport(event_message, TransportType.AUTO)
    assert transport == TransportType.REDIS

    # Test task request -> should select RabbitMQ
    task_message = MessageEnvelope.create(
        sender_id="test-sender",
        message_type=MessageType.TASK_REQUEST,
        payload={"task": "test_task"}
    )
    transport = bus._select_transport(task_message, TransportType.AUTO)
    assert transport == TransportType.RABBITMQ

    # Test heartbeat -> should select Redis
    heartbeat_message = MessageEnvelope.create(
        sender_id="test-sender",
        message_type=MessageType.HEARTBEAT,
        payload={"timestamp": str(datetime.now(timezone.utc))}
    )
    transport = bus._select_transport(heartbeat_message, TransportType.AUTO)
    assert transport == TransportType.REDIS


@pytest.mark.asyncio
async def test_routing_key_generation(sample_message):
    """Test routing key generation from message"""
    bus = MessageBus(auto_reconnect=False)

    # Test direct message with recipient
    routing_key = bus._get_routing_key(sample_message)
    assert routing_key == "agent.test-recipient"

    # Test broadcast message without recipient
    broadcast_message = MessageEnvelope.create(
        sender_id="test-sender",
        message_type=MessageType.EVENT,
        payload={"event": "broadcast_event"},
        recipient_id=None,
        routing_strategy=RoutingStrategy.BROADCAST
    )
    routing_key = bus._get_routing_key(broadcast_message)
    assert routing_key == "event.event"


@pytest.mark.asyncio
async def test_publish_to_redis(mock_redis, mock_rabbitmq, sample_message):
    """Test publishing message to Redis"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()

            # Create event message (should go to Redis)
            event_message = MessageEnvelope.create(
                sender_id="test-sender",
                message_type=MessageType.EVENT,
                payload={"event": "test_event"},
                recipient_id="test-recipient"
            )

            # Publish message
            success = await bus.publish(event_message, transport=TransportType.REDIS)

            assert success is True
            assert bus._messages_sent == 1

            # Verify Redis publish was called
            mock_redis.publish.assert_called_once()

            await bus.disconnect()


@pytest.mark.asyncio
async def test_publish_to_rabbitmq(mock_redis, mock_rabbitmq, sample_message):
    """Test publishing message to RabbitMQ"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()

            # Publish task message (should go to RabbitMQ)
            success = await bus.publish(sample_message, transport=TransportType.RABBITMQ)

            assert success is True
            assert bus._messages_sent == 1

            # Verify RabbitMQ publish was called
            exchange_mock = await channel_mock.get_exchange("lna.direct")
            exchange_mock.publish.assert_called_once()

            await bus.disconnect()


@pytest.mark.asyncio
async def test_publish_expired_message(mock_redis, mock_rabbitmq):
    """Test that expired messages are not published"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()

            # Create message with very short TTL
            header = MessageHeader(
                message_type=MessageType.EVENT,
                priority=MessagePriority.NORMAL,
                correlation_id=str(uuid4()),
                ttl_seconds=1  # Expires in 1 second
            )

            expired_message = MessageEnvelope(
                header=header,
                sender_id="test-sender",
                message_type=MessageType.EVENT,
                payload={"event": "expired"}
            )

            # Wait for message to expire
            await asyncio.sleep(1.1)

            # Try to publish - should be rejected
            success = await bus.publish(expired_message, transport=TransportType.REDIS)

            assert success is False
            assert bus._messages_sent == 0

            await bus.disconnect()


@pytest.mark.asyncio
async def test_get_stats(mock_redis, mock_rabbitmq):
    """Test getting message bus statistics"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            bus = MessageBus(auto_reconnect=False)
            await bus.connect()

            # Get initial stats
            stats = bus.get_stats()

            assert stats["redis_healthy"] is True
            assert stats["rabbitmq_healthy"] is True
            assert stats["messages_sent"] == 0
            assert stats["messages_received"] == 0
            assert "redis_latency_ms" in stats
            assert "rabbitmq_latency_ms" in stats

            await bus.disconnect()


@pytest.mark.asyncio
async def test_amqp_priority_conversion():
    """Test MessagePriority to AMQP priority conversion"""
    bus = MessageBus(auto_reconnect=False)

    assert bus._get_amqp_priority(MessagePriority.LOW) == 2
    assert bus._get_amqp_priority(MessagePriority.NORMAL) == 5
    assert bus._get_amqp_priority(MessagePriority.HIGH) == 7
    assert bus._get_amqp_priority(MessagePriority.CRITICAL) == 9


@pytest.mark.asyncio
async def test_exchange_name_selection():
    """Test exchange name selection based on routing strategy"""
    bus = MessageBus(auto_reconnect=False)

    assert bus._get_exchange_name(RoutingStrategy.DIRECT) == "lna.direct"
    assert bus._get_exchange_name(RoutingStrategy.BROADCAST) == "lna.fanout"
    assert bus._get_exchange_name(RoutingStrategy.FANOUT) == "lna.fanout"
    assert bus._get_exchange_name(RoutingStrategy.ROUND_ROBIN) == "lna.topic"


@pytest.mark.asyncio
async def test_message_envelope_create():
    """Test MessageEnvelope creation helper"""
    envelope = MessageEnvelope.create(
        sender_id="agent-001",
        message_type=MessageType.TASK_REQUEST,
        payload={"action": "test"},
        recipient_id="agent-002",
        priority=MessagePriority.HIGH,
        ttl_seconds=600
    )

    assert envelope.sender_id == "agent-001"
    assert envelope.recipient_id == "agent-002"
    assert envelope.message_type == MessageType.TASK_REQUEST
    assert envelope.header.priority == MessagePriority.HIGH
    assert envelope.header.ttl_seconds == 600
    assert envelope.payload == {"action": "test"}


@pytest.mark.asyncio
async def test_context_manager(mock_redis, mock_rabbitmq):
    """Test MessageBus as async context manager"""
    conn_mock, channel_mock = mock_rabbitmq

    with patch('redis.asyncio.from_url', return_value=mock_redis):
        with patch('messaging.message_bus.aio_pika.connect_robust', return_value=conn_mock):
            async with MessageBus(auto_reconnect=False) as bus:
                assert bus._redis is not None
                assert bus._rabbitmq_conn is not None
                assert bus._redis_healthy is True
                assert bus._rabbitmq_healthy is True

            # After exiting context, connections should be closed
            # (but we can't check since bus is out of scope)


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
