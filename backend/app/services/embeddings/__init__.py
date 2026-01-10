"""
Embedding providers for Life Navigator.

Supports multiple embedding backends:
- GraphRAG (production): Internal gRPC service
- Null (testing): Zero vectors for offline tests
"""

from app.services.embeddings.provider import EmbeddingProvider
from app.services.embeddings.graphrag_provider import GraphRAGEmbeddingProvider
from app.services.embeddings.null_provider import NullEmbeddingProvider

__all__ = [
    "EmbeddingProvider",
    "GraphRAGEmbeddingProvider",
    "NullEmbeddingProvider",
]
