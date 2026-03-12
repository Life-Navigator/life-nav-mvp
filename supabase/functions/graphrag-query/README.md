# graphrag-query

Edge Function that handles user queries with hybrid GraphRAG search and Gemini-powered personalized answers.

## How it works

1. Authenticates caller (JWT or worker secret)
2. Checks query cache for recent identical queries
3. Embeds user query via Gemini `text-embedding-004`
4. **Parallel hybrid search:**
   - Vector search: Qdrant similarity search (tenant-filtered)
   - Graph search: Gemini NL→Cypher → Neo4j graph traversal (tenant-filtered)
5. Reciprocal Rank Fusion combines both result sets
6. Fetches user's risk profile for personalization context
7. Gemini Flash generates personalized answer grounded in user's actual data
8. Caches response for 1 hour

## Endpoints

### Non-streaming

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/graphrag-query" \
  -H "x-worker-secret: ${GRAPHRAG_WORKER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"query": "How am I progressing on my savings goal?", "user_id": "uuid"}'
```

### Streaming (SSE)

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/graphrag-query" \
  -H "x-worker-secret: ${GRAPHRAG_WORKER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"query": "What should I do next?", "user_id": "uuid", "stream": true}'
```

## Required Secrets

Same as `graphrag-sync` — see its README.

## Response Format

### Non-streaming

```json
{
  "message": "Based on your savings goal...",
  "conversation_id": "conv_...",
  "sources": [
    { "entity_type": "goal", "entity_id": "uuid", "score": 0.85, "source": "vector" }
  ],
  "metadata": {
    "duration_ms": 1200,
    "vector_results": 5,
    "graph_results": 3,
    "fused_results": 7
  }
}
```

### Streaming (SSE)

```
data: {"text": "Based on "}
data: {"text": "your savings goal..."}
data: [DONE]
```
