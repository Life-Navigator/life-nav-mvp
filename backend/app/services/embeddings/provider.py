"""
Embedding Provider Protocol.

Defines interface for all embedding providers.
"""

from typing import Protocol


class EmbeddingProvider(Protocol):
    """
    Protocol for embedding generation services.

    All providers must implement this interface to be compatible with
    the embedding service factory.
    """

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        ...

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
        ...

    def get_dimension(self) -> int:
        """
        Get embedding dimension.

        Returns:
            Number of dimensions in embedding vector
        """
        ...
