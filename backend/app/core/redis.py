"""
Redis client for caching and token blacklist.
Enterprise-grade connection management with security-first design.

Security Note:
- Token blacklist operations FAIL SECURE - if Redis is unavailable,
  blacklist checks return True (deny access) to prevent bypassing revocation.
- This is critical for security: a compromised token should not gain access
  just because Redis is temporarily down.
"""

from __future__ import annotations

import asyncio
from enum import Enum
from typing import Optional

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import logger


class RedisAvailability(Enum):
    """Redis connection state tracking."""
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    CHECKING = "checking"


# Global Redis state
_redis_client: Optional[redis.Redis] = None
_redis_state: RedisAvailability = RedisAvailability.CHECKING
_reconnect_task: Optional[asyncio.Task] = None
_RECONNECT_INTERVAL = 30  # seconds


async def get_redis() -> Optional[redis.Redis]:
    """
    Get Redis client instance with automatic reconnection.

    Returns:
        Redis client if available, None otherwise
    """
    global _redis_client, _redis_state, _reconnect_task

    if _redis_state == RedisAvailability.UNAVAILABLE:
        # Start reconnection attempt if not already running
        if _reconnect_task is None or _reconnect_task.done():
            _reconnect_task = asyncio.create_task(_attempt_reconnect())
        return None

    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                str(settings.REDIS_URL),
                encoding="utf-8",
                decode_responses=True,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            # Test connection
            await _redis_client.ping()
            _redis_state = RedisAvailability.AVAILABLE
            logger.info(
                "redis_client_initialized",
                max_connections=settings.REDIS_MAX_CONNECTIONS,
            )
        except Exception as e:
            logger.error(
                "redis_connection_failed",
                error=str(e),
                error_type=type(e).__name__,
            )
            _redis_state = RedisAvailability.UNAVAILABLE
            _redis_client = None

            # Start background reconnection
            if _reconnect_task is None or _reconnect_task.done():
                _reconnect_task = asyncio.create_task(_attempt_reconnect())
            return None

    return _redis_client


async def _attempt_reconnect() -> None:
    """Background task to attempt Redis reconnection."""
    global _redis_state

    while _redis_state == RedisAvailability.UNAVAILABLE:
        await asyncio.sleep(_RECONNECT_INTERVAL)

        try:
            test_client = redis.from_url(
                str(settings.REDIS_URL),
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
            )
            await test_client.ping()
            await test_client.close()

            # Reset state to trigger reconnection on next get_redis()
            _redis_state = RedisAvailability.CHECKING
            logger.info("redis_reconnection_possible")
            return

        except Exception as e:
            logger.debug(
                "redis_reconnection_attempt_failed",
                error=str(e),
            )


async def close_redis() -> None:
    """Close Redis connection pool gracefully."""
    global _redis_client, _redis_state, _reconnect_task

    # Cancel reconnection task
    if _reconnect_task and not _reconnect_task.done():
        _reconnect_task.cancel()
        try:
            await _reconnect_task
        except asyncio.CancelledError:
            pass

    if _redis_client:
        try:
            await _redis_client.close()
        except Exception as e:
            logger.warning("redis_close_error", error=str(e))
        finally:
            _redis_client = None

    _redis_state = RedisAvailability.CHECKING
    logger.info("redis_client_closed")


# =============================================================================
# Token Blacklist Functions
# =============================================================================
#
# SECURITY CRITICAL: These functions implement FAIL-SECURE behavior.
# When Redis is unavailable, blacklist checks return TRUE (deny access).
# This prevents attackers from bypassing token revocation by disrupting Redis.
# =============================================================================


async def blacklist_token(token: str, expires_in: int) -> bool:
    """
    Add a token to the blacklist.

    Args:
        token: The JWT token to blacklist (full token or JTI)
        expires_in: Time in seconds until the token would naturally expire

    Returns:
        True if successfully blacklisted, False if Redis unavailable

    The token is stored in Redis with an expiration matching the JWT expiration.
    This ensures the blacklist entry is automatically cleaned up.

    Security Note: If this fails, subsequent is_token_blacklisted() calls will
    return True (deny access) until Redis is available to verify.
    """
    client = await get_redis()
    if client is None:
        logger.warning(
            "token_blacklist_failed_redis_unavailable",
            token_prefix=token[:16] + "...",
            security_impact="Token will be denied until Redis available",
        )
        return False

    try:
        key = f"blacklist:token:{token}"
        await client.setex(key, expires_in, "1")

        logger.info(
            "token_blacklisted",
            token_prefix=token[:16] + "...",
            expires_in=expires_in,
        )
        return True

    except Exception as e:
        logger.error(
            "token_blacklist_error",
            token_prefix=token[:16] + "...",
            error=str(e),
        )
        return False


