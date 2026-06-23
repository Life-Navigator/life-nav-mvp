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

import logging
import threading
import time
from datetime import timezone
from typing import Optional

log = logging.getLogger("core.vertex_auth")

_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
_REFRESH_SKEW_S = 300  # refresh 5 min before expiry


class VertexAuthError(RuntimeError):
    """ADC is unavailable or unauthorized. Raised loudly — never swallowed into a silent downgrade."""


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
