"""Per-user auth resolution for the MCP server.

An MCP server (stdio) runs in a single user's context — the user supplies their own Supabase JWT via the
`LIFENAV_USER_JWT` env var (the same JWT the web app holds). We VERIFY it with the project's
`SUPABASE_JWT_SECRET` (reusing core-api's verifier) and resolve user_id/tenant_id from the verified claims.
The MCP tools then write as that user only — tenant isolation comes from the verified token, never tool input.

For local development without a JWT, `LIFENAV_USER_ID` may be set explicitly; this is REJECTED unless
`LIFENAV_ALLOW_INSECURE_USER=1` so it can never be used by accident in a deployed context.
"""
from __future__ import annotations

import os

from app.models.common import UserContext


class AuthError(RuntimeError):
    pass


def resolve_user() -> UserContext:
    jwt = os.environ.get("LIFENAV_USER_JWT", "").strip()
    if jwt:
        user_id = _verify_jwt(jwt)
        return UserContext(user_id=user_id)
    dev_id = os.environ.get("LIFENAV_USER_ID", "").strip()
    if dev_id and os.environ.get("LIFENAV_ALLOW_INSECURE_USER") == "1":
        return UserContext(user_id=dev_id)
    raise AuthError(
        "No verified user. Set LIFENAV_USER_JWT to your Supabase access token "
        "(or LIFENAV_USER_ID + LIFENAV_ALLOW_INSECURE_USER=1 for local dev only)."
    )


def _verify_jwt(token: str) -> str:
    """Verify the Supabase JWT and return the user id (sub), reusing core-api's verifier."""
    from app.auth import verify_jwt
    from app.config import get_settings
    secret = get_settings().supabase_jwt_secret or os.environ.get("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise AuthError("SUPABASE_JWT_SECRET not set — cannot verify the user token")
    try:
        user = verify_jwt(token, secret)  # raises on invalid/expired
    except Exception as exc:  # noqa: BLE001
        raise AuthError(f"invalid user token: {exc}") from exc
    if not getattr(user, "user_id", None):
        raise AuthError("token has no subject")
    return str(user.user_id)
