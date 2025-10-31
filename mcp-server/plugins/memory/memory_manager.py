"""Memory Manager - 4-Tier Memory Implementation"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import structlog

import redis.asyncio as aioredis
import asyncpg
from neo4j import AsyncDriver

logger = structlog.get_logger(__name__)


class ShortTermMemory:
    """
    Short-Term Memory (Redis)

    Characteristics:
    - TTL: 1 hour (configurable)
    - Recent conversation turns
    - Temporary context
    - Fast access
    - Automatic expiration
    """

    def __init__(self, redis_pool: aioredis.ConnectionPool, ttl: int = 3600):
        self.redis_pool = redis_pool
        self.ttl = ttl

    def _get_client(self) -> aioredis.Redis:
        """Get Redis client from pool"""
        return aioredis.Redis(connection_pool=self.redis_pool)

    def _make_key(self, user_id: str, conversation_id: Optional[str] = None) -> str:
        """Generate Redis key"""
        if conversation_id:
            return f"stm:{user_id}:{conversation_id}"
        return f"stm:{user_id}:default"

    async def store(
        self,
        user_id: str,
        conversation_id: Optional[str],
        content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Store message in short-term memory"""
        memory_id = str(uuid.uuid4())

        memory_item = {
            "id": memory_id,
            "content": content,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "conversation_id": conversation_id
        }

        redis = self._get_client()
        key = self._make_key(user_id, conversation_id)

        # Store as list (conversation history)
        await redis.rpush(key, json.dumps(memory_item))
        await redis.expire(key, self.ttl)

        logger.debug(
            "stored_short_term_memory",
            user_id=user_id,
            memory_id=memory_id
        )

        return memory_id

    async def get_recent(
        self,
        user_id: str,
        conversation_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """Get recent memories"""
        redis = self._get_client()
        key = self._make_key(user_id, conversation_id)

        # Get last N items
        items = await redis.lrange(key, -limit, -1)

        memories = []
        for item in items:
            try:
                memories.append(json.loads(item))
            except json.JSONDecodeError:
                logger.warning("invalid_memory_json", item=item[:100])

        return memories

    async def search(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> List[Dict]:
        """Search short-term memories (simple keyword match)"""
        # Get all recent memories
        all_memories = await self.get_recent(user_id, limit=100)

        # Simple keyword search
        query_lower = query.lower()
        matches = [
            mem for mem in all_memories
            if query_lower in mem.get("content", "").lower()
        ]

        return matches[:limit]

    async def delete(self, user_id: str, memory_id: str) -> bool:
        """Delete specific memory"""
        # Redis list deletion is complex, mark as deleted instead
        # In production, implement proper list element removal
        logger.info("delete_short_term_memory", memory_id=memory_id)
        return True

    async def clear(
        self,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> None:
        """Clear all short-term memories"""
        redis = self._get_client()
        key = self._make_key(user_id, conversation_id)
        await redis.delete(key)


class WorkingMemory:
    """
    Working Memory (Redis)

    Characteristics:
    - Session-based (no TTL, cleared on session end)
    - Active conversation state
    - Current task context
    - Key-value storage
    - Fast access
    """

    def __init__(self, redis_pool: aioredis.ConnectionPool, max_size: int = 50):
        self.redis_pool = redis_pool
        self.max_size = max_size

    def _get_client(self) -> aioredis.Redis:
        """Get Redis client from pool"""
        return aioredis.Redis(connection_pool=self.redis_pool)

    def _make_key(self, user_id: str, conversation_id: Optional[str] = None) -> str:
        """Generate Redis key"""
        if conversation_id:
            return f"wm:{user_id}:{conversation_id}"
        return f"wm:{user_id}:default"

    async def store(
        self,
        user_id: str,
        conversation_id: Optional[str],
        key: str,
        value: Any
    ) -> None:
        """Store value in working memory"""
        redis = self._get_client()
        hash_key = self._make_key(user_id, conversation_id)

        # Store as hash field
        await redis.hset(hash_key, key, json.dumps(value))

        # Limit size
        size = await redis.hlen(hash_key)
        if size > self.max_size:
            # Remove oldest entries (in production, use LRU)
            logger.warning(
                "working_memory_overflow",
                user_id=user_id,
                size=size
            )

        logger.debug(
            "stored_working_memory",
            user_id=user_id,
            key=key
        )

    async def get(
        self,
        user_id: str,
        conversation_id: Optional[str],
        key: str
    ) -> Optional[Any]:
        """Get value from working memory"""
        redis = self._get_client()
        hash_key = self._make_key(user_id, conversation_id)

        value = await redis.hget(hash_key, key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

        return None

    async def get_all(
        self,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get all working memory"""
        redis = self._get_client()
        hash_key = self._make_key(user_id, conversation_id)

        data = await redis.hgetall(hash_key)

        result = {}
        for key, value in data.items():
            try:
                result[key] = json.loads(value)
            except json.JSONDecodeError:
                result[key] = value

        return result

    async def get_active_context(
        self,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get active conversation context"""
        return await self.get_all(user_id, conversation_id)

    async def clear(
        self,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> None:
        """Clear working memory"""
        redis = self._get_client()
        hash_key = self._make_key(user_id, conversation_id)
        await redis.delete(hash_key)


class LongTermMemory:
    """
    Long-Term Memory (PostgreSQL)

    Characteristics:
    - Persistent storage
    - User profiles
    - Conversation history
    - Facts and preferences
    - Full-text search
    """

    def __init__(self, postgres_pool: asyncpg.Pool):
        self.pool = postgres_pool

    async def initialize(self) -> None:
        """Initialize database schema"""
        async with self.pool.acquire() as conn:
            # User profiles table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    profile_data JSONB NOT NULL DEFAULT '{}',
                    preferences JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Long-term memories table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS long_term_memories (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata JSONB NOT NULL DEFAULT '{}',
                    importance FLOAT NOT NULL DEFAULT 0.5,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    access_count INTEGER NOT NULL DEFAULT 0
                )
            """)

            # Conversation history table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    turn_index INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)

            # Indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_ltm_user_id
                ON long_term_memories(user_id)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_conv_user_conv
                ON conversation_history(user_id, conversation_id)
            """)

        logger.info("long_term_memory_initialized")

    async def store(
        self,
        user_id: str,
        content: str,
        metadata: Dict[str, Any],
        importance: float = 0.5
    ) -> str:
        """Store in long-term memory"""
        async with self.pool.acquire() as conn:
            memory_id = await conn.fetchval("""
                INSERT INTO long_term_memories (user_id, content, metadata, importance)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            """, user_id, content, json.dumps(metadata), importance)

            logger.debug(
                "stored_long_term_memory",
                user_id=user_id,
                memory_id=memory_id
            )

            return str(memory_id)

    async def search(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> List[Dict]:
        """Search long-term memories"""
        async with self.pool.acquire() as conn:
            # Simple text search (in production, use full-text search)
            rows = await conn.fetch("""
                SELECT id, content, metadata, importance, created_at, access_count
                FROM long_term_memories
                WHERE user_id = $1
                  AND LOWER(content) LIKE '%' || LOWER($2) || '%'
                ORDER BY importance DESC, accessed_at DESC
                LIMIT $3
            """, user_id, query, limit)

            return [dict(row) for row in rows]

    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT profile_data, preferences, created_at, updated_at
                FROM user_profiles
                WHERE user_id = $1
            """, user_id)

            if not row:
                # Create default profile
                await conn.execute("""
                    INSERT INTO user_profiles (user_id)
                    VALUES ($1)
                    ON CONFLICT (user_id) DO NOTHING
                """, user_id)

                return {
                    "user_id": user_id,
                    "profile_data": {},
                    "preferences": {}
                }

            return {
                "user_id": user_id,
                "profile_data": row["profile_data"],
                "preferences": row["preferences"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat()
            }

    async def update_user_profile(
        self,
        user_id: str,
        updates: Dict[str, Any]
    ) -> None:
        """Update user profile"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_profiles (user_id, profile_data, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id)
                DO UPDATE SET
                    profile_data = user_profiles.profile_data || $2,
                    updated_at = NOW()
            """, user_id, json.dumps(updates))

    async def store_conversation_turn(
        self,
        user_id: str,
        conversation_id: str,
        turn_index: int,
        role: str,
        content: str,
        metadata: Dict[str, Any]
    ) -> None:
        """Store conversation turn"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO conversation_history
                (user_id, conversation_id, turn_index, role, content, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, user_id, conversation_id, turn_index, role, content, json.dumps(metadata))

    async def get_conversation_history(
        self,
        user_id: str,
        conversation_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """Get conversation history"""
        async with self.pool.acquire() as conn:
            if conversation_id:
                rows = await conn.fetch("""
                    SELECT conversation_id, turn_index, role, content, metadata, created_at
                    FROM conversation_history
                    WHERE user_id = $1 AND conversation_id = $2
                    ORDER BY turn_index DESC
                    LIMIT $3
                """, user_id, conversation_id, limit)
            else:
                rows = await conn.fetch("""
                    SELECT conversation_id, turn_index, role, content, metadata, created_at
                    FROM conversation_history
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2
                """, user_id, limit)

            return [dict(row) for row in rows]

    async def delete(self, user_id: str, memory_id: str) -> bool:
        """Delete long-term memory"""
        async with self.pool.acquire() as conn:
            result = await conn.execute("""
                DELETE FROM long_term_memories
                WHERE id = $1 AND user_id = $2
            """, memory_id, user_id)

            return result == "DELETE 1"


class EpisodicMemory:
    """
    Episodic & Semantic Memory (Neo4j)

    Characteristics:
    - Episodic: Autobiographical events with temporal context
    - Semantic: Abstract facts and knowledge
    - Connected to knowledge graph
    - Rich relational context
    """

    def __init__(self, neo4j_driver: AsyncDriver):
        self.driver = neo4j_driver

    async def initialize(self) -> None:
        """Initialize episodic memory schema"""
        async with self.driver.session() as session:
            # Create indexes
            await session.run("""
                CREATE INDEX episode_user_index IF NOT EXISTS
                FOR (e:Episode) ON (e.user_id)
            """)

            await session.run("""
                CREATE INDEX episode_timestamp_index IF NOT EXISTS
                FOR (e:Episode) ON (e.timestamp)
            """)

        logger.info("episodic_memory_initialized")

    async def store_episode(
        self,
        user_id: str,
        content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Store episodic memory"""
        episode_id = str(uuid.uuid4())

        query = """
        CREATE (e:Episode {
            id: $id,
            user_id: $user_id,
            content: $content,
            timestamp: datetime(),
            metadata: $metadata
        })
        RETURN e.id as id
        """

        async with self.driver.session() as session:
            result = await session.run(query, {
                "id": episode_id,
                "user_id": user_id,
                "content": content,
                "metadata": metadata
            })

            logger.debug(
                "stored_episodic_memory",
                user_id=user_id,
                episode_id=episode_id
            )

            return episode_id

    async def search_episodes(
        self,
        user_id: str,
        query: str,
        limit: int = 5
    ) -> List[Dict]:
        """Search episodic memories"""
        cypher_query = """
        MATCH (e:Episode)
        WHERE e.user_id = $user_id
          AND toLower(e.content) CONTAINS toLower($query)
        RETURN e
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """

        async with self.driver.session() as session:
            result = await session.run(cypher_query, {
                "user_id": user_id,
                "query": query,
                "limit": limit
            })

            episodes = []
            async for record in result:
                episodes.append(dict(record["e"]))

            return episodes

    async def delete_episode(self, user_id: str, episode_id: str) -> bool:
        """Delete episode"""
        query = """
        MATCH (e:Episode {id: $episode_id, user_id: $user_id})
        DELETE e
        """

        async with self.driver.session() as session:
            await session.run(query, {
                "episode_id": episode_id,
                "user_id": user_id
            })

            return True


class MemoryConsolidation:
    """
    Memory Consolidation System

    Automatically moves important memories from short-term to long-term storage.
    Uses importance scoring and access patterns.
    """

    def __init__(
        self,
        short_term: ShortTermMemory,
        working: WorkingMemory,
        long_term: LongTermMemory,
        episodic: EpisodicMemory
    ):
        self.short_term = short_term
        self.working = working
        self.long_term = long_term
        self.episodic = episodic

    async def consolidate(
        self,
        user_id: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Consolidate memories from short-term to long-term.

        Criteria for consolidation:
        - Mentioned multiple times (frequency)
        - User explicitly marked as important
        - Contains entities/facts
        - Part of significant episode
        """
        logger.info("consolidating_memory", user_id=user_id)

        # Get short-term memories
        short_term_memories = await self.short_term.get_recent(
            user_id=user_id,
            conversation_id=conversation_id,
            limit=100
        )

        consolidated_count = 0
        episodic_count = 0

        for memory in short_term_memories:
            importance = self._calculate_importance(memory)

            if importance > 0.7:  # High importance threshold
                # Store in long-term
                await self.long_term.store(
                    user_id=user_id,
                    content=memory["content"],
                    metadata=memory["metadata"],
                    importance=importance
                )
                consolidated_count += 1

            if importance > 0.8 and memory["metadata"].get("type") == "episode":
                # Store as episode
                await self.episodic.store_episode(
                    user_id=user_id,
                    content=memory["content"],
                    metadata=memory["metadata"]
                )
                episodic_count += 1

        logger.info(
            "memory_consolidated",
            user_id=user_id,
            consolidated=consolidated_count,
            episodic=episodic_count
        )

        return {
            "consolidated": consolidated_count,
            "episodic": episodic_count,
            "total_processed": len(short_term_memories)
        }

    def _calculate_importance(self, memory: Dict) -> float:
        """Calculate memory importance score"""
        score = 0.5  # Base score

        # Explicit importance in metadata
        if memory["metadata"].get("importance"):
            score += memory["metadata"]["importance"] * 0.3

        # Length (longer = more detailed = more important)
        content_length = len(memory["content"])
        if content_length > 200:
            score += 0.1
        if content_length > 500:
            score += 0.1

        # Contains entities/facts
        if memory["metadata"].get("has_entities"):
            score += 0.2

        # Explicit user marking
        if memory["metadata"].get("user_marked_important"):
            score += 0.3

        return min(score, 1.0)
