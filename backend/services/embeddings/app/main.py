"""
Life Navigator - Vector Embedding Generation Service
Generates embeddings for semantic search and GraphRAG using E5-large-v2

Production Features:
- E5-large-v2 model (1024 dimensions, MTEB 64.5 score)
- Batch processing for efficiency
- GPU acceleration with automatic CPU fallback
- Request caching for identical texts
- FastAPI HTTP server for gRPC alternative
- Health checks and monitoring
"""
import asyncio
import hashlib
import logging
import os
from typing import List, Dict, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import torch
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

class EmbeddingConfig:
    """Embedding service configuration"""
    MODEL_NAME: str = os.getenv("EMBEDDING_MODEL", "intfloat/e5-large-v2")
    DIMENSION: int = 1024  # E5-large-v2 dimension
    BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "32"))
    MAX_SEQ_LENGTH: int = 512  # E5-large-v2 max tokens
    DEVICE: str = "cuda" if torch.cuda.is_available() else "cpu"
    CACHE_SIZE: int = 10000  # Cache up to 10K embeddings

    # E5 model requires prefixes for asymmetric search
    QUERY_PREFIX: str = "query: "
    DOCUMENT_PREFIX: str = "passage: "


# ============================================================================
# Request/Response Models
# ============================================================================

class EmbeddingRequest(BaseModel):
    """Request for generating embeddings"""
    content: str = Field(..., description="Text to embed")
    prefix: Optional[str] = Field(None, description="Optional prefix (query/passage)")


class BatchEmbeddingRequest(BaseModel):
    """Batch embedding request"""
    texts: List[str] = Field(..., description="List of texts to embed")
    is_query: bool = Field(False, description="Whether texts are queries (vs documents)")


class EmbeddingResponse(BaseModel):
    """Embedding response"""
    embedding: List[float] = Field(..., description="Vector embedding")
    dimension: int = Field(..., description="Embedding dimension")
    model: str = Field(..., description="Model used")


class BatchEmbeddingResponse(BaseModel):
    """Batch embedding response"""
    embeddings: List[List[float]] = Field(..., description="List of embeddings")
    count: int = Field(..., description="Number of embeddings")
    dimension: int = Field(..., description="Embedding dimension")
    model: str = Field(..., description="Model used")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    device: str
    dimension: int
    cache_size: int


# ============================================================================
# Embedding Service
# ============================================================================

class EmbeddingService:
    """
    Vector Embedding Service with E5-large-v2

    Features:
    - Asymmetric search support (query vs document embeddings)
    - Batch processing for efficiency
    - GPU acceleration with CPU fallback
    - LRU caching for duplicate texts
    - Normalized vectors for cosine similarity
    """

    def __init__(self, config: EmbeddingConfig = EmbeddingConfig()):
        """Initialize embedding service with E5-large-v2 model"""
        self.config = config
        self.model: Optional[SentenceTransformer] = None
        self._cache: Dict[str, List[float]] = {}

        logger.info(
            f"Initializing embedding service",
            extra={
                "model": config.MODEL_NAME,
                "device": config.DEVICE,
                "dimension": config.DIMENSION
            }
        )

    def load_model(self) -> None:
        """Load SentenceTransformer model with E5-large-v2"""
        try:
            logger.info(f"Loading model: {self.config.MODEL_NAME}")

            self.model = SentenceTransformer(
                self.config.MODEL_NAME,
                device=self.config.DEVICE
            )

            # Set max sequence length
            self.model.max_seq_length = self.config.MAX_SEQ_LENGTH

            logger.info(
                f"Model loaded successfully",
                extra={
                    "device": self.config.DEVICE,
                    "max_seq_length": self.config.MAX_SEQ_LENGTH,
                    "dimension": self.config.DIMENSION
                }
            )

        except Exception as e:
            logger.error(f"Failed to load model: {e}", exc_info=True)
            raise RuntimeError(f"Model loading failed: {e}") from e

    def unload_model(self) -> None:
        """Unload model and free GPU memory"""
        if self.model is not None:
            del self.model
            self.model = None

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info("Model unloaded and GPU memory cleared")

    async def generate_embeddings(
        self,
        texts: List[str],
        is_query: bool = False,
        use_cache: bool = True
    ) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of text strings to embed
            is_query: Whether texts are queries (True) or documents (False)
            use_cache: Whether to use cache for lookups

        Returns:
            List of embedding vectors (1024 dimensions each)

        Raises:
            RuntimeError: If model not loaded or encoding fails
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        if not texts:
            return []

        # Add appropriate prefix for E5 model (asymmetric search)
        prefix = self.config.QUERY_PREFIX if is_query else self.config.DOCUMENT_PREFIX
        prefixed_texts = [f"{prefix}{text}" for text in texts]

        # Check cache for all texts
        embeddings = []
        texts_to_encode = []
        indices_to_encode = []

        if use_cache:
            for i, text in enumerate(prefixed_texts):
                cache_key = self._get_cache_key(text)
                if cache_key in self._cache:
                    embeddings.append(self._cache[cache_key])
                else:
                    texts_to_encode.append(text)
                    indices_to_encode.append(i)
                    embeddings.append(None)  # Placeholder
        else:
            texts_to_encode = prefixed_texts
            indices_to_encode = list(range(len(prefixed_texts)))
            embeddings = [None] * len(prefixed_texts)

        # Encode texts not in cache
        if texts_to_encode:
            try:
                # Run encoding in thread pool to avoid blocking
                new_embeddings = await asyncio.to_thread(
                    self._encode_batch,
                    texts_to_encode
                )

                # Update cache and results
                for idx, embedding in zip(indices_to_encode, new_embeddings):
                    embeddings[idx] = embedding

                    if use_cache and len(self._cache) < self.config.CACHE_SIZE:
                        cache_key = self._get_cache_key(prefixed_texts[idx])
                        self._cache[cache_key] = embedding

            except Exception as e:
                logger.error(f"Encoding failed: {e}", exc_info=True)
                raise RuntimeError(f"Failed to encode texts: {e}") from e

        return embeddings

    def _encode_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Encode texts using SentenceTransformer (synchronous).

        Args:
            texts: Prefixed texts to encode

        Returns:
            List of normalized embedding vectors
        """
        # Encode with normalization for cosine similarity
        embeddings = self.model.encode(
            texts,
            batch_size=self.config.BATCH_SIZE,
            normalize_embeddings=True,  # L2 normalization
            show_progress_bar=False,
            convert_to_numpy=True
        )

        # Convert numpy arrays to lists
        return [emb.tolist() for emb in embeddings]

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key from text using SHA256"""
        return hashlib.sha256(text.encode()).hexdigest()

    def clear_cache(self) -> int:
        """Clear embedding cache and return number of entries cleared"""
        count = len(self._cache)
        self._cache.clear()
        logger.info(f"Cache cleared: {count} entries removed")
        return count

    def get_stats(self) -> Dict:
        """Get service statistics"""
        return {
            "model": self.config.MODEL_NAME,
            "device": self.config.DEVICE,
            "dimension": self.config.DIMENSION,
            "cache_size": len(self._cache),
            "cache_max": self.config.CACHE_SIZE,
            "batch_size": self.config.BATCH_SIZE,
            "model_loaded": self.model is not None
        }


