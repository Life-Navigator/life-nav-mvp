#!/usr/bin/env bash
# LifeNavigator FastAPI Gateway — Fly.io deployment script.
#
# Run from this directory:
#
#   cd apps/api-gateway
#   ./deploy.sh
#
# Pre-set secrets in your shell before running:
#
#   export SUPABASE_URL=https://YOURPROJECT.supabase.co
#   export SUPABASE_ANON_KEY=eyJ...
#   export SUPABASE_JWT_SECRET=...
#   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   export GEMINI_API_KEY=AIza...
#   export QDRANT_URL=https://YOURQDRANT.qdrant.io:6333
#   export QDRANT_API_KEY=...
#   export QDRANT_PERSONAL_COLLECTION=life_navigator
#   export QDRANT_CENTRAL_COLLECTION=ln_central
#   export NEO4J_URI=https://YOURNEO4J.databases.neo4j.io
#   export NEO4J_USERNAME=neo4j
#   export NEO4J_PASSWORD=...
#   export NEO4J_PERSONAL_DATABASE=neo4j
#   export NEO4J_CENTRAL_DATABASE=central
#   export ALLOWED_ORIGINS="https://lifenavigator.app,https://*.vercel.app"
set -euo pipefail

APP_NAME="${FLY_APP_NAME:-lifenavigator-api-gateway}"

command -v fly >/dev/null 2>&1 || {
  echo "fly CLI not found. Install: https://fly.io/docs/flyctl/install/"
  exit 1
}

REQUIRED=(
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_JWT_SECRET SUPABASE_SERVICE_ROLE_KEY
  GEMINI_API_KEY
  QDRANT_URL QDRANT_API_KEY QDRANT_PERSONAL_COLLECTION QDRANT_CENTRAL_COLLECTION
  NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD NEO4J_PERSONAL_DATABASE NEO4J_CENTRAL_DATABASE
  ALLOWED_ORIGINS
)
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "missing env: $var" >&2
    exit 1
  fi
done

# Tests gate the deploy.
if [ -d .venv ]; then
  echo "[deploy] running pytest"
  .venv/bin/pytest -q
else
  echo "[deploy] no .venv; assuming tests already passed in CI"
fi

if ! fly status -a "$APP_NAME" >/dev/null 2>&1; then
  echo "[deploy] creating Fly app: $APP_NAME"
  fly apps create "$APP_NAME"
fi

echo "[deploy] pushing secrets to $APP_NAME"
fly secrets set -a "$APP_NAME" --stage \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  QDRANT_URL="$QDRANT_URL" \
  QDRANT_API_KEY="$QDRANT_API_KEY" \
  QDRANT_PERSONAL_COLLECTION="$QDRANT_PERSONAL_COLLECTION" \
  QDRANT_CENTRAL_COLLECTION="$QDRANT_CENTRAL_COLLECTION" \
  NEO4J_URI="$NEO4J_URI" \
  NEO4J_USERNAME="$NEO4J_USERNAME" \
  NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  NEO4J_PERSONAL_DATABASE="$NEO4J_PERSONAL_DATABASE" \
  NEO4J_CENTRAL_DATABASE="$NEO4J_CENTRAL_DATABASE" \
  ALLOWED_ORIGINS="$ALLOWED_ORIGINS"

echo "[deploy] launching deployment"
fly deploy -a "$APP_NAME" --remote-only

echo "[deploy] verifying /healthz"
HEALTH_URL="https://${APP_NAME}.fly.dev/healthz"
for i in 1 2 3 4 5; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "[deploy] healthz ok"
    break
  fi
  echo "[deploy] waiting for healthz... ($i/5)"
  sleep 5
done

echo
echo "Done. Smoke-check from your machine:"
echo "  curl -fsS $HEALTH_URL"
echo "  curl -fsS -H 'Authorization: Bearer <supabase-jwt>' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"text\":\"You should buy SPY this week.\"}' \\"
echo "       https://${APP_NAME}.fly.dev/api/compliance/check"
