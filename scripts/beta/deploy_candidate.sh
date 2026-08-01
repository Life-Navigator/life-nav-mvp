#!/usr/bin/env bash
#
# Deploy a release candidate to a NON-PRODUCTION target.
#
# WHY THIS EXISTS
#   deploy-fly.yml fires only on push to main, so the only way to see the candidate running was to
#   merge it first. That inverts the gate: R-1 (tenant isolation) must pass against the candidate
#   BEFORE it reaches main, and it cannot pass against something that was never deployed. This
#   script breaks the cycle by deploying an explicit SHA to a separate, disposable staging app.
#
# SAFETY POSTURE — this script refuses more than it accepts:
#   * --env is REQUIRED. No default. An ambiguous target is a hard error, never a guess.
#   * production is REFUSED outright. There is no flag here that reaches it; production deploys
#     remain the merge-to-main path, deliberately.
#   * GRAPH_GROUNDING_ENABLED is pinned false and re-asserted after deploy.
#   * Public registration stays disabled; access is restricted to the two synthetic beta accounts.
#   * Secrets are read from the environment and NEVER printed, echoed, or written to a file.
#
# USAGE
#   scripts/beta/deploy_candidate.sh --env staging --sha <full-40-char-sha> [--api] [--web] [--dry-run]
#   scripts/beta/deploy_candidate.sh --env staging --sha $(git rev-parse HEAD) --destroy
#
set -euo pipefail

STAGING_API_APP="lifenavigator-core-api-candidate"
FORBIDDEN_ENVS="production prod live"

ENVIRONMENT=""
CANDIDATE_SHA=""
DO_API=0
DO_WEB=0
DRY_RUN=0
DESTROY=0

die() { printf '\nERROR: %s\n\n' "$1" >&2; exit 1; }
info() { printf '  %s\n' "$1"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)      ENVIRONMENT="${2:-}"; shift 2 ;;
    --sha)      CANDIDATE_SHA="${2:-}"; shift 2 ;;
    --api)      DO_API=1; shift ;;
    --web)      DO_WEB=1; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --destroy)  DESTROY=1; shift ;;
    -h|--help)  sed -n '2,30p' "$0"; exit 0 ;;
    *)          die "unknown argument: $1" ;;
  esac
done

# ── fail closed on target ambiguity ───────────────────────────────────────────────────────────────
[[ -n "$ENVIRONMENT" ]] || die "--env is required. There is no default target: an ambiguous
  deployment target is exactly the mistake this script exists to prevent.
  Valid: staging | candidate"

for forbidden in $FORBIDDEN_ENVS; do
  if [[ "${ENVIRONMENT,,}" == "$forbidden" ]]; then
    die "REFUSING: '$ENVIRONMENT' is a production target.
  This script deploys candidates only. Production deploys go through merge-to-main, which is
  gated on R-1 passing against the candidate first."
  fi
done

case "${ENVIRONMENT,,}" in
  staging|candidate) ;;
  *) die "unrecognised --env '$ENVIRONMENT'. Valid: staging | candidate" ;;
esac

# ── candidate SHA must be explicit and real ───────────────────────────────────────────────────────
[[ -n "$CANDIDATE_SHA" ]] || die "--sha is required (full 40-character commit SHA).
  Deploying 'whatever is checked out' is how an audited commit and a deployed commit diverge."

[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "--sha must be a full 40-character lowercase SHA.
  Short SHAs and branch names are refused: they are not stable identifiers."

git cat-file -e "${CANDIDATE_SHA}^{commit}" 2>/dev/null \
  || die "SHA $CANDIDATE_SHA does not exist in this repository"

# ── teardown path ─────────────────────────────────────────────────────────────────────────────────
if [[ $DESTROY -eq 1 ]]; then
  echo
  echo "TEARDOWN — temporary candidate infrastructure"
  info "fly app to destroy: $STAGING_API_APP"
  if [[ $DRY_RUN -eq 1 ]]; then info "(dry-run) would run: flyctl apps destroy $STAGING_API_APP --yes"; exit 0; fi
  [[ -n "${FLY_API_TOKEN:-}" ]] || die "FLY_API_TOKEN is not set (name only; never paste the value)"
  flyctl apps destroy "$STAGING_API_APP" --yes
  echo "Destroyed. Vercel preview deployments expire on their own; delete explicitly if required."
  exit 0
fi

[[ $DO_API -eq 1 || $DO_WEB -eq 1 ]] || die "specify at least one of --api / --web"

BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo
echo "CANDIDATE DEPLOYMENT"
info "environment    : $ENVIRONMENT"
info "candidate sha  : $CANDIDATE_SHA"
info "build time     : $BUILD_TIME"
info "api target     : $([[ $DO_API -eq 1 ]] && echo "$STAGING_API_APP" || echo skipped)"
info "web target     : $([[ $DO_WEB -eq 1 ]] && echo 'vercel preview (non-production)' || echo skipped)"
info "graph grounding: false (pinned)"
info "dry run        : $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo

# ── credential presence: NAMES ONLY, never values ─────────────────────────────────────────────────
# A dry run must never need credentials — that is what makes it runnable in CI as a safety gate.
missing=()
[[ $DO_API -eq 1 && -z "${FLY_API_TOKEN:-}"  ]] && missing+=("FLY_API_TOKEN")
[[ $DO_WEB -eq 1 && -z "${VERCEL_TOKEN:-}"   ]] && missing+=("VERCEL_TOKEN")
if [[ ${#missing[@]} -gt 0 ]]; then
  printf 'MISSING ENVIRONMENT VARIABLES (names only):\n'
  printf '  - %s\n' "${missing[@]}"
  if [[ $DRY_RUN -eq 0 ]]; then
    die "supply them in the environment; never paste values into a prompt or a file"
  fi
  info "(dry-run) continuing without credentials — nothing will be executed"
fi

# ── API: temporary Fly app, explicit SHA baked into the image ─────────────────────────────────────
if [[ $DO_API -eq 1 ]]; then
  echo "── core-api -> $STAGING_API_APP"
  API_CMD=(flyctl deploy apps/lifenavigator-core-api
    --app "$STAGING_API_APP"
    --build-arg "LN_COMMIT_SHA=$CANDIDATE_SHA"
    --build-arg "LN_BUILD_TIME=$BUILD_TIME"
    --build-arg "LN_ENVIRONMENT=$ENVIRONMENT"
    --env "GRAPH_GROUNDING_ENABLED=false"
    --env "PRIVATE_BETA_ENABLED=true"
    --strategy immediate)

  if [[ $DRY_RUN -eq 1 ]]; then
    info "(dry-run) ${API_CMD[*]}"
  else
    "${API_CMD[@]}"
    # Re-assert the flag from the running app, not from our own intent.
    info "verifying GRAPH_GROUNDING_ENABLED remained false..."
    flyctl ssh console -a "$STAGING_API_APP" -C 'printenv GRAPH_GROUNDING_ENABLED' \
      | grep -qx 'false' || die "GRAPH_GROUNDING_ENABLED is not false on $STAGING_API_APP — ABORT"
    info "confirmed false"
  fi
fi

# ── WEB: Vercel PREVIEW. --prod is never passed, anywhere in this file. ───────────────────────────
if [[ $DO_WEB -eq 1 ]]; then
  echo "── web -> vercel preview"
  WEB_CMD=(vercel deploy apps/web
    --token "\$VERCEL_TOKEN"          # placeholder in display only; real value never echoed
    --build-env "NEXT_PUBLIC_LN_COMMIT_SHA=$CANDIDATE_SHA"
    --build-env "NEXT_PUBLIC_LN_BUILD_TIME=$BUILD_TIME"
    --build-env "NEXT_PUBLIC_LN_ENVIRONMENT=$ENVIRONMENT"
    --yes)

  if [[ $DRY_RUN -eq 1 ]]; then
    info "(dry-run) ${WEB_CMD[*]}"
    info "(dry-run) note: --prod is NEVER passed; this is a preview deployment by construction"
  else
    vercel deploy apps/web \
      --token "$VERCEL_TOKEN" \
      --build-env "NEXT_PUBLIC_LN_COMMIT_SHA=$CANDIDATE_SHA" \
      --build-env "NEXT_PUBLIC_LN_BUILD_TIME=$BUILD_TIME" \
      --build-env "NEXT_PUBLIC_LN_ENVIRONMENT=$ENVIRONMENT" \
      --yes
  fi
fi

echo
echo "Next: verify BOTH tiers report $CANDIDATE_SHA before running any gate."
echo "  CANDIDATE_SHA=$CANDIDATE_SHA \\"
echo "  API_BASE_URL=https://$STAGING_API_APP.fly.dev WEB_BASE_URL=<preview-url> \\"
echo "  python3 scripts/beta/harness/verify_deployed_sha.py"
echo
echo "Teardown when finished:  $0 --env $ENVIRONMENT --sha $CANDIDATE_SHA --destroy"
