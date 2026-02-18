#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export VERCEL_ENVIRONMENT=production   # production|preview|development
#   export NEXT_PUBLIC_SUPABASE_URL=...
#   export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   export INTERNAL_AGENT_WEBHOOK_SECRET=...
#   export AGENT_API_URL=...               # optional
#   export AGENT_INTERNAL_API_KEY=...      # optional
#   export ENABLE_AGENT_FORWARDING=false   # optional
#   export SUPABASE_SERVICE_ROLE_KEY=...   # optional; only if required server-side
#   ./scripts/setup-vercel-mvp-secrets.sh

VERCEL_ENVIRONMENT="${VERCEL_ENVIRONMENT:-production}"

required_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  INTERNAL_AGENT_WEBHOOK_SECRET
)

for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required env var: $v"
    exit 1
  fi
done

set_secret() {
  local key="$1"
  local val="$2"
  vercel env rm "${key}" "${VERCEL_ENVIRONMENT}" -y >/dev/null 2>&1 || true
  printf '%s' "${val}" | vercel env add "${key}" "${VERCEL_ENVIRONMENT}"
}

echo "Setting required Vercel env vars in ${VERCEL_ENVIRONMENT}..."
set_secret NEXT_PUBLIC_SUPABASE_URL "${NEXT_PUBLIC_SUPABASE_URL}"
set_secret NEXT_PUBLIC_SUPABASE_ANON_KEY "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
set_secret INTERNAL_AGENT_WEBHOOK_SECRET "${INTERNAL_AGENT_WEBHOOK_SECRET}"

if [[ -n "${AGENT_API_URL:-}" ]]; then
  set_secret AGENT_API_URL "${AGENT_API_URL}"
fi

if [[ -n "${AGENT_INTERNAL_API_KEY:-}" ]]; then
  set_secret AGENT_INTERNAL_API_KEY "${AGENT_INTERNAL_API_KEY}"
fi

if [[ -n "${ENABLE_AGENT_FORWARDING:-}" ]]; then
  set_secret ENABLE_AGENT_FORWARDING "${ENABLE_AGENT_FORWARDING}"
fi

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Warning: setting SUPABASE_SERVICE_ROLE_KEY in Vercel. Keep this server-only."
  set_secret SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY}"
fi

echo "Done."
echo "Never set NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY or INGESTION_WORKER_SECRET in Vercel."
