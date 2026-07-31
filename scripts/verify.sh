#!/usr/bin/env bash
# Deterministic verification of the beta-critical packages. No credentials, no network stores.
#
#   scripts/verify.sh            beta-critical only (must be green)
#   scripts/verify.sh --all      + non-beta packages (mobile is KNOWN RED — see docs/beta/CI_BASELINE.md)
#
# Every store is faked in these suites. They prove CONTRACT behaviour, never live integration.
set -uo pipefail
cd "$(dirname "$0")/.."
ALL=0; [ "${1:-}" = "--all" ] && ALL=1
FAILED=(); PASSED=()

run() { # run <label> <dir> <cmd...>
  local label="$1" dir="$2"; shift 2
  printf '\n\033[1m── %s\033[0m\n' "$label"
  if (cd "$dir" && "$@"); then PASSED+=("$label"); else FAILED+=("$label"); fi
}

# ── beta-critical ────────────────────────────────────────────────────────────
run "web · lint"                 . pnpm --filter @life-navigator/web run lint
run "web · type-check"           . pnpm --filter @life-navigator/web run type-check
run "web · unit tests"           . pnpm --filter @life-navigator/web run test
run "core-api · tests"           apps/lifenavigator-core-api .venv/bin/python -m pytest tests/ -q
run "worker · tests + drift gates" apps/ingestion-worker cargo test --lib

if [ "$ALL" = "1" ]; then
  printf '\n\033[33m── non-beta packages (mobile is KNOWN RED: broken tsconfig paths, 0 tests, no runner)\033[0m\n'
  run "mobile · lint"       . pnpm --filter @life-navigator/mobile run lint
  run "mobile · type-check" . pnpm --filter @life-navigator/mobile run type-check
fi

printf '\n\033[1m════ SUMMARY ════\033[0m\n'
for p in "${PASSED[@]:-}"; do [ -n "$p" ] && printf '  \033[32m✓\033[0m %s\n' "$p"; done
for f in "${FAILED[@]:-}"; do [ -n "$f" ] && printf '  \033[31m✗\033[0m %s\n' "$f"; done
if [ "${#FAILED[@]}" -gt 0 ]; then printf '\n\033[31mFAILED: %d\033[0m\n' "${#FAILED[@]}"; exit 1; fi
printf '\n\033[32mAll verified.\033[0m\n'
