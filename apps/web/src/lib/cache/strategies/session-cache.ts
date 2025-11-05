/**
 * Session Cache Strategy
 * Manages user session caching with Redis
 */

import { caches } from '../cache-service';
import type { User } from '@prisma/client';

export interface SessionData {
  user: Partial<User>;
  permissions?: string[];
  preferences?: Record<string, any>;
  lastActivity: Date;
}

export class SessionCache {
  private static instance: SessionCache;
  private cache = caches.session;

  private constructor() {}

  static getInstance(): SessionCache {
    if (!SessionCache.instance) {
      SessionCache.instance = new SessionCache();
    }
    return SessionCache.instance;
  }

  /**
   * Store user session
   */
  async setSession(userId: string, data: SessionData): Promise<void> {
    const key = `session:${userId}`;
    await this.cache.set(key, data, {
      ttl: 86400, // 24 hours
      tags: ['sessions', `user:${userId}`],
    });
  }

  /**
   * Get user session
   */
  async getSession(userId: string): Promise<SessionData | null> {
    const key = `session:${userId}`;
    return await this.cache.get<SessionData>(key);
  }

  /**
   * Update session activity
   */
  async touchSession(userId: string): Promise<void> {
    const session = await this.getSession(userId);
    if (session) {
      session.lastActivity = new Date();
      await this.setSession(userId, session);
    }
  }

  /**
   * Delete user session
   */
  async destroySession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.cache.forget(key);
  }

  /**
   * Delete all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    await this.cache.invalidateTag(`user:${userId}`);
  }

  /**
   * Store user preferences in session
   */
  async setPreferences(userId: string, preferences: Record<string, any>): Promise<void> {
    const session = await this.getSession(userId);
    if (session) {
      session.preferences = preferences;
      await this.setSession(userId, session);
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    const keys = await this.cache['flush']('session:*');
    return keys ? 1 : 0; // This is simplified, implement proper counting
  }
}

export const sessionCache = SessionCache.getInstance();