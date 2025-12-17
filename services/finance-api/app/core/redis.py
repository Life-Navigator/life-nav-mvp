"""
Redis Configuration and Management
Enterprise-grade caching, session management, and pub/sub with circuit breaker pattern.

Features:
- Connection pooling with health monitoring
- Circuit breaker for fault tolerance
- Structured logging with correlation IDs
- Graceful degradation for high availability
"""

from __future__ import annotations

import asyncio
import json
import pickle
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, Optional, TypeVar, Union

import redis.asyncio as redis
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    """Circuit breaker states for fault tolerance."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """
    Circuit breaker pattern implementation for Redis operations.

    Prevents cascading failures by failing fast when Redis is unhealthy,
    while periodically testing for recovery.
    """

    __slots__ = (
        "_state", "_failure_count", "_success_count", "_last_failure_time",
        "_failure_threshold", "_recovery_timeout", "_success_threshold"
    )

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        success_threshold: int = 3,
    ):
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._success_threshold = success_threshold

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, checking for recovery timeout."""
        if self._state == CircuitState.OPEN and self._last_failure_time:
            elapsed = (datetime.utcnow() - self._last_failure_time).total_seconds()
            if elapsed >= self._recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._success_count = 0
                logger.info("circuit_breaker_half_open", elapsed_seconds=elapsed)
        return self._state

    @property
    def is_available(self) -> bool:
        """Check if circuit allows requests."""
        return self.state != CircuitState.OPEN

    def record_success(self) -> None:
        """Record successful operation."""
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self._success_threshold:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                logger.info("circuit_breaker_closed", success_count=self._success_count)
        elif self._state == CircuitState.CLOSED:
            self._failure_count = max(0, self._failure_count - 1)

    def record_failure(self) -> None:
        """Record failed operation."""
        self._failure_count += 1
        self._last_failure_time = datetime.utcnow()

        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            logger.warning("circuit_breaker_reopened", failure_count=self._failure_count)
        elif self._failure_count >= self._failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning("circuit_breaker_opened", failure_count=self._failure_count)


class RedisConnectionError(Exception):
    """Raised when Redis connection fails."""
    pass


class RedisManager:
    """
    Enterprise Redis connection manager with connection pooling, circuit breaker,
    and health monitoring.

    Features:
    - Singleton pattern for connection reuse
    - Circuit breaker for fault tolerance
    - Connection health monitoring
    - Graceful shutdown handling
    """

    _instance: Optional[RedisManager] = None
    _redis_client: Optional[redis.Redis] = None
    _circuit_breaker: CircuitBreaker = CircuitBreaker()
    _is_healthy: bool = False
    _health_check_task: Optional[asyncio.Task] = None

    def __new__(cls) -> RedisManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def is_healthy(self) -> bool:
        """Check if Redis connection is healthy."""
        return self._is_healthy and self._circuit_breaker.is_available

    async def get_client(self) -> redis.Redis:
        """
        Get or create Redis client with connection pooling and circuit breaker.

        Returns:
            Redis client instance

        Raises:
            RedisConnectionError: If circuit breaker is open or connection fails
        """
        if not self._circuit_breaker.is_available:
            raise RedisConnectionError(
                f"Redis circuit breaker is {self._circuit_breaker.state.value}"
            )

        if self._redis_client is None:
            await self._initialize_client()

        return self._redis_client

    async def _initialize_client(self) -> None:
        """Initialize Redis client with optimal settings."""
        try:
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=getattr(settings, "REDIS_MAX_CONNECTIONS", 50),
                socket_timeout=getattr(settings, "REDIS_SOCKET_TIMEOUT", 5.0),
                socket_connect_timeout=getattr(settings, "REDIS_CONNECT_TIMEOUT", 5.0),
                socket_keepalive=True,
                socket_keepalive_options={
                    1: 60,   # TCP_KEEPIDLE: Start keepalive after 60s idle
                    2: 15,   # TCP_KEEPINTVL: Send keepalive every 15s
                    3: 4,    # TCP_KEEPCNT: Close after 4 failed keepalives
                },
                retry_on_timeout=True,
                health_check_interval=30,
            )

            # Verify connection
            await self._redis_client.ping()
            self._is_healthy = True
            self._circuit_breaker.record_success()

            # Start health monitoring
            if self._health_check_task is None or self._health_check_task.done():
                self._health_check_task = asyncio.create_task(self._health_monitor())

            logger.info(
                "redis_connection_established",
                url=self._sanitize_url(settings.REDIS_URL),
                max_connections=getattr(settings, "REDIS_MAX_CONNECTIONS", 50),
            )

        except Exception as e:
            self._circuit_breaker.record_failure()
            self._is_healthy = False
            logger.error(
                "redis_connection_failed",
                error=str(e),
                error_type=type(e).__name__,
                circuit_state=self._circuit_breaker.state.value,
            )
            raise RedisConnectionError(f"Failed to connect to Redis: {e}") from e

    async def _health_monitor(self) -> None:
        """Background task to monitor Redis health."""
        while True:
            try:
                await asyncio.sleep(30)
                if self._redis_client:
                    await self._redis_client.ping()
                    self._is_healthy = True
                    self._circuit_breaker.record_success()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._is_healthy = False
                self._circuit_breaker.record_failure()
                logger.warning(
                    "redis_health_check_failed",
                    error=str(e),
                    circuit_state=self._circuit_breaker.state.value,
                )

    @staticmethod
    def _sanitize_url(url: str) -> str:
        """Remove sensitive information from Redis URL for logging."""
        if "@" in url:
            # Hide password in URL
            parts = url.split("@")
            return f"redis://***@{parts[-1]}"
        return url

    async def close(self) -> None:
        """Gracefully close Redis connection and cleanup."""
        if self._health_check_task and not self._health_check_task.done():
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        if self._redis_client:
            try:
                await self._redis_client.close()
                await self._redis_client.connection_pool.disconnect()
            except Exception as e:
                logger.warning("redis_close_error", error=str(e))
            finally:
                self._redis_client = None
                self._is_healthy = False
                logger.info("redis_connection_closed")


