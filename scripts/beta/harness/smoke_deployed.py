#!/usr/bin/env python3
"""Deployed readiness + dependency smoke, and the flag-state assertion.

Unauthenticated portions run today. Authenticated portions need synthetic-user credentials.
Nothing here mutates anything.
"""
from __future__ import annotations

import os
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _safe import emit  # noqa: E402

GATE = "smoke"

UNAUTH = [
    ("api.healthz", "https://lifenavigator-core-api.fly.dev/healthz"),
    ("api.readyz",  "https://lifenavigator-core-api.fly.dev/readyz"),
    ("web.home",    "https://lifenavigator.tech"),
]

# Require auth; listed so the gate table shows what is NOT yet covered.
AUTHED = ["auth.login", "advisor.chat", "report.submit", "consent.record",
          "download.document", "flags.state", "version.sha"]


def probe(name: str, url: str) -> dict:
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            body = r.read(2000).decode("utf-8", "replace")
            return {"name": name, "status": r.status,
                    "latency_s": round(time.monotonic() - t0, 3), "body": body[:400]}
    except Exception as exc:                                   # noqa: BLE001
        return {"name": name, "status": None, "error": type(exc).__name__,
                "latency_s": round(time.monotonic() - t0, 3)}


def main() -> int:
    results = [probe(n, u) for n, u in UNAUTH]

    readyz = next((r for r in results if r["name"] == "api.readyz"), {})
    deps_ok = all(t in (readyz.get("body") or "") for t in
                  ('"supabase":true', '"qdrant":true', '"neo4j":true', '"gemini":true'))

    emit(GATE, "deployed-smoke", {
        "gate": "SMOKE deployed dependencies",
        "unauthenticated": results,
        "all_dependencies_healthy": deps_ok,
        "authenticated_checks_pending": AUTHED,
        "graph_grounding_expected": "false",
        "graph_grounding_observed": "REQUIRES FLY_API_TOKEN — cannot read runtime flags "
                                    "without platform access",
        "verdict": "PARTIAL — unauthenticated only",
        "note": "A healthy /readyz proves dependencies are reachable from the API. It proves "
                "nothing about tenant isolation or answer quality.",
    })
    print(f"smoke: dependencies_healthy={deps_ok}")
    return 0 if deps_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