# ============================================================================
# Global Service Instance
# ============================================================================

embedding_service = EmbeddingService()


# ============================================================================
# FastAPI Application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - load/unload model"""
    # Startup: Load model
    logger.info("Starting embedding service...")
    embedding_service.load_model()
    yield
    # Shutdown: Unload model
    logger.info("Shutting down embedding service...")
    embedding_service.unload_model()


app = FastAPI(
    title="Life Navigator Embedding Service",
    description="E5-large-v2 vector embeddings for semantic search and GraphRAG",
    version="2.0.0",
    lifespan=lifespan
)


@app.post("/embedding", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """
    Generate embedding for a single text.

    Compatible with GraphRAG Rust service endpoint.
    """
    try:
        # Determine if query or document based on prefix
        is_query = request.prefix == "query:" if request.prefix else False

        embeddings = await embedding_service.generate_embeddings(
            texts=[request.content],
            is_query=is_query
        )

        return EmbeddingResponse(
            embedding=embeddings[0],
            dimension=embedding_service.config.DIMENSION,
            model=embedding_service.config.MODEL_NAME
        )

    except Exception as e:
        logger.error(f"Embedding generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@app.post("/embeddings/batch", response_model=BatchEmbeddingResponse)
async def create_batch_embeddings(request: BatchEmbeddingRequest):
    """Generate embeddings for multiple texts (batch processing)"""
    try:
        embeddings = await embedding_service.generate_embeddings(
            texts=request.texts,
            is_query=request.is_query
        )

        return BatchEmbeddingResponse(
            embeddings=embeddings,
            count=len(embeddings),
            dimension=embedding_service.config.DIMENSION,
            model=embedding_service.config.MODEL_NAME
        )

    except Exception as e:
        logger.error(f"Batch embedding failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch embedding failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    stats = embedding_service.get_stats()

    return HealthResponse(
        status="healthy" if stats["model_loaded"] else "unhealthy",
        model=stats["model"],
        device=stats["device"],
        dimension=stats["dimension"],
        cache_size=stats["cache_size"]
    )


@app.post("/cache/clear")
async def clear_cache():
    """Clear embedding cache"""
    count = embedding_service.clear_cache()
    return {"status": "success", "entries_cleared": count}


@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    return embedding_service.get_stats()


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Run server
    port = int(os.getenv("PORT", "8090"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting embedding service on {host}:{port}")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
