"""
Test suite for GraphRAG Client functionality

Tests the GraphRAG client with mocked PostgreSQL connections.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from uuid import uuid4, UUID
from datetime import datetime, timezone
import json

from graphrag.client import GraphRAGClient
from utils.errors import GraphRAGError, PostgresConnectionError, QueryExecutionError


@pytest.fixture
def mock_pool():
    """Mock asyncpg connection pool"""
    pool_mock = AsyncMock()

    # Mock connection
    conn_mock = AsyncMock()
    conn_mock.execute = AsyncMock()
    conn_mock.fetchval = AsyncMock()
    conn_mock.fetchrow = AsyncMock()
    conn_mock.fetch = AsyncMock(return_value=[])

    # Mock pool.acquire() context manager
    class MockAcquire:
        async def __aenter__(self):
            return conn_mock

        async def __aexit__(self, exc_type, exc, tb):
            pass

    pool_mock.acquire = Mock(return_value=MockAcquire())
    pool_mock.close = AsyncMock()
    pool_mock.get_size = Mock(return_value=10)
    pool_mock.get_idle_size = Mock(return_value=5)

    return pool_mock, conn_mock


@pytest.fixture
def mock_create_pool_factory(mock_pool):
    """Factory to create async mock for asyncpg.create_pool"""
    pool_mock, _ = mock_pool

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    return mock_create_pool


@pytest.mark.asyncio
async def test_graphrag_client_initialization():
    """Test GraphRAG client initialization"""
    client = GraphRAGClient(
        dsn="postgresql://user:pass@localhost:5432/test_db",
        min_pool_size=2,
        max_pool_size=10,
        command_timeout=30.0
    )

    assert client.dsn == "postgresql://user:pass@localhost:5432/test_db"
    assert client.min_pool_size == 2
    assert client.max_pool_size == 10
    assert client.command_timeout == 30.0
    assert client.vector_dim == 384


@pytest.mark.asyncio
async def test_graphrag_client_connect(mock_pool):
    """Test GraphRAG client connection"""
    pool_mock, conn_mock = mock_pool

    # Create an async mock for create_pool
    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Verify pool created
        assert client._pool is not None

        # Verify schema initialization called
        assert conn_mock.execute.called

        await client.disconnect()


@pytest.mark.asyncio
async def test_graphrag_client_disconnect(mock_pool):
    """Test GraphRAG client disconnection"""
    pool_mock, conn_mock = mock_pool

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()
        await client.disconnect()

        # Verify pool closed
        pool_mock.close.assert_called_once()
        assert client._pool is None


@pytest.mark.asyncio
async def test_store_entity(mock_pool):
    """Test storing an entity"""
    pool_mock, conn_mock = mock_pool
    entity_id = uuid4()

    # Mock fetchval to return entity_id
    conn_mock.fetchval = AsyncMock(return_value=entity_id)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Store entity
        result_id = await client.store_entity(
            user_id="user-001",
            entity_type="transaction",
            properties={"amount": 500, "category": "groceries"},
            embedding=[0.1] * 384,
            metadata={"source": "plaid"}
        )

        assert result_id == str(entity_id)

        # Verify SQL called with correct parameters
        conn_mock.fetchval.assert_called_once()
        call_args = conn_mock.fetchval.call_args
        assert "INSERT INTO graphrag.entities" in call_args[0][0]
        assert call_args[0][1] == "user-001"
        assert call_args[0][2] == "transaction"

        await client.disconnect()


@pytest.mark.asyncio
async def test_store_relationship(mock_pool):
    """Test storing a relationship"""
    pool_mock, conn_mock = mock_pool
    relationship_id = uuid4()

    conn_mock.fetchval = AsyncMock(return_value=relationship_id)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        source_id = str(uuid4())
        target_id = str(uuid4())

        # Store relationship
        result_id = await client.store_relationship(
            user_id="user-001",
            source_entity_id=source_id,
            target_entity_id=target_id,
            relationship_type="belongs_to",
            properties={"weight": 1.0}
        )

        assert result_id == str(relationship_id)

        # Verify SQL called
        conn_mock.fetchval.assert_called_once()
        call_args = conn_mock.fetchval.call_args
        assert "INSERT INTO graphrag.relationships" in call_args[0][0]

        await client.disconnect()


@pytest.mark.asyncio
async def test_semantic_search(mock_pool):
    """Test semantic search"""
    pool_mock, conn_mock = mock_pool

    # Mock search results
    mock_results = [
        {
            'entity_id': uuid4(),
            'entity_type': 'transaction',
            'properties': {"amount": 500},
            'metadata': {},
            'distance': 0.2
        },
        {
            'entity_id': uuid4(),
            'entity_type': 'transaction',
            'properties': {"amount": 300},
            'metadata': {},
            'distance': 0.3
        }
    ]

    conn_mock.fetch = AsyncMock(return_value=mock_results)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Perform semantic search
        query_embedding = [0.5] * 384
        results = await client.semantic_search(
            user_id="user-001",
            query_embedding=query_embedding,
            entity_type="transaction",
            k=5
        )

        assert len(results) == 2
        assert results[0]['entity_type'] == 'transaction'
        assert 'similarity' in results[0]
        assert 0.0 <= results[0]['similarity'] <= 1.0

        # Verify SQL called
        conn_mock.fetch.assert_called_once()

        await client.disconnect()


@pytest.mark.asyncio
async def test_semantic_search_with_threshold(mock_pool):
    """Test semantic search with distance threshold"""
    pool_mock, conn_mock = mock_pool

    # Mock results with varying distances
    mock_results = [
        {
            'entity_id': uuid4(),
            'entity_type': 'transaction',
            'properties': {"amount": 500},
            'metadata': {},
            'distance': 0.1  # Very similar
        },
        {
            'entity_id': uuid4(),
            'entity_type': 'transaction',
            'properties': {"amount": 300},
            'metadata': {},
            'distance': 1.5  # Beyond threshold
        }
    ]

    conn_mock.fetch = AsyncMock(return_value=mock_results)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Search with strict threshold
        results = await client.semantic_search(
            user_id="user-001",
            query_embedding=[0.5] * 384,
            k=5,
            distance_threshold=1.0  # Only first result should pass
        )

        # Only one result should pass threshold
        assert len(results) == 1
        assert results[0]['properties']['amount'] == 500

        await client.disconnect()


@pytest.mark.asyncio
async def test_store_memory(mock_pool):
    """Test storing agent memory"""
    pool_mock, conn_mock = mock_pool
    memory_id = uuid4()

    conn_mock.fetchval = AsyncMock(return_value=memory_id)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Store memory
        result_id = await client.store_memory(
            user_id="user-001",
            agent_id="agent-001",
            content="User wants to save $500 monthly for vacation",
            embedding=[0.2] * 384,
            context={"conversation_id": "conv-123"},
            metadata={"priority": "high"}
        )

        assert result_id == str(memory_id)

        # Verify SQL called
        conn_mock.fetchval.assert_called_once()
        call_args = conn_mock.fetchval.call_args
        assert "INSERT INTO graphrag.semantic_memory" in call_args[0][0]

        await client.disconnect()


@pytest.mark.asyncio
async def test_retrieve_memories(mock_pool):
    """Test retrieving agent memories"""
    pool_mock, conn_mock = mock_pool

    # Mock memory results
    mock_memories = [
        {
            'memory_id': uuid4(),
            'content': 'User wants to save money',
            'context': {},
            'metadata': {},
            'created_at': datetime.now(timezone.utc),
            'distance': 0.15
        },
        {
            'memory_id': uuid4(),
            'content': 'User has spending goal',
            'context': {},
            'metadata': {},
            'created_at': datetime.now(timezone.utc),
            'distance': 0.25
        }
    ]

    conn_mock.fetch = AsyncMock(return_value=mock_memories)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Retrieve memories
        memories = await client.retrieve_memories(
            user_id="user-001",
            agent_id="agent-001",
            query_embedding=[0.3] * 384,
            k=5
        )

        assert len(memories) == 2
        assert 'content' in memories[0]
        assert 'similarity' in memories[0]
        assert 'created_at' in memories[0]

        await client.disconnect()


@pytest.mark.asyncio
async def test_get_entity(mock_pool):
    """Test getting entity by ID"""
    pool_mock, conn_mock = mock_pool
    entity_id = uuid4()

    # Mock entity result
    mock_entity = {
        'entity_id': entity_id,
        'entity_type': 'goal',
        'properties': {"target": 10000, "name": "Vacation fund"},
        'metadata': {},
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }

    conn_mock.fetchrow = AsyncMock(return_value=mock_entity)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Get entity
        entity = await client.get_entity(
            user_id="user-001",
            entity_id=str(entity_id)
        )

        assert entity is not None
        assert entity['entity_id'] == str(entity_id)
        assert entity['entity_type'] == 'goal'
        assert entity['properties']['target'] == 10000

        await client.disconnect()


@pytest.mark.asyncio
async def test_get_entity_not_found(mock_pool):
    """Test getting non-existent entity"""
    pool_mock, conn_mock = mock_pool

    conn_mock.fetchrow = AsyncMock(return_value=None)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Get non-existent entity
        entity = await client.get_entity(
            user_id="user-001",
            entity_id=str(uuid4())
        )

        assert entity is None

        await client.disconnect()


@pytest.mark.asyncio
async def test_get_relationships_outgoing(mock_pool):
    """Test getting outgoing relationships"""
    pool_mock, conn_mock = mock_pool
    entity_id = uuid4()

    # Mock relationship results
    mock_rels = [
        {
            'relationship_id': uuid4(),
            'source_entity_id': entity_id,
            'target_entity_id': uuid4(),
            'relationship_type': 'belongs_to',
            'properties': {},
            'metadata': {},
            'created_at': datetime.now(timezone.utc)
        }
    ]

    conn_mock.fetch = AsyncMock(return_value=mock_rels)

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Get outgoing relationships
        relationships = await client.get_relationships(
            user_id="user-001",
            entity_id=str(entity_id),
            direction="outgoing"
        )

        assert len(relationships) == 1
        assert relationships[0]['relationship_type'] == 'belongs_to'

        # Verify SQL called with correct condition
        call_args = conn_mock.fetch.call_args
        assert "source_entity_id = $2" in call_args[0][0]

        await client.disconnect()


@pytest.mark.asyncio
async def test_get_stats(mock_pool):
    """Test getting client statistics"""
    pool_mock, conn_mock = mock_pool

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        client = GraphRAGClient()
        await client.connect()

        # Get stats
        stats = client.get_stats()

        assert stats['connected'] is True
        assert stats['vector_dim'] == 384
        assert 'pool_size' in stats
        assert 'pool_free' in stats

        await client.disconnect()


@pytest.mark.asyncio
async def test_context_manager(mock_pool):
    """Test GraphRAG client as async context manager"""
    pool_mock, conn_mock = mock_pool

    async def mock_create_pool(*args, **kwargs):
        return pool_mock

    with patch('asyncpg.create_pool', side_effect=mock_create_pool):
        async with GraphRAGClient() as client:
            assert client._pool is not None

        # After exiting context, pool should be closed
        pool_mock.close.assert_called_once()


@pytest.mark.asyncio
async def test_connection_error():
    """Test handling connection errors"""
    with patch('asyncpg.create_pool', side_effect=Exception("Connection failed")):
        client = GraphRAGClient()

        with pytest.raises(PostgresConnectionError):
            await client.connect()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
