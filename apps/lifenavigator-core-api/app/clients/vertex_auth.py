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
# Credential scratch files are suffixed with the RUNNING UID so processes never collide on ownership.
# (The uvicorn worker runs as `core` uid 10001; an in-machine `flyctl ssh` shell runs as root uid 0 —
# if root wrote /tmp/gcp-*.json first, the worker could not read them and EVERY LLM call fell back.
# Per-uid paths mean the worker always owns, reads, and refreshes its own files.)
_UID = os.getuid()
_SA_FILE = f"/tmp/gcp-sa-{_UID}.json"  # where a JSON-secret service account is materialized for google.auth
# Workload Identity Federation (keyless): Fly OIDC token → STS exchange → SA impersonation. No key, ever.
_EXTERNAL_ACCOUNT_FILE = f"/tmp/gcp-external-account-{_UID}.json"  # NOT a secret (no key material)
_FLY_OIDC_TOKEN_FILE = f"/tmp/fly-oidc-token-{_UID}"               # short-lived (15 min) Fly JWT, refreshed per exchange
_FLY_API_SOCKET = "/.fly/api"                              # Fly Machine local API unix socket


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


def wif_enabled() -> bool:
    """WIF mode is active when the three keyless-federation env vars are present (set on Fly)."""
    return bool(
        os.environ.get("VERTEX_WIF_AUDIENCE")
        and os.environ.get("VERTEX_WIF_PROVIDER")
        and os.environ.get("VERTEX_SA_EMAIL")
    )


def fetch_fly_oidc_token(audience: str) -> str:
    """Mint a fresh Fly OIDC token (15-min JWT) via the Machine's local unix socket. No key involved."""
    import http.client  # noqa: PLC0415
    import socket  # noqa: PLC0415

    class _UnixHTTPConnection(http.client.HTTPConnection):
        def __init__(self, path: str) -> None:
            super().__init__("localhost")
            self._unix_path = path

        def connect(self) -> None:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect(self._unix_path)
            self.sock = s

    conn = _UnixHTTPConnection(_FLY_API_SOCKET)
    try:
        conn.request("POST", "/v1/tokens/oidc", body=json.dumps({"aud": audience}),
                     headers={"Content-Type": "application/json"})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8")
        if resp.status != 200:
            raise VertexAuthError(f"Fly OIDC mint failed: HTTP {resp.status}: {body[:200]}")
    except OSError as e:
        raise VertexAuthError(f"Cannot reach Fly OIDC socket {_FLY_API_SOCKET} (not on a Fly Machine?): {e}") from e
    finally:
        conn.close()
    tok = body.strip()
    if tok.startswith("{"):  # some Fly versions wrap the JWT in JSON
        try:
            obj = json.loads(tok)
            tok = obj.get("token") or obj.get("jwt") or obj.get("id_token") or ""
        except json.JSONDecodeError:
            tok = ""
    if tok.count(".") != 2:
        raise VertexAuthError("Fly OIDC response was not a JWT.")
    return tok


def refresh_fly_oidc_token() -> None:
    """Write a fresh Fly OIDC token to the file the external_account credential reads."""
    tok = fetch_fly_oidc_token(os.environ["VERTEX_WIF_AUDIENCE"])
    with open(_FLY_OIDC_TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(tok)
    os.chmod(_FLY_OIDC_TOKEN_FILE, stat.S_IRUSR | stat.S_IWUSR)


def materialize_external_account_config() -> str:
    """Write the keyless external_account credential config (no key material) and point ADC at it."""
    provider = os.environ["VERTEX_WIF_PROVIDER"].lstrip("/")  # projects/NUM/locations/global/workloadIdentityPools/POOL/providers/PROV
    sa = os.environ["VERTEX_SA_EMAIL"]
    cfg = {
        "type": "external_account",
        "audience": f"//iam.googleapis.com/{provider}",
        "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
        "token_url": "https://sts.googleapis.com/v1/token",
        "service_account_impersonation_url":
            f"https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{sa}:generateAccessToken",
        "credential_source": {"file": _FLY_OIDC_TOKEN_FILE, "format": {"type": "text"}},
    }
    with open(_EXTERNAL_ACCOUNT_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _EXTERNAL_ACCOUNT_FILE
    log.info("vertex_auth: WIF external_account config written (provider=%s, sa=%s) — keyless", provider, sa)
    return _EXTERNAL_ACCOUNT_FILE


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
        if wif_enabled():
            # Keyless: write the external_account config + an initial Fly OIDC token, then let google.auth
            # build an external_account credential (STS exchange + SA impersonation on each refresh).
            materialize_external_account_config()
            refresh_fly_oidc_token()
        else:
            materialize_sa_credentials()  # JSON-secret SA → file (no-op for user ADC / metadata)
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
                if wif_enabled():
                    # The Fly OIDC subject token expires in 15 min; mint a fresh one immediately before the
                    # STS exchange so the external_account refresh always has a valid subject token.
                    refresh_fly_oidc_token()
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
