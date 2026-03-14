/**
 * Scenario Lab - Simulation Endpoint
 *
 * POST /api/scenario-lab/versions/[versionId]/simulate
 * Enqueues a Monte Carlo simulation job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { enqueueJob } from '@/lib/scenario-lab/job-queue';
import { enforceRateLimit } from '@/lib/scenario-lab/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST - Enqueue simulation job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    // Rate limit check
    try {
      await enforceRateLimit(userId, 'simulation');
    } catch (rateLimitError: any) {
      return NextResponse.json({ error: rateLimitError.message }, { status: 429 });
    }

    const { versionId } = await params;

    // Verify version ownership
    const { data: version, error: versionError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('id, scenario_id')
      .eq('id', versionId)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Check if inputs exist
    const { data: inputs, error: inputsError } = await (supabaseAdmin as any)
      .from('scenario_inputs')
      .select('id')
      .eq('version_id', versionId)
      .limit(1);

    if (inputsError || !inputs || inputs.length === 0) {
      return NextResponse.json(
        { error: 'No inputs found for this version. Add inputs before simulating.' },
        { status: 400 }
      );
    }

    // Parse body for optional config
    const body = await request.json().catch(() => ({}));
    const iterations = body.iterations || 10000;
    const seed = body.seed || Date.now();

    // Enqueue simulation job
    const job = await enqueueJob({
      userId,
      scenarioId: version.scenario_id,
      jobType: 'SIMULATE',
      inputJson: {
        version_id: versionId,
        iterations,
        seed,
      },
      idempotencyKey: `simulate-${versionId}-${seed}`,
    });

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'simulation.enqueued',
      resource_type: 'scenario_version',
      resource_id: versionId,
      metadata: { job_id: job.id, iterations, seed },
    });

    return NextResponse.json(
      {
        job_id: job.id,
        status: job.status,
        message: 'Simulation job enqueued. Poll /api/scenario-lab/jobs/{job_id} for status.',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API] Error in POST /versions/[versionId]/simulate:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
