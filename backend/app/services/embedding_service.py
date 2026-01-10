"""
Embedding Generation Service (OpenAI-free).

Generates vector embeddings for text using internal providers.
NO external LLM APIs (OpenAI, Cohere, etc.) in production.
"""

from typing import Optional

import structlog

from app.core.config import settings
from app.services.embeddings.provider import EmbeddingProvider
from app.services.embeddings.graphrag_provider import GraphRAGEmbeddingProvider
from app.services.embeddings.null_provider import NullEmbeddingProvider

logger = structlog.get_logger()


class EmbeddingService:
    """
    Service for generating text embeddings.

    Features:
    - Provider pattern (GraphRAG, Null)
    - Batch processing
    - Error handling
    - NO external LLM dependencies
    """

    def __init__(self, provider: Optional[EmbeddingProvider] = None):
        """
        Initialize embedding service.

        Args:
            provider: Embedding provider (auto-selected from config if None)
        """
        if provider is None:
            provider = self._create_provider()

        self.provider = provider
        self.dimension = provider.get_dimension()

        logger.info(
            "embedding_service_initialized",
            provider=provider.__class__.__name__,
            dimension=self.dimension,
        )

    def _create_provider(self) -> EmbeddingProvider:
        """
        Create embedding provider based on configuration.

        Returns:
            EmbeddingProvider instance
        """
        provider_type = settings.EMBEDDINGS_PROVIDER

        if provider_type == "graphrag":
            return GraphRAGEmbeddingProvider()
        elif provider_type == "null":
            return NullEmbeddingProvider()
        else:
            raise ValueError(
                f"Unknown EMBEDDINGS_PROVIDER: {provider_type}. "
                f"Valid options: graphrag, null"
            )

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        if not text or not text.strip():
            return [0.0] * self.dimension

        # Truncate very long text
        if len(text) > 8000:
            text = text[:8000]

        return await self.provider.generate_embedding(text)

    async def generate_embeddings_batch(
        self, texts: list[str], batch_size: int = 100
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed
            batch_size: Number of texts to process per batch

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        return await self.provider.generate_embeddings_batch(texts, batch_size)

    def create_entity_text(self, entity: dict) -> str:
        """
        Create text representation of an entity for embedding.

        Args:
            entity: Entity dict with type and properties

        Returns:
            Text representation suitable for embedding
        """
        entity_type = entity.get("type", "Unknown")
        properties = entity.get("properties", {})

        # Build text from important properties
        text_parts = [f"Entity type: {entity_type}"]

        # Add common properties
        for key in ["name", "title", "description", "content", "summary"]:
            if key in properties and properties[key]:
                text_parts.append(f"{key}: {properties[key]}")

        # Add all other string properties
        for key, value in properties.items():
            if (
                key not in ["name", "title", "description", "content", "summary"]
                and isinstance(value, str)
                and value.strip()
            ):
                text_parts.append(f"{key}: {value}")

        text = "\n".join(text_parts)

        # Truncate if too long
        if len(text) > 8000:
            text = text[:8000]

        return text

    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension


# Global service instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get or create global embedding service instance.

    The provider is selected based on EMBEDDINGS_PROVIDER config:
    - graphrag (production): Internal gRPC service
    - null (testing): Zero vectors

    Returns:
        EmbeddingService instance
    """
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
