#!/usr/bin/env bash
# Sync GitHub Actions secrets → Fly.io app secrets, per app, least-privilege.
#
#   scripts/ci/fly_secrets.sh <core-api|ingestion-worker|api-gateway> [--check-only]
#
# Values are read from the PROCESS ENVIRONMENT, which the workflow populates from `secrets.*`. Nothing is
# passed on the command line (argv is world-readable via /proc on many systems) and no value is ever
# echoed — failures report NAMES only.
#
# WHY A SCRIPT AND NOT INLINE WORKFLOW YAML
# -----------------------------------------
# Three things need to be true and stay true, and none of them survives being spread across three copies
# of a `flyctl secrets set` line in YAML:
#
#   1. LEAST PRIVILEGE PER APP. api-gateway must NOT receive SUPABASE_SERVICE_ROLE_KEY. That key bypasses
#      every RLS policy in the project, and the gateway has zero Supabase read sites — the three Supabase
#      vars were deliberately removed from it (GATEWAY_PRIVILEGE_REDUCTION.md). A "sync all secrets to all
#      apps" step would silently hand it back, undoing that work with no diff to review. The manifests
#      below are the enforcement.
#
#   2. MISSING SECRETS MUST FAIL LOUDLY. An unset GitHub secret expands to an EMPTY STRING, not an error.
#      `flyctl secrets set QDRANT_API_KEY=` would cheerfully deploy an app that cannot reach Qdrant, and
#      the failure surfaces later as "retrieval returned nothing" — indistinguishable from a user with no
#      data. This is the same shape as the traversal defect, and it is worth refusing to deploy over.
#
#   3. IT MUST BE RUNNABLE LOCALLY. `--check-only` validates a manifest without touching Fly, so the
#      mapping can be verified before a deploy rather than during one.
#
# STAGED, NOT LIVE
# ----------------
# Secrets are staged (`--stage`), so no machine restarts on `set`. The subsequent `flyctl deploy` applies
# them in one release with the image. Setting secrets live would restart the app once per invocation and
# leave a window where new code has not shipped but new config has.
set -uo pipefail

APP_KEY="${1:-}"
MODE="${2:-}"

usage() { echo "usage: $0 <core-api|ingestion-worker|api-gateway> [--check-only]" >&2; exit 2; }
[[ -n "${APP_KEY}" ]] || usage

# ── Per-app manifests ────────────────────────────────────────────────────────────────────────────
# REQUIRED: deploy is refused if unset or empty.
# OPTIONAL: forwarded when present, skipped silently when absent (feature flags, tunables).
#
# Non-secret configuration (collection names, model ids, log level, flags) lives in each app's fly.toml
# [env] block, NOT here. Config belongs in a reviewable file; only credentials belong in a secret store.

case "${APP_KEY}" in
  core-api)
    FLY_APP="lifenavigator-core-api"
    REQUIRED=(SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_JWT_SECRET SUPABASE_SERVICE_ROLE_KEY
              GEMINI_API_KEY QDRANT_URL QDRANT_API_KEY NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD)
    OPTIONAL=(PLAID_CLIENT_ID PLAID_CLIENT_SECRET PLAID_ENV
              GRAPH_GROUNDING_ENABLED GRAPH_RETRIEVAL_V2
              MODEL_PROVIDER VERTEX_PROJECT VERTEX_REGION VERTEX_MODEL
              PRIVATE_BETA_ENABLED PRIVATE_BETA_ALLOWLIST ADMIN_EMAILS)
    ;;
  ingestion-worker)
    FLY_APP="lifenavigator-ingestion-worker"
    # The worker is the only service that legitimately holds BOTH the service-role key and write access
    # to all three stores — it is the ingestion path. It needs no JWT secret: it verifies no user tokens.
    REQUIRED=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
              GEMINI_API_KEY QDRANT_URL QDRANT_API_KEY NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD)
    OPTIONAL=(WORKER_BATCH_SIZE WORKER_MAX_RETRIES WORKER_POLL_INTERVAL_SECONDS)
    ;;
  api-gateway)
    FLY_APP="lifenavigator-api-gateway"
    # DELIBERATELY MINIMAL. This service only VERIFIES the HS256 JWT that Supabase Auth already issued;
    # it never calls Supabase. SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY were removed on 2026-07-29
    # after an audit found zero read sites (GATEWAY_PRIVILEGE_REDUCTION.md), and app/config.py raises if
    # code reaches for them. Do not add them back here — that is the whole point of a per-app manifest.
    REQUIRED=(SUPABASE_JWT_SECRET GEMINI_API_KEY QDRANT_URL QDRANT_API_KEY
              NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD)
    OPTIONAL=()
    ;;
  *) usage ;;
esac

echo "app: ${FLY_APP}"
echo "required: ${#REQUIRED[@]}   optional: ${#OPTIONAL[@]}"

# ── Validate ────────────────────────────────────────────────────────────────────────────────────
MISSING=()
for name in "${REQUIRED[@]}"; do
  value="${!name:-}"
  [[ -n "${value}" ]] || MISSING+=("${name}")
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  {
    echo
    echo "FAIL: ${#MISSING[@]} required secret(s) are unset or empty for ${FLY_APP}:"
    printf '  · %s\n' "${MISSING[@]}"
    echo
    echo "An unset GitHub secret expands to an empty string rather than an error, so deploying now would"
    echo "produce a running app that silently cannot reach one of its stores. Refusing."
    echo
    echo "Set them at: Settings → Secrets and variables → Actions → repository secrets."
    echo "Names must match EXACTLY (they are case-sensitive)."
  } >&2
  exit 1
fi

PRESENT_OPTIONAL=()
for name in "${OPTIONAL[@]}"; do
  [[ -n "${!name:-}" ]] && PRESENT_OPTIONAL+=("${name}")
done

echo "validated: all ${#REQUIRED[@]} required present"
[[ ${#PRESENT_OPTIONAL[@]} -gt 0 ]] \
  && echo "optional supplied: ${PRESENT_OPTIONAL[*]}" \
  || echo "optional supplied: none"

if [[ "${MODE}" == "--check-only" ]]; then
  echo "check-only: not contacting Fly."
  exit 0
fi

command -v flyctl >/dev/null 2>&1 || { echo "FAIL: flyctl not found on PATH." >&2; exit 1; }
[[ -n "${FLY_API_TOKEN:-}" ]] || { echo "FAIL: FLY_API_TOKEN is unset — cannot authenticate." >&2; exit 1; }

# ── Stage ───────────────────────────────────────────────────────────────────────────────────────
# Built in-process and piped to `flyctl secrets import` on STDIN: values never appear in argv, in
# `set -x` output, or in a temp file. `--stage` defers application to the next deploy.
{
  for name in "${REQUIRED[@]}" "${PRESENT_OPTIONAL[@]}"; do
    printf '%s=%s\n' "${name}" "${!name}"
  done
} | flyctl secrets import --stage -a "${FLY_APP}" >/dev/null

status=$?
if [[ ${status} -ne 0 ]]; then
  echo "FAIL: flyctl secrets import failed for ${FLY_APP} (exit ${status})." >&2
  exit "${status}"
fi

echo "staged $(( ${#REQUIRED[@]} + ${#PRESENT_OPTIONAL[@]} )) secret(s) on ${FLY_APP} — applied by the next deploy."
