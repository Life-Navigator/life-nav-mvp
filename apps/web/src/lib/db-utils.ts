import { db } from './db';

/**
 * Safely execute a database query with automatic retry on connection timeout
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if it's a connection timeout error
      const isTimeoutError =
        error.message?.includes('timeout') ||
        error.message?.includes('Unable to check out process from the pool') ||
        error.code === 'P2024';

      if (isTimeoutError && attempt < maxRetries) {
        console.warn(`Database timeout on attempt ${attempt + 1}, retrying...`);

        // Wait before retrying with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        continue;
      }

      // If it's not a timeout error or we've exhausted retries, throw
      throw error;
    }
  }

  throw lastError || new Error('Database operation failed');
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if ('$queryRaw' in db) {
      await (db as any).$queryRaw`SELECT 1 as result`;
      return true;
    }
    return true; // Mock DB is always healthy
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database connection stats (if available)
 */
export async function getDatabaseStats() {
  try {
    if ('$metrics' in db) {
      return await (db as any).$metrics.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
}
