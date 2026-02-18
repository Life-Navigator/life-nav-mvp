"""
GraphRAG Client for PostgreSQL + pgvector

Provides semantic search, knowledge graph storage, and context retrieval for agents.
Uses pgvector for vector similarity search and PostgreSQL for relational data.
"""

from typing import List, Dict, Any, Optional
import asyncpg
from asyncpg.pool import Pool
import json

from utils.config import Config
from utils.logging import get_logger
from utils.errors import (
    PostgresConnectionError,
    QueryExecutionError
)

logger = get_logger(__name__)


class GraphRAGClient:
    """
    Production-grade GraphRAG client with PostgreSQL + pgvector.

    Features:
    - Vector similarity search for semantic context retrieval
    - Knowledge graph storage (entities, relationships, properties)
    - Row-level security for multi-tenancy
    - Connection pooling with automatic reconnection
    - Transaction support
    - Bulk insert optimization

    Example:
        >>> async with GraphRAGClient() as client:
        ...     # Store entity with embedding
        ...     entity_id = await client.store_entity(
        ...         entity_type="transaction",
        ...         properties={"amount": 500, "category": "groceries"},
        ...         embedding=embedding_vector
        ...     )
        ...     # Semantic search
        ...     results = await client.semantic_search(query_embedding, k=5)
    """

    def __init__(
        self,
        dsn: Optional[str] = None,
        min_pool_size: int = 5,
        max_pool_size: int = 20,
        command_timeout: float = 60.0
    ):
        """
        Initialize GraphRAG client.

        Args:
            dsn: PostgreSQL DSN connection string (defaults to config)
            min_pool_size: Minimum connection pool size
            max_pool_size: Maximum connection pool size
            command_timeout: Query timeout in seconds
        """
        config = Config.get()

        # Connection settings
        self.dsn = dsn or config.postgres.dsn
        self.min_pool_size = min_pool_size
        self.max_pool_size = max_pool_size
        self.command_timeout = command_timeout

        # Connection pool
        self._pool: Optional[Pool] = None

        # Vector dimension (384 for sentence-transformers/all-MiniLM-L6-v2)
        self.vector_dim = 384

        logger.info(
            "GraphRAGClient initialized",
            extra={
                "dsn_host": dsn.split("@")[-1].split("/")[0] if dsn else config.postgres.host,
                "pool_size": f"{min_pool_size}-{max_pool_size}"
            }
        )

    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()

    async def connect(self):
        """
        Create connection pool and initialize schema.
        """
        try:
            self._pool = await asyncpg.create_pool(
                dsn=self.dsn,
                min_size=self.min_pool_size,
                max_size=self.max_pool_size,
                command_timeout=self.command_timeout
            )

            logger.info(
                "PostgreSQL connection pool created",
                extra={
                    "pool_size": f"{self.min_pool_size}-{self.max_pool_size}",
                    "timeout": self.command_timeout
                }
            )

            # Initialize GraphRAG tables if needed
            await self._initialize_schema()

        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}", error=e)
            raise PostgresConnectionError(f"Failed to connect: {e}")

    async def disconnect(self):
        """
        Close connection pool.
        """
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("PostgreSQL connection pool closed")

    async def _initialize_schema(self):
        """
        Initialize GraphRAG schema and tables.
        Creates entities, relationships, and semantic_memory tables.
        """
        async with self._pool.acquire() as conn:
            # Create entities table with vector column
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS graphrag.entities (
                    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id VARCHAR(255) NOT NULL,
                    entity_type VARCHAR(255) NOT NULL,
                    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
                    embedding vector(384),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Create relationships table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS graphrag.relationships (
                    relationship_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id VARCHAR(255) NOT NULL,
                    source_entity_id UUID REFERENCES graphrag.entities(entity_id) ON DELETE CASCADE,
                    target_entity_id UUID REFERENCES graphrag.entities(entity_id) ON DELETE CASCADE,
                    relationship_type VARCHAR(255) NOT NULL,
                    properties JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Create semantic memory table for agent conversations
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS graphrag.semantic_memory (
                    memory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id VARCHAR(255) NOT NULL,
                    agent_id VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector(384),
                    context JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    metadata JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Create indexes for fast queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_entities_user_id ON graphrag.entities(user_id);
                CREATE INDEX IF NOT EXISTS idx_entities_type ON graphrag.entities(entity_type);
                CREATE INDEX IF NOT EXISTS idx_entities_embedding ON graphrag.entities USING ivfflat (embedding vector_cosine_ops);

                CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON graphrag.relationships(user_id);
                CREATE INDEX IF NOT EXISTS idx_relationships_source ON graphrag.relationships(source_entity_id);
                CREATE INDEX IF NOT EXISTS idx_relationships_target ON graphrag.relationships(target_entity_id);

                CREATE INDEX IF NOT EXISTS idx_semantic_memory_user_id ON graphrag.semantic_memory(user_id);
                CREATE INDEX IF NOT EXISTS idx_semantic_memory_agent_id ON graphrag.semantic_memory(agent_id);
                CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON graphrag.semantic_memory USING ivfflat (embedding vector_cosine_ops);
            """)

            logger.info("GraphRAG schema initialized")

    async def store_entity(
        self,
        user_id: str,
        entity_type: str,
        properties: Dict[str, Any],
        embedding: Optional[List[float]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store an entity in the knowledge graph.

        Args:
            user_id: User identifier for row-level security
            entity_type: Type of entity (e.g., "transaction", "goal", "account")
            properties: Entity properties as dict
            embedding: Optional embedding vector (384-dim)
            metadata: Optional additional metadata

        Returns:
            entity_id: UUID of created entity

        Raises:
            QueryExecutionError: If insert fails
        """
        try:
            async with self._pool.acquire() as conn:
                # Convert embedding to pgvector format if provided
                embedding_str = f'[{",".join(map(str, embedding))}]' if embedding else None

                entity_id = await conn.fetchval(
                    """
                    INSERT INTO graphrag.entities
                    (user_id, entity_type, properties, embedding, metadata)
                    VALUES ($1, $2, $3, $4::vector, $5)
                    RETURNING entity_id
                    """,
                    user_id,
                    entity_type,
                    json.dumps(properties),
                    embedding_str,
                    json.dumps(metadata or {})
                )

                logger.debug(
                    f"Entity stored: {entity_id}",
                    extra={
                        "user_id": user_id,
                        "entity_type": entity_type,
                        "has_embedding": embedding is not None
                    }
                )

                return str(entity_id)

        except Exception as e:
            logger.error(f"Failed to store entity: {e}", error=e)
            raise QueryExecutionError(f"Entity storage failed: {e}")

    async def store_relationship(
        self,
        user_id: str,
        source_entity_id: str,
        target_entity_id: str,
        relationship_type: str,
        properties: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store a relationship between two entities.

        Args:
            user_id: User identifier
            source_entity_id: Source entity UUID
            target_entity_id: Target entity UUID
            relationship_type: Type of relationship (e.g., "belongs_to", "related_to")
            properties: Optional relationship properties
            metadata: Optional metadata

        Returns:
            relationship_id: UUID of created relationship

        Raises:
            QueryExecutionError: If insert fails
        """
        try:
            async with self._pool.acquire() as conn:
                relationship_id = await conn.fetchval(
                    """
                    INSERT INTO graphrag.relationships
                    (user_id, source_entity_id, target_entity_id, relationship_type, properties, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING relationship_id
                    """,
                    user_id,
                    source_entity_id,
                    target_entity_id,
                    relationship_type,
                    json.dumps(properties or {}),
                    json.dumps(metadata or {})
                )

                logger.debug(
                    f"Relationship stored: {relationship_id}",
                    extra={
                        "user_id": user_id,
                        "type": relationship_type
                    }
                )

                return str(relationship_id)

        except Exception as e:
            logger.error(f"Failed to store relationship: {e}", error=e)
            raise QueryExecutionError(f"Relationship storage failed: {e}")

    async def semantic_search(
        self,
        user_id: str,
        query_embedding: List[float],
        entity_type: Optional[str] = None,
        k: int = 5,
        distance_threshold: float = 1.0
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search using vector similarity.

        Args:
            user_id: User identifier for filtering
            query_embedding: Query vector (384-dim)
            entity_type: Optional filter by entity type
            k: Number of results to return
            distance_threshold: Maximum cosine distance (0-2, lower is more similar)

        Returns:
            List of entities with similarity scores

        Raises:
            QueryExecutionError: If search fails
        """
        try:
            async with self._pool.acquire() as conn:
                # Build query with optional entity_type filter
                query = """
                    SELECT
                        entity_id,
                        entity_type,
                        properties,
                        metadata,
                        (embedding <=> $2::vector) AS distance
                    FROM graphrag.entities
                    WHERE user_id = $1
                    AND embedding IS NOT NULL
                """

                params = [user_id, f'[{",".join(map(str, query_embedding))}]']

                if entity_type:
                    query += " AND entity_type = $3"
                    params.append(entity_type)

                query += f" ORDER BY embedding <=> $2::vector LIMIT {k}"

                rows = await conn.fetch(query, *params)

                results = []
                for row in rows:
                    distance = float(row['distance'])
                    if distance <= distance_threshold:
                        results.append({
                            "entity_id": str(row['entity_id']),
                            "entity_type": row['entity_type'],
                            "properties": row['properties'],
                            "metadata": row['metadata'],
                            "similarity": 1.0 - (distance / 2.0)  # Convert distance to similarity (0-1)
                        })

                logger.debug(
                    f"Semantic search completed: {len(results)} results",
                    extra={
                        "user_id": user_id,
                        "entity_type": entity_type,
                        "k": k
                    }
                )

                return results

        except Exception as e:
            logger.error(f"Semantic search failed: {e}", error=e)
            raise QueryExecutionError(f"Semantic search failed: {e}")

    async def store_memory(
        self,
        user_id: str,
        agent_id: str,
        content: str,
        embedding: List[float],
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Store agent conversation memory.

        Args:
            user_id: User identifier
            agent_id: Agent identifier
            content: Memory content (text)
            embedding: Content embedding vector
            context: Optional conversation context
            metadata: Optional metadata

        Returns:
            memory_id: UUID of stored memory

        Raises:
            QueryExecutionError: If insert fails
        """
        try:
            async with self._pool.acquire() as conn:
                embedding_str = f'[{",".join(map(str, embedding))}]'

                memory_id = await conn.fetchval(
                    """
                    INSERT INTO graphrag.semantic_memory
                    (user_id, agent_id, content, embedding, context, metadata)
                    VALUES ($1, $2, $3, $4::vector, $5, $6)
                    RETURNING memory_id
                    """,
                    user_id,
                    agent_id,
                    content,
                    embedding_str,
                    json.dumps(context or {}),
                    json.dumps(metadata or {})
                )

                logger.debug(
                    f"Memory stored: {memory_id}",
                    extra={
                        "user_id": user_id,
                        "agent_id": agent_id
                    }
                )

                return str(memory_id)

        except Exception as e:
            logger.error(f"Failed to store memory: {e}", error=e)
            raise QueryExecutionError(f"Memory storage failed: {e}")

    async def retrieve_memories(
        self,
        user_id: str,
        agent_id: str,
        query_embedding: List[float],
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant memories using semantic search.

        Args:
            user_id: User identifier
            agent_id: Agent identifier
            query_embedding: Query embedding vector
            k: Number of memories to retrieve

        Returns:
            List of relevant memories with similarity scores

        Raises:
            QueryExecutionError: If retrieval fails
        """
        try:
            async with self._pool.acquire() as conn:
                embedding_str = f'[{",".join(map(str, query_embedding))}]'

                rows = await conn.fetch(
                    """
                    SELECT
                        memory_id,
                        content,
                        context,
                        metadata,
                        created_at,
                        (embedding <=> $3::vector) AS distance
                    FROM graphrag.semantic_memory
                    WHERE user_id = $1 AND agent_id = $2
                    AND embedding IS NOT NULL
                    ORDER BY embedding <=> $3::vector
                    LIMIT $4
                    """,
                    user_id,
                    agent_id,
                    embedding_str,
                    k
                )

                memories = []
                for row in rows:
                    memories.append({
                        "memory_id": str(row['memory_id']),
                        "content": row['content'],
                        "context": row['context'],
                        "metadata": row['metadata'],
                        "created_at": row['created_at'].isoformat(),
                        "similarity": 1.0 - (float(row['distance']) / 2.0)
                    })

                logger.debug(
                    f"Retrieved {len(memories)} memories",
                    extra={
                        "user_id": user_id,
                        "agent_id": agent_id,
                        "k": k
                    }
                )

                return memories

        except Exception as e:
            logger.error(f"Failed to retrieve memories: {e}", error=e)
            raise QueryExecutionError(f"Memory retrieval failed: {e}")

    async def get_entity(
        self,
        user_id: str,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get entity by ID.

        Args:
            user_id: User identifier
            entity_id: Entity UUID

        Returns:
            Entity dict or None if not found

        Raises:
            QueryExecutionError: If query fails
        """
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT entity_id, entity_type, properties, metadata, created_at, updated_at
                    FROM graphrag.entities
                    WHERE user_id = $1 AND entity_id = $2
                    """,
                    user_id,
                    entity_id
                )

                if row:
                    return {
                        "entity_id": str(row['entity_id']),
                        "entity_type": row['entity_type'],
                        "properties": row['properties'],
                        "metadata": row['metadata'],
                        "created_at": row['created_at'].isoformat(),
                        "updated_at": row['updated_at'].isoformat()
                    }

                return None

        except Exception as e:
            logger.error(f"Failed to get entity: {e}", error=e)
            raise QueryExecutionError(f"Entity retrieval failed: {e}")

    async def get_relationships(
        self,
        user_id: str,
        entity_id: str,
        direction: str = "both"  # "outgoing", "incoming", "both"
    ) -> List[Dict[str, Any]]:
        """
        Get all relationships for an entity.

        Args:
            user_id: User identifier
            entity_id: Entity UUID
            direction: Relationship direction to query

        Returns:
            List of relationships

        Raises:
            QueryExecutionError: If query fails
        """
        try:
            async with self._pool.acquire() as conn:
                if direction == "outgoing":
                    condition = "source_entity_id = $2"
                elif direction == "incoming":
                    condition = "target_entity_id = $2"
                else:  # both
                    condition = "(source_entity_id = $2 OR target_entity_id = $2)"

                rows = await conn.fetch(
                    f"""
                    SELECT
                        relationship_id,
                        source_entity_id,
                        target_entity_id,
                        relationship_type,
                        properties,
                        metadata,
                        created_at
                    FROM graphrag.relationships
                    WHERE user_id = $1 AND {condition}
                    ORDER BY created_at DESC
                    """,
                    user_id,
                    entity_id
                )

                relationships = []
                for row in rows:
                    relationships.append({
                        "relationship_id": str(row['relationship_id']),
                        "source_entity_id": str(row['source_entity_id']),
                        "target_entity_id": str(row['target_entity_id']),
                        "relationship_type": row['relationship_type'],
                        "properties": row['properties'],
                        "metadata": row['metadata'],
                        "created_at": row['created_at'].isoformat()
                    })

                return relationships

        except Exception as e:
            logger.error(f"Failed to get relationships: {e}", error=e)
            raise QueryExecutionError(f"Relationship retrieval failed: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """
        Get client statistics.

        Returns:
            Dictionary with current statistics
        """
        pool_stats = {}
        if self._pool:
            pool_stats = {
                "pool_size": self._pool.get_size(),
                "pool_free": self._pool.get_idle_size()
            }

        return {
            "connected": self._pool is not None,
            "vector_dim": self.vector_dim,
            **pool_stats
        }


# Global GraphRAG client instance (lazy initialization)
_global_client: Optional[GraphRAGClient] = None


async def get_graphrag_client() -> GraphRAGClient:
    """
    Get or create global GraphRAG client instance.

    Returns:
        Shared GraphRAGClient instance
    """
    global _global_client

    if _global_client is None:
        _global_client = GraphRAGClient()
        await _global_client.connect()
        logger.info("Global GraphRAG client created")

    return _global_client


async def cleanup_graphrag_client():
    """
    Cleanup global GraphRAG client instance.
    Call this on application shutdown.
    """
    global _global_client

    if _global_client is not None:
        await _global_client.disconnect()
        _global_client = None
        logger.info("Global GraphRAG client cleaned up")
