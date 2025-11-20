"""
Neo4j Client for Knowledge Graph Storage.

Provides async interface for:
- Entity creation and updates
- Relationship management
- Cypher query execution
- Tenant data isolation
- Batch operations
"""

from typing import Any, Optional
from uuid import UUID

import structlog
from neo4j import AsyncDriver, AsyncGraphDatabase
from neo4j.exceptions import Neo4jError

from app.core.config import settings

logger = structlog.get_logger()


class Neo4jClient:
    """
    Async Neo4j client for knowledge graph operations.

    Features:
    - Multi-tenant data isolation
    - Batch entity/relationship creation
    - Efficient Cypher query execution
    - Connection pooling
    - Error handling and retry logic
    """

    def __init__(self):
        self.driver: Optional[AsyncDriver] = None
        self.uri = settings.NEO4J_URI
        self.user = settings.NEO4J_USER
        self.password = settings.NEO4J_PASSWORD
        self.database = settings.NEO4J_DATABASE

    async def connect(self) -> None:
        """Establish connection to Neo4j."""
        if self.driver is not None:
            return

        try:
            self.driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_pool_size=50,
                connection_acquisition_timeout=60.0,
            )

            # Verify connectivity
            await self.driver.verify_connectivity()

            logger.info(
                "neo4j_connected",
                uri=self.uri,
                database=self.database,
            )

        except Exception as e:
            logger.error("neo4j_connection_failed", error=str(e))
            raise

    async def close(self) -> None:
        """Close Neo4j connection."""
        if self.driver:
            await self.driver.close()
            self.driver = None
            logger.info("neo4j_disconnected")

    async def create_entity(
        self,
        tenant_id: UUID,
        entity_type: str,
        entity_id: UUID,
        properties: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Create an entity node in the knowledge graph.

        Args:
            tenant_id: Tenant ID for isolation
            entity_type: Entity type (Goal, Transaction, HealthRecord, etc.)
            entity_id: Unique entity ID
            properties: Entity properties

        Returns:
            Created entity data
        """
        if not self.driver:
            await self.connect()

        # Sanitize entity type for Neo4j label
        label = entity_type.replace(":", "_")

        # Add tenant_id and entity_id to properties
        node_props = {
            **properties,
            "tenant_id": str(tenant_id),
            "entity_id": str(entity_id),
            "entity_type": entity_type,
        }

        query = f"""
        CREATE (n:{label} $props)
        RETURN n
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, props=node_props)
                record = await result.single()

                if record:
                    node = record["n"]
                    logger.info(
                        "neo4j_entity_created",
                        tenant_id=str(tenant_id),
                        entity_type=entity_type,
                        entity_id=str(entity_id),
                    )
                    return dict(node)

                return {}

        except Neo4jError as e:
            logger.error(
                "neo4j_entity_create_failed",
                error=str(e),
                entity_type=entity_type,
            )
            raise

    async def create_entities_batch(
        self,
        tenant_id: UUID,
        entities: list[dict[str, Any]],
    ) -> int:
        """
        Create multiple entities in a single transaction.

        Args:
            tenant_id: Tenant ID
            entities: List of entities with structure:
                {
                    "type": "ln:Goal",
                    "id": UUID,
                    "properties": {...}
                }

        Returns:
            Number of entities created
        """
        if not self.driver:
            await self.connect()

        if not entities:
            return 0

        # Build batch create query
        query = """
        UNWIND $entities AS entity
        CALL {
            WITH entity
            CREATE (n)
            SET n += entity.properties
            SET n.tenant_id = $tenant_id
            SET n.entity_id = entity.id
            SET n.entity_type = entity.type
            SET n:Entity
            WITH n, entity.type AS type
            CALL apoc.create.addLabels(n, [type]) YIELD node
            RETURN node
        }
        RETURN count(*) as created
        """

        # Prepare entity data
        entity_data = [
            {
                "type": e["type"].replace(":", "_"),
                "id": str(e["id"]),
                "properties": e["properties"],
            }
            for e in entities
        ]

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(
                    query,
                    entities=entity_data,
                    tenant_id=str(tenant_id),
                )
                record = await result.single()
                created_count = record["created"] if record else 0

                logger.info(
                    "neo4j_batch_entities_created",
                    tenant_id=str(tenant_id),
                    count=created_count,
                )

                return created_count

        except Neo4jError as e:
            logger.error(
                "neo4j_batch_create_failed",
                error=str(e),
                batch_size=len(entities),
            )
            raise

    async def create_relationship(
        self,
        tenant_id: UUID,
        source_id: UUID,
        target_id: UUID,
        relationship_type: str,
        properties: dict[str, Any] | None = None,
    ) -> bool:
        """
        Create a relationship between two entities.

        Args:
            tenant_id: Tenant ID
            source_id: Source entity ID
            target_id: Target entity ID
            relationship_type: Relationship type (HAS_GOAL, RELATED_TO, etc.)
            properties: Optional relationship properties

        Returns:
            True if created successfully
        """
        if not self.driver:
            await self.connect()

        rel_type = relationship_type.replace(":", "_").upper()
        rel_props = properties or {}
        rel_props["tenant_id"] = str(tenant_id)

        query = f"""
        MATCH (source {{entity_id: $source_id, tenant_id: $tenant_id}})
        MATCH (target {{entity_id: $target_id, tenant_id: $tenant_id}})
        CREATE (source)-[r:{rel_type} $props]->(target)
        RETURN r
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(
                    query,
                    source_id=str(source_id),
                    target_id=str(target_id),
                    tenant_id=str(tenant_id),
                    props=rel_props,
                )
                record = await result.single()

                if record:
                    logger.info(
                        "neo4j_relationship_created",
                        source_id=str(source_id),
                        target_id=str(target_id),
                        relationship_type=relationship_type,
                    )
                    return True

                return False

        except Neo4jError as e:
            logger.error(
                "neo4j_relationship_create_failed",
                error=str(e),
                relationship_type=relationship_type,
            )
            return False

    async def create_relationships_batch(
        self,
        tenant_id: UUID,
        relationships: list[dict[str, Any]],
    ) -> int:
        """
        Create multiple relationships in batch.

        Args:
            tenant_id: Tenant ID
            relationships: List of relationships:
                {
                    "source_id": UUID,
                    "target_id": UUID,
                    "type": "HAS_GOAL",
                    "properties": {...}
                }

        Returns:
            Number of relationships created
        """
        if not self.driver:
            await self.connect()

        if not relationships:
            return 0

        query = """
        UNWIND $relationships AS rel
        MATCH (source {entity_id: rel.source_id, tenant_id: $tenant_id})
        MATCH (target {entity_id: rel.target_id, tenant_id: $tenant_id})
        CALL apoc.create.relationship(source, rel.type, rel.properties, target) YIELD rel AS r
        RETURN count(*) as created
        """

        # Prepare relationship data
        rel_data = [
            {
                "source_id": str(r["source_id"]),
                "target_id": str(r["target_id"]),
                "type": r["type"].replace(":", "_").upper(),
                "properties": {**(r.get("properties") or {}), "tenant_id": str(tenant_id)},
            }
            for r in relationships
        ]

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(
                    query,
                    relationships=rel_data,
                    tenant_id=str(tenant_id),
                )
                record = await result.single()
                created_count = record["created"] if record else 0

                logger.info(
                    "neo4j_batch_relationships_created",
                    tenant_id=str(tenant_id),
                    count=created_count,
                )

                return created_count

        except Neo4jError as e:
            logger.error(
                "neo4j_batch_relationships_failed",
                error=str(e),
                batch_size=len(relationships),
            )
            raise

    async def delete_tenant_data(self, tenant_id: UUID) -> int:
        """
        Delete all data for a tenant.

        Args:
            tenant_id: Tenant ID to delete

        Returns:
            Number of nodes deleted
        """
        if not self.driver:
            await self.connect()

        query = """
        MATCH (n {tenant_id: $tenant_id})
        DETACH DELETE n
        RETURN count(*) as deleted
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, tenant_id=str(tenant_id))
                record = await result.single()
                deleted_count = record["deleted"] if record else 0

                logger.warning(
                    "neo4j_tenant_data_deleted",
                    tenant_id=str(tenant_id),
                    deleted_count=deleted_count,
                )

                return deleted_count

        except Neo4jError as e:
            logger.error(
                "neo4j_tenant_delete_failed",
                error=str(e),
                tenant_id=str(tenant_id),
            )
            raise

    async def get_entity_count(self, tenant_id: UUID) -> int:
        """Get total entity count for tenant."""
        if not self.driver:
            await self.connect()

        query = """
        MATCH (n {tenant_id: $tenant_id})
        RETURN count(n) as count
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, tenant_id=str(tenant_id))
                record = await result.single()
                return record["count"] if record else 0

        except Neo4jError as e:
            logger.error("neo4j_count_failed", error=str(e))
            return 0

    async def get_entity_counts_by_type(self, tenant_id: UUID) -> dict[str, int]:
        """Get entity counts grouped by type."""
        if not self.driver:
            await self.connect()

        query = """
        MATCH (n {tenant_id: $tenant_id})
        RETURN n.entity_type as type, count(*) as count
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, tenant_id=str(tenant_id))
                counts = {}

                async for record in result:
                    entity_type = record["type"]
                    count = record["count"]
                    if entity_type:
                        counts[entity_type] = count

                return counts

        except Neo4jError as e:
            logger.error("neo4j_type_counts_failed", error=str(e))
            return {}

    async def get_relationship_count(self, tenant_id: UUID) -> int:
        """Get total relationship count for tenant."""
        if not self.driver:
            await self.connect()

        query = """
        MATCH ()-[r {tenant_id: $tenant_id}]->()
        RETURN count(r) as count
        """

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, tenant_id=str(tenant_id))
                record = await result.single()
                return record["count"] if record else 0

        except Neo4jError as e:
            logger.error("neo4j_relationship_count_failed", error=str(e))
            return 0

    async def execute_cypher(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute a custom Cypher query.

        Args:
            query: Cypher query string
            parameters: Query parameters

        Returns:
            List of result records
        """
        if not self.driver:
            await self.connect()

        try:
            async with self.driver.session(database=self.database) as session:
                result = await session.run(query, parameters or {})
                records = []

                async for record in result:
                    records.append(dict(record))

                return records

        except Neo4jError as e:
            logger.error("neo4j_query_failed", error=str(e), query=query)
            raise

    async def health_check(self) -> bool:
        """Check Neo4j connectivity."""
        try:
            if not self.driver:
                await self.connect()

            await self.driver.verify_connectivity()
            return True

        except Exception as e:
            logger.error("neo4j_health_check_failed", error=str(e))
            return False


# Global client instance
_neo4j_client: Optional[Neo4jClient] = None


def get_neo4j_client() -> Neo4jClient:
    """Get or create global Neo4j client instance."""
    global _neo4j_client
    if _neo4j_client is None:
        _neo4j_client = Neo4jClient()
    return _neo4j_client
