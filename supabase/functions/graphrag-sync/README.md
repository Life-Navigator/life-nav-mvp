# graphrag-sync

Edge Function that syncs data from Supabase to Neo4j Aura + Qdrant Cloud.

## How it works

1. Claims pending jobs from `graphrag.sync_queue` (populated by triggers on goals, financial_accounts, risk_assessments, career_profiles)
2. For each job:
   - Builds text representation of the entity
   - Generates embedding via Gemini `gemini-embedding-001` (768 dims)
   - Upserts/deletes node in Neo4j Aura (HTTP Transaction API)
   - Upserts/deletes point in Qdrant Cloud (REST API)
3. Marks jobs as completed or failed

## Required Secrets

```bash
supabase secrets set \
  GRAPHRAG_WORKER_SECRET=<random-secret> \
  GEMINI_API_KEY=<google-ai-api-key> \
  NEO4J_QUERY_API_URL=https://<dbid>.databases.neo4j.io \
  NEO4J_USERNAME=neo4j \
  NEO4J_PASSWORD=<password> \
  QDRANT_URL=https://<cluster>.qdrant.io:6333 \
  QDRANT_API_KEY=<api-key> \
  QDRANT_COLLECTION=life_navigator
```

## Supabase Config

Add `graphrag` to **API Settings → Exposed schemas** so PostgREST can call functions in the `graphrag` schema.

## Neo4j Constraints (run once)

```cypher
CREATE CONSTRAINT person_tenant IF NOT EXISTS FOR (p:Person) REQUIRE p.tenant_id IS UNIQUE;
CREATE CONSTRAINT goal_entity IF NOT EXISTS FOR (g:Goal) REQUIRE (g.entity_id, g.tenant_id) IS UNIQUE;
CREATE CONSTRAINT account_entity IF NOT EXISTS FOR (a:FinancialAccount) REQUIRE (a.entity_id, a.tenant_id) IS UNIQUE;
CREATE CONSTRAINT risk_entity IF NOT EXISTS FOR (r:RiskAssessment) REQUIRE (r.entity_id, r.tenant_id) IS UNIQUE;
CREATE CONSTRAINT career_entity IF NOT EXISTS FOR (c:CareerProfile) REQUIRE (c.entity_id, c.tenant_id) IS UNIQUE;
CREATE INDEX person_user IF NOT EXISTS FOR (p:Person) ON (p.user_id);
```

## Qdrant Collection (create once)

```bash
curl -X PUT "${QDRANT_URL}/collections/life_navigator" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": { "size": 768, "distance": "Cosine" },
    "optimizers_config": { "indexing_threshold": 1000 },
    "replication_factor": 1
  }'

# Payload indexes for tenant isolation and filtering
curl -X PUT "${QDRANT_URL}/collections/life_navigator/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "tenant_id", "field_schema": "keyword" }'

curl -X PUT "${QDRANT_URL}/collections/life_navigator/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "entity_type", "field_schema": "keyword" }'

curl -X PUT "${QDRANT_URL}/collections/life_navigator/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "domain", "field_schema": "keyword" }'
```

## Triggering

Call via POST with worker secret:

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/graphrag-sync" \
  -H "x-worker-secret: ${GRAPHRAG_WORKER_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"limit": 25}'
```

Set up a cron (e.g., `pg_cron` or external scheduler) to call every 30s–60s.
