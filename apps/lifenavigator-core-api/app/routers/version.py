"""Release identity.

/version — WHAT COMMIT IS ACTUALLY RUNNING. Nothing else.

Why this exists: the 2026-07-30 beta audit could not verify Gate H ("deployment confidence") because
the deployed SHA was unprovable — /healthz reports liveness and carries no build identity, and the
web tier exposed no commit header either. An auditor with no platform credentials had no way to
answer "is the reviewed commit the running commit?", which makes every other gate result provisional:
a gate passed against an unknown build proves nothing.

DESIGN CONSTRAINTS (all load-bearing, do not relax without re-reading the audit):

1. The SHA is INJECTED AT BUILD TIME via the LN_COMMIT_SHA build-arg -> env var. It is never read
   from a git working directory at runtime. The container has no .git, and a runtime git read would
   report the SHA of whatever tree the process happens to sit in — which in a container is a lie by
   construction, and in a dev shell is the *uncommitted* tree.

2. STAGING AND PRODUCTION FAIL LOUDLY on a missing SHA (503). An endpoint whose whole purpose is
   proving identity must never answer "unknown" in an environment where identity is a gate. A silent
   "unknown" would be worse than a 404 — it looks like an answer.

3. Local development is allowed a clearly-labelled placeholder so nobody has to fake a build.

4. NO INFRASTRUCTURE DETAIL. No hostnames, no account/project ids, no database names, no private
   URLs, no dependency status. This endpoint is intentionally readable by anyone who can reach the
   service; the moment it carries infra detail it becomes a reconnaissance surface. Dependency health
   already lives at /readyz and stays there.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["version"])

# Environments where an unproven identity is a hard failure rather than a curiosity.
_IDENTITY_REQUIRED = {"production", "staging", "candidate"}

_DEV_PLACEHOLDER = "development-unbuilt"


def _environment() -> str:
    return (os.environ.get("LN_ENVIRONMENT") or "development").strip().lower()


def _release_identity() -> dict[str, str]:
    """Build the identity payload, or raise 503 where identity is mandatory."""
    environment = _environment()
    commit_sha = (os.environ.get("LN_COMMIT_SHA") or "").strip()
    build_time = (os.environ.get("LN_BUILD_TIME") or "").strip()
    version = (os.environ.get("LN_APP_VERSION") or "").strip()

    if not commit_sha:
        if environment in _IDENTITY_REQUIRED:
            # Loud, not silent. See constraint 2.
            raise HTTPException(
                status_code=503,
                detail=(
                    "release identity unavailable: LN_COMMIT_SHA was not injected at build time "
                    f"and environment '{environment}' requires a provable commit"
                ),
            )
        commit_sha = _DEV_PLACEHOLDER

    payload = {
        "service": "lifenavigator-core-api",
        "commit_sha": commit_sha,
        "build_time": build_time or "unknown",
        "environment": environment,
    }
    if version:
        payload["version"] = version
    return payload


@router.get("/version")
def version() -> dict[str, str]:
    return _release_identity()
