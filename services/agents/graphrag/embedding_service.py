"""
Embedding Service for GraphRAG

Local embedding generation using sentence-transformers.
Uses all-MiniLM-L6-v2 model (384 dimensions) for efficient semantic embeddings.
"""

from typing import List, Union, Optional
import numpy as np
import asyncio

from utils.logging import get_logger

logger = get_logger(__name__)

# Model configuration
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
VECTOR_DIM = 384


class EmbeddingService:
    """
    Local embedding service using sentence-transformers.

    Features:
    - Efficient batch embedding generation
    - CPU/GPU automatic selection
    - Caching for repeated queries
    - Async-friendly interface

    Example:
        >>> embedding_service = EmbeddingService()
        >>> await embedding_service.load_model()
        >>> embedding = await embedding_service.encode("Hello world")
        >>> print(embedding.shape)  # (384,)
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        device: Optional[str] = None,
        normalize: bool = True
    ):
        """
        Initialize embedding service.

        Args:
            model_name: HuggingFace model name
            device: Device to use ('cpu', 'cuda', or None for auto)
            normalize: Whether to normalize embeddings to unit length
        """
        self.model_name = model_name
        self.device = device
        self.normalize = normalize

        self._model = None
        self._loaded = False

        logger.info(
            "EmbeddingService initialized",
            extra={"model": model_name, "device": device}
        )

    async def load_model(self):
        """Load the embedding model"""
        if self._loaded:
            return

        try:
            from sentence_transformers import SentenceTransformer

            # Load model (will auto-select device if not specified)
            self._model = SentenceTransformer(
                self.model_name,
                device=self.device
            )

            self._loaded = True

            logger.info(
                f"Embedding model loaded: {self.model_name}",
                extra={"device": str(self._model.device)}
            )

        except ImportError:
            logger.error("sentence-transformers not installed. Run: pip install sentence-transformers")
            raise

        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise

    async def encode(
        self,
        text: Union[str, List[str]],
        batch_size: int = 32,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Generate embeddings for text.

        Args:
            text: Single string or list of strings
            batch_size: Batch size for encoding
            show_progress: Show progress bar

        Returns:
            Numpy array of embeddings (384-dim)
        """
        if not self._loaded:
            await self.load_model()

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: self._model.encode(
                text,
                batch_size=batch_size,
                show_progress_bar=show_progress,
                normalize_embeddings=self.normalize
            )
        )

        return embeddings

    async def encode_documents(
        self,
        documents: List[str],
        batch_size: int = 32
    ) -> List[np.ndarray]:
        """
        Encode multiple documents with batching.

        Args:
            documents: List of document texts
            batch_size: Batch size

        Returns:
            List of embedding arrays
        """
        if not documents:
            return []

        embeddings = await self.encode(documents, batch_size=batch_size)

        # Convert to list of individual embeddings
        if len(documents) == 1:
            return [embeddings]

        return [embeddings[i] for i in range(len(documents))]

    async def encode_query(self, query: str) -> np.ndarray:
        """
        Encode a search query.

        Args:
            query: Query text

        Returns:
            Query embedding (384-dim)
        """
        return await self.encode(query)

    def get_vector_dim(self) -> int:
        """Get the embedding vector dimension"""
        return VECTOR_DIM

    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self._loaded


# Global embedding service instance
_global_embedding_service: Optional[EmbeddingService] = None


async def get_embedding_service() -> EmbeddingService:
    """Get or create global embedding service"""
    global _global_embedding_service

    if _global_embedding_service is None:
        _global_embedding_service = EmbeddingService()
        await _global_embedding_service.load_model()
        logger.info("Global embedding service created")

    return _global_embedding_service


async def cleanup_embedding_service():
    """Cleanup global embedding service"""
    global _global_embedding_service

    if _global_embedding_service is not None:
        _global_embedding_service = None
        logger.info("Global embedding service cleaned up")
