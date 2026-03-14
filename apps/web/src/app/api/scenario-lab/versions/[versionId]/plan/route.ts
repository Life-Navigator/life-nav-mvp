/**
 * Scenario Lab - Plan Retrieval Endpoint
 *
 * GET /api/scenario-lab/versions/[versionId]/plan
 * Returns plan with phases and tasks for a committed version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin } from '@/lib/scenario-lab/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(
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

    // Fetch plan for this version
    const { data: plan, error: planError } = await (supabaseAdmin as any)
      .from('plans')
      .select('*')
      .eq('scenario_version_id', versionId)
      .single();

    if (planError || !plan) {
      // No plan exists (not committed yet)
      return NextResponse.json({
        has_plan: false,
        message: 'No plan exists for this version. Commit the scenario to generate a roadmap.',
      });
    }

    // Fetch phases
    const { data: phases, error: phasesError } = await (supabaseAdmin as any)
      .from('plan_phases')
      .select('*')
      .eq('plan_id', plan.id)
      .order('phase_number', { ascending: true });

    if (phasesError) {
      console.error('[API] Error fetching phases:', phasesError);
      return NextResponse.json({ error: 'Failed to fetch phases' }, { status: 500 });
    }

    // Fetch tasks
    const { data: tasks, error: tasksError } = await (supabaseAdmin as any)
      .from('plan_tasks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('task_number', { ascending: true });

    if (tasksError) {
      console.error('[API] Error fetching tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({
      has_plan: true,
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        status: plan.status,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      },
      phases: phases || [],
      tasks: tasks || [],
    });
  } catch (error) {
    console.error('[API] Error in GET /versions/[versionId]/plan:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
