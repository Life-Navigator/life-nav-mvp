#!/usr/bin/env python3
"""R-5 — prove the deployed SHA on BOTH tiers equals the reviewed candidate SHA.

Consumes the release-identity endpoints added in Prompt 1A:

    core-api   GET /version           -> {"service","commit_sha","build_time","environment",...}
    web        GET /api/version       -> same shape, service "lifenavigator-web"
                                         (also sets X-LifeNavigator-Commit)

Both endpoints return 503 in staging/production when no SHA was injected at build time, so "I could
not prove it" is a loud failure rather than a silent "unknown".

This closes the Prompt 0 finding that the deployed SHA was unprovable without platform credentials:
an auditor can now answer "is the reviewed commit the running commit?" with nothing but curl.

USAGE
    CANDIDATE_SHA=<40-char sha> \
    API_BASE_URL=https://lifenavigator-core-api-candidate.fly.dev \
    WEB_BASE_URL=https://<preview>.vercel.app \
    python3 scripts/beta/harness/verify_deployed_sha.py

Exit 0 only when every configured tier reports exactly CANDIDATE_SHA.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _safe import emit  # noqa: E402

GATE = "r5-sha-proof"


def _get(url: str, timeout: int = 20) -> tuple[int | None, str, dict]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read(8000).decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as exc:                      # noqa: PERF203
        return exc.code, exc.read(2000).decode("utf-8", "replace"), dict(exc.headers or {})
    except Exception as exc:                                   # noqa: BLE001
        return None, f"{type(exc).__name__}", {}


def check_tier(name: str, url: str, expected_sha: str) -> dict:
    """Read one tier's release identity and compare it to the candidate."""
    status, body, headers = _get(url)
    result: dict = {"tier": name, "url": url, "http_status": status}

    if status == 503:
        result.update(verdict="FAIL",
                      reason="tier returned 503 — no SHA was injected at build time",
                      detail=body[:300])
        return result
    if status != 200:
        result.update(verdict="FAIL", reason=f"unexpected HTTP {status}", detail=body[:300])
        return result

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        result.update(verdict="FAIL", reason="response was not JSON", detail=body[:200])
        return result

    reported = str(payload.get("commit_sha", "")).strip()
    result.update(
        reported_sha=reported,
        build_time=payload.get("build_time"),
        environment=payload.get("environment"),
        service=payload.get("service"),
        commit_header=headers.get("X-LifeNavigator-Commit"),
    )

    if not reported:
        result.update(verdict="FAIL", reason="no commit_sha in payload")
    elif reported == "development-unbuilt":
        result.update(verdict="FAIL",
                      reason="tier is serving an unbuilt development placeholder")
    elif expected_sha and reported != expected_sha:
        result.update(verdict="FAIL",
                      reason="DEPLOYED SHA DOES NOT MATCH THE CANDIDATE",
                      expected_sha=expected_sha)
    elif not expected_sha:
        result.update(verdict="INCONCLUSIVE", reason="CANDIDATE_SHA not set — nothing to compare")
    else:
        result.update(verdict="PASS")
    return result


def main() -> int:
    expected = (os.environ.get("CANDIDATE_SHA") or "").strip()
    api_base = (os.environ.get("API_BASE_URL") or "").rstrip("/")
    web_base = (os.environ.get("WEB_BASE_URL") or "").rstrip("/")

    if not api_base and not web_base:
        sys.stderr.write("\nMISSING ENVIRONMENT VARIABLES (names only):\n"
                         "  - API_BASE_URL and/or WEB_BASE_URL\n"
                         "  - CANDIDATE_SHA (required for a comparison verdict)\n\n")
        return 3

    checks = []
    if api_base:
        checks.append(check_tier("core-api", f"{api_base}/version", expected))
    if web_base:
        checks.append(check_tier("web", f"{web_base}/api/version", expected))

    failed = [c for c in checks if c["verdict"] != "PASS"]
    verdict = "PASS" if checks and not failed else "FAIL"

    emit(GATE, "sha-proof", {
        "gate": "R-5 deployed SHA proof",
        "expected_candidate_sha": expected or "<unset>",
        "tiers_checked": len(checks),
        "checks": checks,
        "verdict": verdict,
        "note": "Both tiers must report the candidate SHA. A 503 means the build forgot to inject "
                "it — that is a failure, not an unknown.",
    })

    for c in checks:
        print(f"  {c['tier']:<10} {c['verdict']:<12} {c.get('reported_sha', c.get('reason', ''))}")
    print(f"R-5 verdict: {verdict}")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
