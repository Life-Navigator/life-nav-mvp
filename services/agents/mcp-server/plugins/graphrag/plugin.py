"""GraphRAG Plugin - Hybrid Knowledge Graph + Vector Search"""

import time
from typing import Dict, List, Any, Optional
import structlog

from ..base import BasePlugin, PluginMetadata, PluginStatus
from ...utils.database import DatabaseManager
from .operations import (
    GraphOperations,
    VectorOperations,
    HybridSearch,
)

logger = structlog.get_logger(__name__)


class GraphRAGPlugin(BasePlugin):
    """
    Hybrid GraphRAG Plugin combining:
    - Neo4j knowledge graph (entities, relationships, patterns)
    - Qdrant vector search (semantic similarity)
    - Hybrid search (graph + semantic fusion)

    Features:
    - Entity and relationship management
    - Semantic search with re-ranking
    - Graph traversal and pattern matching
    - Multi-hop reasoning
    - Temporal queries
    - Row-level security (RLS) for multi-tenancy

    Tools provided:
    - query_knowledge_graph: Cypher queries
    - search_semantic: Vector similarity search
    - hybrid_search: Combined graph + vector
    - add_entity: Create entities
    - add_relationship: Create relationships
    - get_entity_context: Full entity context with relationships
    - find_path: Shortest path between entities
    - get_recommendations: Graph-based recommendations
    """

    def __init__(self, db_manager: DatabaseManager):
        super().__init__(
            metadata=PluginMetadata(
                name="graphrag",
                version="1.0.0",
                description="Hybrid knowledge graph and vector search system",
                author="Life Navigator",
                priority=100,  # Highest priority
                tags=["graph", "vector", "search", "knowledge"]
            )
        )
        self.db = db_manager
        self.graph_ops: Optional[GraphOperations] = None
        self.vector_ops: Optional[VectorOperations] = None
        self.hybrid_search: Optional[HybridSearch] = None

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize GraphRAG plugin"""
        logger.info("initializing_graphrag_plugin", config=config)

        self.config = config

        try:
            # Initialize graph operations
            self.graph_ops = GraphOperations(self.db.neo4j)
            await self.graph_ops.initialize()

            # Initialize vector operations
            self.vector_ops = VectorOperations(self.db.qdrant)
            await self.vector_ops.initialize(
                collection_name=config.get("collection_name", "life_navigator_embeddings"),
                vector_size=config.get("vector_size", 1024)
            )

            # Initialize hybrid search
            self.hybrid_search = HybridSearch(
                graph_ops=self.graph_ops,
                vector_ops=self.vector_ops
            )

            self.set_status(PluginStatus.READY)
            logger.info("graphrag_plugin_initialized")

        except Exception as e:
            self.set_status(PluginStatus.ERROR, str(e))
            logger.error(
                "graphrag_initialization_failed",
                error=str(e),
                exc_info=True
            )
            raise

    async def get_context(
        self,
        query: str,
        user_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get GraphRAG context for a query.

        Performs hybrid search combining:
        1. Semantic vector search (Qdrant)
        2. Graph pattern matching (Neo4j)
        3. Entity relationship traversal

        Args:
            query: User query
            user_id: User identifier for RLS
            **kwargs: Additional parameters

        Returns:
            Context with entities, relationships, and semantic results
        """
        start_time = time.time()

        try:
            # Perform hybrid search
            max_results = kwargs.get("max_results", self.config.get("max_results", 10))
            include_relationships = kwargs.get(
                "include_relationships",
                self.config.get("include_relationships", True)
            )

            results = await self.hybrid_search.search(
                query=query,
                user_id=user_id,
                max_results=max_results,
                include_relationships=include_relationships,
                filters=kwargs.get("filters", {})
            )

            # Format for LLM consumption
            context = {
                "entities": results["entities"],
                "relationships": results["relationships"],
                "semantic_matches": results["semantic_matches"],
                "graph_patterns": results["graph_patterns"],
            }

            # Calculate relevance score
            relevance_score = self._calculate_relevance(results)

            # Estimate tokens
            tokens = self._estimate_tokens(context)

            latency_ms = (time.time() - start_time) * 1000

            return {
                "data": context,
                "metadata": {
                    "source": "graphrag",
                    "relevance_score": relevance_score,
                    "tokens": tokens,
                    "latency_ms": latency_ms,
                    "entities_count": len(results["entities"]),
                    "relationships_count": len(results["relationships"]),
                }
            }

        except Exception as e:
            logger.error(
                "graphrag_context_failed",
                query=query[:100],
                error=str(e),
                exc_info=True
            )
            raise

    def get_tools(self) -> List[Any]:
        """Register GraphRAG tools"""
        from ...tools.base import Tool

        return [
            Tool(
                name="query_knowledge_graph",
                description="Execute Cypher query on knowledge graph. Returns entities and relationships matching the query.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "cypher_query": {
                            "type": "string",
                            "description": "Cypher query to execute"
                        },
                        "parameters": {
                            "type": "object",
                            "description": "Query parameters"
                        }
                    },
                    "required": ["cypher_query"]
                },
                handler=self._tool_query_graph
            ),
            Tool(
                name="search_semantic",
                description="Search for semantically similar entities using vector embeddings.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results",
                            "default": 10
                        },
                        "filters": {
                            "type": "object",
                            "description": "Optional filters"
                        }
                    },
                    "required": ["query"]
                },
                handler=self._tool_search_semantic
            ),
            Tool(
                name="hybrid_search",
                description="Perform hybrid search combining graph patterns and semantic similarity.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum results",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                },
                handler=self._tool_hybrid_search
            ),
            Tool(
                name="add_entity",
                description="Create a new entity in the knowledge graph.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "entity_type": {
                            "type": "string",
                            "description": "Entity type (e.g., Person, Project, Document)"
                        },
                        "properties": {
                            "type": "object",
                            "description": "Entity properties"
                        },
                        "generate_embedding": {
                            "type": "boolean",
                            "description": "Generate vector embedding",
                            "default": True
                        }
                    },
                    "required": ["entity_type", "properties"]
                },
                handler=self._tool_add_entity
            ),
            Tool(
                name="add_relationship",
                description="Create a relationship between two entities.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "source_id": {
                            "type": "string",
                            "description": "Source entity ID"
                        },
                        "target_id": {
                            "type": "string",
                            "description": "Target entity ID"
                        },
                        "relationship_type": {
                            "type": "string",
                            "description": "Relationship type (e.g., WORKS_ON, CREATED_BY)"
                        },
                        "properties": {
                            "type": "object",
                            "description": "Relationship properties"
                        }
                    },
                    "required": ["source_id", "target_id", "relationship_type"]
                },
                handler=self._tool_add_relationship
            ),
            Tool(
                name="get_entity_context",
                description="Get full context for an entity including all relationships.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "entity_id": {
                            "type": "string",
                            "description": "Entity ID"
                        },
                        "depth": {
                            "type": "integer",
                            "description": "Relationship traversal depth",
                            "default": 2
                        }
                    },
                    "required": ["entity_id"]
                },
                handler=self._tool_get_entity_context
            ),
            Tool(
                name="find_path",
                description="Find shortest path between two entities in the graph.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "start_id": {
                            "type": "string",
                            "description": "Start entity ID"
                        },
                        "end_id": {
                            "type": "string",
                            "description": "End entity ID"
                        },
                        "max_depth": {
                            "type": "integer",
                            "description": "Maximum path length",
                            "default": 5
                        }
                    },
                    "required": ["start_id", "end_id"]
                },
                handler=self._tool_find_path
            ),
            Tool(
                name="get_recommendations",
                description="Get entity recommendations based on graph patterns.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "entity_id": {
                            "type": "string",
                            "description": "Source entity ID"
                        },
                        "recommendation_type": {
                            "type": "string",
                            "description": "Type of recommendations"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum recommendations",
                            "default": 10
                        }
                    },
                    "required": ["entity_id"]
                },
                handler=self._tool_get_recommendations
            ),
        ]

    async def on_tool_invocation(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: str
    ) -> Any:
        """Handle tool invocation"""
        # Get tool handler
        tools = {tool.name: tool for tool in self.get_tools()}

        if tool_name not in tools:
            raise ValueError(f"Tool '{tool_name}' not found")

        tool = tools[tool_name]

        # Add user_id to parameters for RLS
        parameters["user_id"] = user_id

        # Execute handler
        return await tool.handler(**parameters)

    # Tool handlers
    async def _tool_query_graph(
        self,
        cypher_query: str,
        parameters: Optional[Dict] = None,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute Cypher query"""
        return await self.graph_ops.execute_query(
            cypher_query,
            parameters or {},
            user_id=user_id
        )

    async def _tool_search_semantic(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict] = None,
        user_id: str = None,
        **kwargs
    ) -> List[Dict]:
        """Semantic search"""
        return await self.vector_ops.search(
            query=query,
            limit=limit,
            filters=filters,
            user_id=user_id
        )

    async def _tool_hybrid_search(
        self,
        query: str,
        max_results: int = 10,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Hybrid search"""
        return await self.hybrid_search.search(
            query=query,
            user_id=user_id,
            max_results=max_results
        )

    async def _tool_add_entity(
        self,
        entity_type: str,
        properties: Dict,
        generate_embedding: bool = True,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Add entity"""
        # Add to graph
        entity = await self.graph_ops.create_entity(
            entity_type=entity_type,
            properties=properties,
            user_id=user_id
        )

        # Generate embedding if requested
        if generate_embedding:
            await self.vector_ops.add_entity_embedding(
                entity_id=entity["id"],
                entity_data=properties,
                user_id=user_id
            )

        return entity

    async def _tool_add_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        properties: Optional[Dict] = None,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Add relationship"""
        return await self.graph_ops.create_relationship(
            source_id=source_id,
            target_id=target_id,
            relationship_type=relationship_type,
            properties=properties or {},
            user_id=user_id
        )

    async def _tool_get_entity_context(
        self,
        entity_id: str,
        depth: int = 2,
        user_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get entity context"""
        return await self.graph_ops.get_entity_with_relationships(
            entity_id=entity_id,
            depth=depth,
            user_id=user_id
        )

    async def _tool_find_path(
        self,
        start_id: str,
        end_id: str,
        max_depth: int = 5,
        user_id: str = None,
        **kwargs
    ) -> List[Dict]:
        """Find path"""
        return await self.graph_ops.find_shortest_path(
            start_id=start_id,
            end_id=end_id,
            max_depth=max_depth,
            user_id=user_id
        )

    async def _tool_get_recommendations(
        self,
        entity_id: str,
        recommendation_type: Optional[str] = None,
        limit: int = 10,
        user_id: str = None,
        **kwargs
    ) -> List[Dict]:
        """Get recommendations"""
        return await self.graph_ops.get_recommendations(
            entity_id=entity_id,
            recommendation_type=recommendation_type,
            limit=limit,
            user_id=user_id
        )

    async def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("cleaning_up_graphrag_plugin")
        # Neo4j and Qdrant connections managed by DatabaseManager

    def _calculate_relevance(self, results: Dict) -> float:
        """Calculate relevance score from results"""
        # Simple scoring based on result counts
        entity_score = min(len(results.get("entities", [])) / 10, 1.0)
        semantic_score = min(len(results.get("semantic_matches", [])) / 10, 1.0)

        return (entity_score + semantic_score) / 2

    def _estimate_tokens(self, context: Dict) -> int:
        """Estimate token count for context"""
        import json
        context_str = json.dumps(context)
        return len(context_str) // 4
