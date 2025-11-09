"""
Redis Configuration and Management
Caching, session management, and pub/sub
"""

import redis.asyncio as redis
from typing import Optional, Any, Dict
import json
import pickle
from datetime import timedelta
import structlog

from app.core.config import settings

logger = structlog.get_logger()

class RedisManager:
    """
    Redis connection manager with connection pooling
    """
    
    _instance: Optional['RedisManager'] = None
    _redis_client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def get_client(self) -> redis.Redis:
        """Get or create Redis client with connection pooling"""
        if not self._redis_client:
            try:
                self._redis_client = await redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    max_connections=50,
                    socket_keepalive=True,
                    socket_keepalive_options={
                        1: 1,  # TCP_KEEPIDLE
                        2: 1,  # TCP_KEEPINTVL
                        3: 3,  # TCP_KEEPCNT
                    },
                    retry_on_timeout=True,
                    retry_on_error=[ConnectionError, TimeoutError],
                )
                
                # Test connection
                await self._redis_client.ping()
                logger.info("Redis connection established")
                
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise
        
        return self._redis_client
    
    async def close(self):
        """Close Redis connection"""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
            logger.info("Redis connection closed")


class CacheService:
    """
    High-level caching service with multiple strategies
    """
    
    def __init__(self):
        self.redis_manager = RedisManager()
        self.default_ttl = settings.CACHE_TTL
    
    async def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache"""
        try:
            client = await self.redis_manager.get_client()
            value = await client.get(key)
            
            if value is None:
                return default
            
            # Try to deserialize JSON
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                # Return as string if not JSON
                return value
                
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return default
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        nx: bool = False,
        xx: bool = False
    ) -> bool:
        """
        Set value in cache
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            nx: Only set if key doesn't exist
            xx: Only set if key exists
        """
        try:
            client = await self.redis_manager.get_client()
            
            # Serialize value
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            elif not isinstance(value, str):
                value = str(value)
            
            # Set with options
            return await client.set(
                key,
                value,
                ex=ttl or self.default_ttl,
                nx=nx,
                xx=xx
            )
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, *keys: str) -> int:
        """Delete one or more keys"""
        try:
            client = await self.redis_manager.get_client()
            return await client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return 0
    
    async def exists(self, *keys: str) -> int:
        """Check if keys exist"""
        try:
            client = await self.redis_manager.get_client()
            return await client.exists(*keys)
        except Exception as e:
            logger.error(f"Cache exists error: {e}")
            return 0
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on key"""
        try:
            client = await self.redis_manager.get_client()
            return await client.expire(key, ttl)
        except Exception as e:
            logger.error(f"Cache expire error for key {key}: {e}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a counter"""
        try:
            client = await self.redis_manager.get_client()
            return await client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {e}")
            return None
    
    async def get_or_set(
        self,
        key: str,
        factory_fn,
        ttl: Optional[int] = None
    ) -> Any:
        """Get from cache or compute and set"""
        # Try to get from cache
        value = await self.get(key)
        if value is not None:
            return value
        
        # Compute value
        if callable(factory_fn):
            value = await factory_fn() if asyncio.iscoroutinefunction(factory_fn) else factory_fn()
        else:
            value = factory_fn
        
        # Cache the value
        await self.set(key, value, ttl)
        
        return value
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            client = await self.redis_manager.get_client()
            
            # Find all keys matching pattern
            keys = []
            async for key in client.scan_iter(match=pattern):
                keys.append(key)
            
            # Delete keys in batches
            if keys:
                return await client.delete(*keys)
            
            return 0
            
        except Exception as e:
            logger.error(f"Cache invalidate pattern error: {e}")
            return 0


class SessionService:
    """
    Session management using Redis
    """
    
    def __init__(self):
        self.redis_manager = RedisManager()
        self.session_ttl = 86400  # 24 hours
    
    async def create_session(
        self,
        session_id: str,
        user_id: str,
        data: Dict[str, Any]
    ) -> bool:
        """Create a new session"""
        try:
            client = await self.redis_manager.get_client()
            
            session_data = {
                "user_id": user_id,
                "created_at": datetime.utcnow().isoformat(),
                **data
            }
            
            return await client.setex(
                f"session:{session_id}",
                self.session_ttl,
                json.dumps(session_data)
            )
            
        except Exception as e:
            logger.error(f"Session create error: {e}")
            return False
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        try:
            client = await self.redis_manager.get_client()
            data = await client.get(f"session:{session_id}")
            
            if data:
                # Refresh TTL on access
                await client.expire(f"session:{session_id}", self.session_ttl)
                return json.loads(data)
            
            return None
            
        except Exception as e:
            logger.error(f"Session get error: {e}")
            return None
    
    async def update_session(
        self,
        session_id: str,
        data: Dict[str, Any]
    ) -> bool:
        """Update session data"""
        current_session = await self.get_session(session_id)
        if not current_session:
            return False
        
        current_session.update(data)
        
        try:
            client = await self.redis_manager.get_client()
            return await client.setex(
                f"session:{session_id}",
                self.session_ttl,
                json.dumps(current_session)
            )
        except Exception as e:
            logger.error(f"Session update error: {e}")
            return False
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        try:
            client = await self.redis_manager.get_client()
            return await client.delete(f"session:{session_id}") > 0
        except Exception as e:
            logger.error(f"Session delete error: {e}")
            return False


class PubSubService:
    """
    Pub/Sub messaging using Redis
    """
    
    def __init__(self):
        self.redis_manager = RedisManager()
        self.subscriptions = {}
    
    async def publish(self, channel: str, message: Any) -> int:
        """Publish message to channel"""
        try:
            client = await self.redis_manager.get_client()
            
            if isinstance(message, (dict, list)):
                message = json.dumps(message)
            
            return await client.publish(channel, message)
            
        except Exception as e:
            logger.error(f"Publish error to channel {channel}: {e}")
            return 0
    
    async def subscribe(self, channel: str, callback):
        """Subscribe to channel with callback"""
        try:
            client = await self.redis_manager.get_client()
            pubsub = client.pubsub()
            
            await pubsub.subscribe(channel)
            self.subscriptions[channel] = pubsub
            
            # Start listening in background
            asyncio.create_task(self._listen(pubsub, callback))
            
            logger.info(f"Subscribed to channel: {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Subscribe error for channel {channel}: {e}")
            return False
    
    async def _listen(self, pubsub, callback):
        """Listen for messages and call callback"""
        try:
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = message['data']
                    
                    # Try to parse JSON
                    try:
                        data = json.loads(data)
                    except Exception as e:
                        # Log error for debugging
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.debug(f"Operation failed: {e}")
                        pass
                    
                    # Call callback
                    if asyncio.iscoroutinefunction(callback):
                        await callback(data)
                    else:
                        callback(data)
                        
        except Exception as e:
            logger.error(f"Pubsub listen error: {e}")
    
    async def unsubscribe(self, channel: str):
        """Unsubscribe from channel"""
        if channel in self.subscriptions:
            pubsub = self.subscriptions[channel]
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            del self.subscriptions[channel]
            logger.info(f"Unsubscribed from channel: {channel}")


# Import required modules
import asyncio
from datetime import datetime

# Global instances
redis_manager = RedisManager()
cache_service = CacheService()
session_service = SessionService()
pubsub_service = PubSubService()

async def init_redis():
    """Initialize Redis connection"""
    await redis_manager.get_client()

async def close_redis():
    """Close Redis connection"""
    await redis_manager.close()