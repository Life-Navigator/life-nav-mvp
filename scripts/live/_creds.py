"""Credential loading for the live readiness runner.

RULES THIS MODULE ENFORCES, NOT SUGGESTS
----------------------------------------
* Credentials come from a FILE or the environment. Never from argv — argv is visible to any process
  on the box via `ps`, and it lands in shell history.
* Values are never printed. `fingerprint()` emits a length and a short SHA-256 prefix, which is
  enough to confirm "the key I pasted is the key being used" and useless to anyone who reads a log.
* The runner reports WHICH checks a given credential set can run, so a partial set produces partial
  results rather than a confusing cascade of failures.

Why this is stricter than it looks: LN-SEC-2026-0729-02 in this repo was a credential that reached
git history. The scanners were configured and still did not catch it, because the file was outside
their scope. So the defence here is to never let a value be written or echoed in the first place,
rather than to rely on a scanner noticing afterwards.

FILE FORMAT — a plain `KEY=value` env file (`#` comments allowed):

    GCP_PROJECT=lifenav-prod
    VERTEX_REGION=us-east5
    QDRANT_URL=https://xxxx.qdrant.io:6333
    QDRANT_API_KEY=...
    NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
    NEO4J_USERNAME=neo4j
    NEO4J_PASSWORD=...
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...
    PLAID_CLIENT_ID=...
    PLAID_SECRET=...

Load with `--creds ~/.ln-live-creds.env`. The file is read, never written, and never copied.
"""
from __future__ import annotations

import hashlib
import os
import pathlib
import stat
from dataclasses import dataclass, field
from typing import Optional

# Everything the runner knows how to use. Presence decides which checks are eligible.
KNOWN = (
    "GCP_PROJECT", "VERTEX_REGION", "VERTEX_ACCESS_TOKEN", "CLAUDE_MODEL",
    "QDRANT_URL", "QDRANT_API_KEY", "QDRANT_PERSONAL_COLLECTION", "QDRANT_CENTRAL_COLLECTION",
    "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "NEO4J_PERSONAL_DATABASE",
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV",
    "CORE_API_URL", "WEB_URL",
)

# Values that, if leaked, grant broad access. Reported with extra prominence so the operator is
# reminded to rotate them when the window closes.
HIGH_PRIVILEGE = ("SUPABASE_SERVICE_ROLE_KEY", "NEO4J_PASSWORD", "QDRANT_API_KEY",
                  "VERTEX_ACCESS_TOKEN", "PLAID_SECRET", "GEMINI_API_KEY")


@dataclass
class Creds:
    values: dict[str, str] = field(default_factory=dict)
    source: str = "none"

    def get(self, key: str, default: str = "") -> str:
        return self.values.get(key, default) or default

    def has(self, *keys: str) -> bool:
        """True only when EVERY key is present and non-empty.

        An unset env var expands to an empty string, and an empty credential produces a confusing
        auth error several layers down rather than an honest "not configured" — the same
        silent-empty-config failure the Fly secret manifests guard against.
        """
        return all(self.values.get(k) for k in keys)

    def missing(self, *keys: str) -> list[str]:
        return [k for k in keys if not self.values.get(k)]

    def fingerprint(self, key: str) -> str:
        v = self.values.get(key) or ""
        if not v:
            return "absent"
        return f"len={len(v)} sha256={hashlib.sha256(v.encode()).hexdigest()[:8]}"

    def summary(self) -> list[str]:
        """One line per known credential — presence and fingerprint only, never a value."""
        out: list[str] = []
        for k in KNOWN:
            mark = "HIGH-PRIV" if k in HIGH_PRIVILEGE and self.values.get(k) else "         "
            out.append(f"  {mark} {k:34} {self.fingerprint(k)}")
        return out


def load(path: Optional[str] = None, *, inherit_env: bool = True) -> Creds:
    """Load credentials from `path` (an env file) and/or the process environment.

    The file wins over the environment: it is the thing the operator just wrote for this run, and
    silently preferring a stale exported variable is how a test ends up measuring the wrong project.
    """
    values: dict[str, str] = {}

    if inherit_env:
        for k in KNOWN:
            v = os.environ.get(k)
            if v:
                values[k] = v

    source = "env"
    if path:
        p = pathlib.Path(path).expanduser()
        if not p.exists():
            raise SystemExit(f"credentials file not found: {p}")
        _warn_if_world_readable(p)
        for raw in p.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and v:
                values[k] = v
        source = str(p)

    return Creds(values=values, source=source)


def _warn_if_world_readable(p: pathlib.Path) -> None:
    """Nudge, not a refusal — the operator may have reasons, and refusing mid-window is worse."""
    try:
        mode = p.stat().st_mode
        if mode & (stat.S_IROTH | stat.S_IRGRP):
            print(f"  ! {p} is group/world-readable — consider `chmod 600 {p}`")
    except OSError:
        pass
