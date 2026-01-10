"""
Null Embedding Provider.

Returns zero vectors for testing without external dependencies.
"""

import structlog

logger = structlog.get_logger()


class NullEmbeddingProvider:
    """
    Null embedding provider for offline testing.

    Returns zero vectors instead of calling external services.
    Useful for:
    - Unit tests
    - CI/CD pipelines without GraphRAG
    - Development without embeddings dependency
    """

    def __init__(self):
        self.dimension = 768  # Match GraphRAG dimension
        logger.info(
            "null_embedding_provider_initialized",
            dimension=self.dimension,
        )

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate zero vector for text.

        Args:
            text: Text (ignored)

        Returns:
            Zero vector
        """
        logger.debug(
            "null_embedding_generated",
            text_length=len(text) if text else 0,
        )
        return [0.0] * self.dimension

    async def generate_embeddings_batch(
        self, texts: list[str], batch_size: int = 100
    ) -> list[list[float]]:
        """
        Generate zero vectors for batch.

        Args:
            texts: List of texts (ignored)
            batch_size: Batch size (ignored)

        Returns:
            List of zero vectors
        """
        logger.info(
            "null_batch_embeddings_generated",
            count=len(texts),
        )
        return [[0.0] * self.dimension for _ in texts]

    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension
