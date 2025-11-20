"""
Enterprise API Key Management Service.

Features:
- Cryptographically secure key generation
- SHA-256 hashed storage (never stores plaintext)
- Rate limiting enforcement
- Permission-based access control
- IP whitelisting
- Usage analytics
- Audit trail
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import (
    APIKey,
    APIKeyStatus,
    APIKeyUsage,
    APIKeyRateLimit,
    APIKeyScope,
)

logger = structlog.get_logger()


class APIKeyService:
    """Service for managing API keys with enterprise security features."""

    KEY_LENGTH = 32  # 256 bits
    PREFIX_LENGTH = 8  # First 8 chars for display

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def generate_api_key() -> tuple[str, str, str]:
        """
        Generate a cryptographically secure API key.

        Returns:
            tuple: (full_key, key_hash, key_prefix)
                - full_key: The actual key to give to user (show ONCE)
                - key_hash: SHA-256 hash to store in database
                - key_prefix: First 8 chars for display/logging
        """
        # Generate 256-bit random key
        key_bytes = secrets.token_bytes(32)

        # Convert to URL-safe base64 (more readable than hex)
        import base64

        full_key = base64.urlsafe_b64encode(key_bytes).decode("utf-8").rstrip("=")

        # Create prefix (first 8 chars for display)
        key_prefix = f"sk_{full_key[:8]}"

        # Hash the key for storage (SHA-256)
        key_hash = hashlib.sha256(full_key.encode("utf-8")).hexdigest()

        return full_key, key_hash, key_prefix

    async def create_api_key(
        self,
        user_id: UUID,
        name: str,
        scopes: list[str],
        description: Optional[str] = None,
        rate_limit_per_minute: int = 100,
        rate_limit_per_hour: int = 5000,
        allowed_ips: Optional[list[str]] = None,
        expires_in_days: Optional[int] = None,
    ) -> tuple[APIKey, str]:
        """
        Create a new API key.

        Args:
            user_id: User who owns this key
            name: Human-readable name for the key
            scopes: List of permission scopes
            description: Optional description
            rate_limit_per_minute: Max requests per minute
            rate_limit_per_hour: Max requests per hour
            allowed_ips: Optional IP whitelist
            expires_in_days: Optional expiration (null = never expires)

        Returns:
            tuple: (APIKey object, plaintext_key)
                WARNING: plaintext_key should be shown to user ONCE and never logged/stored!
        """
        # Generate secure key
        plaintext_key, key_hash, key_prefix = self.generate_api_key()

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Create API key record
        api_key = APIKey(
            user_id=user_id,
            name=name,
            description=description,
            key_hash=key_hash,
            key_prefix=key_prefix,
            status=APIKeyStatus.ACTIVE,
            scopes=scopes,
            rate_limit_per_minute=rate_limit_per_minute,
            rate_limit_per_hour=rate_limit_per_hour,
            allowed_ips=allowed_ips,
            expires_at=expires_at,
        )

        self.db.add(api_key)
        await self.db.commit()
        await self.db.refresh(api_key)

        logger.info(
            "api_key_created",
            key_id=str(api_key.id),
            user_id=str(user_id),
            name=name,
            prefix=key_prefix,
            scopes=scopes,
        )

        # Return both the DB record and the plaintext key
        # IMPORTANT: Caller must show plaintext_key to user ONCE
        return api_key, plaintext_key

    async def validate_api_key(
        self,
        plaintext_key: str,
        required_scope: Optional[str] = None,
        request_ip: Optional[str] = None,
    ) -> Optional[APIKey]:
        """
        Validate an API key and check permissions.

        Args:
            plaintext_key: The actual API key from request
            required_scope: Optional scope to check
            request_ip: Optional IP to verify whitelist

        Returns:
            APIKey object if valid, None otherwise
        """
        # Hash the provided key
        key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()

        # Look up by hash
        result = await self.db.execute(
            select(APIKey).where(
                and_(
                    APIKey.key_hash == key_hash,
                    APIKey.status == APIKeyStatus.ACTIVE,
                )
            )
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            logger.warning("api_key_not_found", key_hash_prefix=key_hash[:8])
            return None

        # Check if expired
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            logger.warning(
                "api_key_expired",
                key_id=str(api_key.id),
                expired_at=api_key.expires_at.isoformat(),
            )
            # Auto-update status
            api_key.status = APIKeyStatus.EXPIRED
            await self.db.commit()
            return None

        # Check IP whitelist
        if request_ip and not api_key.is_ip_allowed(request_ip):
            logger.warning(
                "api_key_ip_blocked",
                key_id=str(api_key.id),
                request_ip=request_ip,
                allowed_ips=api_key.allowed_ips,
            )
            return None

        # Check required scope
        if required_scope and not api_key.has_scope(required_scope):
            logger.warning(
                "api_key_insufficient_scope",
                key_id=str(api_key.id),
                required=required_scope,
                has=api_key.scopes,
            )
            return None

        # Update last used
        api_key.last_used_at = datetime.utcnow()
        api_key.last_used_ip = request_ip
        api_key.total_requests += 1
        await self.db.commit()

        logger.info(
            "api_key_validated",
            key_id=str(api_key.id),
            user_id=str(api_key.user_id),
            prefix=api_key.key_prefix,
        )

        return api_key

    async def check_rate_limit(
        self,
        api_key: APIKey,
    ) -> tuple[bool, dict]:
        """
        Check if API key has exceeded rate limits.

        Args:
            api_key: APIKey object

        Returns:
            tuple: (is_allowed, limit_info)
                - is_allowed: True if under limit
                - limit_info: Dict with current usage stats
        """
        now = datetime.utcnow()

        # Check minute window
        minute_start = now.replace(second=0, microsecond=0)
        minute_result = await self.db.execute(
            select(APIKeyRateLimit).where(
                and_(
                    APIKeyRateLimit.api_key_id == api_key.id,
                    APIKeyRateLimit.window_type == "minute",
                    APIKeyRateLimit.window_start == minute_start,
                )
            )
        )
        minute_limit = minute_result.scalar_one_or_none()

        minute_count = minute_limit.request_count if minute_limit else 0

        # Check hour window
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        hour_result = await self.db.execute(
            select(APIKeyRateLimit).where(
                and_(
                    APIKeyRateLimit.api_key_id == api_key.id,
                    APIKeyRateLimit.window_type == "hour",
                    APIKeyRateLimit.window_start == hour_start,
                )
            )
        )
        hour_limit = hour_result.scalar_one_or_none()

        hour_count = hour_limit.request_count if hour_limit else 0

        # Check limits
        minute_exceeded = minute_count >= api_key.rate_limit_per_minute
        hour_exceeded = hour_count >= api_key.rate_limit_per_hour

        is_allowed = not (minute_exceeded or hour_exceeded)

        limit_info = {
            "minute": {
                "limit": api_key.rate_limit_per_minute,
                "used": minute_count,
                "remaining": max(0, api_key.rate_limit_per_minute - minute_count),
                "reset_at": (minute_start + timedelta(minutes=1)).isoformat(),
            },
            "hour": {
                "limit": api_key.rate_limit_per_hour,
                "used": hour_count,
                "remaining": max(0, api_key.rate_limit_per_hour - hour_count),
                "reset_at": (hour_start + timedelta(hours=1)).isoformat(),
            },
        }

        if not is_allowed:
            logger.warning(
                "api_key_rate_limit_exceeded",
                key_id=str(api_key.id),
                minute_count=minute_count,
                hour_count=hour_count,
            )

        return is_allowed, limit_info

    async def increment_rate_limit(self, api_key: APIKey):
        """Increment rate limit counters for API key."""
        now = datetime.utcnow()

        # Increment minute window
        minute_start = now.replace(second=0, microsecond=0)
        await self._upsert_rate_limit(api_key.id, "minute", minute_start)

        # Increment hour window
        hour_start = now.replace(minute=0, second=0, microsecond=0)
        await self._upsert_rate_limit(api_key.id, "hour", hour_start)

    async def _upsert_rate_limit(
        self,
        api_key_id: UUID,
        window_type: str,
        window_start: datetime,
    ):
        """Upsert rate limit record (increment if exists, create if not)."""
        from sqlalchemy.dialects.postgresql import insert

        stmt = insert(APIKeyRateLimit).values(
            api_key_id=api_key_id,
            window_type=window_type,
            window_start=window_start,
            request_count=1,
            updated_at=datetime.utcnow(),
        )

        # On conflict, increment count
        stmt = stmt.on_conflict_do_update(
            index_elements=["api_key_id", "window_type", "window_start"],
            set_={
                "request_count": APIKeyRateLimit.request_count + 1,
                "updated_at": datetime.utcnow(),
            },
        )

        await self.db.execute(stmt)
        await self.db.commit()

    async def log_usage(
        self,
        api_key: APIKey,
        endpoint: str,
        method: str,
        status_code: int,
        response_time_ms: int,
        ip_address: str,
        user_agent: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Log API key usage for analytics and auditing."""
        usage = APIKeyUsage(
            api_key_id=api_key.id,
            timestamp=datetime.utcnow(),
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            response_time_ms=response_time_ms,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=error_message,
        )

        self.db.add(usage)
        await self.db.commit()

    async def revoke_api_key(
        self,
        api_key_id: UUID,
        revoked_by: UUID,
        reason: Optional[str] = None,
    ) -> bool:
        """
        Revoke an API key.

        Args:
            api_key_id: Key to revoke
            revoked_by: User who revoked it
            reason: Optional reason for revocation

        Returns:
            True if successful
        """
        result = await self.db.execute(
            select(APIKey).where(APIKey.id == api_key_id)
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            return False

        api_key.status = APIKeyStatus.REVOKED
        api_key.revoked_at = datetime.utcnow()
        api_key.revoked_by = revoked_by
        api_key.revocation_reason = reason

        await self.db.commit()

        logger.info(
            "api_key_revoked",
            key_id=str(api_key_id),
            revoked_by=str(revoked_by),
            reason=reason,
        )

        return True

    async def list_user_keys(
        self,
        user_id: UUID,
        include_revoked: bool = False,
    ) -> list[APIKey]:
        """List all API keys for a user."""
        query = select(APIKey).where(APIKey.user_id == user_id)

        if not include_revoked:
            query = query.where(
                or_(
                    APIKey.status == APIKeyStatus.ACTIVE,
                    APIKey.status == APIKeyStatus.SUSPENDED,
                )
            )

        result = await self.db.execute(query.order_by(APIKey.created_at.desc()))
        return list(result.scalars().all())

    async def get_usage_stats(
        self,
        api_key_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        """Get usage statistics for an API key."""
        from sqlalchemy import func

        query = select(
            func.count(APIKeyUsage.id).label("total_requests"),
            func.avg(APIKeyUsage.response_time_ms).label("avg_response_time"),
            func.count(
                func.nullif(
                    func.cast(
                        (APIKeyUsage.status_code >= 500).cast(Integer),
                        Boolean,
                    ),
                    False,
                )
            ).label("error_count"),
        ).where(APIKeyUsage.api_key_id == api_key_id)

        if start_date:
            query = query.where(APIKeyUsage.timestamp >= start_date)
        if end_date:
            query = query.where(APIKeyUsage.timestamp <= end_date)

        result = await self.db.execute(query)
        row = result.one()

        return {
            "total_requests": row.total_requests or 0,
            "avg_response_time_ms": float(row.avg_response_time or 0),
            "error_count": row.error_count or 0,
            "error_rate": (
                (row.error_count / row.total_requests * 100)
                if row.total_requests > 0
                else 0
            ),
        }
