"""
GraphRAG Infrastructure for Life Navigator Agents.

Dual-Graph Architecture:
- Central Knowledge Graph: Regulatory rules, compliance (Neo4j)
- Personal Knowledge Graph: User data with RLS (Neo4j + PostgreSQL)

Vector Search (Qdrant):
- central_knowledge: Regulatory embeddings
- personal_documents: User document embeddings
- personal_transactions: Transaction embeddings
- conversation_memory: Agent conversation history

Compliance Validation:
- Block -> Reassess -> Rewrite flow
- Logs all validations for human review
"""

# PostgreSQL + pgvector client (legacy, for backward compatibility)
from graphrag.client import (
    GraphRAGClient,
    get_graphrag_client,
    cleanup_graphrag_client
)

# Neo4j dual-graph client
from graphrag.neo4j_client import (
    Neo4jClient,
    get_neo4j_client,
    cleanup_neo4j_client,
    CENTRAL_GRAPH_DB,
    PERSONAL_GRAPH_DB,
    CENTRALIZED_USER_ID
)

# Qdrant vector client
from graphrag.qdrant_client import (
    QdrantVectorClient,
    get_qdrant_client,
    cleanup_qdrant_client,
    COLLECTION_CENTRAL_KNOWLEDGE,
    COLLECTION_PERSONAL_DOCUMENTS,
    COLLECTION_PERSONAL_TRANSACTIONS,
    COLLECTION_CONVERSATION_MEMORY,
    VECTOR_DIM
)

# Embedding service
from graphrag.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    cleanup_embedding_service
)

# Compliance validator
from graphrag.compliance_validator import (
    ComplianceValidator,
    ComplianceResult,
    ComplianceViolation,
    ComplianceSeverity,
    ComplianceCategory,
    ValidationLog,
    create_compliance_validator
)

# Document ingestion
from graphrag.document_ingestion import (
    DocumentIngestionPipeline,
    DocumentType,
    ChunkingStrategy,
    CENTRALIZED_USER_ID as DOC_CENTRALIZED_USER_ID  # noqa: F401
)

# Orchestrator
from graphrag.orchestrator import (
    GraphRAGOrchestrator,
    QueryContext,
    ProcessedResponse,
    create_orchestrator
)

__all__ = [
    # PostgreSQL client (legacy)
    "GraphRAGClient",
    "get_graphrag_client",
    "cleanup_graphrag_client",

    # Neo4j client
    "Neo4jClient",
    "get_neo4j_client",
    "cleanup_neo4j_client",
    "CENTRAL_GRAPH_DB",
    "PERSONAL_GRAPH_DB",
    "CENTRALIZED_USER_ID",

    # Qdrant client
    "QdrantVectorClient",
    "get_qdrant_client",
    "cleanup_qdrant_client",
    "COLLECTION_CENTRAL_KNOWLEDGE",
    "COLLECTION_PERSONAL_DOCUMENTS",
    "COLLECTION_PERSONAL_TRANSACTIONS",
    "COLLECTION_CONVERSATION_MEMORY",
    "VECTOR_DIM",

    # Embedding service
    "EmbeddingService",
    "get_embedding_service",
    "cleanup_embedding_service",

    # Compliance
    "ComplianceValidator",
    "ComplianceResult",
    "ComplianceViolation",
    "ComplianceSeverity",
    "ComplianceCategory",
    "ValidationLog",
    "create_compliance_validator",

    # Document ingestion
    "DocumentIngestionPipeline",
    "DocumentType",
    "ChunkingStrategy",

    # Orchestrator
    "GraphRAGOrchestrator",
    "QueryContext",
    "ProcessedResponse",
    "create_orchestrator"
]
