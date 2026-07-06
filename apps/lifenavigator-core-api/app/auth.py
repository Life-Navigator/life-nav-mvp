"""Supabase JWT validation.

Supabase Auth issues HS256-signed JWTs with the project's JWT secret. We
verify every request's ``Authorization: Bearer <token>`` and extract the
``user_id`` (the ``sub`` claim).

CRITICAL: routes must NEVER accept a ``user_id`` from the request body /
query / headers. The only trusted source of identity is the verified JWT.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status

from .beta_access import is_beta_access_allowed, masked_email
from .config import Settings, get_settings

logger = logging.getLogger("app.auth")


@dataclass(frozen=True)
class AuthenticatedUser:
    """Identity extracted from a verified Supabase JWT."""

    user_id: str
    email: Optional[str]
    role: str  # 'authenticated' | 'anon' | 'service_role' | ...
    invited: bool = False  # app_metadata.invited — redeemed a private beta invite key


def _strip_bearer(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1].strip()


def verify_jwt(token: str, secret: str) -> AuthenticatedUser:
    """Verify a Supabase JWT; raise 401 on any failure mode."""
    if not secret:
        # Misconfiguration is a 500 — clients should never see this.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server JWT secret is not configured",
        )
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
        )
    app_meta = payload.get("app_metadata")
    invited = bool(isinstance(app_meta, dict) and app_meta.get("invited") is True)
    return AuthenticatedUser(
        user_id=sub,
        email=payload.get("email"),
        role=payload.get("role") or "authenticated",
        invited=invited,
    )


def _enforce_beta_gate(user: AuthenticatedUser, settings: Settings) -> None:
    """Private-beta allowlist — enforced HERE, not only in the web proxy, because the
    core-api is publicly reachable. When the gate is OFF this is a no-op. Service-role
    callers (internal service-to-service) always bypass. 403 for a non-allowlisted user.
    """
    if user.role == "service_role":
        return
    if is_beta_access_allowed(user.email, user.invited, settings):
        return
    # Loud, non-PII log so a blocked attempt is visible without leaking the address.
    logger.warning("beta_gate_block masked=%s reason=not_allowlisted", masked_email(user.email))
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This account is not part of the current private beta.",
    )


def current_user(
    authorization: Optional[str] = Header(default=None, include_in_schema=False),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """FastAPI dependency: returns the authenticated user (401 if absent/invalid, 403 if not in beta)."""
    token = _strip_bearer(authorization)
    user = verify_jwt(token, settings.supabase_jwt_secret)
    _enforce_beta_gate(user, settings)
    return user
