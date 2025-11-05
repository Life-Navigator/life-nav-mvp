/**
 * API Cache Strategy
 * Caches API responses to improve performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { caches } from '../cache-service';
import crypto from 'crypto';

export interface ApiCacheOptions {
  ttl?: number;
  varyBy?: string[]; // Headers to vary cache by
  tags?: string[];
  condition?: (req: NextRequest) => boolean;
}

export class ApiCache {
  private static instance: ApiCache;
  private cache = caches.api;

  private constructor() {}

  static getInstance(): ApiCache {
    if (!ApiCache.instance) {
      ApiCache.instance = new ApiCache();
    }
    return ApiCache.instance;
  }

  /**
   * Generate cache key from request
   */
  private generateKey(req: NextRequest, varyBy: string[] = []): string {
    const url = req.url;
    const method = req.method;
    const userId = req.headers.get('x-user-id') || 'anonymous';
    
    // Include specified headers in cache key
    const varyHeaders = varyBy
      .map(header => `${header}:${req.headers.get(header) || ''}`)
      .join(':');
    
    const keyString = `${method}:${url}:${userId}:${varyHeaders}`;
    
    // Hash the key to keep it manageable
    return crypto
      .createHash('md5')
      .update(keyString)
      .digest('hex');
  }

  /**
   * Cache middleware for API routes
   */
  middleware(options: ApiCacheOptions = {}) {
    return async (
      req: NextRequest,
      handler: () => Promise<NextResponse>
    ): Promise<NextResponse> => {
      // Check if caching should be applied
      if (options.condition && !options.condition(req)) {
        return handler();
      }

      // Only cache GET requests by default
      if (req.method !== 'GET') {
        return handler();
      }

      const cacheKey = this.generateKey(req, options.varyBy);
      
      // Try to get from cache
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        // Return cached response
        const response = NextResponse.json(cached.data, {
          status: cached.status || 200,
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            ...cached.headers,
          },
        });
        return response;
      }

      // Execute handler
      const response = await handler();
      
      // Only cache successful responses
      if (response.status === 200) {
        const data = await response.json();
        
        await this.cache.set(
          cacheKey,
          {
            data,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
          },
          {
            ttl: options.ttl || 300, // 5 minutes default
            tags: options.tags,
          }
        );

        // Return new response with cache headers
        return NextResponse.json(data, {
          status: response.status,
          headers: {
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
          },
        });
      }

      return response;
    };
  }

  /**
   * Invalidate API cache by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    await this.cache.flush(pattern);
  }

  /**
   * Invalidate API cache by tag
   */
  async invalidateTag(tag: string): Promise<void> {
    await this.cache.invalidateTag(tag);
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUp(key: string, data: any, options: ApiCacheOptions = {}): Promise<void> {
    await this.cache.set(key, data, {
      ttl: options.ttl || 300,
      tags: options.tags,
    });
  }
}

export const apiCache = ApiCache.getInstance();

/**
 * Decorator for caching API route handlers
 */
export function CachedRoute(options: ApiCacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: NextRequest, ...args: any[]) {
      return apiCache.middleware(options)(req, () => 
        originalMethod.apply(this, [req, ...args])
      );
    };

    return descriptor;
  };
}

/**
 * Helper to create cached API route
 */
export function createCachedHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ApiCacheOptions = {}
) {
  return async (req: NextRequest) => {
    return apiCache.middleware(options)(req, () => handler(req));
  };
}