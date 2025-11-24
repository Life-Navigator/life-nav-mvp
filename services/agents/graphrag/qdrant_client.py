"""
Qdrant Vector Database Client

High-performance vector similarity search for:
- Central Knowledge: Regulatory embeddings for semantic compliance search
- Personal Knowledge: User document and transaction embeddings

Qdrant running on localhost:6333
"""

from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient as QdrantSDK
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchParams,
    HnswConfigDiff,
    OptimizersConfigDiff
)
import uuid
from datetime import datetime

from utils.config import Config
from utils.logging import get_logger

logger = get_logger(__name__)

# Collection names
COLLECTION_CENTRAL_KNOWLEDGE = "central_knowledge"      # Regulatory embeddings
COLLECTION_PERSONAL_DOCUMENTS = "personal_documents"    # User document embeddings
COLLECTION_PERSONAL_TRANSACTIONS = "personal_transactions"  # Transaction embeddings
COLLECTION_CONVERSATION_MEMORY = "conversation_memory"  # Agent conversation memory

# Vector dimensions (all-MiniLM-L6-v2 = 384)
VECTOR_DIM = 384

# Special user ID for centralized content
CENTRALIZED_USER_ID = "centralized"


class QdrantVectorClient:
    """
    Qdrant client for high-performance vector similarity search.

    Collections:
    - central_knowledge: Shared regulatory/compliance embeddings (no user_id filter)
    - personal_documents: User document embeddings (filtered by user_id)
    - personal_transactions: Transaction embeddings (filtered by user_id)
    - conversation_memory: Agent conversation history (filtered by user_id + agent_id)

    Features:
    - Cosine similarity search
    - Payload filtering for RLS
    - Batch upsert operations
    - HNSW indexing for fast queries
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        grpc_port: Optional[int] = None,
        prefer_grpc: bool = True
    ):
        """
        Initialize Qdrant client.

        Args:
            host: Qdrant host (defaults to localhost)
            port: REST API port (defaults to 6333)
            grpc_port: gRPC port (defaults to 6334)
            prefer_grpc: Use gRPC for better performance
        """
        config = Config.get()

        self.host = host or config.get("QDRANT_HOST", "localhost")
        self.port = port or int(config.get("QDRANT_PORT", "6333"))
        self.grpc_port = grpc_port or int(config.get("QDRANT_GRPC_PORT", "6334"))
        self.prefer_grpc = prefer_grpc

        self._client: Optional[QdrantSDK] = None

        logger.info(
            "QdrantVectorClient initialized",
            extra={"host": self.host, "port": self.port}
        )

    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()

    async def connect(self):
        """Create connection to Qdrant"""
        try:
            self._client = QdrantSDK(
                host=self.host,
                port=self.port,
                grpc_port=self.grpc_port,
                prefer_grpc=self.prefer_grpc
            )

            # Initialize collections
            await self._initialize_collections()

            logger.info("Qdrant connection established")

        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            raise

    async def disconnect(self):
        """Close Qdrant connection"""
        if self._client:
            self._client.close()
            self._client = None
            logger.info("Qdrant connection closed")

    async def _initialize_collections(self):
        """Initialize all required collections"""
        collections_config = [
            {
                "name": COLLECTION_CENTRAL_KNOWLEDGE,
                "description": "Central regulatory and compliance knowledge embeddings"
            },
            {
                "name": COLLECTION_PERSONAL_DOCUMENTS,
                "description": "User document embeddings with RLS"
            },
            {
                "name": COLLECTION_PERSONAL_TRANSACTIONS,
                "description": "User transaction embeddings with RLS"
            },
            {
                "name": COLLECTION_CONVERSATION_MEMORY,
                "description": "Agent conversation memory embeddings"
            }
        ]

        for config in collections_config:
            try:
                # Check if collection exists
                if not self._client.collection_exists(config["name"]):
                    self._client.create_collection(
                        collection_name=config["name"],
                        vectors_config=VectorParams(
                            size=VECTOR_DIM,
                            distance=Distance.COSINE
                        ),
                        hnsw_config=HnswConfigDiff(
                            m=16,
                            ef_construct=100,
                            full_scan_threshold=10000
                        ),
                        optimizers_config=OptimizersConfigDiff(
                            memmap_threshold=20000
                        )
                    )
                    logger.info(f"Created collection: {config['name']}")
                else:
                    logger.debug(f"Collection exists: {config['name']}")

            except Exception as e:
                logger.error(f"Error creating collection {config['name']}: {e}")
                raise

    # =========================================================================
    # Central Knowledge (Regulatory Embeddings)
    # =========================================================================

    async def upsert_central_knowledge(
        self,
        points: List[Dict[str, Any]]
    ) -> int:
        """
        Upsert embeddings to central knowledge collection.

        Args:
            points: List of dicts with keys:
                - id: Unique identifier
                - embedding: Vector (384-dim)
                - regulation_id: Source regulation
                - rule_id: Optional rule ID
                - chunk_text: Text content
                - category: Regulation category
                - source: Source agency
                - metadata: Additional metadata

        Returns:
            Number of points upserted
        """
        qdrant_points = []

        for point in points:
            point_id = point.get("id") or str(uuid.uuid4())

            qdrant_points.append(PointStruct(
                id=point_id if isinstance(point_id, str) else str(point_id),
                vector=point["embedding"],
                payload={
                    "regulation_id": point.get("regulation_id"),
                    "rule_id": point.get("rule_id"),
                    "chunk_text": point.get("chunk_text", ""),
                    "category": point.get("category"),
                    "source": point.get("source"),
                    "metadata": point.get("metadata", {}),
                    "created_at": datetime.utcnow().isoformat()
                }
            ))

        self._client.upsert(
            collection_name=COLLECTION_CENTRAL_KNOWLEDGE,
            points=qdrant_points
        )

        logger.debug(f"Upserted {len(qdrant_points)} points to central knowledge")
        return len(qdrant_points)

    async def search_central_knowledge(
        self,
        query_embedding: List[float],
        category: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 10,
        score_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search central knowledge for relevant regulations.

        Args:
            query_embedding: Query vector (384-dim)
            category: Filter by category
            source: Filter by source
            limit: Maximum results
            score_threshold: Minimum similarity score

        Returns:
            List of matching regulations with scores
        """
        # Build filters
        must_conditions = []

        if category:
            must_conditions.append(
                FieldCondition(key="category", match=MatchValue(value=category))
            )

        if source:
            must_conditions.append(
                FieldCondition(key="source", match=MatchValue(value=source))
            )

        search_filter = Filter(must=must_conditions) if must_conditions else None

        results = self._client.search(
            collection_name=COLLECTION_CENTRAL_KNOWLEDGE,
            query_vector=query_embedding,
            query_filter=search_filter,
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True
        )

        return [
            {
                "id": str(r.id),
                "score": r.score,
                "regulation_id": r.payload.get("regulation_id"),
                "rule_id": r.payload.get("rule_id"),
                "chunk_text": r.payload.get("chunk_text"),
                "category": r.payload.get("category"),
                "source": r.payload.get("source"),
                "metadata": r.payload.get("metadata", {})
            }
            for r in results
        ]

    # =========================================================================
    # Personal Documents (User Document Embeddings with RLS)
    # =========================================================================

    async def upsert_personal_documents(
        self,
        user_id: str,
        points: List[Dict[str, Any]]
    ) -> int:
        """
        Upsert document embeddings for a user.

        Args:
            user_id: User identifier (RLS)
            points: List of dicts with keys:
                - id: Unique identifier
                - embedding: Vector (384-dim)
                - document_id: Source document
                - chunk_text: Text content
                - document_type: Document type
                - metadata: Additional metadata

        Returns:
            Number of points upserted
        """
        qdrant_points = []

        for point in points:
            point_id = point.get("id") or str(uuid.uuid4())

            qdrant_points.append(PointStruct(
                id=point_id if isinstance(point_id, str) else str(point_id),
                vector=point["embedding"],
                payload={
                    "user_id": user_id,  # RLS key
                    "document_id": point.get("document_id"),
                    "chunk_text": point.get("chunk_text", ""),
                    "document_type": point.get("document_type"),
                    "metadata": point.get("metadata", {}),
                    "created_at": datetime.utcnow().isoformat()
                }
            ))

        self._client.upsert(
            collection_name=COLLECTION_PERSONAL_DOCUMENTS,
            points=qdrant_points
        )

        logger.debug(f"Upserted {len(qdrant_points)} document points for user {user_id}")
        return len(qdrant_points)

    async def search_personal_documents(
        self,
        user_id: str,
        query_embedding: List[float],
        document_type: Optional[str] = None,
        limit: int = 10,
        score_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search user's documents (RLS enforced).

        Args:
            user_id: User identifier
            query_embedding: Query vector
            document_type: Filter by type
            limit: Maximum results
            score_threshold: Minimum similarity

        Returns:
            List of matching document chunks
        """
        # Always filter by user_id (RLS)
        must_conditions = [
            FieldCondition(key="user_id", match=MatchValue(value=user_id))
        ]

        if document_type:
            must_conditions.append(
                FieldCondition(key="document_type", match=MatchValue(value=document_type))
            )

        results = self._client.search(
            collection_name=COLLECTION_PERSONAL_DOCUMENTS,
            query_vector=query_embedding,
            query_filter=Filter(must=must_conditions),
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True
        )

        return [
            {
                "id": str(r.id),
                "score": r.score,
                "document_id": r.payload.get("document_id"),
                "chunk_text": r.payload.get("chunk_text"),
                "document_type": r.payload.get("document_type"),
                "metadata": r.payload.get("metadata", {})
            }
            for r in results
        ]

    # =========================================================================
    # Personal Transactions (Transaction Embeddings with RLS)
    # =========================================================================

    async def upsert_personal_transactions(
        self,
        user_id: str,
        points: List[Dict[str, Any]]
    ) -> int:
        """
        Upsert transaction embeddings for a user.

        Args:
            user_id: User identifier (RLS)
            points: List of dicts with keys:
                - id: Unique identifier
                - embedding: Vector (384-dim)
                - transaction_id: Source transaction
                - description: Transaction description
                - category: Transaction category
                - amount: Transaction amount
                - metadata: Additional metadata

        Returns:
            Number of points upserted
        """
        qdrant_points = []

        for point in points:
            point_id = point.get("id") or str(uuid.uuid4())

            qdrant_points.append(PointStruct(
                id=point_id if isinstance(point_id, str) else str(point_id),
                vector=point["embedding"],
                payload={
                    "user_id": user_id,  # RLS key
                    "transaction_id": point.get("transaction_id"),
                    "description": point.get("description", ""),
                    "category": point.get("category"),
                    "amount": point.get("amount"),
                    "metadata": point.get("metadata", {}),
                    "created_at": datetime.utcnow().isoformat()
                }
            ))

        self._client.upsert(
            collection_name=COLLECTION_PERSONAL_TRANSACTIONS,
            points=qdrant_points
        )

        logger.debug(f"Upserted {len(qdrant_points)} transaction points for user {user_id}")
        return len(qdrant_points)

    async def search_personal_transactions(
        self,
        user_id: str,
        query_embedding: List[float],
        category: Optional[str] = None,
        limit: int = 10,
        score_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search user's transactions (RLS enforced).

        Args:
            user_id: User identifier
            query_embedding: Query vector
            category: Filter by category
            limit: Maximum results
            score_threshold: Minimum similarity

        Returns:
            List of matching transactions
        """
        # Always filter by user_id (RLS)
        must_conditions = [
            FieldCondition(key="user_id", match=MatchValue(value=user_id))
        ]

        if category:
            must_conditions.append(
                FieldCondition(key="category", match=MatchValue(value=category))
            )

        results = self._client.search(
            collection_name=COLLECTION_PERSONAL_TRANSACTIONS,
            query_vector=query_embedding,
            query_filter=Filter(must=must_conditions),
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True
        )

        return [
            {
                "id": str(r.id),
                "score": r.score,
                "transaction_id": r.payload.get("transaction_id"),
                "description": r.payload.get("description"),
                "category": r.payload.get("category"),
                "amount": r.payload.get("amount"),
                "metadata": r.payload.get("metadata", {})
            }
            for r in results
        ]

    # =========================================================================
    # Conversation Memory
    # =========================================================================

    async def upsert_conversation_memory(
        self,
        user_id: str,
        agent_id: str,
        points: List[Dict[str, Any]]
    ) -> int:
        """
        Upsert conversation memory embeddings.

        Args:
            user_id: User identifier (RLS)
            agent_id: Agent identifier
            points: List of dicts with keys:
                - id: Unique identifier
                - embedding: Vector (384-dim)
                - content: Message content
                - role: Message role (user/assistant)
                - metadata: Additional metadata

        Returns:
            Number of points upserted
        """
        qdrant_points = []

        for point in points:
            point_id = point.get("id") or str(uuid.uuid4())

            qdrant_points.append(PointStruct(
                id=point_id if isinstance(point_id, str) else str(point_id),
                vector=point["embedding"],
                payload={
                    "user_id": user_id,  # RLS key
                    "agent_id": agent_id,
                    "content": point.get("content", ""),
                    "role": point.get("role"),
                    "metadata": point.get("metadata", {}),
                    "created_at": datetime.utcnow().isoformat()
                }
            ))

        self._client.upsert(
            collection_name=COLLECTION_CONVERSATION_MEMORY,
            points=qdrant_points
        )

        logger.debug(f"Upserted {len(qdrant_points)} memory points for user {user_id}")
        return len(qdrant_points)

    async def search_conversation_memory(
        self,
        user_id: str,
        agent_id: str,
        query_embedding: List[float],
        limit: int = 10,
        score_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search conversation memory (RLS enforced).

        Args:
            user_id: User identifier
            agent_id: Agent identifier
            query_embedding: Query vector
            limit: Maximum results
            score_threshold: Minimum similarity

        Returns:
            List of matching memories
        """
        results = self._client.search(
            collection_name=COLLECTION_CONVERSATION_MEMORY,
            query_vector=query_embedding,
            query_filter=Filter(must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="agent_id", match=MatchValue(value=agent_id))
            ]),
            limit=limit,
            score_threshold=score_threshold,
            with_payload=True
        )

        return [
            {
                "id": str(r.id),
                "score": r.score,
                "content": r.payload.get("content"),
                "role": r.payload.get("role"),
                "metadata": r.payload.get("metadata", {}),
                "created_at": r.payload.get("created_at")
            }
            for r in results
        ]

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def delete_user_data(self, user_id: str) -> Dict[str, int]:
        """
        Delete all data for a user across all personal collections.

        Args:
            user_id: User identifier

        Returns:
            Dict with deletion counts per collection
        """
        deleted = {}

        for collection in [
            COLLECTION_PERSONAL_DOCUMENTS,
            COLLECTION_PERSONAL_TRANSACTIONS,
            COLLECTION_CONVERSATION_MEMORY
        ]:
            result = self._client.delete(
                collection_name=collection,
                points_selector=Filter(must=[
                    FieldCondition(key="user_id", match=MatchValue(value=user_id))
                ])
            )
            deleted[collection] = result.status

        logger.info(f"Deleted all data for user {user_id}")
        return deleted

    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics"""
        stats = {
            "connected": self._client is not None,
            "host": self.host,
            "port": self.port,
            "collections": {}
        }

        if self._client:
            for collection in [
                COLLECTION_CENTRAL_KNOWLEDGE,
                COLLECTION_PERSONAL_DOCUMENTS,
                COLLECTION_PERSONAL_TRANSACTIONS,
                COLLECTION_CONVERSATION_MEMORY
            ]:
                try:
                    info = self._client.get_collection(collection)
                    stats["collections"][collection] = {
                        "points_count": info.points_count,
                        "vectors_count": info.vectors_count
                    }
                except Exception:
                    stats["collections"][collection] = {"error": "not found"}

        return stats


# Global client instance
_global_qdrant_client: Optional[QdrantVectorClient] = None


async def get_qdrant_client() -> QdrantVectorClient:
    """Get or create global Qdrant client instance"""
    global _global_qdrant_client

    if _global_qdrant_client is None:
        _global_qdrant_client = QdrantVectorClient()
        await _global_qdrant_client.connect()
        logger.info("Global Qdrant client created")

    return _global_qdrant_client


async def cleanup_qdrant_client():
    """Cleanup global Qdrant client instance"""
    global _global_qdrant_client

    if _global_qdrant_client is not None:
        await _global_qdrant_client.disconnect()
        _global_qdrant_client = None
        logger.info("Global Qdrant client cleaned up")
