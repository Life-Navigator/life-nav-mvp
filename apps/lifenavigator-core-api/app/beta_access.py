"""Core-API private-beta access gate — server-side enforcement.

The web Next.js proxy is NOT the only door: the Fly core-api is publicly
reachable (``https://lifenavigator-core-api.fly.dev``), so an authenticated but
non-allowlisted user could otherwise read/write straight through it, bypassing
the front-door gate. This module enforces the SAME allowlist here.

Semantics mirror the web ``betaAccess.ts`` exactly:

  gate OFF (PRIVATE_BETA_ENABLED not truthy) -> everyone allowed (normal behavior)
  gate ON  -> allowed iff: redeemed invite (app_metadata.invited) OR admin email
              OR exact allowlisted email OR (synthetic demo domain when opted in)

NEVER logs allowlist contents or tokens.
"""
from __future__ import annotations

import re
from typing import Optional

from .config import Settings

_SYNTHETIC_BETA_DOMAIN = "@lifenav-beta.example.com"
_TRUTHY = re.compile(r"^(1|true|yes|on)$", re.IGNORECASE)


def _truthy(v: Optional[str]) -> bool:
    return bool(_TRUTHY.match((v or "").strip()))


def _email_set(raw: Optional[str]) -> set[str]:
    return {e.strip().lower() for e in (raw or "").split(",") if e.strip()}


def private_beta_enabled(settings: Settings) -> bool:
    """Is the private-beta gate active? When false, the app behaves normally (open)."""
    return _truthy(settings.private_beta_enabled)


def is_beta_access_allowed(email: Optional[str], invited: bool, settings: Settings) -> bool:
    """Gate OFF -> True. Gate ON -> admin OR exact-allowlisted OR invited OR opt-in synthetic domain.

    Missing email while the gate is ON -> blocked (never fail open on an unidentifiable caller).
    """
    if not private_beta_enabled(settings):
        return True
    # A redeemed private invite (server-stamped app_metadata.invited) grants access.
    if invited:
        return True
    e = (email or "").strip().lower()
    if not e:
        return False
    if e in _email_set(settings.private_beta_admin_emails):
        return True
    if e in _email_set(settings.private_beta_allowed_emails):
        return True
    # Domain wildcard is OFF by default (first-5 = exact-account only). Internal-demo opt-in only.
    if _truthy(settings.private_beta_allow_synthetic_domain) and e.endswith(_SYNTHETIC_BETA_DOMAIN):
        return True
    return False


def masked_email(email: Optional[str]) -> str:
    """Non-PII form for audit logs: first two chars + domain. Never the full address."""
    e = (email or "").strip().lower()
    if "@" not in e:
        return "(none)"
    local, _, domain = e.partition("@")
    return f"{local[:2]}***@{domain}"
