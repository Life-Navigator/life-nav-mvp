/**
 * Scenario Lab Health Check Endpoint
 *
 * Purpose: Verify that the foundation layer is working
 * Tests:
 * - Foundation files are importable
 * - Supabase connection works
 * - Feature flag is readable
 * - Types are valid
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {};

    // Check 1: Feature flag
    checks.feature_flag = {
      status: 'pass',
      message: `FEATURE_SCENARIO_LAB_ENABLED=${process.env.FEATURE_SCENARIO_LAB_ENABLED || 'not set'}`,
    };

    // Check 2: Supabase connection
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('scenario_labs')
        .select('id')
        .limit(1);

      if (error) {
        checks.supabase_connection = {
          status: 'fail',
          message: `Supabase error: ${error.message}`,
        };
      } else {
        checks.supabase_connection = {
          status: 'pass',
          message: 'Table scenario_labs is accessible',
        };
      }
    } catch (err) {
      checks.supabase_connection = {
        status: 'fail',
        message: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 3: Storage buckets
    try {
      const { data: buckets, error } = await (supabaseAdmin as any).storage.listBuckets();

      if (error) {
        checks.storage_buckets = {
          status: 'fail',
          message: `Storage error: ${error.message}`,
        };
      } else {
        const scenarioBuckets = buckets.filter(
          (b) => b.id === 'scenario-docs' || b.id === 'scenario-reports'
        );
        checks.storage_buckets = {
          status: scenarioBuckets.length === 2 ? 'pass' : 'fail',
          message: `Found ${scenarioBuckets.length}/2 required buckets`,
        };
      }
    } catch (err) {
      checks.storage_buckets = {
        status: 'fail',
        message: `Storage error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 4: Job queue table
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('scenario_jobs')
        .select('id')
        .limit(1);

      if (error) {
        checks.job_queue = {
          status: 'fail',
          message: `Jobs table error: ${error.message}`,
        };
      } else {
        checks.job_queue = {
          status: 'pass',
          message: 'Table scenario_jobs is accessible',
        };
      }
    } catch (err) {
      checks.job_queue = {
        status: 'fail',
        message: `Jobs table error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 5: Types are importable
    try {
      // Dynamic import to test types file
      await import('@/lib/scenario-lab/types');
      checks.types = {
        status: 'pass',
        message: 'Types module loaded successfully',
      };
    } catch (err) {
      checks.types = {
        status: 'fail',
        message: `Types error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 6: Validation is importable
    try {
      await import('@/lib/scenario-lab/validation');
      checks.validation = {
        status: 'pass',
        message: 'Validation module loaded successfully',
      };
    } catch (err) {
      checks.validation = {
        status: 'fail',
        message: `Validation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 7: Job queue helpers
    try {
      await import('@/lib/scenario-lab/job-queue');
      checks.job_queue_helpers = {
        status: 'pass',
        message: 'Job queue module loaded successfully',
      };
    } catch (err) {
      checks.job_queue_helpers = {
        status: 'fail',
        message: `Job queue error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Check 8: Rate limiter
    try {
      await import('@/lib/scenario-lab/rate-limiter');
      checks.rate_limiter = {
        status: 'pass',
        message: 'Rate limiter module loaded successfully',
      };
    } catch (err) {
      checks.rate_limiter = {
        status: 'fail',
        message: `Rate limiter error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const allPassed = Object.values(checks).every((c) => c.status === 'pass');
    const passCount = Object.values(checks).filter((c) => c.status === 'pass').length;
    const totalCount = Object.keys(checks).length;

    return NextResponse.json(
      {
        status: allPassed ? 'healthy' : 'degraded',
        summary: `${passCount}/${totalCount} checks passed`,
        checks,
        timestamp: new Date().toISOString(),
      },
      {
        status: allPassed ? 200 : 503,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  }
}
