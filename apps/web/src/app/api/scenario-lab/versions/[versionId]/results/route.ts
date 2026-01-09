/**
 * Scenario Lab - Simulation Results Endpoint
 *
 * GET /api/scenario-lab/versions/[versionId]/results
 * Returns latest simulation results for a version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

/**
 * GET - Get latest simulation results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const versionId = params.versionId;

    // Verify version ownership
    const { data: version, error: versionError } = await supabaseAdmin
      .from('scenario_versions')
      .select('id, scenario_id')
      .eq('id', versionId)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Fetch latest simulation run
    const { data: simRun, error: simError } = await supabaseAdmin
      .from('scenario_sim_runs')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (simError || !simRun) {
      return NextResponse.json({
        message: 'No simulation results found for this version',
        has_results: false,
      });
    }

    // Fetch goal snapshots
    const { data: goalSnapshots, error: snapshotsError } = await supabaseAdmin
      .from('scenario_goal_snapshots')
      .select('*')
      .eq('sim_run_id', simRun.id)
      .order('created_at', { ascending: true });

    if (snapshotsError) {
      console.error('[API] Error fetching goal snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch goal snapshots' }, { status: 500 });
    }

    return NextResponse.json({
      has_results: true,
      simulation: simRun,
      goals: goalSnapshots,
    });
  } catch (error) {
    console.error('[API] Error in GET /versions/[versionId]/results:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
