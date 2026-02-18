"""
Rate Limiting Middleware
Production-grade rate limiting with Redis backend
"""

import time
import hashlib
from typing import Optional, Callable, Dict
from fastapi import Request, Response, HTTPException, status
import redis.asyncio as redis
from datetime import datetime, timedelta
import json
import structlog

from app.core.config import settings

logger = structlog.get_logger()

class RateLimitMiddleware:
    """
    Advanced rate limiting with multiple strategies
    """
    
    def __init__(self, app):
        self.app = app
        self.redis_client: Optional[redis.Redis] = None
        
        # Rate limit configurations
        self.default_limits = {
            "requests": settings.RATE_LIMIT_REQUESTS,  # 100 requests
            "period": settings.RATE_LIMIT_PERIOD,  # 60 seconds
        }
        
        # Endpoint-specific limits
        self.endpoint_limits = {
            "/api/v1/market/quotes/bulk": {"requests": 20, "period": 60},
            "/api/v1/documents/upload": {"requests": 10, "period": 300},
            "/api/v1/auth/login": {"requests": 5, "period": 60},
            "/api/v1/auth/register": {"requests": 3, "period": 300},
        }
        
        # User tier limits (requests per minute)
        self.tier_limits = {
            "free": {"requests": 60, "period": 60},
            "premium": {"requests": 300, "period": 60},
            "enterprise": {"requests": 1000, "period": 60},
        }
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks and docs
        if request.url.path in ["/health", "/api/docs", "/api/openapi.json"]:
            return await call_next(request)
        
        # Initialize Redis connection if not exists
        if not self.redis_client:
            try:
                self.redis_client = await redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
            except Exception as e:
                logger.warning(f"Redis connection failed, using in-memory rate limiting: {e}")
                # Fall back to in-memory rate limiting
                return await self._fallback_rate_limit(request, call_next)
        
        # Get client identifier
        client_id = self._get_client_identifier(request)
        
        # Get rate limit for this request
        limit_config = self._get_limit_config(request)
        
        # Check rate limit
        try:
            allowed = await self._check_rate_limit(client_id, limit_config)
            
            if not allowed:
                # Get current usage for headers
                usage = await self._get_usage(client_id, limit_config)
                
                logger.warning(
                    "rate_limit_exceeded",
                    client_id=client_id,
                    path=request.url.path,
                    usage=usage
                )
                
                # Return 429 with retry information
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                    headers={
                        "X-RateLimit-Limit": str(limit_config["requests"]),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time()) + limit_config["period"]),
                        "Retry-After": str(limit_config["period"])
                    }
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            usage = await self._get_usage(client_id, limit_config)
            response.headers["X-RateLimit-Limit"] = str(limit_config["requests"])
            response.headers["X-RateLimit-Remaining"] = str(max(0, limit_config["requests"] - usage))
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + limit_config["period"])
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # On error, allow request but log
            return await call_next(request)
    
    def _get_client_identifier(self, request: Request) -> str:
        """
        Get unique client identifier for rate limiting
        Priority: User ID > API Key > IP Address
        """
        # Try to get user ID from request state (set by auth middleware)
        if hasattr(request.state, "user_id"):
            return f"user:{request.state.user_id}"
        
        # Try to get API key
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api:{api_key[:16]}"  # Use first 16 chars
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        
        # Handle proxy headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"
    
    def _get_limit_config(self, request: Request) -> Dict:
        """
        Get rate limit configuration for the request
        """
        # Check endpoint-specific limits
        for path_pattern, limits in self.endpoint_limits.items():
            if request.url.path.startswith(path_pattern):
                return limits
        
        # Check user tier limits
        if hasattr(request.state, "user_tier"):
            tier = request.state.user_tier
            if tier in self.tier_limits:
                return self.tier_limits[tier]
        
        # Default limits
        return self.default_limits
    
    async def _check_rate_limit(self, client_id: str, limit_config: Dict) -> bool:
        """
        Check if request is within rate limit using sliding window
        """
        now = time.time()
        window_start = now - limit_config["period"]
        
        # Redis key for this client
        key = f"rate_limit:{client_id}"
        
        # Remove old entries and count current window
        pipe = self.redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, limit_config["period"] + 1)
        
        results = await pipe.execute()
        current_requests = results[1]
        
        return current_requests < limit_config["requests"]
    
    async def _get_usage(self, client_id: str, limit_config: Dict) -> int:
        """
        Get current usage count for the client
        """
        now = time.time()
        window_start = now - limit_config["period"]
        key = f"rate_limit:{client_id}"
        
        # Count requests in current window
        count = await self.redis_client.zcount(key, window_start, now)
        return count
    
    async def _fallback_rate_limit(self, request: Request, call_next: Callable) -> Response:
        """
        Fallback in-memory rate limiting when Redis is unavailable
        Simple implementation - not recommended for production
        """
        # Simple in-memory storage (not distributed)
        if not hasattr(self, "_memory_limits"):
            self._memory_limits = {}
        
        client_id = self._get_client_identifier(request)
        now = time.time()
        
        # Clean old entries
        self._memory_limits = {
            k: [t for t in v if t > now - 60]
            for k, v in self._memory_limits.items()
        }
        
        # Check limit
        if client_id not in self._memory_limits:
            self._memory_limits[client_id] = []
        
        if len(self._memory_limits[client_id]) >= self.default_limits["requests"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
        
        self._memory_limits[client_id].append(now)
        
        return await call_next(request)


class AdaptiveRateLimiter:
    """
    Advanced adaptive rate limiting based on system load
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.base_limit = 100
        self.min_limit = 10
        self.max_limit = 1000
    
    async def get_adaptive_limit(self) -> int:
        """
        Calculate adaptive rate limit based on system metrics
        """
        # Get system metrics from Redis
        cpu_usage = await self._get_metric("system:cpu_usage") or 50
        memory_usage = await self._get_metric("system:memory_usage") or 50
        response_time = await self._get_metric("system:avg_response_time") or 100
        
        # Calculate load factor (0-1)
        load_factor = (
            (cpu_usage / 100 * 0.3) +
            (memory_usage / 100 * 0.3) +
            (min(response_time / 1000, 1) * 0.4)
        )
        
        # Adjust limit based on load
        if load_factor < 0.5:
            # Low load - increase limits
            adaptive_limit = int(self.base_limit * (2 - load_factor))
        else:
            # High load - decrease limits
            adaptive_limit = int(self.base_limit * (1.5 - load_factor))
        
        # Apply bounds
        return max(self.min_limit, min(adaptive_limit, self.max_limit))
    
    async def _get_metric(self, key: str) -> Optional[float]:
        """Get system metric from Redis"""
        try:
            value = await self.redis_client.get(key)
            return float(value) if value else None
        except Exception as e:
            # Specific exception caught for better error handling
            return None