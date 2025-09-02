/**
 * Redis Client Configuration
 * Handles connection to Redis for caching and session management
 */

import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    // Exponential backoff with max 3 seconds
    return Math.min(times * 50, 3000);
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect until first use
};

// Create Redis client instance
const redis = new Redis(redisConfig);

// Create a separate client for pub/sub if needed
const pubClient = new Redis(redisConfig);
const subClient = new Redis(redisConfig);

// Error handling
redis.on('error', (error) => {
  console.error('Redis Client Error:', error);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

redis.on('ready', () => {
  console.log('Redis Client Ready');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
  await pubClient.quit();
  await subClient.quit();
});

export { redis as default, pubClient, subClient };

// Helper functions for common operations
export const redisHelper = {
  /**
   * Set a value with optional TTL (in seconds)
   */
  async set(key: string, value: any, ttl?: number): Promise<'OK' | null> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      return await redis.setex(key, ttl, serialized);
    }
    return await redis.set(key, serialized);
  },

  /**
   * Get a value and parse it
   */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },

  /**
   * Set TTL on existing key (in seconds)
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await redis.expire(key, ttl);
    return result === 1;
  },

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return await redis.keys(pattern);
  },

  /**
   * Clear all keys with pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return await redis.incr(key);
  },

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    return await redis.decr(key);
  },
};