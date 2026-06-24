"""Vertex AI auth via Application Default Credentials (ADC) — NO API keys.

Org policy disallows API keys, so every Vertex call authenticates with ADC:
  * dev:    a user ADC from `gcloud auth application-default login`
  * deploy: the attached service account (Fly/Cloud Run metadata server, or a
            GOOGLE_APPLICATION_CREDENTIALS key file)

Tokens are minted + cached here and refreshed ~5 min before expiry. Failure is LOUD —
a missing or unauthorized credential raises VertexAuthError rather than silently
degrading to a weaker path. Callers log the error and surface it as a visible model
fallback (never a silent quality drop).
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import stat
import threading
import time
from datetime import timezone
from typing import Optional

log = logging.getLogger("core.vertex_auth")

_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
_REFRESH_SKEW_S = 300  # refresh 5 min before expiry
_SA_FILE = "/tmp/gcp-sa.json"  # where a JSON-secret service account is materialized for google.auth


class VertexAuthError(RuntimeError):
    """ADC is unavailable or unauthorized. Raised loudly — never swallowed into a silent downgrade."""


def materialize_sa_credentials() -> Optional[str]:
    """Bridge a Fly-style env SECRET to the FILE google.auth expects.

    Fly secrets are env vars, but `google.auth.default()` reads `GOOGLE_APPLICATION_CREDENTIALS` (a file
    path). If that file path is already set + readable, we do nothing (e.g. WIF or a mounted key). Otherwise,
    if `GOOGLE_APPLICATION_CREDENTIALS_JSON` is present (raw JSON or base64), decode it to a 0600 file and
    point `GOOGLE_APPLICATION_CREDENTIALS` at it. Idempotent; never logs the credential. Returns the path or None.
    """
    existing = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if existing and os.path.isfile(existing):
        return existing
    raw = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if not raw:
        return None
    blob = raw.strip()
    text: Optional[str] = None
    # Try base64 first (the documented Fly setup base64-encodes the key), then fall back to raw JSON.
    try:
        decoded = base64.b64decode(blob, validate=True).decode("utf-8")
        if decoded.lstrip().startswith("{"):
            text = decoded
    except (binascii.Error, ValueError, UnicodeDecodeError):
        text = None
    if text is None and blob.startswith("{"):
        text = blob
    if text is None:
        raise VertexAuthError("GOOGLE_APPLICATION_CREDENTIALS_JSON is neither valid base64 nor raw JSON.")
    try:
        parsed = json.loads(text)
        if parsed.get("type") != "service_account":
            raise ValueError("not a service_account key")
    except (json.JSONDecodeError, ValueError) as e:
        raise VertexAuthError(f"GOOGLE_APPLICATION_CREDENTIALS_JSON is not a valid service-account key: {e}") from e
    with open(_SA_FILE, "w", encoding="utf-8") as f:
        f.write(text)
    os.chmod(_SA_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 0600
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _SA_FILE
    log.info("vertex_auth: materialized service-account credentials to %s (project=%s)",
             _SA_FILE, parsed.get("project_id", "?"))
    return _SA_FILE


class AdcTokenProvider:
    """Mints + caches a Google OAuth access token from ADC. Thread-safe; refresh is blocking (network),
    so async callers should invoke `.token()` via asyncio.to_thread. Refreshes happen ~hourly, so the
    block is rare and short."""

    def __init__(self, scope: str = _SCOPE) -> None:
        self._scope = scope
        self._lock = threading.Lock()
        self._creds = None
        self._token: Optional[str] = None
        self._exp: float = 0.0

    def _load_credentials(self):
        try:
            import google.auth  # noqa: PLC0415
        except ImportError as e:
            raise VertexAuthError(
                "google-auth is not installed — add `google-auth` to requirements and pip install it."
            ) from e
        materialize_sa_credentials()  # bridge a JSON-secret SA to the file google.auth expects (no-op for WIF/user ADC)
        try:
            creds, _project = google.auth.default(scopes=[self._scope])
        except Exception as e:  # google.auth.exceptions.DefaultCredentialsError et al.  # noqa: BLE001
            raise VertexAuthError(
                "No Application Default Credentials found. In dev run "
                "`gcloud auth application-default login`; in deploy attach a service account "
                f"(metadata server or GOOGLE_APPLICATION_CREDENTIALS). Underlying: {e}"
            ) from e
        return creds

    def token(self) -> str:
        """Return a valid access token, refreshing if needed. Raises VertexAuthError loudly on failure."""
        with self._lock:
            now = time.time()
            if self._token and now < self._exp - _REFRESH_SKEW_S:
                return self._token
            from google.auth.transport.requests import Request  # noqa: PLC0415
            if self._creds is None:
                self._creds = self._load_credentials()
            try:
                self._creds.refresh(Request())
            except Exception as e:  # noqa: BLE001
                raise VertexAuthError(f"Failed to refresh ADC token: {e}") from e
            token = getattr(self._creds, "token", None)
            if not token:
                raise VertexAuthError("ADC refresh returned an empty token.")
            self._token = token
            exp = getattr(self._creds, "expiry", None)
            if exp is not None:
                # google-auth expiry is a naive UTC datetime
                self._exp = exp.replace(tzinfo=timezone.utc).timestamp()
            else:
                self._exp = now + 3000
            log.info("vertex_auth: minted ADC access token (expires in ~%ds)", int(self._exp - now))
            return self._token

    @property
    def available(self) -> bool:
        """Best-effort, non-raising readiness probe (used for config/health reporting, not the hot path)."""
        try:
            return bool(self.token())
        except VertexAuthError:
            return False
