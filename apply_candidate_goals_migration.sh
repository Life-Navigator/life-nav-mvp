#!/usr/bin/env bash
# Apply the life.candidate_goals migration to PROD via the Supabase Management API.
# Requires a Supabase Management PAT (sbp_...). Run:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./apply_candidate_goals_migration.sh
set -euo pipefail
PROJECT_REF="diwkyyahglnqmyledsey"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN to your Supabase Management PAT (sbp_...)}"
SQL=$(cat supabase/migrations/20260611020000_life_candidate_goals.sql)
curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$(jq -nc --arg q "$SQL" '{query: $q}')"
echo ""
echo "→ verifying table exists…"
curl -sS -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$(jq -nc '{query: "select count(*) as candidate_goals_rows from life.candidate_goals"}')"
