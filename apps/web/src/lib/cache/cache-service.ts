/**
 * Cache Service
 * Provides caching strategies and utilities for the application
 */

import redis from './redis-client';
import { redisHelper } from './redis-client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Compress large values
}

export class CacheService {
  private prefix: string;
  private defaultTTL: number;

  constructor(prefix: string = 'app:', defaultTTL: number = 3600) {
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get or set cache with callback
   */
  async remember<T>(
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.getKey(key);
    
    // Try to get from cache
    const cached = await redisHelper.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Get fresh value
    const value = await callback();
    
    // Store in cache
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Set cache value
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const cacheKey = this.getKey(key);
    const ttl = options.ttl || this.defaultTTL;
    
    await redisHelper.set(cacheKey, value, ttl);
    
    // Store tags for invalidation
    if (options.tags && options.tags.length > 0) {
      await this.addTags(key, options.tags);
    }
  }

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.getKey(key);
    return await redisHelper.get<T>(cacheKey);
  }

  /**
   * Delete cache value
   */
  async forget(key: string): Promise<void> {
    const cacheKey = this.getKey(key);
    await redisHelper.del(cacheKey);
  }

  /**
   * Clear all cache with specific tag
   */
  async invalidateTag(tag: string): Promise<void> {
    const tagKey = `${this.prefix}tag:${tag}`;
    const keys = await redis.smembers(tagKey);
    
    if (keys.length > 0) {
      await redisHelper.del(...keys.map(k => this.getKey(k)));
      await redis.del(tagKey);
    }
  }

  /**
   * Clear all cache with pattern
   */
  async flush(pattern?: string): Promise<void> {
    const searchPattern = pattern 
      ? `${this.prefix}${pattern}*`
      : `${this.prefix}*`;
    
    await redisHelper.clearPattern(searchPattern);
  }

  /**
   * Add tags to a cache key
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    const promises = tags.map(tag => {
      const tagKey = `${this.prefix}tag:${tag}`;
      return redis.sadd(tagKey, key);
    });
    
    await Promise.all(promises);
  }
}

// Pre-configured cache instances for different use cases
export const caches = {
  // General application cache (1 hour TTL)
  app: new CacheService('app:', 3600),
  
  // Session cache (24 hours TTL)
  session: new CacheService('session:', 86400),
  
  // API response cache (5 minutes TTL)
  api: new CacheService('api:', 300),
  
  // User-specific cache (30 minutes TTL)
  user: new CacheService('user:', 1800),
  
  // Real-time data cache (1 minute TTL)
  realtime: new CacheService('rt:', 60),
};

// Cache decorator for class methods
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Generate cache key from method name and arguments
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      return await caches.app.remember(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// Rate limiting using cache
export class RateLimiter {
  private cache: CacheService;
  private maxAttempts: number;
  private windowSeconds: number;

  constructor(maxAttempts: number = 10, windowSeconds: number = 60) {
    this.cache = new CacheService('ratelimit:', windowSeconds);
    this.maxAttempts = maxAttempts;
    this.windowSeconds = windowSeconds;
  }

  async attempt(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = identifier;
    const current = await redis.incr(this.cache['getKey'](key));
    
    if (current === 1) {
      await redis.expire(this.cache['getKey'](key), this.windowSeconds);
    }
    
    const allowed = current <= this.maxAttempts;
    const remaining = Math.max(0, this.maxAttempts - current);
    
    return { allowed, remaining };
  }

  async reset(identifier: string): Promise<void> {
    await this.cache.forget(identifier);
  }
}

export default CacheService;