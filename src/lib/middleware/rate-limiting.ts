/**
 * Rate limiting middleware for API routes
 */
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Define rate limiting constants
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_AUTH = 10;      // 10 requests per minute for auth endpoints
const MAX_REQUESTS_SENSITIVE = 20; // 20 requests per minute for sensitive operations
const MAX_REQUESTS_STANDARD = 50;  // 50 requests per minute for standard endpoints

// Connect to Redis for rate limiting
// In production, use environment variables for connection details
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.error('Failed to connect to Redis for rate limiting:', error);
}

interface RateLimitConfig {
  maxRequests: number;
  windowSizeMs: number;
  keyPrefix: string;
}

/**
 * Generate a rate limit key from the request
 */
function getRateLimitKey(req: NextRequest, keyPrefix: string): string {
  // Use user IP as the primary identifier
  const ip = req.ip || 'unknown';
  
  // Add user ID from headers if available
  const userId = req.headers.get('x-user-id') || '';
  
  // Generate rate limit key
  return `${keyPrefix}:${ip}:${userId}`;
}

/**
 * Check if the request exceeds rate limits
 */
async function checkRateLimit(
  req: NextRequest, 
  config: RateLimitConfig
): Promise<{
  allowed: boolean; 
  current: number; 
  remaining: number; 
  resetMs: number;
}> {
  // If Redis is not available, bypass rate limiting
  if (!redis) {
    return { allowed: true, current: 0, remaining: config.maxRequests, resetMs: 0 };
  }
  
  const key = getRateLimitKey(req, config.keyPrefix);
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowSizeMs) * config.windowSizeMs;
  
  const countKey = `${key}:${windowStart}`;
  const resetMs = windowStart + config.windowSizeMs - now;
  
  try {
    // Increment the counter
    const current = await redis.incr(countKey);
    
    // Set expiry on the key if it's new
    if (current === 1) {
      await redis.expire(countKey, Math.ceil(config.windowSizeMs / 1000));
    }
    
    // Check if rate limit is exceeded
    const remaining = Math.max(0, config.maxRequests - current);
    const allowed = current <= config.maxRequests;
    
    return { allowed, current, remaining, resetMs };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // If Redis fails, bypass rate limiting
    return { allowed: true, current: 0, remaining: config.maxRequests, resetMs: 0 };
  }
}

/**
 * Set rate limit headers on the response
 */
function setRateLimitHeaders(
  res: NextResponse,
  rateLimit: { current: number; remaining: number; resetMs: number },
  config: RateLimitConfig
): NextResponse {
  res.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  res.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.headers.set('X-RateLimit-Reset', (Math.ceil(Date.now() + rateLimit.resetMs) / 1000).toString());

  return res;
}

/**
 * Create a rate-limited middleware handler
 */
function createRateLimitedHandler(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig
) {
  return async (req: NextRequest) => {
    const rateLimit = await checkRateLimit(req, config);
    
    // If rate limit is exceeded, return 429 Too Many Requests
    if (!rateLimit.allowed) {
      const res = NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil(rateLimit.resetMs / 1000),
        },
        { status: 429 }
      );

      res.headers.set('Retry-After', Math.ceil(rateLimit.resetMs / 1000).toString());
      return setRateLimitHeaders(res, rateLimit, config);
    }

    // Otherwise, process the request
    const response = await handler(req);

    // Add rate limit headers to the response
    return setRateLimitHeaders(response, rateLimit, config);
  };
}

// Prebuilt rate limiters for different types of endpoints
export const rateLimiters = {
  /**
   * Rate limiter for authentication endpoints (login, register, etc.)
   */
  auth: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) => 
    createRateLimitedHandler(handler, {
      maxRequests: MAX_REQUESTS_AUTH,
      windowSizeMs: WINDOW_SIZE_MS,
      keyPrefix: 'rl:auth',
    }),
  
  /**
   * Rate limiter for sensitive operations (password reset, email change, etc.)
   */
  sensitive: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) => 
    createRateLimitedHandler(handler, {
      maxRequests: MAX_REQUESTS_SENSITIVE,
      windowSizeMs: WINDOW_SIZE_MS,
      keyPrefix: 'rl:sensitive',
    }),
  
  /**
   * Rate limiter for standard API endpoints
   */
  standard: (handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) => 
    createRateLimitedHandler(handler, {
      maxRequests: MAX_REQUESTS_STANDARD,
      windowSizeMs: WINDOW_SIZE_MS,
      keyPrefix: 'rl:standard',
    }),
  
  /**
   * Custom rate limiter with specified configuration
   */
  custom: (
    handler: (req: NextRequest) => Promise<NextResponse> | NextResponse,
    maxRequests: number,
    windowSizeMs: number = WINDOW_SIZE_MS,
    keyPrefix: string = 'rl:custom'
  ) => 
    createRateLimitedHandler(handler, {
      maxRequests,
      windowSizeMs,
      keyPrefix,
    }),
};