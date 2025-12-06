"""
Neo4j Client for Dual-Graph Knowledge Architecture

Provides true graph database capabilities with Cypher queries for:
- Central Knowledge Graph: Regulatory rules, laws, compliance (read-only, shared)
- Personal Knowledge Graph: User-specific data with row-level security

Neo4j Enterprise running on localhost:7687
"""

from typing import List, Dict, Any, Optional, Tuple
from neo4j import AsyncGraphDatabase, AsyncDriver
from neo4j.exceptions import ServiceUnavailable, AuthError
import json

from utils.config import Config
from utils.logging import get_logger

logger = get_logger(__name__)

# Graph databases (Neo4j supports multiple databases)
CENTRAL_GRAPH_DB = "central"  # Shared regulatory knowledge
PERSONAL_GRAPH_DB = "personal"  # User-specific data with RLS

# Special user ID for centralized/shared content
CENTRALIZED_USER_ID = "centralized"


class Neo4jClient:
    """
    Neo4j client for dual-graph knowledge architecture.

    Architecture:
    - Central Graph (central): Regulatory rules, compliance, laws
      - Shared across all users (read-only for queries)
      - Ingested by admins/system only

    - Personal Graph (personal): User-specific knowledge
      - Row-level security via user_id property
      - Contains transactions, documents, goals, memories

    Features:
    - True graph traversal with Cypher
    - Multi-hop relationship queries
    - Compliance rule matching
    - User isolation via RLS
    """

    def __init__(
        self,
        uri: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        max_connection_pool_size: int = 50
    ):
        """
        Initialize Neo4j client.

        Args:
            uri: Neo4j bolt URI (defaults to config)
            username: Neo4j username
            password: Neo4j password
            max_connection_pool_size: Connection pool size
        """
        config = Config.get()

        self.uri = uri or config.get("NEO4J_URI", "bolt://localhost:7687")
        self.username = username or config.get("NEO4J_USERNAME", "neo4j")
        self.password = password or config.get("NEO4J_PASSWORD", "password")
        self.max_pool_size = max_connection_pool_size

        self._driver: Optional[AsyncDriver] = None

        logger.info(
            "Neo4jClient initialized",
            extra={"uri": self.uri}
        )

    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()

    async def connect(self):
        """Create connection to Neo4j"""
        try:
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password),
                max_connection_pool_size=self.max_pool_size
            )

            # Verify connection
            await self._driver.verify_connectivity()

            logger.info("Neo4j connection established")

            # Initialize schema for both graphs
            await self._initialize_central_schema()
            await self._initialize_personal_schema()

        except AuthError as e:
            logger.error(f"Neo4j authentication failed: {e}")
            raise
        except ServiceUnavailable as e:
            logger.error(f"Neo4j service unavailable: {e}")
            raise

    async def disconnect(self):
        """Close Neo4j connection"""
        if self._driver:
            await self._driver.close()
            self._driver = None
            logger.info("Neo4j connection closed")

    # =========================================================================
    # Central Knowledge Graph (Regulatory/Compliance)
    # =========================================================================

    async def _initialize_central_schema(self):
        """Initialize central graph schema for regulatory knowledge"""
        async with self._driver.session(database=CENTRAL_GRAPH_DB) as session:
            # Create constraints and indexes for regulatory entities
            await session.run("""
                CREATE CONSTRAINT regulation_id IF NOT EXISTS
                FOR (r:Regulation) REQUIRE r.regulation_id IS UNIQUE
            """)

            await session.run("""
                CREATE CONSTRAINT rule_id IF NOT EXISTS
                FOR (r:Rule) REQUIRE r.rule_id IS UNIQUE
            """)

            await session.run("""
                CREATE INDEX regulation_type IF NOT EXISTS
                FOR (r:Regulation) ON (r.regulation_type)
            """)

            await session.run("""
                CREATE INDEX rule_category IF NOT EXISTS
                FOR (r:Rule) ON (r.category)
            """)

            await session.run("""
                CREATE INDEX regulation_source IF NOT EXISTS
                FOR (r:Regulation) ON (r.source)
            """)

            logger.info("Central graph schema initialized")

    async def add_regulation(
        self,
        regulation_id: str,
        title: str,
        regulation_type: str,
        source: str,
        content: str,
        effective_date: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a regulation to the central knowledge graph.

        Args:
            regulation_id: Unique identifier (e.g., "IRS-2024-001")
            title: Regulation title
            regulation_type: Type (e.g., "tax_law", "sec_rule", "hipaa")
            source: Source agency (e.g., "IRS", "SEC", "HHS")
            content: Full regulation text
            effective_date: When the regulation became effective
            metadata: Additional metadata

        Returns:
            regulation_id
        """
        async with self._driver.session(database=CENTRAL_GRAPH_DB) as session:
            result = await session.run(
                """
                MERGE (r:Regulation {regulation_id: $regulation_id})
                SET r.title = $title,
                    r.regulation_type = $regulation_type,
                    r.source = $source,
                    r.content = $content,
                    r.effective_date = $effective_date,
                    r.metadata = $metadata,
                    r.updated_at = datetime()
                RETURN r.regulation_id AS id
                """,
                regulation_id=regulation_id,
                title=title,
                regulation_type=regulation_type,
                source=source,
                content=content,
                effective_date=effective_date,
                metadata=json.dumps(metadata or {})
            )

            record = await result.single()
            logger.debug(f"Regulation added: {regulation_id}")
            return record["id"]

    async def add_rule(
        self,
        rule_id: str,
        regulation_id: str,
        title: str,
        category: str,
        description: str,
        conditions: List[str],
        actions: List[str],
        severity: str = "warning",  # "info", "warning", "block"
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a compliance rule linked to a regulation.

        Args:
            rule_id: Unique rule identifier
            regulation_id: Parent regulation ID
            title: Rule title
            category: Category (e.g., "disclosure", "investment_limit", "hipaa_phi")
            description: Rule description
            conditions: List of conditions that trigger this rule
            actions: List of required actions
            severity: Rule severity level
            metadata: Additional metadata

        Returns:
            rule_id
        """
        async with self._driver.session(database=CENTRAL_GRAPH_DB) as session:
            await session.run(
                """
                MATCH (reg:Regulation {regulation_id: $regulation_id})
                MERGE (r:Rule {rule_id: $rule_id})
                SET r.title = $title,
                    r.category = $category,
                    r.description = $description,
                    r.conditions = $conditions,
                    r.actions = $actions,
                    r.severity = $severity,
                    r.metadata = $metadata,
                    r.updated_at = datetime()
                MERGE (r)-[:DEFINED_BY]->(reg)
                """,
                rule_id=rule_id,
                regulation_id=regulation_id,
                title=title,
                category=category,
                description=description,
                conditions=conditions,
                actions=actions,
                severity=severity,
                metadata=json.dumps(metadata or {})
            )

            logger.debug(f"Rule added: {rule_id} -> {regulation_id}")
            return rule_id

    async def get_applicable_rules(
        self,
        category: Optional[str] = None,
        regulation_type: Optional[str] = None,
        source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all rules matching the given criteria.

        Args:
            category: Filter by rule category
            regulation_type: Filter by regulation type
            source: Filter by source agency

        Returns:
            List of matching rules with their parent regulations
        """
        async with self._driver.session(database=CENTRAL_GRAPH_DB) as session:
            # Build dynamic query
            conditions = []
            params = {}

            if category:
                conditions.append("r.category = $category")
                params["category"] = category

            if regulation_type:
                conditions.append("reg.regulation_type = $regulation_type")
                params["regulation_type"] = regulation_type

            if source:
                conditions.append("reg.source = $source")
                params["source"] = source

            where_clause = " AND ".join(conditions) if conditions else "TRUE"

            result = await session.run(
                f"""
                MATCH (r:Rule)-[:DEFINED_BY]->(reg:Regulation)
                WHERE {where_clause}
                RETURN r.rule_id AS rule_id,
                       r.title AS title,
                       r.category AS category,
                       r.description AS description,
                       r.conditions AS conditions,
                       r.actions AS actions,
                       r.severity AS severity,
                       reg.regulation_id AS regulation_id,
                       reg.title AS regulation_title,
                       reg.source AS source
                ORDER BY r.severity DESC
                """,
                **params
            )

            rules = []
            async for record in result:
                rules.append({
                    "rule_id": record["rule_id"],
                    "title": record["title"],
                    "category": record["category"],
                    "description": record["description"],
                    "conditions": record["conditions"],
                    "actions": record["actions"],
                    "severity": record["severity"],
                    "regulation_id": record["regulation_id"],
                    "regulation_title": record["regulation_title"],
                    "source": record["source"]
                })

            return rules

    async def search_regulations(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Full-text search across regulations.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of matching regulations
        """
        async with self._driver.session(database=CENTRAL_GRAPH_DB) as session:
            # Use contains for basic search (full-text index can be added)
            result = await session.run(
                """
                MATCH (r:Regulation)
                WHERE r.title CONTAINS $query OR r.content CONTAINS $query
                RETURN r.regulation_id AS regulation_id,
                       r.title AS title,
                       r.regulation_type AS regulation_type,
                       r.source AS source,
                       r.effective_date AS effective_date
                LIMIT $limit
                """,
                query=query,
                limit=limit
            )

            regulations = []
            async for record in result:
                regulations.append({
                    "regulation_id": record["regulation_id"],
                    "title": record["title"],
                    "regulation_type": record["regulation_type"],
                    "source": record["source"],
                    "effective_date": record["effective_date"]
                })

            return regulations

    # =========================================================================
    # Personal Knowledge Graph (User Data with RLS)
    # =========================================================================

    async def _initialize_personal_schema(self):
        """Initialize personal graph schema with RLS support"""
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            # User constraint
            await session.run("""
                CREATE CONSTRAINT user_id IF NOT EXISTS
                FOR (u:User) REQUIRE u.user_id IS UNIQUE
            """)

            # Document constraint
            await session.run("""
                CREATE CONSTRAINT document_id IF NOT EXISTS
                FOR (d:Document) REQUIRE d.document_id IS UNIQUE
            """)

            # Transaction constraint
            await session.run("""
                CREATE CONSTRAINT transaction_id IF NOT EXISTS
                FOR (t:Transaction) REQUIRE t.transaction_id IS UNIQUE
            """)

            # User ID index for RLS
            await session.run("""
                CREATE INDEX entity_user_id IF NOT EXISTS
                FOR (n:Entity) ON (n.user_id)
            """)

            await session.run("""
                CREATE INDEX document_user_id IF NOT EXISTS
                FOR (d:Document) ON (d.user_id)
            """)

            await session.run("""
                CREATE INDEX transaction_user_id IF NOT EXISTS
                FOR (t:Transaction) ON (t.user_id)
            """)

            logger.info("Personal graph schema initialized")

    async def add_user_document(
        self,
        user_id: str,
        document_id: str,
        title: str,
        document_type: str,
        content_summary: str,
        source_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a document to a user's personal graph.

        Args:
            user_id: User identifier (RLS)
            document_id: Document identifier
            title: Document title
            document_type: Type (e.g., "tax_return", "medical_record", "bank_statement")
            content_summary: Summary or full content
            source_path: Path to blob storage
            metadata: Additional metadata

        Returns:
            document_id
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            await session.run(
                """
                MERGE (u:User {user_id: $user_id})
                MERGE (d:Document {document_id: $document_id})
                SET d.user_id = $user_id,
                    d.title = $title,
                    d.document_type = $document_type,
                    d.content_summary = $content_summary,
                    d.source_path = $source_path,
                    d.metadata = $metadata,
                    d.created_at = datetime(),
                    d.updated_at = datetime()
                MERGE (d)-[:BELONGS_TO]->(u)
                """,
                user_id=user_id,
                document_id=document_id,
                title=title,
                document_type=document_type,
                content_summary=content_summary,
                source_path=source_path,
                metadata=json.dumps(metadata or {})
            )

            logger.debug(f"Document added for user {user_id}: {document_id}")
            return document_id

    async def add_user_transaction(
        self,
        user_id: str,
        transaction_id: str,
        account_id: str,
        amount: float,
        category: str,
        merchant: Optional[str] = None,
        date: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a financial transaction to user's personal graph.

        Args:
            user_id: User identifier (RLS)
            transaction_id: Transaction identifier
            account_id: Bank account ID
            amount: Transaction amount
            category: Category (e.g., "groceries", "healthcare", "investment")
            merchant: Merchant name
            date: Transaction date
            metadata: Additional metadata

        Returns:
            transaction_id
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            await session.run(
                """
                MERGE (u:User {user_id: $user_id})
                MERGE (a:Account {account_id: $account_id, user_id: $user_id})
                MERGE (t:Transaction {transaction_id: $transaction_id})
                SET t.user_id = $user_id,
                    t.account_id = $account_id,
                    t.amount = $amount,
                    t.category = $category,
                    t.merchant = $merchant,
                    t.date = $date,
                    t.metadata = $metadata,
                    t.created_at = datetime()
                MERGE (t)-[:FROM_ACCOUNT]->(a)
                MERGE (t)-[:BELONGS_TO]->(u)
                MERGE (a)-[:BELONGS_TO]->(u)
                """,
                user_id=user_id,
                transaction_id=transaction_id,
                account_id=account_id,
                amount=amount,
                category=category,
                merchant=merchant,
                date=date,
                metadata=json.dumps(metadata or {})
            )

            logger.debug(f"Transaction added for user {user_id}: {transaction_id}")
            return transaction_id

    async def add_entity_relationship(
        self,
        user_id: str,
        source_id: str,
        source_type: str,
        target_id: str,
        target_type: str,
        relationship_type: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        """
        Create a relationship between two entities in the personal graph.

        Args:
            user_id: User identifier (RLS)
            source_id: Source entity ID
            source_type: Source entity label
            target_id: Target entity ID
            target_type: Target entity label
            relationship_type: Type of relationship
            properties: Relationship properties

        Returns:
            Tuple of (source_id, target_id)
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            # Dynamic relationship creation
            query = f"""
                MATCH (s:{source_type} {{user_id: $user_id}})
                WHERE s.document_id = $source_id OR s.transaction_id = $source_id
                      OR s.account_id = $source_id OR s.entity_id = $source_id
                MATCH (t:{target_type} {{user_id: $user_id}})
                WHERE t.document_id = $target_id OR t.transaction_id = $target_id
                      OR t.account_id = $target_id OR t.entity_id = $target_id
                MERGE (s)-[r:{relationship_type}]->(t)
                SET r.properties = $properties,
                    r.created_at = datetime()
                RETURN s, t
            """

            await session.run(
                query,
                user_id=user_id,
                source_id=source_id,
                target_id=target_id,
                properties=json.dumps(properties or {})
            )

            logger.debug(f"Relationship created: {source_id} -[{relationship_type}]-> {target_id}")
            return (source_id, target_id)

    async def get_user_documents(
        self,
        user_id: str,
        document_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get documents for a user (RLS enforced).

        Args:
            user_id: User identifier
            document_type: Optional filter by type
            limit: Maximum results

        Returns:
            List of documents
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            type_filter = "AND d.document_type = $document_type" if document_type else ""

            result = await session.run(
                f"""
                MATCH (d:Document {{user_id: $user_id}})
                WHERE TRUE {type_filter}
                RETURN d.document_id AS document_id,
                       d.title AS title,
                       d.document_type AS document_type,
                       d.content_summary AS content_summary,
                       d.source_path AS source_path,
                       d.created_at AS created_at
                ORDER BY d.created_at DESC
                LIMIT $limit
                """,
                user_id=user_id,
                document_type=document_type,
                limit=limit
            )

            documents = []
            async for record in result:
                documents.append({
                    "document_id": record["document_id"],
                    "title": record["title"],
                    "document_type": record["document_type"],
                    "content_summary": record["content_summary"],
                    "source_path": record["source_path"],
                    "created_at": str(record["created_at"]) if record["created_at"] else None
                })

            return documents

    async def get_user_transactions(
        self,
        user_id: str,
        category: Optional[str] = None,
        account_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get transactions for a user (RLS enforced).

        Args:
            user_id: User identifier
            category: Optional filter by category
            account_id: Optional filter by account
            limit: Maximum results

        Returns:
            List of transactions
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            conditions = []
            params = {"user_id": user_id, "limit": limit}

            if category:
                conditions.append("t.category = $category")
                params["category"] = category

            if account_id:
                conditions.append("t.account_id = $account_id")
                params["account_id"] = account_id

            where_clause = " AND ".join(conditions) if conditions else "TRUE"

            result = await session.run(
                f"""
                MATCH (t:Transaction {{user_id: $user_id}})
                WHERE {where_clause}
                RETURN t.transaction_id AS transaction_id,
                       t.account_id AS account_id,
                       t.amount AS amount,
                       t.category AS category,
                       t.merchant AS merchant,
                       t.date AS date
                ORDER BY t.date DESC
                LIMIT $limit
                """,
                **params
            )

            transactions = []
            async for record in result:
                transactions.append({
                    "transaction_id": record["transaction_id"],
                    "account_id": record["account_id"],
                    "amount": record["amount"],
                    "category": record["category"],
                    "merchant": record["merchant"],
                    "date": record["date"]
                })

            return transactions

    async def traverse_user_graph(
        self,
        user_id: str,
        start_id: str,
        relationship_types: Optional[List[str]] = None,
        max_depth: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Traverse the user's personal graph from a starting node.

        Args:
            user_id: User identifier (RLS)
            start_id: Starting entity ID
            relationship_types: Optional filter by relationship types
            max_depth: Maximum traversal depth

        Returns:
            List of connected nodes and relationships
        """
        async with self._driver.session(database=PERSONAL_GRAPH_DB) as session:
            rel_filter = f"[r:{('|'.join(relationship_types)) if relationship_types else '*'}*1..{max_depth}]"

            result = await session.run(
                f"""
                MATCH (start {{user_id: $user_id}})
                WHERE start.document_id = $start_id OR start.transaction_id = $start_id
                      OR start.account_id = $start_id OR start.entity_id = $start_id
                MATCH path = (start)-{rel_filter}-(connected)
                WHERE connected.user_id = $user_id
                RETURN nodes(path) AS nodes, relationships(path) AS relationships
                LIMIT 100
                """,
                user_id=user_id,
                start_id=start_id
            )

            paths = []
            async for record in result:
                paths.append({
                    "nodes": [dict(n) for n in record["nodes"]],
                    "relationships": [dict(r) for r in record["relationships"]]
                })

            return paths

    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics"""
        return {
            "connected": self._driver is not None,
            "uri": self.uri,
            "central_db": CENTRAL_GRAPH_DB,
            "personal_db": PERSONAL_GRAPH_DB
        }


# Global client instance
_global_neo4j_client: Optional[Neo4jClient] = None


async def get_neo4j_client() -> Neo4jClient:
    """Get or create global Neo4j client instance"""
    global _global_neo4j_client

    if _global_neo4j_client is None:
        _global_neo4j_client = Neo4jClient()
        await _global_neo4j_client.connect()
        logger.info("Global Neo4j client created")

    return _global_neo4j_client


async def cleanup_neo4j_client():
    """Cleanup global Neo4j client instance"""
    global _global_neo4j_client

    if _global_neo4j_client is not None:
        await _global_neo4j_client.disconnect()
        _global_neo4j_client = None
        logger.info("Global Neo4j client cleaned up")
