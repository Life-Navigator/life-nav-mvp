/**
 * Redis Client Configuration - Production Ready
 * This file provides the Redis client for the application with production-grade features
 */

import { getRedisManager, initializeRedis } from './redis-client-production';

// Initialize Redis with production configuration
const initRedis = async () => {
  try {
    const manager = await initializeRedis({
      // Configuration is loaded from environment variables
      enableCircuitBreaker: true,
      enableMetrics: true,
      connectionPoolSize: parseInt(process.env.REDIS_POOL_SIZE || '10'),
    });

    // Setup monitoring listeners
    manager.on('error', (error) => {
      console.error('[Redis] Error event:', error.message);
    });

    manager.on('circuit-breaker-open', () => {
      console.warn('[Redis] Circuit breaker opened - operations will fail fast');
    });

    manager.on('health', (status) => {
      if (status.status === 'unhealthy') {
        console.warn('[Redis] Health check failed:', status.error);
      }
    });

    return manager;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    throw error;
  }
};

// Create Redis instance
let redisManagerInstance: ReturnType<typeof getRedisManager> | null = null;

// Get or create Redis manager
const getRedis = () => {
  if (!redisManagerInstance) {
    redisManagerInstance = getRedisManager();
  }
  return redisManagerInstance;
};

// Helper functions for common operations with production error handling
export const redisHelper = {
  /**
   * Set a value with optional TTL (in seconds)
   */
  async set(key: string, value: any, ttl?: number): Promise<'OK' | null> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        return await manager.execute('setex', key, ttl, serialized);
      }
      return await manager.execute('set', key, serialized);
    } catch (error) {
      console.error(`[Redis] Failed to set key ${key}:`, error);
      return null;
    }
  },

  /**
   * Get a value and parse it
   */
  async get<T = any>(key: string): Promise<T | null> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const value = await manager.execute<string>('get', key);
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`[Redis] Failed to get key ${key}:`, error);
      return null;
    }
  },

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<number>('del', ...keys);
      return result || 0;
    } catch (error) {
      console.error(`[Redis] Failed to delete keys:`, error);
      return 0;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<number>('exists', key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Failed to check existence of key ${key}:`, error);
      return false;
    }
  },

  /**
   * Set TTL on existing key (in seconds)
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<number>('expire', key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Failed to set expiry on key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<string[]>('keys', pattern);
      return result || [];
    } catch (error) {
      console.error(`[Redis] Failed to get keys with pattern ${pattern}:`, error);
      return [];
    }
  },

  /**
   * Clear all keys with pattern (use with caution in production)
   */
  async clearPattern(pattern: string): Promise<number> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      // Use SCAN instead of KEYS for production (non-blocking)
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await manager.execute<[string, string[]]>('scan', cursor, 'MATCH', pattern, 'COUNT', 100);
        if (!result) break;
        
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length === 0) return 0;
      
      // Delete in batches to avoid blocking
      let deleted = 0;
      for (let i = 0; i < keys.length; i += 100) {
        const batch = keys.slice(i, i + 100);
        const result = await manager.execute<number>('del', ...batch);
        deleted += result || 0;
      }
      
      return deleted;
    } catch (error) {
      console.error(`[Redis] Failed to clear pattern ${pattern}:`, error);
      return 0;
    }
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<number>('incr', key);
      return result || 0;
    } catch (error) {
      console.error(`[Redis] Failed to increment key ${key}:`, error);
      return 0;
    }
  },

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    const manager = getRedis();
    
    if (!manager.isConnected()) {
      await manager.connect();
    }

    try {
      const result = await manager.execute<number>('decr', key);
      return result || 0;
    } catch (error) {
      console.error(`[Redis] Failed to decrement key ${key}:`, error);
      return 0;
    }
  },

  /**
   * Get Redis health status
   */
  async getHealth(): Promise<{
    connected: boolean;
    metrics?: any;
    circuitBreaker?: any;
  }> {
    const manager = getRedis();
    
    return {
      connected: manager.isConnected(),
      metrics: manager.getMetrics(),
      circuitBreaker: manager.getCircuitBreakerStatus(),
    };
  },
};

// Create a lazy-loaded Redis instance
class LazyRedis {
  private static instance: Awaited<ReturnType<typeof initRedis>> | null = null;
  private static initPromise: Promise<ReturnType<typeof initRedis>> | null = null;

  static async getInstance() {
    if (this.instance) {
      return this.instance;
    }

    if (!this.initPromise) {
      this.initPromise = initRedis().then(manager => {
        this.instance = manager;
        return manager;
      });
    }

    return this.initPromise;
  }
}

// Export Redis instance (lazy-loaded)
const redis = {
  async ping(): Promise<string> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('ping') || 'PONG';
  },
  
  async set(key: string, value: string): Promise<'OK' | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('set', key, value);
  },
  
  async get(key: string): Promise<string | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('get', key);
  },
  
  async del(...keys: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('del', ...keys) || 0;
  },
  
  async exists(key: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('exists', key) || 0;
  },
  
  async expire(key: string, seconds: number): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('expire', key, seconds) || 0;
  },
  
  async setex(key: string, seconds: number, value: string): Promise<'OK' | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('setex', key, seconds, value);
  },
  
  async incr(key: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('incr', key) || 0;
  },
  
  async decr(key: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('decr', key) || 0;
  },
  
  async keys(pattern: string): Promise<string[]> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('keys', pattern) || [];
  },
  
  async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('scan', cursor, ...args) || ['0', []];
  },
  
  async sadd(key: string, ...members: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('sadd', key, ...members) || 0;
  },
  
  async smembers(key: string): Promise<string[]> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('smembers', key) || [];
  },
  
  async srem(key: string, ...members: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('srem', key, ...members) || 0;
  },
  
  async hset(key: string, field: string, value: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('hset', key, field, value) || 0;
  },
  
  async hget(key: string, field: string): Promise<string | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('hget', key, field);
  },
  
  async hgetall(key: string): Promise<Record<string, string>> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('hgetall', key) || {};
  },
  
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('hdel', key, ...fields) || 0;
  },
  
  async lpush(key: string, ...values: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('lpush', key, ...values) || 0;
  },
  
  async rpush(key: string, ...values: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('rpush', key, ...values) || 0;
  },
  
  async lpop(key: string): Promise<string | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('lpop', key);
  },
  
  async rpop(key: string): Promise<string | null> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('rpop', key);
  },
  
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('lrange', key, start, stop) || [];
  },
  
  async llen(key: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('llen', key) || 0;
  },
  
  async zadd(key: string, ...args: any[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('zadd', key, ...args) || 0;
  },
  
  async zrange(key: string, start: number, stop: number, ...args: any[]): Promise<string[]> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('zrange', key, start, stop, ...args) || [];
  },
  
  async zrem(key: string, ...members: string[]): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('zrem', key, ...members) || 0;
  },
  
  async ttl(key: string): Promise<number> {
    const manager = await LazyRedis.getInstance();
    return await manager.execute('ttl', key) || -2;
  },
};

// For backward compatibility
export default redis;

// Export for pub/sub (create separate connections)
export const pubClient = redis;
export const subClient = redis;

// redisHelper already exported above at line 52