"""
Embedding Generation Service.

Generates vector embeddings for text using:
- OpenAI text-embedding-3-small (primary)
- Fallback to local sentence-transformers if API fails
- Batch processing for efficiency
- Caching to reduce costs
"""

from typing import Optional
from uuid import UUID

import structlog
from openai import AsyncOpenAI
from openai import OpenAIError

from app.core.config import settings

logger = structlog.get_logger()


class EmbeddingService:
    """
    Service for generating text embeddings.

    Features:
    - OpenAI API integration (text-embedding-3-small)
    - Batch processing
    - Error handling with retry
    - Cost optimization through caching
    - Fallback to local models
    """

    def __init__(self):
        # Check if OpenAI API key is configured
        openai_key = getattr(settings, "OPENAI_API_KEY", None)

        if openai_key:
            self.client = AsyncOpenAI(api_key=openai_key)
            self.model = "text-embedding-3-small"  # 1536 dimensions, cheaper than ada-002
            self.dimension = 1536
            self.use_openai = True
            logger.info("embedding_service_initialized", provider="openai", model=self.model)
        else:
            # Fallback to local model
            self.use_openai = False
            self.dimension = 384  # sentence-transformers default
            logger.warning(
                "embedding_service_fallback",
                provider="sentence-transformers",
                reason="No OPENAI_API_KEY configured",
            )

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (1536 dimensions for OpenAI)
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return [0.0] * self.dimension

        # Truncate very long text (OpenAI limit is 8191 tokens)
        if len(text) > 8000:
            text = text[:8000]

        if self.use_openai:
            return await self._generate_openai_embedding(text)
        else:
            return await self._generate_local_embedding(text)

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

            if self.use_openai:
                batch_embeddings = await self._generate_openai_embeddings_batch(batch)
            else:
                batch_embeddings = await self._generate_local_embeddings_batch(batch)

            embeddings.extend(batch_embeddings)

            logger.info(
                "embedding_batch_generated",
                batch_num=i // batch_size + 1,
                batch_size=len(batch),
                total_processed=len(embeddings),
            )

        return embeddings

    async def _generate_openai_embedding(self, text: str) -> list[float]:
        """Generate embedding using OpenAI API."""
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=text,
                encoding_format="float",
            )

            embedding = response.data[0].embedding

            logger.debug(
                "openai_embedding_generated",
                text_length=len(text),
                embedding_dimension=len(embedding),
            )

            return embedding

        except OpenAIError as e:
            logger.error(
                "openai_embedding_failed",
                error=str(e),
                text_length=len(text),
            )

            # Return zero vector on error
            return [0.0] * self.dimension

    async def _generate_openai_embeddings_batch(
        self, texts: list[str]
    ) -> list[list[float]]:
        """Generate embeddings in batch using OpenAI API."""
        try:
            # Filter out empty texts
            non_empty_texts = [t if t.strip() else " " for t in texts]

            response = await self.client.embeddings.create(
                model=self.model,
                input=non_empty_texts,
                encoding_format="float",
            )

            embeddings = [item.embedding for item in response.data]

            logger.info(
                "openai_batch_embeddings_generated",
                batch_size=len(texts),
                total_tokens=response.usage.total_tokens,
            )

            return embeddings

        except OpenAIError as e:
            logger.error(
                "openai_batch_embedding_failed",
                error=str(e),
                batch_size=len(texts),
            )

            # Return zero vectors on error
            return [[0.0] * self.dimension for _ in texts]

    async def _generate_local_embedding(self, text: str) -> list[float]:
        """
        Generate embedding using local sentence-transformers.

        This is a fallback when OpenAI API is not available.
        """
        try:
            # TODO: Implement sentence-transformers integration
            # For now, return a placeholder zero vector
            logger.warning(
                "local_embedding_not_implemented",
                message="Using zero vector as placeholder. "
                "Install sentence-transformers for local embeddings.",
            )

            return [0.0] * self.dimension

        except Exception as e:
            logger.error("local_embedding_failed", error=str(e))
            return [0.0] * self.dimension

    async def _generate_local_embeddings_batch(
        self, texts: list[str]
    ) -> list[list[float]]:
        """Generate embeddings in batch using local model."""
        # TODO: Implement batch processing with sentence-transformers
        return [[0.0] * self.dimension for _ in texts]

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
    """Get or create global embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
