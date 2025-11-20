# GraphRAG Deployment Guide

This guide covers deploying and testing the Life Navigator GraphRAG (Knowledge Graph + Vector Search) system.

## Overview

The GraphRAG system consists of:
- **Neo4j** - Property graph database for storing entities and relationships
- **Qdrant** - Vector database for storing embeddings and semantic search
- **OpenAI API** - For generating text embeddings (text-embedding-3-small)
- **PostgreSQL** - Source data for entity extraction
- **Redis** - For caching and Celery task queue

## Architecture

```
PostgreSQL (Source Data)
    ↓
Entity Extraction Service
    ↓
GraphRAG Rebuild Service
    ├→ Embedding Service → OpenAI API → Qdrant (Vectors)
    └→ Neo4j Client → Neo4j (Graph)
```

## Prerequisites

### Required Services

1. **Neo4j 5.x** - Graph database
2. **Qdrant 1.7+** - Vector database
3. **PostgreSQL 15+** - Primary database
4. **Redis 7+** - Cache and task queue
5. **OpenAI API Key** - For embeddings

### Python Dependencies

Already added to `backend/pyproject.toml`:
```toml
neo4j = "^5.14.0"
qdrant-client = "^1.7.0"
openai = "^1.6.0"
```

## Installation

### 1. Install Dependencies

```bash
cd backend
poetry install
```

### 2. Deploy Neo4j

#### Local Development (Docker)

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  -e NEO4J_PLUGINS='["apoc"]' \
  -e NEO4J_apoc_export_file_enabled=true \
  -e NEO4J_apoc_import_file_enabled=true \
  neo4j:5.14
```

#### Production (Kubernetes)

Use the Neo4j Helm chart:

```bash
helm repo add neo4j https://helm.neo4j.com/neo4j
helm install neo4j neo4j/neo4j \
  --set neo4j.password=YOUR_PASSWORD \
  --set neo4j.edition=enterprise \
  --set volumes.data.mode=defaultStorageClass \
  --set volumes.data.defaultStorageClass.requests.storage=50Gi
```

### 3. Deploy Qdrant

#### Local Development (Docker)

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:v1.7.0
```

#### Production (Kubernetes)

Create `k8s/base/qdrant/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qdrant
spec:
  replicas: 1
  selector:
    matchLabels:
      app: qdrant
  template:
    metadata:
      labels:
        app: qdrant
    spec:
      containers:
      - name: qdrant
        image: qdrant/qdrant:v1.7.0
        ports:
        - containerPort: 6333
        volumeMounts:
        - name: qdrant-storage
          mountPath: /qdrant/storage
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: qdrant-storage
        persistentVolumeClaim:
          claimName: qdrant-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: qdrant
spec:
  selector:
    app: qdrant
  ports:
  - port: 6333
    targetPort: 6333
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: qdrant-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

### 4. Configure Environment Variables

Add to your `.env` file (backend directory):

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # Optional, for production
QDRANT_COLLECTION=life_navigator

# OpenAI Configuration
OPENAI_API_KEY=sk-...your-openai-api-key...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

For production, add these to your Kubernetes secrets:

```bash
# Using External Secrets Operator (already configured in k8s/shared/external-secrets.yaml)
# Add to your Google Secret Manager:

gcloud secrets create life-navigator-neo4j-password --data-file=- <<< "your_password"
gcloud secrets create life-navigator-openai-api-key --data-file=- <<< "sk-your-key"
```

Update `k8s/shared/external-secrets.yaml` to include:

```yaml
- key: neo4j-password
  name: NEO4J_PASSWORD
- key: neo4j-uri
  name: NEO4J_URI
- key: qdrant-url
  name: QDRANT_URL
- key: openai-api-key
  name: OPENAI_API_KEY
```

### 5. Update Backend Deployment

Ensure the backend deployment has the new secrets mounted:

```yaml
# k8s/base/backend/deployment.yaml
envFrom:
- secretRef:
    name: life-navigator-secrets  # ExternalSecret creates this
```

## Testing the System

### 1. Health Check

Test that all services are reachable:

```bash
# Neo4j
curl http://localhost:7474

# Qdrant
curl http://localhost:6333/health

# Backend API
curl http://localhost:8000/api/v1/health
```

### 2. Create Test Data

Create some test entities in PostgreSQL:

```python
# In Python shell or test script
import asyncio
from app.models.goal import Goal
from app.core.database import get_db

async def create_test_goal():
    async for db in get_db():
        goal = Goal(
            name="Learn GraphRAG",
            description="Understand how knowledge graphs work with vector search",
            category="education",
            status="active",
            user_id=YOUR_USER_UUID,
            tenant_id=YOUR_TENANT_UUID,
        )
        db.add(goal)
        await db.commit()
        print(f"Created goal: {goal.id}")
        break

