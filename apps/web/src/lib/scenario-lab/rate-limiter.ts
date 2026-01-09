/**
 * Scenario Lab - Rate Limiter
 *
 * Database-backed rate limiting using scenario_jobs table
 */

import { supabaseAdmin } from './supabase-client';
import { RateLimitCheck } from './types';

// Rate limit configurations
const RATE_LIMITS = {
  upload: {
    count: 5,
    window_hours: 1,
    job_type: 'OCR' as const,
  },
  simulation: {
    count: 20,
    window_minutes: 15,
    job_type: 'SIMULATE' as const,
  },
  pdf: {
    count: 10,
    window_hours: 24,
    job_type: 'PDF' as const,
  },
};

/**
 * Check if user is within rate limit
 */
export async function checkRateLimit(
  userId: string,
  limitType: 'upload' | 'simulation' | 'pdf'
): Promise<RateLimitCheck> {
  const config = RATE_LIMITS[limitType];

  // Calculate window start time
  const windowStart = new Date();
  if ('window_hours' in config) {
    windowStart.setHours(windowStart.getHours() - config.window_hours);
  } else if ('window_minutes' in config) {
    windowStart.setMinutes(windowStart.getMinutes() - config.window_minutes);
  }

  // Count recent jobs of this type
  const { count, error } = await supabaseAdmin
    .from('scenario_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('job_type', config.job_type)
    .gte('created_at', windowStart.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow the request if we can't check
    return {
      limit_key: `${userId}:${limitType}`,
      limit_type: limitType,
      allowed: true,
      current_count: 0,
      limit: config.count,
      reset_at: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  const currentCount = count || 0;
  const allowed = currentCount < config.count;

  // Calculate reset time
  const resetAt = new Date();
  if ('window_hours' in config) {
    resetAt.setHours(resetAt.getHours() + config.window_hours);
  } else if ('window_minutes' in config) {
    resetAt.setMinutes(resetAt.getMinutes() + config.window_minutes);
  }

  return {
    limit_key: `${userId}:${limitType}`,
    limit_type: limitType,
    allowed,
    current_count: currentCount,
    limit: config.count,
    reset_at: resetAt.toISOString(),
  };
}

/**
 * Enforce rate limit - throws error if exceeded
 */
export async function enforceRateLimit(
  userId: string,
  limitType: 'upload' | 'simulation' | 'pdf'
): Promise<void> {
  const check = await checkRateLimit(userId, limitType);

  if (!check.allowed) {
    const resetDate = new Date(check.reset_at);
    const minutesUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / 60000);

    throw new Error(
      `Rate limit exceeded. You've used ${check.current_count}/${check.limit} ${limitType}s. ` +
      `Try again in ${minutesUntilReset} minutes.`
    );
  }
}