async def is_token_blacklisted(token: str) -> bool:
    """
    Check if a token is blacklisted.

    SECURITY: FAILS SECURE - returns True (deny) if Redis unavailable.

    Args:
        token: The JWT token to check

    Returns:
        True if token is blacklisted OR if Redis is unavailable
        False only if Redis confirms token is NOT blacklisted

    This fail-secure design ensures that:
    - Compromised tokens cannot bypass revocation during Redis outages
    - Attackers cannot exploit Redis failures to use revoked tokens
    - Short-lived access tokens naturally expire, limiting impact
    """
    client = await get_redis()
    if client is None:
        # FAIL SECURE: Deny access when we cannot verify
        logger.warning(
            "token_blacklist_check_denied_redis_unavailable",
            token_prefix=token[:16] + "...",
            action="denying_access",
        )
        return True  # SECURITY: Assume blacklisted when uncertain

    try:
        key = f"blacklist:token:{token}"
        exists = await client.exists(key)
        return bool(exists)

    except Exception as e:
        logger.error(
            "token_blacklist_check_error",
            token_prefix=token[:16] + "...",
            error=str(e),
            action="denying_access",
        )
        return True  # FAIL SECURE: Deny on error


async def blacklist_user_tokens(user_id: str) -> bool:
    """
    Blacklist all tokens for a specific user.

    Used for security events like:
    - Password changes
    - Account compromise detection
    - Forced logout (admin action)
    - User-initiated "logout all devices"

    Args:
        user_id: The user ID whose tokens should be blacklisted

    Returns:
        True if successfully blacklisted, False if Redis unavailable
    """
    client = await get_redis()
    if client is None:
        logger.error(
            "user_token_blacklist_failed_redis_unavailable",
            user_id=user_id,
            security_impact="User sessions will be denied until Redis available",
        )
        return False

    try:
        key = f"blacklist:user:{user_id}"

        # Set flag for maximum token lifetime (refresh tokens last 30 days)
        ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        await client.setex(key, ttl, "1")

        logger.warning(
            "user_tokens_blacklisted",
            user_id=user_id,
            ttl_days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
        )
        return True

    except Exception as e:
        logger.error(
            "user_token_blacklist_error",
            user_id=user_id,
            error=str(e),
        )
        return False


async def is_user_blacklisted(user_id: str) -> bool:
    """
    Check if all tokens for a user are blacklisted.

    SECURITY: FAILS SECURE - returns True (deny) if Redis unavailable.

    Args:
        user_id: The user ID to check

    Returns:
        True if user is blacklisted OR if Redis is unavailable
        False only if Redis confirms user is NOT blacklisted
    """
    client = await get_redis()
    if client is None:
        # FAIL SECURE: Deny access when we cannot verify
        logger.warning(
            "user_blacklist_check_denied_redis_unavailable",
            user_id=user_id,
            action="denying_access",
        )
        return True  # SECURITY: Assume blacklisted when uncertain

    try:
        key = f"blacklist:user:{user_id}"
        exists = await client.exists(key)
        return bool(exists)

    except Exception as e:
        logger.error(
            "user_blacklist_check_error",
            user_id=user_id,
            error=str(e),
            action="denying_access",
        )
        return True  # FAIL SECURE: Deny on error


async def remove_user_blacklist(user_id: str) -> bool:
    """
    Remove user from blacklist (e.g., after password reset complete).

    Args:
        user_id: The user ID to remove from blacklist

    Returns:
        True if removed, False if Redis unavailable or error
    """
    client = await get_redis()
    if client is None:
        return False

    try:
        key = f"blacklist:user:{user_id}"
        await client.delete(key)

        logger.info("user_blacklist_removed", user_id=user_id)
        return True

    except Exception as e:
        logger.error(
            "user_blacklist_remove_error",
            user_id=user_id,
            error=str(e),
        )
        return False


# =============================================================================
# Cache Functions (Optional - for future use)
# =============================================================================


async def cache_set(key: str, value: str, expire: int = 3600) -> None:
    """
    Set a value in the cache.

    Args:
        key: Cache key
        value: Value to store
        expire: Expiration time in seconds (default: 1 hour)

    Note: If Redis is unavailable, this is a no-op.
    """
    client = await get_redis()
    if client is None:
        return

    await client.setex(f"cache:{key}", expire, value)


async def cache_get(key: str) -> Optional[str]:
    """
    Get a value from the cache.

    Args:
        key: Cache key

    Returns:
        Cached value or None if not found or Redis unavailable
    """
    client = await get_redis()
    if client is None:
        return None

    return await client.get(f"cache:{key}")


async def cache_delete(key: str) -> None:
    """
    Delete a value from the cache.

    Args:
        key: Cache key

    Note: If Redis is unavailable, this is a no-op.
    """
    client = await get_redis()
    if client is None:
        return

    await client.delete(f"cache:{key}")