asyncio.run(create_test_goal())
```

### 3. Trigger GraphRAG Rebuild

#### Via API

```bash
curl -X POST http://localhost:8000/api/v1/graphrag/rebuild \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_UUID" \
  -H "Content-Type: application/json" \
  -d '{
    "rebuild_type": "full",
    "clear_existing": true
  }'
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Rebuild job created successfully"
}
```

#### Check Job Status

```bash
curl http://localhost:8000/api/v1/graphrag/jobs/{job_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_UUID"
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "rebuild_type": "full",
  "progress": 100,
  "entities_processed": 150,
  "relationships_created": 75,
  "errors": 0,
  "started_at": "2025-11-20T10:00:00Z",
  "completed_at": "2025-11-20T10:05:23Z"
}
```

### 4. Verify Data in Neo4j

Connect to Neo4j Browser (http://localhost:7474) and run:

```cypher
// Check entity count
MATCH (n {tenant_id: "YOUR_TENANT_UUID"})
RETURN labels(n) as type, count(*) as count

// View sample entities
MATCH (n:Goal {tenant_id: "YOUR_TENANT_UUID"})
RETURN n
LIMIT 10

// View relationships
MATCH (n {tenant_id: "YOUR_TENANT_UUID"})-[r]->(m {tenant_id: "YOUR_TENANT_UUID"})
RETURN n, r, m
LIMIT 50
```

### 5. Verify Data in Qdrant

```python
# Test vector search
import asyncio
from app.clients.qdrant_client import get_qdrant_client
from app.services.embedding_service import get_embedding_service
from uuid import UUID

async def test_vector_search():
    qdrant = get_qdrant_client()
    embedding_service = get_embedding_service()

    # Generate query embedding
    query = "education goals"
    query_vector = await embedding_service.generate_embedding(query)

    # Search
    results = await qdrant.search_similar(
        tenant_id=UUID("YOUR_TENANT_UUID"),
        query_vector=query_vector,
        limit=10,
        score_threshold=0.5
    )

    print(f"Found {len(results)} similar entities:")
    for result in results:
        print(f"  - {result['metadata'].get('name')} (score: {result['score']:.3f})")

asyncio.run(test_vector_search())
```

### 6. Check Index Metrics

```bash
curl http://localhost:8000/api/v1/graphrag/metrics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-ID: YOUR_TENANT_UUID"
```

Response:
```json
{
  "total_entities": 150,
  "entity_counts": {
    "ln:Goal": 45,
    "ln:Transaction": 80,
    "ln:HealthRecord": 15,
    "ln:Course": 10
  },
  "total_relationships": 75,
  "total_vectors": 150,
  "last_rebuild": "2025-11-20T10:05:23Z",
  "last_sync": null,
  "index_health": "healthy"
}
```

## Monitoring

### Neo4j Metrics

```cypher
// Database size
CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store sizes")
YIELD attributes
RETURN attributes.TotalStoreSize.value AS totalSize

// Query performance
CALL dbms.listQueries()
YIELD query, elapsedTimeMillis, allocatedBytes
WHERE elapsedTimeMillis > 1000
RETURN query, elapsedTimeMillis, allocatedBytes
```

### Qdrant Metrics

```bash
# Collection info
curl http://localhost:6333/collections/life_navigator

# Cluster info
curl http://localhost:6333/cluster
```

### Application Metrics

The GraphRAG service emits structured logs (via structlog):

```json
{
  "event": "graphrag_rebuild_started",
  "job_id": "550e8400-...",
  "tenant_id": "...",
  "rebuild_type": "full",
  "timestamp": "2025-11-20T10:00:00Z"
}
```

Use your log aggregation system (e.g., Loki, CloudWatch) to monitor:
- `event=graphrag_rebuild_completed` - Successful rebuilds
- `event=graphrag_rebuild_failed` - Failed rebuilds
- `event=neo4j_batch_stored` - Entity storage
- `event=qdrant_batch_vectors_upserted` - Vector storage

## Troubleshooting

### Issue: Neo4j Connection Failed

**Symptoms**: Logs show `neo4j_connection_failed`

**Solution**:
1. Check Neo4j is running: `docker ps | grep neo4j`
2. Verify credentials: Try connecting via Neo4j Browser
3. Check network connectivity: `telnet localhost 7687`
4. Review Neo4j logs: `docker logs neo4j`

### Issue: Qdrant Collection Not Found

**Symptoms**: Logs show `qdrant_collection_setup_failed`

**Solution**:
1. Check Qdrant is running: `curl http://localhost:6333/health`
2. Manually create collection:
   ```bash
   curl -X PUT http://localhost:6333/collections/life_navigator \
     -H "Content-Type: application/json" \
     -d '{
       "vectors": {
         "size": 1536,
         "distance": "Cosine"
       }
     }'
   ```

### Issue: OpenAI Embeddings Failing

**Symptoms**: Logs show `openai_embedding_failed`

