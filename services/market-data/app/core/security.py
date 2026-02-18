"""
Security utilities for service-to-service authentication.

Validates JWT tokens with audience and scope enforcement.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
security_scheme = HTTPBearer()


class JWTPayload:
    """Parsed JWT payload"""

    def __init__(self, payload: dict):
        self.issuer: str = payload.get("iss", "")
        self.audience: str = payload.get("aud", "")
        self.scope: str = payload.get("scope", "")
        self.issued_at: Optional[datetime] = None
        self.expires_at: Optional[datetime] = None

        if "iat" in payload:
            self.issued_at = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        if "exp" in payload:
            self.expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

    def has_scope(self, required_scope: str) -> bool:
        """Check if token has required scope"""
        return required_scope in self.scope.split()


def validate_service_token(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
    required_scope: Optional[str] = None,
) -> JWTPayload:
    """
    Validate service-to-service JWT token.

    Checks:
    - Signature validity
    - Audience matches "market-data"
    - Issuer is "life-navigator-backend"
    - Token not expired
    - Has required scope (if specified)

    Raises HTTPException(403) on validation failure.
    """
    token = credentials.credentials

    try:
        # Decode and validate JWT
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )

        jwt_payload = JWTPayload(payload)

        # Validate scope if required
        if required_scope and not jwt_payload.has_scope(required_scope):
            logger.warning(
                "token_scope_mismatch",
                required=required_scope,
                actual=jwt_payload.scope,
            )
            raise HTTPException(
                status_code=403,
                detail=f"Token missing required scope: {required_scope}",
            )

        logger.debug(
            "token_validated",
            issuer=jwt_payload.issuer,
            scope=jwt_payload.scope,
        )

        return jwt_payload

    except JWTError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(
            status_code=403,
            detail=f"Invalid token: {str(e)}",
        )


def require_read_scope(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> JWTPayload:
    """Require market:read scope"""
    return validate_service_token(credentials, required_scope="market:read")


def require_build_scope(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> JWTPayload:
    """Require market:build scope (admin only)"""
    return validate_service_token(credentials, required_scope="market:build")
