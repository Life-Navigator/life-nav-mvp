#!/usr/bin/env bash
# ==========================================================================
# Qdrant Cloud — One-time collection initialization
# Usage: QDRANT_URL=https://xxx.qdrant.io:6333 QDRANT_API_KEY=xxx ./init-qdrant.sh
# ==========================================================================
set -euo pipefail

: "${QDRANT_URL:?Set QDRANT_URL (e.g. https://xxx.qdrant.io:6333)}"
: "${QDRANT_API_KEY:?Set QDRANT_API_KEY}"

COLLECTION="${QDRANT_COLLECTION:-life_navigator}"

echo "Creating collection: ${COLLECTION} (768 dims, Cosine)..."
curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": { "size": 768, "distance": "Cosine" },
    "optimizers_config": { "indexing_threshold": 1000 },
    "replication_factor": 1
  }' && echo " OK" || echo " (may already exist)"

echo "Creating payload index: tenant_id..."
curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "tenant_id", "field_schema": "keyword" }' && echo " OK"

echo "Creating payload index: entity_type..."
curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "entity_type", "field_schema": "keyword" }' && echo " OK"

echo "Creating payload index: domain..."
curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}/index" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "field_name": "domain", "field_schema": "keyword" }' && echo " OK"

echo "Qdrant collection '${COLLECTION}' initialized."