**Solution**:
1. Verify API key is set: `echo $OPENAI_API_KEY`
2. Check API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
3. Check rate limits on OpenAI dashboard
4. Fallback: The service will return zero vectors (search won't work but won't crash)

### Issue: Entity Extraction Returns Empty

**Symptoms**: Rebuild completes with 0 entities

**Solution**:
1. Verify PostgreSQL has data:
   ```sql
   SELECT COUNT(*) FROM goals WHERE deleted_at IS NULL;
   ```
2. Check tenant_id matches: All entities must have matching tenant_id
3. Review extraction service logs for model import errors

### Issue: Rebuild Job Stuck

**Symptoms**: Job stays in `in_progress` status

**Solution**:
1. Check Celery worker is running: `celery -A app.core.celery_app inspect active`
2. Review Celery logs: `docker logs backend-celery-worker`
3. Check Redis connection: `redis-cli ping`
4. Manually fail stuck job:
   ```sql
   UPDATE graphrag_jobs
   SET status = 'failed',
       error_message = 'Job stuck, manually failed'
   WHERE job_id = 'YOUR_JOB_ID';
   ```

## Performance Tuning

### Neo4j

1. **Increase Memory** (for large datasets):
   ```conf
   # neo4j.conf
   dbms.memory.heap.initial_size=4G
   dbms.memory.heap.max_size=4G
   dbms.memory.pagecache.size=4G
   ```

2. **Create Indexes**:
   ```cypher
   CREATE INDEX entity_tenant_id IF NOT EXISTS FOR (n) ON (n.tenant_id);
   CREATE INDEX entity_type IF NOT EXISTS FOR (n) ON (n.entity_id);
   ```

### Qdrant

1. **Adjust Collection Parameters**:
   ```python
   # For larger datasets, increase segment size
   await client.update_collection(
       collection_name="life_navigator",
       optimizer_config={"indexing_threshold": 50000}
   )
   ```

2. **Enable Quantization** (for memory efficiency):
   ```python
   await client.update_collection(
       collection_name="life_navigator",
       quantization_config={"scalar": {"type": "int8"}}
   )
   ```

### OpenAI API

1. **Batch Size**: Adjust `batch_size` parameter in `generate_embeddings_batch()`:
   ```python
   # Larger batches = fewer API calls but higher latency
   embeddings = await embedding_service.generate_embeddings_batch(
       texts, batch_size=200  # Default is 100
   )
   ```

2. **Rate Limiting**: Implement exponential backoff if hitting rate limits

## Cost Estimation

### OpenAI Embeddings

- Model: `text-embedding-3-small`
- Cost: $0.02 / 1M tokens (~3,000 pages)
- Average entity text: ~200 tokens
- Cost per 1,000 entities: $0.004 (less than half a cent)

For 100K entities:
- Total cost: ~$0.40
- Incremental rebuilds only process changed entities

### Infrastructure

**Development** (Docker on single machine):
- Cost: $0 (local)

**Production** (GKE):
- Neo4j: 4GB RAM, 2 vCPUs → ~$80/month
- Qdrant: 4GB RAM, 2 vCPUs → ~$80/month
- Storage (100GB): ~$17/month
- **Total: ~$180/month**

**Scaling**: Both Neo4j and Qdrant can scale horizontally for larger datasets.

## Security Considerations

1. **Multi-tenant Isolation**: All queries filter by `tenant_id`
2. **Network Security**: Use private IPs for Neo4j and Qdrant in production
3. **Secrets Management**: Store credentials in Google Secret Manager, not .env files
4. **API Keys**: Rotate OpenAI API keys regularly
5. **Access Control**: Restrict Neo4j browser access via firewall rules

## Backup and Recovery

### Neo4j Backup

```bash
# Backup
docker exec neo4j neo4j-admin database dump neo4j --to-path=/backups

# Restore
docker exec neo4j neo4j-admin database load neo4j --from-path=/backups
```

### Qdrant Backup

```bash
# Create snapshot
curl -X POST http://localhost:6333/collections/life_navigator/snapshots

# Download snapshot
curl http://localhost:6333/collections/life_navigator/snapshots/{snapshot_name} \
  --output snapshot.zip

# Restore
curl -X PUT http://localhost:6333/collections/life_navigator/snapshots/upload \
  --data-binary @snapshot.zip
```

## Next Steps

1. **Test with Real Data**: Run rebuild on production data copy
2. **Monitor Performance**: Track rebuild times and resource usage
3. **Implement Incremental Sync**: Use the KG-sync service for real-time updates
4. **Add GraphDB**: Integrate GraphDB for RDF/semantic triples (future)
5. **Build Query Interface**: Create API endpoints for graph and vector queries

## Support

For issues or questions:
- Check logs: `kubectl logs -l app=backend`
- Review Neo4j browser: http://YOUR_NEO4J_URL:7474
- Review Qdrant dashboard: http://YOUR_QDRANT_URL:6333/dashboard
- Contact: team@lifenavigator.ai
