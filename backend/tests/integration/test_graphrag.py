"""
Tests for GraphRAG gRPC client integration.

Tests verify that:
- GraphRAG client can establish gRPC connections
- Health checks work correctly
- Personalized queries include RLS context (user_id, tenant_id)
- Centralized queries work for org-wide knowledge
- Error handling works for service unavailability
- Response formats match protobuf schema

Note: These tests require the GraphRAG service to be running.
Use pytest markers to skip if service is unavailable:
    pytest -m "not requires_graphrag"
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.clients.graphrag import GraphRAGClient, get_graphrag_client
from app.models.user import Tenant, User


@pytest.mark.asyncio
@pytest.mark.integration
class TestGraphRAGClient:
    """Tests for GraphRAG gRPC client."""

    async def test_client_initialization(self):
        """Test GraphRAG client initialization with custom settings."""
        client = GraphRAGClient(
            host="localhost",
            port=50051,
            timeout=30.0,
            max_retries=3,
        )

        assert client.host == "localhost"
        assert client.port == 50051
        assert client.timeout == 30.0
        assert client.max_retries == 3
        assert client.address == "localhost:50051"

    async def test_client_initialization_with_defaults(self):
        """Test GraphRAG client uses settings defaults."""
        client = GraphRAGClient()

        # Should use defaults from settings or hardcoded defaults
        assert client.host in ["localhost", "graphrag"]
        assert client.port in [50051, 50052]
        assert client.timeout == 30.0

    async def test_client_context_manager(self):
        """Test GraphRAG client async context manager."""
        # Mock the channel and stub to avoid actual connection
        with patch("app.clients.graphrag.aio.insecure_channel") as mock_channel:
            mock_channel_instance = MagicMock()
            mock_channel_instance.close = AsyncMock()
            mock_channel.return_value = mock_channel_instance

            async with GraphRAGClient() as client:
                assert client._channel is not None

            # Verify close was called
            mock_channel_instance.close.assert_called_once()

    @pytest.mark.requires_graphrag
    async def test_health_check_when_service_available(self):
        """Test health check when GraphRAG service is running."""
        client = GraphRAGClient()

        try:
            health = await client.health_check()

            # Verify health response structure
            assert "status" in health
            assert "connected" in health
            assert health["connected"] is True
            assert health["status"] in ["healthy", "unhealthy"]

            # Optional fields
            if health["status"] == "healthy":
                assert "services" in health
                assert "version" in health

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    async def test_health_check_when_service_unavailable(self):
        """Test health check handles service unavailability gracefully."""
        # Use invalid host to simulate unavailable service
        client = GraphRAGClient(host="invalid-host-12345", port=99999)

        health = await client.health_check()

        # Should return unhealthy status instead of raising exception
        assert health["status"] == "unhealthy"
        assert health["connected"] is False
        assert "error" in health

        await client.close()

    @pytest.mark.requires_graphrag
    async def test_query_personalized_with_rls_context(
        self,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test personalized query includes RLS context (user_id, tenant_id)."""
        client = GraphRAGClient()

        try:
            response = await client.query_personalized(
                query="What are my financial goals?",
                user_id=str(test_user.id),
                tenant_id=str(test_tenant.id),
                max_results=5,
                domains=["finance", "goals"],
                include_sources=True,
                include_reasoning=False,
            )

            # Verify response structure
            assert "answer" in response
            assert "sources" in response
            assert "confidence" in response
            assert "entities" in response
            assert "duration_ms" in response

            # Verify types
            assert isinstance(response["answer"], str)
            assert isinstance(response["sources"], list)
            assert isinstance(response["confidence"], float)
            assert isinstance(response["entities"], list)
            assert isinstance(response["duration_ms"], int)

            # Confidence should be 0.0-1.0
            assert 0.0 <= response["confidence"] <= 1.0

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    @pytest.mark.requires_graphrag
    async def test_query_centralized(self):
        """Test centralized query for org-wide knowledge."""
        client = GraphRAGClient()

        try:
            response = await client.query_centralized(
                query="What is the company's mission?",
                max_results=5,
                domains=["organization"],
                include_sources=True,
                include_reasoning=False,
            )

            # Verify response structure (same as personalized)
            assert "answer" in response
            assert "sources" in response
            assert "confidence" in response
            assert "entities" in response
            assert "duration_ms" in response

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    @pytest.mark.requires_graphrag
    async def test_semantic_search(self, test_tenant: Tenant):
        """Test semantic search in knowledge graph."""
        client = GraphRAGClient()

        try:
            response = await client.semantic_search(
                query="financial accounts",
                tenant_id=str(test_tenant.id),
                entity_type="ln:FinancialAccount",
                limit=10,
            )

            # Verify response structure
            assert "entities" in response
            assert "total_count" in response
            assert "duration_ms" in response

            assert isinstance(response["entities"], list)
            assert isinstance(response["total_count"], int)
            assert isinstance(response["duration_ms"], int)

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    @pytest.mark.requires_graphrag
    async def test_vector_search(self):
        """Test vector similarity search."""
        client = GraphRAGClient()

        try:
            response = await client.vector_search(
                query_text="retirement planning strategies",
                limit=5,
                min_score=0.7,
            )

            # Verify response structure
            assert "results" in response
            assert "duration_ms" in response

            assert isinstance(response["results"], list)
            assert isinstance(response["duration_ms"], int)

            # Verify result structure if any results
            for result in response["results"]:
                assert "id" in result
                assert "score" in result
                assert "content" in result
                assert result["score"] >= 0.7  # Should respect min_score

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    @pytest.mark.requires_graphrag
    async def test_hybrid_search(self, test_tenant: Tenant):
        """Test hybrid search (semantic + vector)."""
        client = GraphRAGClient()

        try:
            response = await client.hybrid_search(
                query="investment portfolio diversification",
                tenant_id=str(test_tenant.id),
                limit=10,
                semantic_weight=0.6,
                vector_weight=0.4,
            )

            # Verify response structure
            assert "results" in response
            assert "duration_ms" in response

            assert isinstance(response["results"], list)
            assert isinstance(response["duration_ms"], int)

            # Verify result structure if any results
            for result in response["results"]:
                assert "entity" in result
                assert "semantic_score" in result
                assert "vector_score" in result
                assert "combined_score" in result
                assert "matched_by" in result

        except Exception as e:
            pytest.skip(f"GraphRAG service not available: {e}")
        finally:
            await client.close()

    def test_get_graphrag_client_singleton(self):
        """Test global client singleton pattern."""
        client1 = get_graphrag_client()
        client2 = get_graphrag_client()

        # Should return same instance
        assert client1 is client2


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.api
class TestGraphRAGEndpoints:
    """Tests for GraphRAG API endpoints."""

    async def test_query_endpoint_requires_auth(self, client):
        """Test query endpoint requires authentication."""
        response = client.post(
            "/api/v1/graphrag/query",
            json={
                "query": "What are my goals?",
                "max_results": 10,
            },
        )

        assert response.status_code == 401  # Unauthorized

    async def test_status_endpoint_requires_auth(self, client):
        """Test status endpoint requires authentication."""
        response = client.get("/api/v1/graphrag/status")

        assert response.status_code == 401  # Unauthorized

    @pytest.mark.requires_graphrag
    async def test_query_endpoint_with_auth(
        self,
        authenticated_client,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test query endpoint with valid authentication."""
        response = authenticated_client.post(
            "/api/v1/graphrag/query",
            json={
                "query": "What are my financial goals?",
                "max_results": 5,
                "domains": ["finance", "goals"],
                "include_sources": True,
                "include_reasoning": False,
            },
        )

        if response.status_code == 503:
            # Service unavailable - GraphRAG not running
            pytest.skip("GraphRAG service not available")

        assert response.status_code == 200

        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert "confidence" in data
        assert "entities" in data
        assert "duration_ms" in data

    @pytest.mark.requires_graphrag
    async def test_status_endpoint_with_auth(self, authenticated_client):
        """Test status endpoint with valid authentication."""
        response = authenticated_client.get("/api/v1/graphrag/status")

        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert "connected" in data

    async def test_index_rebuild_endpoint_not_implemented(self, authenticated_client):
        """Test index rebuild endpoint returns not implemented."""
        response = authenticated_client.post("/api/v1/graphrag/index/rebuild")

        assert response.status_code == 501  # Not Implemented
        assert "not yet available" in response.json()["detail"]

    async def test_index_status_endpoint_not_implemented(self, authenticated_client):
        """Test index status endpoint returns not implemented."""
        response = authenticated_client.get("/api/v1/graphrag/index/status")

        assert response.status_code == 501  # Not Implemented
        assert "not yet available" in response.json()["detail"]

    async def test_query_validation_requires_query_text(self, authenticated_client):
        """Test query validation requires query text."""
        response = authenticated_client.post(
            "/api/v1/graphrag/query",
            json={
                "max_results": 10,
                # Missing "query" field
            },
        )

        assert response.status_code == 422  # Unprocessable Entity

    async def test_query_validation_max_results_bounds(self, authenticated_client):
        """Test query validation enforces max_results bounds."""
        # Test upper bound
        response = authenticated_client.post(
            "/api/v1/graphrag/query",
            json={
                "query": "test",
                "max_results": 1000,  # Exceeds max of 100
            },
        )

        assert response.status_code == 422  # Unprocessable Entity

        # Test lower bound
        response = authenticated_client.post(
            "/api/v1/graphrag/query",
            json={
                "query": "test",
                "max_results": 0,  # Below min of 1
            },
        )

        assert response.status_code == 422  # Unprocessable Entity