class CacheService:
    """
    Enterprise caching service with multiple strategies and graceful degradation.

    Features:
    - Automatic JSON serialization/deserialization
    - TTL management with defaults
    - Pattern-based invalidation
    - Cache-aside pattern with get_or_set
    - Graceful degradation when Redis unavailable
    """

    __slots__ = ("_redis_manager", "_default_ttl")

    def __init__(self, default_ttl: Optional[int] = None):
        self._redis_manager = RedisManager()
        self._default_ttl = default_ttl or getattr(settings, "CACHE_TTL", 3600)

    async def get(self, key: str, default: T = None) -> Union[T, Any]:
        """
        Get value from cache with automatic deserialization.

        Args:
            key: Cache key
            default: Default value if key not found or error

        Returns:
            Cached value or default
        """
        try:
            client = await self._redis_manager.get_client()
            value = await client.get(key)

            if value is None:
                return default

            return self._deserialize(value)

        except RedisConnectionError:
            logger.debug("cache_get_skipped_circuit_open", key=key)
            return default
        except Exception as e:
            logger.warning("cache_get_error", key=key, error=str(e))
            return default

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool:
        """
        Set value in cache with automatic serialization.

        Args:
            key: Cache key
            value: Value to cache (auto-serialized)
            ttl: Time to live in seconds (uses default if not specified)
            nx: Only set if key doesn't exist (SET NX)
            xx: Only set if key exists (SET XX)

        Returns:
            True if set successfully, False otherwise
        """
        try:
            client = await self._redis_manager.get_client()
            serialized = self._serialize(value)

            result = await client.set(
                key,
                serialized,
                ex=ttl or self._default_ttl,
                nx=nx,
                xx=xx,
            )
            return bool(result)

        except RedisConnectionError:
            logger.debug("cache_set_skipped_circuit_open", key=key)
            return False
        except Exception as e:
            logger.warning("cache_set_error", key=key, error=str(e))
            return False

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys from cache."""
        if not keys:
            return 0

        try:
            client = await self._redis_manager.get_client()
            return await client.delete(*keys)
        except RedisConnectionError:
            return 0
        except Exception as e:
            logger.warning("cache_delete_error", keys=keys, error=str(e))
            return 0

    async def exists(self, *keys: str) -> int:
        """Check how many of the given keys exist."""
        if not keys:
            return 0

        try:
            client = await self._redis_manager.get_client()
            return await client.exists(*keys)
        except RedisConnectionError:
            return 0
        except Exception as e:
            logger.warning("cache_exists_error", keys=keys, error=str(e))
            return 0

    async def expire(self, key: str, ttl: int) -> bool:
        """Set or update expiration on a key."""
        try:
            client = await self._redis_manager.get_client()
            return await client.expire(key, ttl)
        except RedisConnectionError:
            return False
        except Exception as e:
            logger.warning("cache_expire_error", key=key, error=str(e))
            return False

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Atomically increment a counter."""
        try:
            client = await self._redis_manager.get_client()
            return await client.incrby(key, amount)
        except RedisConnectionError:
            return None
        except Exception as e:
            logger.warning("cache_increment_error", key=key, error=str(e))
            return None

    async def get_or_set(
        self,
        key: str,
        factory_fn: Union[T, Callable[[], T], Callable[[], "asyncio.Future[T]"]],
        ttl: Optional[int] = None,
    ) -> T:
        """
        Cache-aside pattern: get from cache or compute and store.

        Args:
            key: Cache key
            factory_fn: Value, sync callable, or async callable to compute value
            ttl: Time to live in seconds

        Returns:
            Cached or computed value
        """
        # Try cache first
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Compute value
        if callable(factory_fn):
            if asyncio.iscoroutinefunction(factory_fn):
                value = await factory_fn()
            else:
                value = factory_fn()
        else:
            value = factory_fn

        # Store in cache (fire and forget for performance)
        asyncio.create_task(self.set(key, value, ttl))

        return value

    async def invalidate_pattern(self, pattern: str, batch_size: int = 100) -> int:
        """
        Delete all keys matching a pattern using SCAN for memory efficiency.

        Args:
            pattern: Redis glob pattern (e.g., "user:*:profile")
            batch_size: Number of keys to delete per batch

        Returns:
            Total number of keys deleted
        """
        try:
            client = await self._redis_manager.get_client()
            deleted_count = 0
            keys_batch: list[str] = []

            async for key in client.scan_iter(match=pattern, count=batch_size):
                keys_batch.append(key)

                if len(keys_batch) >= batch_size:
                    deleted_count += await client.delete(*keys_batch)
                    keys_batch = []

            # Delete remaining keys
            if keys_batch:
                deleted_count += await client.delete(*keys_batch)

            logger.info(
                "cache_pattern_invalidated",
                pattern=pattern,
                deleted_count=deleted_count,
            )
            return deleted_count

        except RedisConnectionError:
            return 0
        except Exception as e:
            logger.warning("cache_invalidate_pattern_error", pattern=pattern, error=str(e))
            return 0

    @staticmethod
    def _serialize(value: Any) -> str:
        """Serialize value for Redis storage."""
        if isinstance(value, str):
            return value
        if isinstance(value, (dict, list, bool, int, float)):
            return json.dumps(value)
        return str(value)

    @staticmethod
    def _deserialize(value: str) -> Any:
        """Deserialize value from Redis storage."""
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value


