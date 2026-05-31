#!/usr/bin/env bash
# LifeNavigator Ingestion Worker — Fly.io deployment script.
#
# Run from this directory:
#
#   cd apps/ingestion-worker
#   ./deploy.sh
#
# The script does NOT prompt for secrets. Pre-set them in your shell:
#
#   export SUPABASE_URL=https://YOURPROJECT.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   export GEMINI_API_KEY=AIza...
#   export QDRANT_URL=https://YOURQDRANT.qdrant.io:6333
#   export QDRANT_API_KEY=...
#   export QDRANT_PERSONAL_COLLECTION=life_navigator
#   export NEO4J_URI=https://YOURNEO4J.databases.neo4j.io
#   export NEO4J_USERNAME=neo4j
#   export NEO4J_PASSWORD=...
#   export NEO4J_PERSONAL_DATABASE=neo4j
#
# Idempotent: re-runs reapply secrets and ship a fresh image.
set -euo pipefail

APP_NAME="${FLY_APP_NAME:-lifenavigator-ingestion-worker}"

command -v fly >/dev/null 2>&1 || {
  echo "fly CLI not found. Install: https://fly.io/docs/flyctl/install/"
  exit 1
}

# --- 1. Preflight ---------------------------------------------------------
REQUIRED=(
  SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
  GEMINI_API_KEY
  QDRANT_URL QDRANT_API_KEY QDRANT_PERSONAL_COLLECTION
  NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD NEO4J_PERSONAL_DATABASE
)
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "missing env: $var" >&2
    exit 1
  fi
done

# --- 2. Tests must pass before we ship ------------------------------------
echo "[deploy] running cargo test --release"
cargo test --release --quiet

# --- 3. Ensure the Fly app exists -----------------------------------------
if ! fly status -a "$APP_NAME" >/dev/null 2>&1; then
  echo "[deploy] creating Fly app: $APP_NAME"
  fly apps create "$APP_NAME"
fi

# --- 4. Push secrets ------------------------------------------------------
echo "[deploy] pushing secrets to $APP_NAME"
fly secrets set -a "$APP_NAME" --stage \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  QDRANT_URL="$QDRANT_URL" \
  QDRANT_API_KEY="$QDRANT_API_KEY" \
  QDRANT_PERSONAL_COLLECTION="$QDRANT_PERSONAL_COLLECTION" \
  NEO4J_URI="$NEO4J_URI" \
  NEO4J_USERNAME="$NEO4J_USERNAME" \
  NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  NEO4J_PERSONAL_DATABASE="$NEO4J_PERSONAL_DATABASE"

# --- 5. Deploy ------------------------------------------------------------
echo "[deploy] launching deployment"
fly deploy -a "$APP_NAME" --remote-only

# --- 6. Post-deploy verification ------------------------------------------
echo "[deploy] tailing logs for 20s; ctrl-c when satisfied"
timeout 20 fly logs -a "$APP_NAME" || true

echo
echo "Done. Next steps:"
echo "  1. Insert a test row in graphrag.sync_queue (see scripts/validation/smoke_test_graphrag.sh)"
echo "  2. fly logs -a $APP_NAME  to watch the worker drain it"
echo "  3. Query Qdrant + Neo4j for the resulting personal vector + node"
