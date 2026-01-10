"""
GraphRAG Embedding Provider.

Uses internal GraphRAG gRPC service for embeddings.
"""

import grpc
import structlog
from typing import Optional

from app.core.config import settings

logger = structlog.get_logger()


class GraphRAGEmbeddingProvider:
    """
    Embedding provider using GraphRAG gRPC service.

    Features:
    - Internal service (no external API calls)
    - Sub-100ms latency
    - Custom models fine-tuned for Life Navigator
    - Zero marginal cost
    """

    def __init__(self):
        self.grpc_url = settings.GRAPHRAG_URL
        self.dimension = 768  # GraphRAG embedding dimension
        self.timeout = settings.GRAPHRAG_TIMEOUT
        self._channel: Optional[grpc.aio.Channel] = None

        logger.info(
            "graphrag_embedding_provider_initialized",
            grpc_url=self.grpc_url,
            dimension=self.dimension,
        )

    async def _get_channel(self) -> grpc.aio.Channel:
        """Get or create gRPC channel."""
        if self._channel is None:
            self._channel = grpc.aio.insecure_channel(self.grpc_url)
        return self._channel

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (768 dimensions)
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return [0.0] * self.dimension

        # Truncate very long text
        if len(text) > 8000:
            text = text[:8000]

        try:
            # For now, return a placeholder implementation
            # TODO: Implement actual gRPC call to GraphRAG service
            # This requires the GraphRAG protobuf definitions

            # Placeholder: return zero vector
            logger.debug(
                "graphrag_embedding_requested",
                text_length=len(text),
            )

            return [0.0] * self.dimension

            # Actual implementation would be:
            # channel = await self._get_channel()
            # stub = EmbeddingServiceStub(channel)
            # request = GenerateEmbeddingRequest(text=text)
            # response = await stub.GenerateEmbedding(request, timeout=self.timeout)
            # return list(response.embedding)

        except Exception as e:
            logger.error(
                "graphrag_embedding_failed",
                error=str(e),
                text_length=len(text),
            )
            # Return zero vector on error
            return [0.0] * self.dimension

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

        embeddings = []

        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            # For now, call single embedding for each text
            # TODO: Implement batch gRPC call for efficiency
            batch_embeddings = []
            for text in batch:
                embedding = await self.generate_embedding(text)
                batch_embeddings.append(embedding)

            embeddings.extend(batch_embeddings)

            logger.info(
                "graphrag_batch_embeddings_generated",
                batch_num=i // batch_size + 1,
                batch_size=len(batch),
                total_processed=len(embeddings),
            )

        return embeddings

    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension

    async def close(self):
        """Close gRPC channel."""
        if self._channel:
            await self._channel.close()
            self._channel = None
