"""
GraphRAG infrastructure for Life Navigator Agents.

Provides PostgreSQL + pgvector integration for semantic search and knowledge graphs.
"""

from graphrag.client import (
    GraphRAGClient,
    get_graphrag_client,
    cleanup_graphrag_client
)

__all__ = [
    "GraphRAGClient",
    "get_graphrag_client",
    "cleanup_graphrag_client"
]
