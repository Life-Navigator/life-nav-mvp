/**
 * Scenario Lab - Individual Scenario Endpoint
 *
 * GET /api/scenario-lab/scenarios/[id] - Get scenario details
 * PATCH /api/scenario-lab/scenarios/[id] - Update scenario
 * DELETE /api/scenario-lab/scenarios/[id] - Delete scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/auth/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { updateScenarioSchema } from '@/lib/scenario-lab/validation';

export const dynamic = 'force-dynamic';

/**
 * GET - Get scenario with versions and latest results
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { id: scenarioId } = await params;

    // Fetch scenario
    const { data: scenario, error: scenarioError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('*')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Fetch versions
    const { data: versions, error: versionsError } = await (supabaseAdmin as any)
      .from('scenario_versions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('version_number', { ascending: false });

    if (versionsError) {
      console.error('[API] Error fetching versions:', versionsError);
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }

    // Fetch latest simulation results if exists
    let latestSimulation = null;
    if (scenario.current_version_id) {
      const { data: simData } = await (supabaseAdmin as any)
        .from('scenario_sim_runs')
        .select('*, scenario_goal_snapshots(*)')
        .eq('version_id', scenario.current_version_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      latestSimulation = simData;
    }

    return NextResponse.json({
      scenario,
      versions,
      latest_simulation: latestSimulation,
    });
  } catch (error) {
    console.error('[API] Error in GET /scenarios/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update scenario metadata
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { id: scenarioId } = await params;

    // Verify ownership
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id, status')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Prevent editing committed scenarios
    if (existing.status === 'committed') {
      return NextResponse.json({ error: 'Cannot edit committed scenario' }, { status: 400 });
    }

    // Parse and validate body
    const body = await request.json();
    const validation = updateScenarioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Update scenario
    const { data: scenario, error: updateError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scenarioId)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Error updating scenario:', updateError);
      return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.updated',
      resource_type: 'scenario',
      resource_id: scenarioId,
      changes: updates,
    });

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('[API] Error in PATCH /scenarios/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete scenario (cascade deletes versions, inputs, etc.)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.FEATURE_SCENARIO_LAB_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 });
    }

    const { id: scenarioId } = await params;

    // Verify ownership
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .select('id')
      .eq('id', scenarioId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Delete scenario (CASCADE will handle related records)
    const { error: deleteError } = await (supabaseAdmin as any)
      .from('scenario_labs')
      .delete()
      .eq('id', scenarioId);

    if (deleteError) {
      console.error('[API] Error deleting scenario:', deleteError);
      return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
    }

    // Audit log
    await createAuditLog({
      user_id: userId,
      action: 'scenario.deleted',
      resource_type: 'scenario',
      resource_id: scenarioId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error in DELETE /scenarios/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
