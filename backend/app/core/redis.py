"""
Redis client for caching and token blacklist.
Handles connection pooling and token revocation.
"""

from typing import Optional

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import logger

# Global Redis client
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """
    Get Redis client instance.
    Creates connection pool on first use.
    """
    global _redis_client

    if _redis_client is None:
        _redis_client = redis.from_url(
            str(settings.REDIS_URL),
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
        logger.info("Redis client initialized", url=str(settings.REDIS_URL))

    return _redis_client


async def close_redis() -> None:
    """Close Redis connection pool."""
    global _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis client closed")


# =============================================================================
# Token Blacklist Functions
# =============================================================================


async def blacklist_token(token: str, expires_in: int) -> None:
    """
    Add a token to the blacklist.

    Args:
        token: The JWT token to blacklist
        expires_in: Time in seconds until the token would naturally expire

    The token is stored in Redis with an expiration matching the JWT expiration.
    This ensures the blacklist entry is automatically cleaned up.
    """
    client = await get_redis()
    key = f"blacklist:token:{token}"

    # Store with expiration matching the token's remaining lifetime
    await client.setex(key, expires_in, "1")

    logger.info("Token blacklisted", token_prefix=token[:20], expires_in=expires_in)


async def is_token_blacklisted(token: str) -> bool:
    """
    Check if a token is blacklisted.

    Args:
        token: The JWT token to check

    Returns:
        True if the token is blacklisted, False otherwise
    """
    client = await get_redis()
    key = f"blacklist:token:{token}"

    exists = await client.exists(key)
    return bool(exists)


async def blacklist_user_tokens(user_id: str) -> None:
    """
    Blacklist all tokens for a specific user.

    This is used for security events like password changes,
    account compromise, or forced logout.

    Args:
        user_id: The user ID whose tokens should be blacklisted
    """
    client = await get_redis()
    key = f"blacklist:user:{user_id}"

    # Set a flag that lasts for the maximum token lifetime (30 days for refresh tokens)
    await client.setex(key, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, "1")

    logger.warning("All user tokens blacklisted", user_id=user_id)


async def is_user_blacklisted(user_id: str) -> bool:
    """
    Check if all tokens for a user are blacklisted.

    Args:
        user_id: The user ID to check

    Returns:
        True if all user tokens are blacklisted, False otherwise
    """
    client = await get_redis()
    key = f"blacklist:user:{user_id}"

    exists = await client.exists(key)
    return bool(exists)


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
    """
    client = await get_redis()
    await client.setex(f"cache:{key}", expire, value)


async def cache_get(key: str) -> Optional[str]:
    """
    Get a value from the cache.

    Args:
        key: Cache key

    Returns:
        Cached value or None if not found
    """
    client = await get_redis()
    return await client.get(f"cache:{key}")


async def cache_delete(key: str) -> None:
    """
    Delete a value from the cache.

    Args:
        key: Cache key
    """
    client = await get_redis()
    await client.delete(f"cache:{key}")
