#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export SUPABASE_PROJECT_REF=...
#   export SUPABASE_URL=...
#   export SUPABASE_SERVICE_ROLE_KEY=...
#   export INGESTION_WORKER_SECRET=...
#   export INTERNAL_AGENT_WEBHOOK_URL=...
#   export INTERNAL_AGENT_WEBHOOK_SECRET=...
#   supabase login
#   ./scripts/setup-supabase-mvp.sh

required_vars=(
  SUPABASE_PROJECT_REF
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  INGESTION_WORKER_SECRET
  INTERNAL_AGENT_WEBHOOK_URL
  INTERNAL_AGENT_WEBHOOK_SECRET
)

for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required env var: $v"
    exit 1
  fi
done

echo "Linking Supabase project ${SUPABASE_PROJECT_REF}..."
supabase link --project-ref "${SUPABASE_PROJECT_REF}"

echo "Applying migrations..."
supabase db push

echo "Setting Edge Function secrets..."
supabase secrets set SUPABASE_URL="${SUPABASE_URL}"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
supabase secrets set INGESTION_WORKER_SECRET="${INGESTION_WORKER_SECRET}"
supabase secrets set INTERNAL_AGENT_WEBHOOK_URL="${INTERNAL_AGENT_WEBHOOK_URL}"
supabase secrets set INTERNAL_AGENT_WEBHOOK_SECRET="${INTERNAL_AGENT_WEBHOOK_SECRET}"

echo "Deploying Edge Functions..."
supabase functions deploy process-ingestion
supabase functions deploy sync-user-to-backend

echo "Done. Next: configure cron to call process-ingestion with x-worker-secret."
