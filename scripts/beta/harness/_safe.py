"""Shared safety layer for every beta-readiness harness.

Two jobs, both non-negotiable:

1. NOTHING secret reaches an evidence artifact. Every harness writes through `emit()`, which runs
   `redact()` over the whole payload. Redaction is a denylist of *value shapes* plus an explicit
   scrub of every environment variable value we know about — because the failure mode we care about
   is a token arriving somewhere we did not anticipate, not one we did.

2. Probes that are supposed to run as a USER fail closed if a service-role credential is anywhere in
   the environment. A service-role key bypasses RLS, which would make every isolation probe pass
   vacuously. See docs/beta-readiness/2026-08-02/credential-contract.md §C.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── environment variable names ONLY. No values live in this repository. ────────────────────────────
SECRET_ENV_NAMES = (
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY", "FLY_API_TOKEN", "VERCEL_TOKEN", "GH_TOKEN", "GITHUB_TOKEN",
    "QDRANT_API_KEY", "NEO4J_PASSWORD", "GEMINI_API_KEY",
    "BETA_SYNTHETIC_A_PASSWORD", "BETA_SYNTHETIC_B_PASSWORD",
)

# Value-shape denylist: catches tokens that arrive by a name we never listed.
_SHAPES = (
    (re.compile(r"\bey[JI][A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"), "<JWT>"),
    (re.compile(r"\bsbp_[A-Za-z0-9]{20,}"), "<SUPABASE_PAT>"),
    (re.compile(r"\bvcp_[A-Za-z0-9]{20,}"), "<VERCEL_TOKEN>"),
    (re.compile(r"\bFlyV1\s+fm2_[A-Za-z0-9+/=,]{20,}"), "<FLY_TOKEN>"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"), "<GH_TOKEN>"),
    (re.compile(r"\bpostgres(?:ql)?://[^\s\"']+"), "<DB_URL>"),
    (re.compile(r"\b(neo4j|bolt)(\+s{1,2}c?)?://[^\s\"']+"), "<NEO4J_URL>"),
    (re.compile(r"(?i)\b(authorization|api[-_]?key|password|secret|token|cookie)\b\s*[:=]\s*\S+"),
     r"\1=<REDACTED>"),
)

# Headers never written to evidence at all.
FORBIDDEN_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key", "apikey", "api-key"}


def redact(value: Any) -> Any:
    """Recursively scrub secrets from any JSON-able structure."""
    if isinstance(value, dict):
        return {
            k: ("<REDACTED>" if k.lower() in FORBIDDEN_HEADERS else redact(v))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(v) for v in value]
    if not isinstance(value, str):
        return value

    out = value
    # 1. Scrub known env values first — exact-match beats shape-matching.
    for name in SECRET_ENV_NAMES:
        actual = os.environ.get(name)
        if actual and len(actual) >= 8 and actual in out:
            out = out.replace(actual, f"<{name}>")
    # 2. Then shapes, for anything we did not anticipate.
    for pattern, repl in _SHAPES:
        out = pattern.sub(repl, out)
    return out


def require_no_service_role(harness: str) -> None:
    """Fail closed: user-identity probes must never hold an RLS-bypassing credential."""
    present = [n for n in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "SUPABASE_ACCESS_TOKEN")
               if os.environ.get(n)]
    if present:
        sys.stderr.write(
            f"\nREFUSING TO RUN — {harness}\n"
            f"  Service-role/admin credentials present in the environment: {', '.join(present)}\n"
            f"  This probe must authenticate as an ordinary user. A service-role key bypasses RLS,\n"
            f"  which would make every isolation check pass vacuously.\n"
            f"  Unset them and re-run.  See credential-contract.md §C.\n\n")
        raise SystemExit(2)


def require_env(*names: str) -> dict[str, str]:
    """Return the named vars, or exit reporting only the MISSING NAMES (never values)."""
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        sys.stderr.write(
            "\nMISSING REQUIRED ENVIRONMENT VARIABLES:\n"
            + "".join(f"  - {n}\n" for n in missing)
            + "\nSupply them as environment variables. Do not paste values into chat.\n\n")
        raise SystemExit(3)
    return {n: os.environ[n] for n in names}


def evidence_dir(gate: str) -> Path:
    root = Path(__file__).resolve().parents[3] / "docs/beta-readiness/2026-08-02/evidence" / gate
    root.mkdir(parents=True, exist_ok=True)
    return root


def emit(gate: str, name: str, payload: dict[str, Any]) -> Path:
    """Write redacted evidence with a UTC timestamp. The ONLY sanctioned artifact writer."""
    payload = dict(payload)
    payload.setdefault("gate", gate)
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    payload["candidate_sha"] = os.environ.get("CANDIDATE_SHA", "<unset>")
    safe = redact(payload)

    path = evidence_dir(gate) / f"{name}.json"
    path.write_text(json.dumps(safe, indent=2, sort_keys=True) + "\n")

    # Belt and braces: never ship an artifact that still matches a secret shape.
    written = path.read_text()
    for pattern, _ in _SHAPES[:6]:
        if pattern.search(written):
            path.unlink()
            raise SystemExit(f"ABORT: secret shape survived redaction in {name}; artifact deleted")
    print(f"  evidence -> {path.relative_to(Path.cwd()) if path.is_relative_to(Path.cwd()) else path}")
    return path
