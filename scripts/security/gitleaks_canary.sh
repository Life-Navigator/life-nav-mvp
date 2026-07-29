#!/usr/bin/env bash
# Canary test for the secret scanner — proves the control detects the threat it claims to cover.
#
# WHY THIS EXISTS
# ---------------
# Two credentials leaked into this repository while a secret-scanning job ran green on every commit:
#
#   LN-SEC-2026-0729-01  a synthetic-account password, live ~30 days
#   LN-SEC-2026-0729-02  the PRODUCTION Supabase database password, public on origin/main ~5 weeks
#
# In both cases the scanner was configured, running, and passing. TruffleHog's `--only-verified` reports
# a secret only when it can verify it against a provider API; our own application passwords have no
# verifier, so they were invisible by design. A green check meant "nothing verifiable was found", but it
# was read as "there are no secrets here".
#
# The lesson recorded in CREDENTIAL_INCIDENT_REPORT.md is that a control must be TESTED AGAINST THE
# THREAT IT CLAIMS TO COVER. A passing scan is not evidence the scanner works; it is equally consistent
# with the scanner being broken, misconfigured, or pointed at the wrong ruleset. The only way to tell the
# difference is to hand it something it MUST catch and fail the build if it does not.
#
# This plants benign, obviously-fake credentials shaped like the ones that actually leaked, runs gitleaks
# over them, and fails if any goes undetected. It is the Phase 11 exit criterion from
# REMEDIATION_MASTER_PLAN.md, brought forward because it is cheap and both incidents are recent.
#
# The planted values are fake and are scrubbed on exit whether the script passes, fails, or is
# interrupted.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="${REPO_ROOT}/.gitleaks.toml"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT INT TERM

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "FAIL: gitleaks is not installed — the canary cannot verify a scanner that is not there." >&2
  echo "      Install: https://github.com/gitleaks/gitleaks#installing" >&2
  exit 1
fi

# Each canary is: <name>|<file>|<content>. Values are fabricated — no real credential appears here.
# They mirror the SHAPES that actually leaked, not the values.
write_canary() {
  local name="$1" file="$2" content="$3"
  printf '%s\n' "$content" > "${WORKDIR}/${file}"
  echo "$name|${file}"
}

CANARIES=()
# 1. The LN-SEC-2026-0729-02 shape: Supabase pooler connection string with an inline password.
CANARIES+=("$(write_canary "supabase-pooler-connection-string" "runbook.md" \
  "psql 'postgres://postgres.abcdefghijklmnopqrst:Fak3CanaryPw99@aws-1-us-east-1.pooler.supabase.com:6543/postgres'")")
# 2. The LN-SEC-2026-0729-01 shape: a hardcoded fallback to an env lookup.
CANARIES+=("$(write_canary "env-fallback-credential" "verify.py" \
  'PW = os.environ.get("BETA_GATE_PW", "CanaryFallback8821")')")
# 3. A credential-named variable assigned a literal.
CANARIES+=("$(write_canary "assigned-credential-literal" "config.ts" \
  'const SUPABASE_SERVICE_KEY = "canary-not-a-real-key-2f8a1c";')")
# 4. A service-role-shaped JWT — the highest-impact secret in the system (bypasses RLS).
CANARIES+=("$(write_canary "supabase-service-role-jwt" "token.txt" \
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.Q0FOQVJZX05PVF9SRUFMX1RPS0VOX0ZPUl9URVNUSU5H.c2lnbmF0dXJl')")

echo "gitleaks canary — verifying the scanner detects ${#CANARIES[@]} known-bad credential shapes"
echo

REPORT="${WORKDIR}/report.json"
gitleaks detect --source "${WORKDIR}" --config "${CONFIG}" --no-git \
  --report-format json --report-path "${REPORT}" --redact --no-banner >/dev/null 2>&1 || true

if [[ ! -f "${REPORT}" ]]; then
  echo "FAIL: gitleaks produced no report — the scanner did not run." >&2
  exit 1
fi

DETECTED="$(python3 -c "
import json,sys
try: d=json.load(open('${REPORT}'))
except Exception: sys.exit(0)
print('\n'.join(sorted({x.get('RuleID','') for x in d})))
")"

FAILED=0
for entry in "${CANARIES[@]}"; do
  name="${entry%%|*}"
  if grep -qx -- "${name}" <<< "${DETECTED}"; then
    echo "  ✓ detected  ${name}"
  else
    echo "  ✗ MISSED    ${name}"
    FAILED=1
  fi
done

echo
if [[ ${FAILED} -ne 0 ]]; then
  cat >&2 <<'MSG'
FAIL: the secret scanner did not detect every planted credential.

A rule was removed, an allowlist entry grew too broad, or the config failed to load. Until this passes,
a green "Secrets Scan" on this repository means nothing — which is exactly the condition under which two
credentials leaked while CI reported success.

Fix the rule or narrow the allowlist. Do NOT weaken this canary to make it pass.
MSG
  exit 1
fi

echo "PASS: every planted credential shape was detected — the scanner is doing its job."
