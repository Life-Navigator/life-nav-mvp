import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import redis from '@/lib/cache/redis-client';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      usage: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
      };
      percentage: number;
    };
  };
  environment: string;
  version: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization');
  
  // Basic auth check for production (optional)
  if (process.env.NODE_ENV === 'production' && process.env.HEALTH_CHECK_TOKEN) {
    if (authHeader !== `Bearer ${process.env.HEALTH_CHECK_TOKEN}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'down' },
      redis: { status: 'down' },
      memory: {
        status: 'ok',
        usage: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
        },
        percentage: 0,
      },
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
  };

  // Check database connection
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
    health.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const redisStart = Date.now();
    await redis.ping();
    health.checks.redis = {
      status: 'up',
      latency: Date.now() - redisStart,
    };
  } catch (error) {
    health.checks.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
    // Redis being down is degraded, not unhealthy (cache can be skipped)
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const memPercentage = (usedMem / totalMem) * 100;

  health.checks.memory = {
    status: memPercentage > 90 ? 'critical' : memPercentage > 70 ? 'warning' : 'ok',
    usage: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    },
    percentage: Math.round(memPercentage),
  };

  if (health.checks.memory.status === 'critical') {
    health.status = 'unhealthy';
  } else if (health.checks.memory.status === 'warning' && health.status === 'healthy') {
    health.status = 'degraded';
  }

  // Calculate total response time
  const responseTime = Date.now() - startTime;

  // Return appropriate status code based on health
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(
    {
      ...health,
      responseTime,
    },
    { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      },
    }
  );
}

// Liveness check - simpler endpoint for container orchestration
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}