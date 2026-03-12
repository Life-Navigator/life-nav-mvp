/**
 * Scenario Lab Job Status Endpoint
 *
 * GET /api/scenario-lab/jobs/[id]
 * Returns job status for polling (OCR, simulation, PDF jobs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { getJob } from '@/lib/scenario-lab/job-queue';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Feature flag check
    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const jobId = params.id;

    // Get job
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify ownership
    if (job.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Return job data
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        job_type: job.job_type,
        progress: job.output_json?.progress ?? null,
        result_json: job.output_json ?? null,
        error: job.error_text ?? null,
        started_at: job.started_at,
        completed_at: job.completed_at,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching job:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