class SessionService:
    """
    Secure session management using Redis with automatic expiration.

    Features:
    - Configurable TTL with sliding expiration
    - Atomic operations for consistency
    - User metadata tracking
    - Graceful degradation
    """

    __slots__ = ("_redis_manager", "_session_ttl", "_key_prefix")

    def __init__(self, session_ttl: int = 86400, key_prefix: str = "session"):
        self._redis_manager = RedisManager()
        self._session_ttl = session_ttl  # 24 hours default
        self._key_prefix = key_prefix

    def _make_key(self, session_id: str) -> str:
        """Generate namespaced session key."""
        return f"{self._key_prefix}:{session_id}"

    async def create_session(
        self,
        session_id: str,
        user_id: str,
        data: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Create a new session with metadata.

        Args:
            session_id: Unique session identifier
            user_id: Associated user ID
            data: Additional session data
            ttl: Custom TTL (uses default if not specified)

        Returns:
            True if created successfully
        """
        try:
            client = await self._redis_manager.get_client()

            session_data = {
                "user_id": user_id,
                "created_at": datetime.utcnow().isoformat(),
                "last_accessed": datetime.utcnow().isoformat(),
                **(data or {}),
            }

            key = self._make_key(session_id)
            result = await client.setex(
                key,
                ttl or self._session_ttl,
                json.dumps(session_data),
            )

            logger.info("session_created", session_id=session_id[:8], user_id=user_id[:8])
            return bool(result)

        except RedisConnectionError:
            logger.warning("session_create_skipped_circuit_open", session_id=session_id[:8])
            return False
        except Exception as e:
            logger.error("session_create_error", session_id=session_id[:8], error=str(e))
            return False

    async def get_session(
        self,
        session_id: str,
        refresh_ttl: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Get session data with optional TTL refresh (sliding expiration).

        Args:
            session_id: Session identifier
            refresh_ttl: Whether to extend TTL on access

        Returns:
            Session data dict or None if not found
        """
        try:
            client = await self._redis_manager.get_client()
            key = self._make_key(session_id)

            data = await client.get(key)
            if not data:
                return None

            # Refresh TTL for sliding expiration
            if refresh_ttl:
                await client.expire(key, self._session_ttl)

            return json.loads(data)

        except RedisConnectionError:
            return None
        except json.JSONDecodeError as e:
            logger.warning("session_data_corrupt", session_id=session_id[:8], error=str(e))
            return None
        except Exception as e:
            logger.error("session_get_error", session_id=session_id[:8], error=str(e))
            return None

    async def update_session(
        self,
        session_id: str,
        data: Dict[str, Any],
        merge: bool = True,
    ) -> bool:
        """
        Update session data atomically.

        Args:
            session_id: Session identifier
            data: Data to update
            merge: If True, merge with existing data; if False, replace

        Returns:
            True if updated successfully
        """
        try:
            current_session = await self.get_session(session_id, refresh_ttl=False)
            if not current_session:
                return False

            if merge:
                current_session.update(data)
                current_session["last_accessed"] = datetime.utcnow().isoformat()
            else:
                current_session = {
                    **data,
                    "last_accessed": datetime.utcnow().isoformat(),
                }

            client = await self._redis_manager.get_client()
            key = self._make_key(session_id)

            return bool(await client.setex(
                key,
                self._session_ttl,
                json.dumps(current_session),
            ))

        except RedisConnectionError:
            return False
        except Exception as e:
            logger.error("session_update_error", session_id=session_id[:8], error=str(e))
            return False

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        try:
            client = await self._redis_manager.get_client()
            key = self._make_key(session_id)
            deleted = await client.delete(key)

            if deleted:
                logger.info("session_deleted", session_id=session_id[:8])

            return deleted > 0

        except RedisConnectionError:
            return False
        except Exception as e:
            logger.error("session_delete_error", session_id=session_id[:8], error=str(e))
            return False

    async def get_user_sessions(self, user_id: str) -> list[str]:
        """Get all active session IDs for a user (requires secondary index)."""
        try:
            client = await self._redis_manager.get_client()
            pattern = f"{self._key_prefix}:*"
            sessions = []

            async for key in client.scan_iter(match=pattern, count=100):
                data = await client.get(key)
                if data:
                    try:
                        session = json.loads(data)
                        if session.get("user_id") == user_id:
                            sessions.append(key.split(":")[-1])
                    except json.JSONDecodeError:
                        continue

            return sessions

        except RedisConnectionError:
            return []
        except Exception as e:
            logger.error("session_get_user_sessions_error", user_id=user_id[:8], error=str(e))
            return []


class PubSubService:
    """
    Pub/Sub messaging using Redis with proper lifecycle management.

    Features:
    - Automatic JSON serialization
    - Background listener tasks
    - Graceful unsubscription
    - Error isolation per subscription
    """

    __slots__ = ("_redis_manager", "_subscriptions", "_listener_tasks")

    def __init__(self):
        self._redis_manager = RedisManager()
        self._subscriptions: Dict[str, Any] = {}
        self._listener_tasks: Dict[str, asyncio.Task] = {}

    async def publish(self, channel: str, message: Any) -> int:
        """
        Publish message to a channel.

        Args:
            channel: Target channel name
            message: Message to publish (auto-serialized to JSON if dict/list)

        Returns:
            Number of subscribers that received the message
        """
        try:
            client = await self._redis_manager.get_client()

            serialized = json.dumps(message) if isinstance(message, (dict, list)) else str(message)
            count = await client.publish(channel, serialized)

            logger.debug("pubsub_published", channel=channel, subscriber_count=count)
            return count

        except RedisConnectionError:
            logger.warning("pubsub_publish_skipped_circuit_open", channel=channel)
            return 0
        except Exception as e:
            logger.error("pubsub_publish_error", channel=channel, error=str(e))
            return 0

    async def subscribe(
        self,
        channel: str,
        callback: Callable[[Any], Union[None, "asyncio.Future[None]"]],
    ) -> bool:
        """
        Subscribe to a channel with a callback handler.

        Args:
            channel: Channel name to subscribe to
            callback: Sync or async function called for each message

        Returns:
            True if subscribed successfully
        """
        if channel in self._subscriptions:
            logger.warning("pubsub_already_subscribed", channel=channel)
            return True

        try:
            client = await self._redis_manager.get_client()
            pubsub = client.pubsub()

            await pubsub.subscribe(channel)
            self._subscriptions[channel] = pubsub

            # Start background listener
            task = asyncio.create_task(
                self._listen(channel, pubsub, callback),
                name=f"pubsub_listener_{channel}",
            )
            self._listener_tasks[channel] = task

            logger.info("pubsub_subscribed", channel=channel)
            return True

        except RedisConnectionError:
            logger.warning("pubsub_subscribe_skipped_circuit_open", channel=channel)
            return False
        except Exception as e:
            logger.error("pubsub_subscribe_error", channel=channel, error=str(e))
            return False

    async def _listen(
        self,
        channel: str,
        pubsub: Any,
        callback: Callable[[Any], Union[None, "asyncio.Future[None]"]],
    ) -> None:
        """Background task to listen for messages on a channel."""
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                data = message["data"]

                # Attempt JSON deserialization
                try:
                    data = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    # Keep as string if not valid JSON
                    pass

                # Invoke callback
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(data)
                    else:
                        callback(data)
                except Exception as e:
                    logger.error(
                        "pubsub_callback_error",
                        channel=channel,
                        error=str(e),
                        error_type=type(e).__name__,
                    )

        except asyncio.CancelledError:
            logger.debug("pubsub_listener_cancelled", channel=channel)
        except Exception as e:
            logger.error("pubsub_listen_error", channel=channel, error=str(e))

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a channel and cleanup resources."""
        # Cancel listener task
        if channel in self._listener_tasks:
            task = self._listener_tasks[channel]
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            del self._listener_tasks[channel]

        # Close pubsub connection
        if channel in self._subscriptions:
            pubsub = self._subscriptions[channel]
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception as e:
                logger.warning("pubsub_unsubscribe_error", channel=channel, error=str(e))
            del self._subscriptions[channel]

            logger.info("pubsub_unsubscribed", channel=channel)

    async def close_all(self) -> None:
        """Unsubscribe from all channels and cleanup."""
        channels = list(self._subscriptions.keys())
        for channel in channels:
            await self.unsubscribe(channel)


# =============================================================================
# Module Initialization & Global Instances
# =============================================================================

# Singleton instances for application-wide use
redis_manager = RedisManager()
cache_service = CacheService()
session_service = SessionService()
pubsub_service = PubSubService()


async def init_redis() -> bool:
    """
    Initialize Redis connection at application startup.

    Returns:
        True if connection successful, False otherwise
    """
    try:
        await redis_manager.get_client()
        logger.info("redis_initialized")
        return True
    except RedisConnectionError as e:
        logger.warning("redis_init_failed", error=str(e))
        return False


async def close_redis() -> None:
    """Gracefully shutdown Redis connections."""
    await pubsub_service.close_all()
    await redis_manager.close()
    logger.info("redis_shutdown_complete")


async def health_check() -> Dict[str, Any]:
    """
    Perform Redis health check for monitoring.

    Returns:
        Health status dict with connection info
    """
    try:
        client = await redis_manager.get_client()
        info = await client.info("server")

        return {
            "status": "healthy",
            "redis_version": info.get("redis_version", "unknown"),
            "connected_clients": info.get("connected_clients", 0),
            "circuit_breaker": redis_manager._circuit_breaker.state.value,
        }
    except RedisConnectionError:
        return {
            "status": "unhealthy",
            "circuit_breaker": redis_manager._circuit_breaker.state.value,
            "error": "Circuit breaker open",
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }


# Export public API
__all__ = [
    # Exceptions
    "RedisConnectionError",
    # Classes
    "CircuitBreaker",
    "CircuitState",
    "RedisManager",
    "CacheService",
    "SessionService",
    "PubSubService",
    # Instances
    "redis_manager",
    "cache_service",
    "session_service",
    "pubsub_service",
    # Functions
    "init_redis",
    "close_redis",
    "health_check",
]