"""
Qdrant Client for Vector Storage.

Provides async interface for:
- Vector embedding storage
- Similarity search
- Collection management
- Tenant data isolation
- Batch operations
"""

from typing import Any, Optional
from uuid import UUID

import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.core.config import settings

logger = structlog.get_logger()


class QdrantVectorClient:
    """
    Async Qdrant client for vector operations.

    Features:
    - Multi-tenant vector isolation
    - Batch vector insertion
    - Similarity search
    - Collection management
    - Automatic collection creation
    """

    def __init__(self):
        self.client: Optional[AsyncQdrantClient] = None
        self.url = str(settings.QDRANT_URL)
        self.api_key = settings.QDRANT_API_KEY
        self.collection_name = settings.QDRANT_COLLECTION
        self.vector_dimension = 1536  # OpenAI ada-002 / text-embedding-3-small

    async def connect(self) -> None:
        """Establish connection to Qdrant."""
        if self.client is not None:
            return

        try:
            self.client = AsyncQdrantClient(
                url=self.url,
                api_key=self.api_key,
                timeout=30.0,
            )

            logger.info(
                "qdrant_connected",
                url=self.url,
                collection=self.collection_name,
            )

        except Exception as e:
            logger.error("qdrant_connection_failed", error=str(e))
            raise

    async def close(self) -> None:
        """Close Qdrant connection."""
        if self.client:
            await self.client.close()
            self.client = None
            logger.info("qdrant_disconnected")

    async def ensure_collection(self) -> None:
        """Ensure collection exists, create if not."""
        if not self.client:
            await self.connect()

        try:
            # Check if collection exists
            collections = await self.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            if self.collection_name not in collection_names:
                # Create collection
                await self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_dimension,
                        distance=Distance.COSINE,
                    ),
                )

                logger.info(
                    "qdrant_collection_created",
                    collection=self.collection_name,
                    dimension=self.vector_dimension,
                )

        except Exception as e:
            logger.error("qdrant_collection_setup_failed", error=str(e))
            raise

    async def upsert_vector(
        self,
        tenant_id: UUID,
        entity_id: UUID,
        vector: list[float],
        metadata: dict[str, Any],
    ) -> bool:
        """
        Insert or update a vector.

        Args:
            tenant_id: Tenant ID for isolation
            entity_id: Entity ID (used as point ID)
            vector: Embedding vector
            metadata: Entity metadata

        Returns:
            True if successful
        """
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        # Prepare payload with tenant isolation
        payload = {
            **metadata,
            "tenant_id": str(tenant_id),
            "entity_id": str(entity_id),
        }

        try:
            point = PointStruct(
                id=str(entity_id),
                vector=vector,
                payload=payload,
            )

            await self.client.upsert(
                collection_name=self.collection_name,
                points=[point],
            )

            logger.info(
                "qdrant_vector_upserted",
                tenant_id=str(tenant_id),
                entity_id=str(entity_id),
            )

            return True

        except Exception as e:
            logger.error(
                "qdrant_vector_upsert_failed",
                error=str(e),
                entity_id=str(entity_id),
            )
            return False

    async def upsert_vectors_batch(
        self,
        tenant_id: UUID,
        vectors: list[dict[str, Any]],
    ) -> int:
        """
        Insert multiple vectors in batch.

        Args:
            tenant_id: Tenant ID
            vectors: List of vectors with structure:
                {
                    "entity_id": UUID,
                    "vector": [0.1, 0.2, ...],
                    "metadata": {...}
                }

        Returns:
            Number of vectors inserted
        """
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        if not vectors:
            return 0

        try:
            points = []
            for v in vectors:
                payload = {
                    **v.get("metadata", {}),
                    "tenant_id": str(tenant_id),
                    "entity_id": str(v["entity_id"]),
                }

                point = PointStruct(
                    id=str(v["entity_id"]),
                    vector=v["vector"],
                    payload=payload,
                )
                points.append(point)

            await self.client.upsert(
                collection_name=self.collection_name,
                points=points,
            )

            logger.info(
                "qdrant_batch_vectors_upserted",
                tenant_id=str(tenant_id),
                count=len(points),
            )

            return len(points)

        except Exception as e:
            logger.error(
                "qdrant_batch_upsert_failed",
                error=str(e),
                batch_size=len(vectors),
            )
            raise

    async def search_similar(
        self,
        tenant_id: UUID,
        query_vector: list[float],
        limit: int = 10,
        score_threshold: float = 0.5,
    ) -> list[dict[str, Any]]:
        """
        Search for similar vectors.

        Args:
            tenant_id: Tenant ID for isolation
            query_vector: Query embedding vector
            limit: Maximum number of results
            score_threshold: Minimum similarity score (0.0-1.0)

        Returns:
            List of similar entities with scores
        """
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        try:
            # Filter by tenant
            tenant_filter = Filter(
                must=[
                    FieldCondition(
                        key="tenant_id",
                        match=MatchValue(value=str(tenant_id)),
                    )
                ]
            )

            # Search
            results = await self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=tenant_filter,
                limit=limit,
                score_threshold=score_threshold,
            )

            # Format results
            similar_entities = []
            for result in results:
                similar_entities.append({
                    "entity_id": result.payload.get("entity_id"),
                    "score": result.score,
                    "metadata": {
                        k: v
                        for k, v in result.payload.items()
                        if k not in ("tenant_id", "entity_id")
                    },
                })

            logger.info(
                "qdrant_search_completed",
                tenant_id=str(tenant_id),
                results_count=len(similar_entities),
            )

            return similar_entities

        except Exception as e:
            logger.error("qdrant_search_failed", error=str(e))
            return []

    async def delete_tenant_data(self, tenant_id: UUID) -> int:
        """
        Delete all vectors for a tenant.

        Args:
            tenant_id: Tenant ID to delete

        Returns:
            Number of vectors deleted
        """
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        try:
            # Get count before deletion
            count_before = await self.get_vector_count(tenant_id)

            # Delete by tenant filter
            tenant_filter = Filter(
                must=[
                    FieldCondition(
                        key="tenant_id",
                        match=MatchValue(value=str(tenant_id)),
                    )
                ]
            )

            await self.client.delete(
                collection_name=self.collection_name,
                points_selector=tenant_filter,
            )

            logger.warning(
                "qdrant_tenant_data_deleted",
                tenant_id=str(tenant_id),
                deleted_count=count_before,
            )

            return count_before

        except Exception as e:
            logger.error(
                "qdrant_tenant_delete_failed",
                error=str(e),
                tenant_id=str(tenant_id),
            )
            raise

    async def get_vector_count(self, tenant_id: UUID) -> int:
        """Get total vector count for tenant."""
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        try:
            tenant_filter = Filter(
                must=[
                    FieldCondition(
                        key="tenant_id",
                        match=MatchValue(value=str(tenant_id)),
                    )
                ]
            )

            result = await self.client.count(
                collection_name=self.collection_name,
                count_filter=tenant_filter,
            )

            return result.count

        except Exception as e:
            logger.error("qdrant_count_failed", error=str(e))
            return 0

    async def get_collection_info(self) -> dict[str, Any]:
        """Get collection information."""
        if not self.client:
            await self.connect()

        await self.ensure_collection()

        try:
            info = await self.client.get_collection(
                collection_name=self.collection_name
            )

            return {
                "name": info.config.params.vectors.size,
                "vector_dimension": info.config.params.vectors.size,
                "distance": info.config.params.vectors.distance.value,
                "points_count": info.points_count,
                "indexed_vectors_count": info.indexed_vectors_count,
            }

        except Exception as e:
            logger.error("qdrant_collection_info_failed", error=str(e))
            return {}

    async def health_check(self) -> bool:
        """Check Qdrant connectivity."""
        try:
            if not self.client:
                await self.connect()

            # Try to list collections
            await self.client.get_collections()
            return True

        except Exception as e:
            logger.error("qdrant_health_check_failed", error=str(e))
            return False


# Global client instance
_qdrant_client: Optional[QdrantVectorClient] = None


def get_qdrant_client() -> QdrantVectorClient:
    """Get or create global Qdrant client instance."""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantVectorClient()
    return _qdrant_client
