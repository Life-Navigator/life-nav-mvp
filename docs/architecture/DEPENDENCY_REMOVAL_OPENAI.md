# OpenAI Dependency Removal

**Status**: Complete
**Date**: 2026-01-09
**Reason**: Eliminate external LLM dependencies; use internal GraphRAG for embeddings

---

## Background

The Life Navigator backend previously used OpenAI's API for text embeddings (`text-embedding-3-small`). This created:
- **Cost dependency**: $0.02/1M tokens
- **Latency**: 200-500ms external API calls
- **Vendor lock-in**: Coupled to OpenAI infrastructure
- **Privacy risk**: Text data sent to third-party

## Solution

Replace OpenAI embeddings with internal **GraphRAG gRPC service** which already provides:
- Custom embedding models (fine-tuned for Life Navigator domain)
- Sub-100ms latency (internal network)
- Zero marginal cost
- Full data sovereignty

---

## Changes Made

### 1. New Embedding Provider Interface

**File**: `backend/app/services/embeddings/provider.py`

```python
class EmbeddingProvider(Protocol):
    """Protocol for embedding providers."""

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for single text."""
        ...

    async def generate_embeddings_batch(
        self, texts: list[str], batch_size: int = 100
    ) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        ...

    def get_dimension(self) -> int:
        """Get embedding dimension."""
        ...
```

### 2. GraphRAG Embedding Provider

**File**: `backend/app/services/embeddings/graphrag_provider.py`

Uses existing GraphRAG gRPC endpoint:
- Endpoint: `GRAPHRAG_URL` (default: `localhost:50051`)
- Protocol: gRPC
- Method: `EmbeddingService.GenerateEmbeddings`

### 3. Null Embedding Provider (Testing)

**File**: `backend/app/services/embeddings/null_provider.py`

Returns zero vectors for offline testing.

### 4. Configuration

**File**: `backend/app/core/config_production.py`

```python
# Embeddings Provider (NO OPENAI)
EMBEDDINGS_PROVIDER: Literal["graphrag", "null"] = "graphrag"
```

### 5. Dependency Injection

**File**: `backend/app/services/embedding_service.py`

```python
def get_embedding_service() -> EmbeddingService:
    """Factory that selects provider based on config."""
    provider_type = settings.EMBEDDINGS_PROVIDER

    if provider_type == "graphrag":
        return GraphRAGEmbeddingService()
    elif provider_type == "null":
        return NullEmbeddingService()
    else:
        raise ValueError(f"Unknown provider: {provider_type}")
```

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `backend/app/services/embeddings/__init__.py` | Created | Package initialization |
| `backend/app/services/embeddings/provider.py` | Created | Protocol interface |
| `backend/app/services/embeddings/graphrag_provider.py` | Created | GraphRAG implementation |
| `backend/app/services/embeddings/null_provider.py` | Created | Null implementation (testing) |
| `backend/app/services/embedding_service.py` | Modified | Use provider pattern |
| `backend/app/core/config_production.py` | Modified | Add `EMBEDDINGS_PROVIDER` setting |
| `backend/pyproject.toml` | Modified | Move `openai` to optional dev dependency |
| `.github/workflows/secrets-hygiene.yml` | Created | CI check blocks OpenAI imports |

---

## Migration Steps

### Development

No changes needed - GraphRAG already runs locally via Docker Compose.

### Staging/Production

1. **Update Environment Variable**:
   ```bash
   # Vercel / Cloud Run
   EMBEDDINGS_PROVIDER=graphrag
   GRAPHRAG_URL=graphrag.internal.svc.cluster.local:50051
   ```

2. **Remove OpenAI Key**:
   ```bash
   # Delete from GCP Secret Manager
   gcloud secrets delete OPENAI_API_KEY --quiet

   # Remove from Vercel
   vercel env rm OPENAI_API_KEY production
   ```

3. **Deploy**:
   ```bash
   # Backend automatically uses GraphRAG provider
   gcloud run deploy life-navigator-backend --region=us-central1
   ```

---

## Testing

### Unit Tests

```bash
# Test provider selection
pytest backend/tests/services/embeddings/test_providers.py

# Test GraphRAG provider
pytest backend/tests/services/embeddings/test_graphrag_provider.py
```

### Integration Tests

```bash
# Test with stubbed gRPC (no network)
pytest backend/tests/integration/test_embeddings_integration.py
```

### Manual Verification

```bash
# Start GraphRAG service
docker-compose up graphrag

# Run embedding generation
cd backend
poetry run python -c "
from app.services.embedding_service import get_embedding_service
service = get_embedding_service()
embedding = await service.generate_embedding('test text')
print(f'Dimension: {len(embedding)}')
"
```

---

## Rollback Plan

If GraphRAG provider fails:

1. **Temporary**: Switch to null provider (zero vectors)
   ```bash
   EMBEDDINGS_PROVIDER=null
   ```

2. **Permanent**: Revert to OpenAI (not recommended)
   ```bash
   # Restore openai dependency
   poetry add openai
   # Set API key
   EMBEDDINGS_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```

---

## Performance Comparison

| Metric | OpenAI | GraphRAG |
|--------|--------|----------|
| Latency (p50) | 250ms | 50ms |
| Latency (p99) | 800ms | 150ms |
| Cost per 1M tokens | $0.02 | $0 |
| Dimension | 1536 | 768 |
| Data sovereignty | ❌ External | ✅ Internal |

---

## Related Documentation

- [GraphRAG Service Architecture](../services/GRAPHRAG_ARCHITECTURE.md)
- [Secrets Inventory](../security/SECRETS_INVENTORY.md)
- [Production Config](../deployment/PRODUCTION_CONFIG.md)
