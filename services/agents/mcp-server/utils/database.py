"""Database Connection Manager"""

import asyncio
from typing import Optional
from contextlib import asynccontextmanager

import asyncpg
import redis.asyncio as aioredis
from neo4j import AsyncGraphDatabase, AsyncDriver
from qdrant_client import AsyncQdrantClient
import structlog

from .config import Settings

logger = structlog.get_logger(__name__)


class DatabaseManager:
    """
    Manages connections to all databases:
    - PostgreSQL (relational data, auth, metadata)
    - Redis (short-term memory, caching)
    - Neo4j (knowledge graph)
    - Qdrant (vector embeddings)
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._pg_pool: Optional[asyncpg.Pool] = None
        self._redis_pool: Optional[aioredis.ConnectionPool] = None
        self._neo4j_driver: Optional[AsyncDriver] = None
        self._qdrant_client: Optional[AsyncQdrantClient] = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize all database connections"""
        if self._initialized:
            logger.warning("database_manager_already_initialized")
            return

        logger.info("initializing_database_connections")

        try:
            # PostgreSQL
            await self._init_postgres()

            # Redis
            await self._init_redis()

            # Neo4j
            await self._init_neo4j()

            # Qdrant
            await self._init_qdrant()

            self._initialized = True
            logger.info("database_connections_initialized")

        except Exception as e:
            logger.error(
                "database_initialization_failed",
                error=str(e),
                exc_info=True
            )
            await self.cleanup()
            raise

    async def _init_postgres(self) -> None:
        """Initialize PostgreSQL connection pool"""
        logger.info("initializing_postgres", url=self.settings.database_url)

        self._pg_pool = await asyncpg.create_pool(
            dsn=self.settings.database_url,
            min_size=5,
            max_size=self.settings.database_pool_size,
            max_inactive_connection_lifetime=300,
            command_timeout=self.settings.database_pool_timeout,
        )

        # Test connection
        async with self._pg_pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            logger.info("postgres_connected", version=version[:50])

    async def _init_redis(self) -> None:
        """Initialize Redis connection pool"""
        logger.info("initializing_redis", url=self.settings.redis_url)

        self._redis_pool = aioredis.ConnectionPool.from_url(
            self.settings.redis_url,
            max_connections=self.settings.redis_pool_size,
            socket_timeout=self.settings.redis_socket_timeout,
            decode_responses=True,
        )

        # Test connection
        redis_client = aioredis.Redis(connection_pool=self._redis_pool)
        await redis_client.ping()
        logger.info("redis_connected")

    async def _init_neo4j(self) -> None:
        """Initialize Neo4j driver"""
        logger.info("initializing_neo4j", uri=self.settings.neo4j_uri)

        self._neo4j_driver = AsyncGraphDatabase.driver(
            self.settings.neo4j_uri,
            auth=(self.settings.neo4j_user, self.settings.neo4j_password),
            max_connection_lifetime=self.settings.neo4j_max_connection_lifetime,
            max_connection_pool_size=self.settings.neo4j_max_connection_pool_size,
        )

        # Test connection
        await self._neo4j_driver.verify_connectivity()
        logger.info("neo4j_connected")

    async def _init_qdrant(self) -> None:
        """Initialize Qdrant client"""
        logger.info("initializing_qdrant", url=self.settings.qdrant_url)

        self._qdrant_client = AsyncQdrantClient(
            url=self.settings.qdrant_url,
            api_key=self.settings.qdrant_api_key,
            timeout=self.settings.qdrant_timeout,
        )

        # Test connection
        collections = await self._qdrant_client.get_collections()
        logger.info("qdrant_connected", collections_count=len(collections.collections))

    async def cleanup(self) -> None:
        """Cleanup all database connections"""
        logger.info("cleaning_up_database_connections")

        cleanup_tasks = []

        if self._pg_pool:
            cleanup_tasks.append(self._pg_pool.close())

        if self._redis_pool:
            cleanup_tasks.append(self._redis_pool.disconnect())

        if self._neo4j_driver:
            cleanup_tasks.append(self._neo4j_driver.close())

        if self._qdrant_client:
            cleanup_tasks.append(self._qdrant_client.close())

        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)

        self._initialized = False
        logger.info("database_connections_cleaned_up")

    @property
    def postgres(self) -> asyncpg.Pool:
        """Get PostgreSQL connection pool"""
        if not self._pg_pool:
            raise RuntimeError("PostgreSQL not initialized")
        return self._pg_pool

    @property
    def redis(self) -> aioredis.ConnectionPool:
        """Get Redis connection pool"""
        if not self._redis_pool:
            raise RuntimeError("Redis not initialized")
        return self._redis_pool

    def get_redis_client(self) -> aioredis.Redis:
        """Get Redis client instance"""
        return aioredis.Redis(connection_pool=self.redis)

    @property
    def neo4j(self) -> AsyncDriver:
        """Get Neo4j driver"""
        if not self._neo4j_driver:
            raise RuntimeError("Neo4j not initialized")
        return self._neo4j_driver

    @property
    def qdrant(self) -> AsyncQdrantClient:
        """Get Qdrant client"""
        if not self._qdrant_client:
            raise RuntimeError("Qdrant not initialized")
        return self._qdrant_client

    @asynccontextmanager
    async def postgres_transaction(self):
        """Context manager for PostgreSQL transactions"""
        async with self.postgres.acquire() as conn:
            async with conn.transaction():
                yield conn

    @asynccontextmanager
    async def neo4j_session(self, database: Optional[str] = None):
        """Context manager for Neo4j sessions"""
        async with self.neo4j.session(
            database=database or self.settings.neo4j_database
        ) as session:
            yield session

    async def health_check(self) -> dict:
        """
        Check health of all database connections.

        Returns:
            Dictionary with health status for each database
        """
        health = {
            "postgres": "unknown",
            "redis": "unknown",
            "neo4j": "unknown",
            "qdrant": "unknown",
        }

        # PostgreSQL
        try:
            async with self.postgres.acquire() as conn:
                await conn.fetchval("SELECT 1")
            health["postgres"] = "ok"
        except Exception as e:
            health["postgres"] = f"error: {str(e)}"

        # Redis
        try:
            redis_client = self.get_redis_client()
            await redis_client.ping()
            health["redis"] = "ok"
        except Exception as e:
            health["redis"] = f"error: {str(e)}"

        # Neo4j
        try:
            await self.neo4j.verify_connectivity()
            health["neo4j"] = "ok"
        except Exception as e:
            health["neo4j"] = f"error: {str(e)}"

        # Qdrant
        try:
            await self.qdrant.get_collections()
            health["qdrant"] = "ok"
        except Exception as e:
            health["qdrant"] = f"error: {str(e)}"

        return health
