"""Environment configuration for the GraphRAG pipeline."""

import os


class Config:
    """Reads configuration from environment variables."""

    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    NEO4J_URI: str = os.environ.get("NEO4J_URI", "")
    NEO4J_USERNAME: str = os.environ.get("NEO4J_USERNAME", "neo4j")
    NEO4J_PASSWORD: str = os.environ.get("NEO4J_PASSWORD", "")
    QDRANT_URL: str = os.environ.get("QDRANT_URL", "")
    QDRANT_API_KEY: str = os.environ.get("QDRANT_API_KEY", "")
    QDRANT_COLLECTION: str = os.environ.get("QDRANT_COLLECTION", "life_navigator")
    GRAPHRAG_WORKER_SECRET: str = os.environ.get("GRAPHRAG_WORKER_SECRET", "")

    # Gemini model config
    GEMINI_EMBED_MODEL: str = "gemini-embedding-001"
    GEMINI_GENERATE_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_DIMENSIONS: int = 768  # Explicitly requested via output_dimensionality

    # Pipeline config
    MAX_CLAIM: int = 50
    JOB_TIMEOUT_S: int = 25
    VECTOR_TOP_K: int = 10
    RRF_K: int = 60
    CACHE_TTL_HOURS: int = 1

    @classmethod
    def validate(cls) -> list[str]:
        """Return list of missing required env vars."""
        required = [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "GEMINI_API_KEY",
            "NEO4J_URI",
            "NEO4J_USERNAME",
            "NEO4J_PASSWORD",
            "QDRANT_URL",
            "QDRANT_API_KEY",
        ]
        return [k for k in required if not getattr(cls, k)]
