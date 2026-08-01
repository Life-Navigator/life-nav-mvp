#!/usr/bin/env bash
#
# Apply the beta migrations to an EXPLICIT environment, in timestamp order, with a real dry run.
#
# SAFETY POSTURE
#   * --env is REQUIRED. No default target, ever.
#   * production is refused unless --i-am-sure-production is ALSO passed. Two independent flags,
#     because a single flag is one typo away from a production DDL.
#   * --dry-run / --status inspect without applying and need no credentials for the listing.
#   * Filenames are printed. Connection strings, passwords and tokens NEVER are.
#   * No automatic destructive rollback. If a migration fails, this script stops and tells you to
#     read rollback-plan.md — it does not start dropping things on your behalf.
#
# USAGE
#   scripts/beta/apply_migrations.sh --env staging --dry-run
#   scripts/beta/apply_migrations.sh --env staging --status
#   scripts/beta/apply_migrations.sh --env staging
#   scripts/beta/apply_migrations.sh --env production --i-am-sure-production   # refused elsewhere in Prompt 1A
#
set -euo pipefail

# Timestamp order is the dependency order: M3's FK requires M2's table to exist.
MIGRATIONS=(
  "20260728000000_advisor_turns_sources.sql"
  "20260731000000_advisor_response_reports.sql"
  "20260731010000_response_report_review.sql"
)

MIGRATION_DIR="supabase/migrations"
ENVIRONMENT=""
DRY_RUN=0
STATUS=0
PROD_CONFIRMED=0

die() { printf '\nERROR: %s\n\n' "$1" >&2; exit 1; }
info() { printf '  %s\n' "$1"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)                    ENVIRONMENT="${2:-}"; shift 2 ;;
    --dry-run)                DRY_RUN=1; shift ;;
    --status)                 STATUS=1; shift ;;
    --i-am-sure-production)   PROD_CONFIRMED=1; shift ;;
    -h|--help)                sed -n '2,20p' "$0"; exit 0 ;;
    *)                        die "unknown argument: $1" ;;
  esac
done

[[ -n "$ENVIRONMENT" ]] || die "--env is required. There is no default: an ambiguous migration
  target is how staging DDL reaches production.
  Valid: staging | candidate | production"

case "${ENVIRONMENT,,}" in
  staging|candidate) ;;
  production|prod)
    if [[ $PROD_CONFIRMED -eq 0 ]]; then
      die "REFUSING production without --i-am-sure-production.
  Two independent flags are required because one flag is one typo away from production DDL.
  Before you pass it: confirm a PITR/backup timestamp and read
  docs/beta-readiness/2026-08-02/rollback-plan.md §0."
    fi
    ;;
  *) die "unrecognised --env '$ENVIRONMENT'" ;;
esac

echo
echo "MIGRATIONS — environment: $ENVIRONMENT"
echo

# ── listing needs no credentials: filenames only, never connection details ────────────────────────
idx=0
for m in "${MIGRATIONS[@]}"; do
  idx=$((idx + 1))
  path="$MIGRATION_DIR/$m"
  [[ -f "$path" ]] || die "migration file missing: $path"
  size=$(wc -l < "$path")
  # Report what the migration DOES, from its own text — additive checks, not trust.
  destructive=""
  grep -qiE '^\s*(drop|truncate)\s+(table|column|schema)' "$path" && destructive=" ⚠ CONTAINS DROP/TRUNCATE"
  printf '  %d. %-52s %4s lines%s\n' "$idx" "$m" "$size" "$destructive"
done
echo

if [[ $STATUS -eq 1 || $DRY_RUN -eq 1 ]]; then
  echo "Applied-state inspection and application both require SUPABASE_DB_URL."
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "MISSING ENVIRONMENT VARIABLES (names only):"
    echo "  - SUPABASE_DB_URL"
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    echo
    echo "(dry-run) would apply the ${#MIGRATIONS[@]} migrations above, in the order shown."
    echo "(dry-run) nothing was executed."
  fi
  if [[ $STATUS -eq 1 && -n "${SUPABASE_DB_URL:-}" ]]; then
    echo
    echo "Applied state (verification SQL from migration-review.md):"
    psql "$SUPABASE_DB_URL" -Atc "
      SELECT 'advisor_turns.sources: ' || COALESCE((SELECT 'PRESENT' FROM information_schema.columns
        WHERE table_schema='analytics' AND table_name='advisor_turns' AND column_name='sources'), 'ABSENT');
      SELECT 'feedback.advisor_response_reports: ' || COALESCE((SELECT 'PRESENT' FROM information_schema.tables
        WHERE table_schema='feedback' AND table_name='advisor_response_reports'), 'ABSENT');
      SELECT 'feedback.advisor_report_events: ' || COALESCE((SELECT 'PRESENT' FROM information_schema.tables
        WHERE table_schema='feedback' AND table_name='advisor_report_events'), 'ABSENT');
    " 2>&1 | sed 's/^/  /'
  fi
  exit 0
fi

# ── real application ──────────────────────────────────────────────────────────────────────────────
[[ -n "${SUPABASE_DB_URL:-}" ]] || {
  echo "MISSING ENVIRONMENT VARIABLES (names only):"
  echo "  - SUPABASE_DB_URL"
  die "supply it in the environment; never paste the value"
}

APPLIED_LOG="docs/beta-readiness/2026-08-02/evidence/migrations/applied-${ENVIRONMENT}.txt"
mkdir -p "$(dirname "$APPLIED_LOG")"

for m in "${MIGRATIONS[@]}"; do
  echo "── applying $m"
  # Each file is a single DDL batch; --single-transaction makes a partial apply impossible.
  if psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$MIGRATION_DIR/$m" >/dev/null; then
    printf '%s  %s  APPLIED\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$m" >> "$APPLIED_LOG"
    info "applied"
  else
    printf '%s  %s  FAILED\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$m" >> "$APPLIED_LOG"
    die "migration $m FAILED and the transaction rolled back.
  Applied migrations before this point remain applied — that is intended, they are additive.
  DO NOT attempt an automatic rollback. Read docs/beta-readiness/2026-08-02/rollback-plan.md §4."
  fi
done

echo
echo "All ${#MIGRATIONS[@]} migrations applied to $ENVIRONMENT."
echo "Record: $APPLIED_LOG   (filenames + timestamps only; no connection details)"
